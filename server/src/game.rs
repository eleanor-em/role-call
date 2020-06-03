use futures::{StreamExt, SinkExt};
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::{accept_async, tungstenite::Error as WsError, tungstenite::Message, WebSocketStream};
use std::fmt::{Formatter, Display};

#[derive(Debug)]
pub enum GameError {
    Io(std::io::Error),
    WebSocket(WsError),
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

pub struct GameServer {
    ws: WebSocketStream<TcpStream>
}

impl GameServer {
    async fn new(stream: TcpStream) -> Result<Self, GameError> {
        let ws = accept_async(stream).await?;
        Ok(Self { ws })
    }

    async fn start(mut self) -> Result<(), GameError> {
        while let Some(result) = self.ws.next().await {
            let msg = result?;
            if msg.is_text() {
                println!("Receive: {}", msg);
                let response = Message::Text(format!("echo: {}", msg.into_text()?));
                self.ws.send(response).await?;
            }
        }
        Ok(())
    }
}

pub async fn ws_listen(port: u16) -> Result<(), GameError> {
    let mut listener = TcpListener::bind(format!("localhost:{}", port)).await?;
    while let Ok((stream, _)) = listener.accept().await {
        let server = GameServer::new(stream).await?;
        tokio::spawn(server.start());
    }
    Ok(())
}