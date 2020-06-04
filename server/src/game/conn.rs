use futures::{StreamExt, SinkExt};
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::{tungstenite::Message, accept_async, tungstenite::Error as WsError, WebSocketStream};
use std::fmt::{Formatter, Display};
use std::sync::Arc;
use futures::stream::SplitSink;
use crate::db::DbManager;
use crate::game::server::connect_to_server;
use std::hash::{Hash, Hasher};
use std::sync::mpsc::Receiver;

#[derive(Debug)]
pub enum GameError {
    Io(std::io::Error),
    WebSocket(WsError),
    Malformed,
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
        if let Some(Ok(user_token)) = ws.next().await {
            let user_token = user_token.into_text()?.trim().to_string();
            println!("WS: received user token: {}", user_token);
            if let Some(Ok(game_token)) = ws.next().await {
                let game_token = game_token.into_text()?.trim().to_string();
                println!("WS: received game token: {}", game_token);
                Ok(Self { ws, user_token, game_token })
            } else {
                eprintln!("WS: malformed game token");
                Err(GameError::Malformed)
            }
        } else {
            eprintln!("WS: malformed user token");
            Err(GameError::Malformed)
        }
    }

    async fn start(self, db: Arc<DbManager>) {
        match db.can_access_game(&self.user_token, &self.game_token).await {
            Ok(true) => {
                let (writer, mut reader) = self.ws.split();
                let (tx, rx) = std::sync::mpsc::sync_channel(100);
                std::thread::spawn(move || Self::forward_messages(writer, rx));

                let server = connect_to_server(self.user_token.clone(), self.game_token, tx);
                println!("WS: verified connection");
                while let Some(result) = reader.next().await {
                    match result {
                        Ok(result) => server.recv(&self.user_token, result).await,
                        Err(e) => eprintln!("WS: error running connection: {}", e),
                    }
                }
                server.close_client(self.user_token);
            },
            Ok(false) => {
                eprintln!("WS: failed game verification: user not in game");
            },
            Err(e) => {
                eprintln!("WS: failed game verification: {}", e);
            }
        }
    }

    fn forward_messages(mut writer: SplitSink<WebSocketStream<TcpStream>, Message>, rx: Receiver<String>) {
        while let Ok(msg) = rx.recv() {
            println!("WS: forwarding message {}", msg);
            if let Err(e) = futures::executor::block_on(writer.send(Message::Text(msg))) {
                eprintln!("WS: failed writing: {}", e);
            }
        }
        eprintln!("WS: receiver closed");
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

pub async fn ws_listen(db: Arc<DbManager>, port: u16) -> Result<(), GameError> {
    let mut listener = TcpListener::bind(format!("localhost:{}", port)).await?;
    println!("WS: Listening on port {}", port);
    while let Ok((stream, _)) = listener.accept().await {
        tokio::spawn(run_server(db.clone(), stream));
    }
    Ok(())
}

async fn run_server(db: Arc<DbManager>, stream: TcpStream) {
    match GameConnection::new(stream).await {
        Ok(conn) => conn.start(db).await,
        Err(e) => eprintln!("WS: failed to receive client: {}", e),
    }
}