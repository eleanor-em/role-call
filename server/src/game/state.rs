use crate::game::protocol::{ProtocolMessage, Token};
use crate::game::server::UserInfo;
use std::collections::HashMap;
use std::sync::mpsc::SyncSender;

// Can assume it is thread safe since it is stored in a mutex
pub struct GameState {
    host: UserInfo,
    tokens: HashMap<String, Token>,
    token_count: usize,
}

impl GameState {
    pub fn new(host: UserInfo) -> Self {
        Self {
            host,
            tokens: HashMap::new(),
            token_count: 0,
        }
    }

    pub fn process(&mut self, msg: &mut ProtocolMessage) -> bool {
        match msg {
            ProtocolMessage::PlaceToken(token) => {
                token.id = Some(format!("{}", self.token_count));
                // controller is automatically the host
                token.controller = Some(self.host.username.clone());

                if !self
                    .tokens
                    .values()
                    .any(|other| token.x == other.x && token.y == other.y)
                {
                    let token_id = token.id.clone().unwrap();
                    let token = (*token).clone();
                    self.tokens.insert(token_id, token);
                    true
                } else {
                    false
                }
            }
            ProtocolMessage::DeleteToken { token_id } => self.tokens.remove(token_id).is_some(),
            ProtocolMessage::SetController {
                token_id,
                new_controller,
            } => {
                if let Some(token) = self.tokens.get_mut(token_id) {
                    token.controller = Some(new_controller.clone());
                    true
                } else {
                    false
                }
            }
            ProtocolMessage::Movement {
                token_id, dx, dy, ..
            } => {
                if let Some(token) = self.tokens.get_mut(token_id) {
                    token.x += *dx;
                    token.y += *dy;
                    true
                } else {
                    false
                }
            }
            _ => true,
        }
    }

    pub fn get_owner(&self, token_id: &str) -> Option<String> {
        self.tokens
            .get(token_id)
            .and_then(|token| token.controller.clone())
    }

    pub fn replay(&self, tx: SyncSender<String>) {
        self.tokens.values().for_each(|token| {
            if let Err(e) = tx.send(token.to_msg().to_string()) {
                warn!("STATE: error forwarding token: {}", e)
            }
        });
    }
}
