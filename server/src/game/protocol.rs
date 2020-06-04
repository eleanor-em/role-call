use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub enum ProtocolMessage {
    PlaceToken { x: i16, y: i16 },
}

#[derive(Debug, Serialize, Deserialize)]
struct PlaceTokenMessage {
    kind: String,
    x: i16,
    y: i16,
}