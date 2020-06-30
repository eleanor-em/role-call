use std::error::Error;
use std::sync::Arc;
use std::{env, fs, thread};

use dotenv::dotenv;

use rolecall::config::CONFIG;
use rolecall::db::DbManager;
use rolecall::game;
use rolecall::web::Api;

#[tokio::main]
async fn main() {
    dotenv().expect("MAIN: failed loading config");
    create_upload_dir().unwrap();

    let db = create_db().await.expect("MAIN: failed loading database");
    let api = Api::new(db.clone()).expect("MAIN: failed starting web server");
    thread::spawn(move || api.start());
    game::conn::ws_listen(db, &CONFIG.listen_addr)
        .await
        .expect("MAIN: failed starting websocket server");
}

async fn create_db() -> Result<Arc<DbManager>, Box<dyn Error>> {
    let db = DbManager::new().await?;
    db.clear_tables().await?;
    db.create_tables().await?;

    Ok(Arc::new(db))
}

fn create_upload_dir() -> Result<(), Box<dyn Error>> {
    // check the directory doesn't exist
    let mut path = env::current_dir()?;
    path.push(&CONFIG.upload_dir);
    if let Ok(metadata) = fs::metadata(&path) {
        if metadata.is_dir() {
            return Ok(());
        } else {
            panic!("non-directory taking place of upload directory");
        }
    }

    fs::create_dir(&path)?;
    log::info!("creating upload directory: {:?}", path.to_str());
    Ok(())
}
