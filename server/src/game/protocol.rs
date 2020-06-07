use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
// TODO: refactor PlaceToken to have a Token
pub enum ProtocolMessage {
    PlaceToken { kind: String, x: i16, y: i16, colour: String, },
    Connect { username: String, host: bool },
    Disconnect { username: String },
    FailedConnection { reason: String },
}

impl ProtocolMessage {
    pub(crate) fn to_string(&self) -> String {
        // Should never panic
        serde_json::to_string(&self).unwrap()
    }
    pub(crate) fn into_msg(self) -> RawMessage {
        RawMessage::Text(self.to_string())
    }
}

type RawMessage = tokio_tungstenite::tungstenite::Message;

impl Into<RawMessage> for ProtocolMessage {
    fn into(self) -> RawMessage {
        self.into_msg()
    }
}

#[derive(Debug)]
pub struct Token {
    pub kind: String,
    pub x: i16,
    pub y: i16,
    pub colour: String,
}

impl Token {
    pub fn to_msg(&self) -> ProtocolMessage {
        ProtocolMessage::PlaceToken {
            kind: self.kind.clone(),
            x: self.x,
            y: self.y,
            colour: self.colour.clone(),
        }
    }
}