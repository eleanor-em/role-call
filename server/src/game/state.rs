use crate::game::protocol::{ProtocolMessage, Token};
use std::sync::mpsc::SyncSender;

pub struct GameState {
    tokens: Vec<Token>,
}

impl GameState {
    pub fn new() -> Self {
        Self { tokens: Vec::new() }
    }

    pub fn process(&mut self, msg: ProtocolMessage) -> bool {
        match msg {
            ProtocolMessage::PlaceToken(token) => {
                if !self.tokens.iter()
                        .any(|other| token.x == other.x && token.y == other.y) {
                    self.tokens.push(token);
                    true
                } else {
                    false
                }
            },
            _ => true,
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