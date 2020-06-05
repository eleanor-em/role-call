use std::sync::Arc;
use std::sync::Mutex;
use std::collections::HashMap;

use tokio_tungstenite::tungstenite::Message;
use crate::game::protocol::ProtocolMessage;
use std::sync::mpsc::SyncSender;
use std::hash::{Hash, Hasher};
use crate::game::state::GameState;
use tokio::time::{Instant, Duration};

lazy_static! {
    static ref SERVERS: Mutex<HashMap<String, Arc<Server>>> = {
        tokio::spawn(server_monitor());
        Mutex::new(HashMap::new())
    };
}

async fn server_monitor() {
    const TIMEOUT: Duration = Duration::from_secs(1 * 60);
    loop {
        tokio::time::delay_for(Duration::from_secs(5 * 60)).await;
        let mut servers = SERVERS.lock().unwrap();
        let mut to_kill = Vec::new();

        for (game_token, server) in servers.iter() {
            // Option is stored to allow easy replace; should never be empty
            let keepalive = server.keepalive.lock().unwrap().unwrap();
            let num_clients = server.clients.pin().len();

            if num_clients == 0 && keepalive.elapsed() > TIMEOUT {
                println!("SERVER: killing game server {}", game_token);
                to_kill.push(game_token.clone());
            }
        }

        for token in to_kill.into_iter() {
            servers.remove(&token);
        }
    }
}

#[derive(Clone, Debug, PartialOrd, PartialEq, Ord, Eq)]
pub struct UserInfo {
    pub token: String,
    pub username: String,
    pub is_host: bool,
}

impl Hash for UserInfo {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.username.hash(state);
    }
}

pub struct Server {
    game_token: String,
    clients: flurry::HashMap<UserInfo, SyncSender<String>>,
    keepalive: Mutex<Option<Instant>>,
    state: Mutex<GameState>,
}

impl Server {
    fn new(game_token: String) -> Self {
        let clients = flurry::HashMap::new();
        let state = Mutex::new(GameState::new());
        let keepalive = Mutex::new(Some(Instant::now()));
        Self { game_token, clients, state, keepalive }
    }

    async fn add_client(&self, user: UserInfo, tx: SyncSender<String>) {
        // Send existing client info
        let clients = self.clients.pin();
        clients.keys().for_each(|user| {
            if let Err(e) = tx.send(ProtocolMessage::Connect {
                username: user.username.clone(),
                host: user.is_host,
            }.to_string()) {
                eprintln!("SERVER: failed sending users: {}", e);
            }
        });
        // Send existing state info
        {
            let state = self.state.lock().unwrap();
            state.replay(tx.clone());
        }

        clients.insert(user.clone(), tx);
        println!("SERVER: New client for game {}: {}", self.game_token, user.token);
        self.recv(ProtocolMessage::Connect {
            username: user.username,
            host: user.is_host,
        }.into()).await;
    }

    pub fn close_client(&self, user: UserInfo) {
        let clients = self.clients.pin();
        clients.remove(&user);
        if clients.len() == 0 {
            let mut keepalive = self.keepalive.lock().unwrap();
            keepalive.replace(Instant::now());
        }
    }

    pub async fn recv(&self, msg: Message) {
        if let Ok(text) = msg.to_text() {
            if let Ok(parsed) = serde_json::from_str::<ProtocolMessage>(&text) {
                {
                    let mut state = self.state.lock().unwrap();
                    state.process(parsed);
                }

                println!("SERVER: sending: {}", text);
                let clients = self.clients.pin();
                for tx in clients.values() {
                    if let Err(e) = tx.send(text.to_string()) {
                        eprintln!("SERVER: failed writing: {}", e);
                    }
                }
            } else {
                eprintln!("SERVER: malformed message: {}", text);
            }
        } else {
            match msg {
                Message::Close(_) => println!("SERVER: Client closed"),
                _ => eprintln!("SERVER: invalid message type"),
            }
        }
    }
}

pub fn connect_to_server(user: UserInfo, game_token: String, tx: SyncSender<String>) -> Arc<Server> {
    let mut servers = SERVERS.lock().unwrap();
    let server = servers.entry(game_token.clone())
        .or_insert_with(|| {
            println!("SERVER: Create server for game {}", game_token);
            Arc::new(Server::new(game_token))
        });
    futures::executor::block_on(server.add_client(user, tx));
    Arc::clone(server)
}