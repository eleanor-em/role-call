use std::fmt::{Display, Formatter};
use std::hash::{Hash, Hasher};
use std::sync::mpsc::Receiver;
use std::sync::Arc;

use futures::stream::SplitSink;
use futures::{SinkExt, StreamExt};

use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::{
    accept_async, tungstenite::Error as WsError, tungstenite::Message, WebSocketStream,
};

use crate::db::{DbManager, GamePermission};
use crate::game::protocol::ProtocolMessage;
use crate::game::server::{connect_to_server, UserInfo};

#[derive(Debug)]
pub enum GameError {
    Io(std::io::Error),
    WebSocket(WsError),
    Malformed,
    AlreadyConnected,
}

impl From<tokio::io::Error> for GameError {
    fn from(e: tokio::io::Error) -> Self {
        Self::Io(e)
    }
}

impl From<WsError> for GameError {
    fn from(e: WsError) -> Self {
        Self::WebSocket(e)
    }
}

impl Display for GameError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}

impl std::error::Error for GameError {}

pub struct GameConnection {
    ws: WebSocketStream<TcpStream>,
    user_token: String,
    game_token: String,
}

impl GameConnection {
    async fn new(stream: TcpStream) -> Result<Self, GameError> {
        let mut ws = accept_async(stream).await?;

        // Check that the first two messages received are the user and game token
        if let Some(Ok(user_token)) = ws.next().await {
            let user_token = user_token.into_text()?.trim().to_string();
            info!("received user token: {}", user_token);
            if let Some(Ok(game_token)) = ws.next().await {
                let game_token = game_token.into_text()?.trim().to_string();
                info!("received game token: {}", game_token);
                Ok(Self {
                    ws,
                    user_token,
                    game_token,
                })
            } else {
                warn!("malformed game token");
                Err(GameError::Malformed)
            }
        } else {
            warn!("malformed user token");
            Err(GameError::Malformed)
        }
    }

    async fn start(mut self, db: Arc<DbManager>) {
        match db
            .check_game_permissions(&self.user_token, &self.game_token)
            .await
        {
            Ok(GamePermission::None) => {
                warn!("failed game verification: user not in game");
            }
            Err(e) => {
                warn!("failed game verification: {}", e);
                if let Err(e) = self
                    .ws
                    .send(
                        ProtocolMessage::FailedConnection {
                            reason: "could not find game".to_string(),
                        }
                        .into_msg(),
                    )
                    .await
                {
                    warn!("failed to send error to client: {}", e);
                }
            }
            Ok(perm) => {
                // Load user information
                match db.get_account(&self.user_token).await {
                    Ok((id, username)) => {
                        let user = UserInfo {
                            token: self.user_token,
                            username,
                            id,
                            is_host: perm == GamePermission::Host,
                        };
                        let (tx, rx) = std::sync::mpsc::sync_channel(100);
                        if let Ok(server) = connect_to_server(user.clone(), self.game_token, tx) {
                            // Create communication channels and spawn handlers
                            let (writer, mut reader) = self.ws.split();
                            std::thread::spawn(move || Self::forward_messages(writer, rx));

                            // Forward received data to the server
                            info!("verified connection");
                            while let Some(result) = reader.next().await {
                                match result {
                                    Ok(result) => server.recv(result, user.clone()).await,
                                    Err(e) => warn!("error running connection: {}", e),
                                }
                            }
                            server.close_client(user);
                        } else {
                            warn!("user already connected");
                            if let Err(e) = self
                                .ws
                                .send(
                                    ProtocolMessage::FailedConnection {
                                        reason: "user already connected".to_string(),
                                    }
                                    .into_msg(),
                                )
                                .await
                            {
                                warn!("failed to send error to client: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        warn!("error retrieving account information: {}", e);
                    }
                }
            }
        }
    }

    fn forward_messages(
        mut writer: SplitSink<WebSocketStream<TcpStream>, Message>,
        rx: Receiver<String>,
    ) {
        // Listen to the receiver and forward any received messages to the websocket
        while let Ok(msg) = rx.recv() {
            if let Err(e) = futures::executor::block_on(writer.send(Message::Text(msg))) {
                warn!("failed writing: {}", e);
            }
        }
        warn!("receiver closed");
    }

    pub fn get_user(&self) -> String {
        self.user_token.clone()
    }

    pub fn get_game(&self) -> String {
        self.game_token.clone()
    }
}

impl Hash for GameConnection {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.game_token.hash(state);
        self.user_token.hash(state);
    }
}

pub async fn ws_listen(db: Arc<DbManager>, addr: &str) -> Result<(), GameError> {
    // info!("Websocket server starting up...");
    let mut listener = TcpListener::bind(addr).await?;
    info!("Listening at: {}", addr);
    while let Ok((stream, _)) = listener.accept().await {
        info!("Received connection from {}", stream.peer_addr()?);
        tokio::spawn(run_server(db.clone(), stream));
    }
    Ok(())
}

async fn run_server(db: Arc<DbManager>, stream: TcpStream) {
    match GameConnection::new(stream).await {
        Ok(conn) => conn.start(db).await,
        Err(e) => warn!("failed to receive client: {}", e),
    }
}
