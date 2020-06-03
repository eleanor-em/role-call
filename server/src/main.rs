use std::error::Error;
use std::sync::Arc;

use dotenv::dotenv;

use rolecall::db::DbManager;
use rolecall::api::Api;

#[tokio::main]
async fn main() {
    dotenv().unwrap();

    let db = create_db().await.unwrap();
    let api = Api::new(db.clone()).unwrap();
    api.start();
}

async fn create_db() -> Result<Arc<DbManager>, Box<dyn Error>> {
    let db = DbManager::new().await?;
    db.clear_tables().await?;
    db.create_tables().await?;

    Ok(Arc::new(db))
}