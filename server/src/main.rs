use std::error::Error;
use std::sync::Arc;

use dotenv::dotenv;

use rolecall::db::DbManager;
use rolecall::web::Api;
use std::thread;
use rolecall::game;

#[tokio::main]
async fn main() {
    dotenv().expect("MAIN: failed loading config");

    let db = create_db().await.expect("MAIN: failed loading database");
    let api = Api::new(db.clone()).expect("MAIN: failed starting web server");
    thread::spawn(move || api.start());
    game::conn::ws_listen(db, 9000).await.expect("MAIN: failed starting websocket server");
}

async fn create_db() -> Result<Arc<DbManager>, Box<dyn Error>> {
    let db = DbManager::new().await?;
    db.clear_tables().await?;
    db.create_tables().await?;

    Ok(Arc::new(db))
}
