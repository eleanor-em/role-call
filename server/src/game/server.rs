use std::sync::Arc;
use std::sync::Mutex;
use std::collections::HashMap;

use tokio_tungstenite::tungstenite::Message;
use crate::game::protocol::ProtocolMessage;
use std::sync::mpsc::SyncSender;

lazy_static! {
    static ref SERVERS: Mutex<HashMap<String, Arc<Server>>> = {
        Mutex::new(HashMap::new())
    };
}

pub struct Server {
    game_token: String,
    clients: flurry::HashMap<String, SyncSender<String>>,
}

impl Server {
    fn new(game_token: String) -> Self {
        let clients = flurry::HashMap::new();
        Self { game_token, clients }
    }

    fn add_client(&self, user_token: String, tx: SyncSender<String>) {
        self.clients.pin().insert(user_token.clone(), tx);
        println!("SERVER: New client for game {}: {}", self.game_token, user_token);
    }

    pub fn close_client(&self, user_token: String) {
        let new_count = {
            self.clients.pin().remove(&user_token);
            self.clients.len()
        };
        if new_count == 0 {
            let mut servers = SERVERS.lock().unwrap();
            servers.remove(&self.game_token);
            println!("SERVER: Close server for game {}", self.game_token);
        }
    }

    pub async fn recv(&self, sender: &str, msg: Message) {
        if let Ok(text) = msg.to_text() {
            if let Ok(parsed) = serde_json::from_str::<ProtocolMessage>(&text) {
                println!("SERVER: received from {}: {:?}", sender, parsed);
                let clients = self.clients.pin();
                for (dest, tx) in clients.iter() {
                    println!("SERVER: sending {} to {}", text, dest);
                    if let Err(e) = tx.send(text.to_string()) {
                        eprintln!("SERVER: failed writing to {}: {}", dest, e);
                    }
                }
            } else {
                eprintln!("SERVER: malformed message from {}: {}", sender, text);
            }
        } else {
            match msg {
                Message::Close(_) => println!("SERVER: Client closed: {}", sender),
                _ => eprintln!("SERVER: invalid message type from {}", sender),
            }
        }
    }
}

pub fn connect_to_server(user_token: String, game_token: String, tx: SyncSender<String>) -> Arc<Server> {
    let mut servers = SERVERS.lock().unwrap();
    let server = servers.entry(game_token.clone())
        .or_insert_with(|| {
            println!("SERVER: Create server for game {}", game_token);
            Arc::new(Server::new(game_token))
        });
    server.add_client(user_token, tx);
    Arc::clone(server)
}