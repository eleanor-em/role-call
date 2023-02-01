use simple_logger::SimpleLogger;
use std::env;
use std::fmt::Write;
use tokio::time::Duration;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RunMode {
    Debug,
    Release,
}

pub struct Config {
    pub user_token_timeout: Duration,
    pub game_timeout: Duration,
    pub monitor_interval: Duration,
    pub pepper: String,
    pub mode: RunMode,
    pub db_addr: String,
    pub db_user: String,
    pub db_password: String,
    pub db_name: String,
    pub listen_addr: String,
    pub upload_dir: String,
    pub max_upload_mb: u64,
}

fn load_config() -> Config {
    dotenv::dotenv().unwrap();
    let pepper = env::var("RC_PEPPER").unwrap_or_else(|_| {
        info!("CONFIG: warning: generating random pepper");
        let bytes = argonautica::utils::generate_random_bytes(32)
            .expect("CONFIG: Failed to generate pepper");
        let mut s = String::new();
        for byte in bytes {
            write!(&mut s, "{:X}", byte).unwrap();
        }
        s
    });
    let user_token_timeout = Duration::from_secs(
        env::var("RC_SESSION_TIMEOUT")
            .unwrap_or("86400".to_string())
            .parse()
            .expect("CONFIG: failed to parse session timeout"),
    );
    let game_timeout = Duration::from_secs(
        env::var("RC_GAME_TIMEOUT")
            .unwrap_or("1800".to_string())
            .parse()
            .expect("CONFIG: failed to parse game timeout"),
    );
    let monitor_interval = Duration::from_secs(
        env::var("RC_MONITOR_INTERVAL")
            .unwrap_or("300".to_string())
            .parse()
            .expect("CONFIG: failed to parse monitor interval"),
    );
    let mode = if env::var("RC_MODE").unwrap_or("release".to_string()) == "debug" {
        RunMode::Debug
    } else {
        RunMode::Release
    };

    SimpleLogger::new()
        .with_utc_timestamps() // see https://github.com/borntyping/rust-simple_logger/issues/52
        .with_level(
            env::var("RC_LOG_LEVEL")
                .ok()
                .and_then(|level| level.parse().ok())
                .unwrap_or(log::LevelFilter::Info),
        )
        .init()
        .expect("CONFIG: failed to initialise logger");

    let db_addr = env::var("RC_DB_ADDRESS").unwrap_or("localhost".to_string());
    let db_user = env::var("RC_DB_USER").unwrap_or("postgres".to_string());
    let db_password = env::var("RC_DB_PASSWORD").unwrap_or("password".to_string());
    let db_name = env::var("RC_DB_NAME").unwrap_or("rolecall".to_string());
    let listen_addr = env::var("RC_WEBSOCKET_ADDR").unwrap_or("0.0.0.0:9000".to_string());
    let upload_dir = env::var("RC_UPLOAD_PATH").unwrap_or("upload".to_string());
    let max_upload_mb = env::var("RC_MAX_UPLOAD_MB")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(20)
        * 1024
        * 1024;

    Config {
        user_token_timeout,
        game_timeout,
        monitor_interval,
        pepper,
        mode,
        db_addr,
        db_user,
        db_password,
        db_name,
        listen_addr,
        upload_dir,
        max_upload_mb,
    }
}

lazy_static! {
    pub static ref CONFIG: Config = load_config();
}
