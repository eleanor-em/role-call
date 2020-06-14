use crate::game::protocol::{ProtocolMessage, Token};
use std::sync::mpsc::SyncSender;
use crate::game::server::UserInfo;

pub struct GameState {
    host: UserInfo,
    tokens: Vec<Token>,
}

impl GameState {
    pub fn new(host: UserInfo) -> Self {
        Self { host, tokens: Vec::new() }
    }

    pub fn process(&mut self, msg: &mut ProtocolMessage) -> bool {
        match msg {
            ProtocolMessage::PlaceToken(token) => {
                // controller is automatically the host
                token.controller = Some(self.host.username.clone());

                if !self.tokens.iter()
                        .any(|other| token.x == other.x && token.y == other.y) {
                    let token = (*token).clone();
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