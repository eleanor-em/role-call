use crate::game::protocol::{ProtocolMessage, Token};
use std::sync::mpsc::SyncSender;

pub struct GameState {
    tokens: Vec<Token>,
}

impl GameState {
    pub fn new() -> Self {
        Self { tokens: Vec::new() }
    }

    pub fn process(&mut self, msg: ProtocolMessage) {
        match msg {
            ProtocolMessage::PlaceToken { kind, x, y, colour } => {
                self.tokens.push(Token { kind, x, y, colour });
            },
            _ => {},
        }
    }

    pub fn replay(&self, tx: SyncSender<String>) {
        self.tokens.iter().for_each(|token| {
            if let Err(e) = tx.send(token.to_msg().to_string()) {
                warn!("STATE: error forwarding token: {}", e)
            }
        });
    }
}