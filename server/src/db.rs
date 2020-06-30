use crate::config::*;
use argonautica::{Hasher, Verifier};
use futures::future;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter, Write};
use std::sync::Arc;
use std::time::SystemTime;
use tokio_postgres::{Client, NoTls};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Game {
    token: String,
    name: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Map {
    id: i32,
    name: String,
}

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum GamePermission {
    Host,
    Player,
    None,
}

#[derive(Debug)]
pub enum DbError {
    Sql(tokio_postgres::Error),
    Hash(argonautica::Error),
    Time(std::time::SystemTimeError),
    Config(std::env::VarError),
    ConfigParse,
    Auth,
    AlreadyExists,
}

impl From<tokio_postgres::Error> for DbError {
    fn from(e: tokio_postgres::Error) -> Self {
        Self::Sql(e)
    }
}

impl From<argonautica::Error> for DbError {
    fn from(e: argonautica::Error) -> Self {
        Self::Hash(e)
    }
}

impl From<std::time::SystemTimeError> for DbError {
    fn from(e: std::time::SystemTimeError) -> Self {
        Self::Time(e)
    }
}

impl From<std::env::VarError> for DbError {
    fn from(e: std::env::VarError) -> Self {
        Self::Config(e)
    }
}

impl From<std::num::ParseIntError> for DbError {
    fn from(_: std::num::ParseIntError) -> Self {
        Self::ConfigParse
    }
}

impl Display for DbError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}

impl std::error::Error for DbError {}

pub struct DbManager {
    client: Arc<Client>,
}

pub type UserId = i32;
pub type Timestamp = i64;
pub type GameId = i32;

impl DbManager {
    pub async fn new() -> Result<Self, DbError> {
        let (client, conn) = tokio_postgres::Config::new()
            .host(&CONFIG.db_addr)
            .user(&CONFIG.db_user)
            .password(&CONFIG.db_password)
            .dbname(&CONFIG.db_name)
            .connect(NoTls)
            .await?;

        tokio::spawn(async move {
            if let Err(e) = conn.await {
                warn!("database connection error: {}", e);
            }
        });

        let client = Arc::new(client);
        let db = Self { client };
        Ok(db)
    }

    fn timestamp() -> Result<Timestamp, DbError> {
        Ok(SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_millis() as Timestamp)
    }

    fn create_user_token(&self) -> Result<(String, Timestamp), DbError> {
        let token = argonautica::utils::generate_random_base64_encoded_string(32)?;
        let timestamp = Self::timestamp()?;
        // Add 1 day to the timeout
        Ok((
            token,
            timestamp + CONFIG.user_token_timeout.as_millis() as Timestamp,
        ))
    }

    fn create_user_tag() -> String {
        let mut rng = rand::thread_rng();
        let tag = rng.gen_range(0, 10000);
        format!("{:04}", tag)
    }

    fn create_game_token() -> Result<String, DbError> {
        let bytes = argonautica::utils::generate_random_bytes(8)?;
        let mut s = String::new();
        for byte in bytes {
            write!(&mut s, "{:X}", byte).unwrap();
        }

        Ok(s.to_lowercase())
    }

    pub async fn clear_tables(&self) -> Result<(), DbError> {
        self.client
            .execute(
                "
            DROP TABLE IF EXISTS
            user_accounts, identities, unconfirmed_identities, games, user_games, maps
            CASCADE;",
                &[],
            )
            .await?;
        Ok(())
    }

    pub async fn create_tables(&self) -> Result<(), DbError> {
        future::try_join3(
            self.client.execute(
                "
                CREATE TABLE IF NOT EXISTS user_accounts(
                    id          serial PRIMARY KEY,
                    email       text UNIQUE NOT NULL,
                    token       text NOT NULL,
                    nickname    text NOT NULL,
                    tag         text NOT NULL,
                    CONSTRAINT unique_user_name UNIQUE(nickname, tag),
                    timeout     bigint NOT NULL
                );",
                &[],
            ),
            self.client.execute(
                "
                CREATE TABLE IF NOT EXISTS identities(
                    id      serial PRIMARY KEY,
                    email   text UNIQUE NOT NULL,
                    pw_hash text NOT NULL,
                    user_id integer NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES user_accounts(id) ON DELETE CASCADE
                );",
                &[],
            ),
            self.client.execute(
                "
                CREATE TABLE IF NOT EXISTS unconfirmed_identities(
                    id          serial PRIMARY KEY,
                    email       text UNIQUE NOT NULL,
                    pw_hash     text NOT NULL,
                    nickname    text NOT NULL,
                    token       text NOT NULL
                );",
                &[],
            ),
        )
        .await?;

        future::try_join3(
            self.client.execute(
                "
                CREATE TABLE IF NOT EXISTS games(
                    id      serial PRIMARY KEY,
                    host    integer NOT NULL,
                    token   text UNIQUE NOT NULL,
                    name    text NOT NULL,
                    FOREIGN KEY (host) REFERENCES user_accounts(id) ON DELETE CASCADE
                );",
                &[],
            ),
            self.client.execute(
                "
                CREATE TABLE IF NOT EXISTS user_games(
                    user_id integer NOT NULL,
                    game_id integer NOT NULL,
                    PRIMARY KEY (user_id, game_id),
                    FOREIGN KEY (user_id) REFERENCES user_accounts(id)   ON DELETE CASCADE,
                    FOREIGN KEY (game_id) REFERENCES games(id)           ON DELETE CASCADE
                );",
                &[],
            ),
            self.client.execute(
                "
                CREATE TABLE IF NOT EXISTS maps(
                    id      serial PRIMARY KEY,
                    owner   integer NOT NULL,
                    name    text NOT NULL,
                    UNIQUE (owner, name),
                    path    text NOT NULL,
                    FOREIGN KEY (owner) REFERENCES user_accounts(id) ON DELETE CASCADE
                );",
                &[],
            ),
        )
        .await?;

        // for debug, create test users
        if CONFIG.mode == RunMode::Debug {
            let token = self
                .create_user("admin", "password", "admin")
                .await
                .unwrap();
            let admin_token = self.confirm_user("admin", &token).await.unwrap();
            let token = self
                .create_user("player", "password", "player")
                .await
                .unwrap();
            let player_token = self.confirm_user("player", &token).await.unwrap();
            let game_token = self.create_game(&admin_token, &"Test Game").await.unwrap();
            self.join_game(&player_token, &game_token).await.unwrap();
            info!("DEBUG: admin token: {}", admin_token);
            info!("DEBUG: player token: {}", player_token);
        }

        Ok(())
    }

    pub async fn create_user(
        &self,
        email: &str,
        password: &str,
        nickname: &str,
    ) -> Result<String, DbError> {
        let (token, _) = self.create_user_token()?;
        let mut hasher = Hasher::default();
        let pw_hash = hasher
            .with_password(password)
            .with_secret_key(&CONFIG.pepper)
            .hash()?;

        // Create new unconfirmed user
        let statement = "
            INSERT INTO unconfirmed_identities(email, pw_hash, token, nickname)
            VALUES($1, $2, $3, $4);";
        self.client
            .execute(statement, &[&email, &pw_hash, &token, &nickname])
            .await?;
        info!("created new unverified user: {}", email);

        Ok(token)
    }

    async fn remove_unconfirmed(
        &self,
        email: &str,
        token: &str,
    ) -> Result<(String, String), DbError> {
        let statement = "
            DELETE FROM unconfirmed_identities
            WHERE email=$1 AND token=$2
            RETURNING pw_hash, nickname;";
        let rows = self.client.query(statement, &[&email, &token]).await?;
        if rows.len() > 0 {
            let row = rows.get(0).ok_or(DbError::Auth)?;
            Ok((row.get(0), row.get(1)))
        } else {
            Err(DbError::Auth)
        }
    }

    pub async fn confirm_user(&self, email: &str, token: &str) -> Result<String, DbError> {
        let (pw_hash, nickname) = self.remove_unconfirmed(email, token).await?;
        let tag = Self::create_user_tag();

        let (token, timeout) = self.create_user_token()?;
        let statement = "
            INSERT INTO user_accounts(email, token, timeout, nickname, tag)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING (id);";
        let row = self
            .client
            .query_one(statement, &[&email, &token, &timeout, &nickname, &tag])
            .await?;
        let user_id: i32 = row.get(0);
        info!("generated new token for user #{}", user_id);

        let statement = "
            INSERT INTO identities(email, pw_hash, user_id)
            VALUES($1, $2, $3);";
        self.client
            .execute(statement, &[&email, &pw_hash, &user_id])
            .await?;
        info!("verified user id #{}: {}", user_id, email);
        Ok(token)
    }

    async fn get_identities(&self, email: &str) -> Result<(UserId, String), DbError> {
        let statement = "
            SELECT user_id, pw_hash
            FROM identities
            WHERE email=$1;";
        let rows = self.client.query(statement, &[&email]).await?;
        if rows.len() > 0 {
            let record = rows.get(0).ok_or(DbError::Auth)?;
            let user_id: UserId = record.get(0);
            let pw_hash: &str = record.get(1);
            Ok((user_id, pw_hash.to_string()))
        } else {
            Err(DbError::Auth)
        }
    }

    pub async fn auth_user(
        &self,
        email: &str,
        password: &str,
    ) -> Result<(String, String), DbError> {
        let (user_id, pw_hash) = self.get_identities(email).await?;
        let mut verifier = Verifier::default();
        if verifier
            .with_hash(pw_hash)
            .with_password(password)
            .with_secret_key(&CONFIG.pepper)
            .verify()?
        {
            let (token, timeout) = self.create_user_token()?;
            info!("generated new token for user #{}", user_id);

            let statement = "
                UPDATE user_accounts
                SET token=$2, timeout=$3
                WHERE id=$1
                RETURNING nickname, tag;";
            let rows = self
                .client
                .query(statement, &[&user_id, &token, &timeout])
                .await?;
            let row = rows.get(0).ok_or(DbError::Auth)?;
            let nickname: String = row.get(0);
            let tag: String = row.get(1);
            let username = format!("{}#{}", nickname, tag);
            Ok((token, username))
        } else {
            Err(DbError::Auth)
        }
    }

    pub async fn get_account(&self, token: &str) -> Result<(UserId, String), DbError> {
        let statement = "
            SELECT id, timeout, nickname, tag
            FROM user_accounts
            WHERE token=$1;";
        let rows = self.client.query(statement, &[&token]).await?;
        if rows.len() > 0 {
            let record = rows.get(0).ok_or(DbError::Auth)?;
            let user_id: UserId = record.get(0);
            let timeout: Timestamp = record.get(1);
            let nickname: String = record.get(2);
            let tag: String = record.get(3);
            let username = format!("{}#{}", nickname, tag);
            if Self::timestamp()? < timeout {
                Ok((user_id, username))
            } else {
                Err(DbError::Auth)
            }
        } else {
            Err(DbError::Auth)
        }
    }

    pub async fn create_game(&self, user_token: &str, name: &str) -> Result<String, DbError> {
        let (user_id, username) = self.get_account(user_token).await?;
        let game_token = Self::create_game_token()?;

        let statement = "
            INSERT INTO games (host, token, name)
            VALUES ($1, $2, $3)
            RETURNING id;";
        let row = self
            .client
            .query_one(statement, &[&user_id, &game_token, &name])
            .await?;
        let game_id: i32 = row.get(0);

        let statement = "
            INSERT INTO user_games (user_id, game_id)
            VALUES ($1, $2);";
        self.client
            .execute(statement, &[&user_id, &game_id])
            .await?;

        info!(
            "created game {} ({}) for user #{} ({})",
            game_token, name, user_id, username
        );
        Ok(game_token)
    }

    async fn get_game(&self, game_token: &str) -> Result<GameId, DbError> {
        let statement = "
            SELECT id
            FROM games
            WHERE token=$1;";
        let rows = self.client.query(statement, &[&game_token]).await?;
        if rows.len() > 0 {
            let game_id: GameId = rows.get(0).ok_or(DbError::Auth)?.get(0);
            Ok(game_id)
        } else {
            Err(DbError::Auth)
        }
    }

    pub async fn join_game(&self, user_token: &str, game_token: &str) -> Result<(), DbError> {
        let (user_id, username) = self.get_account(user_token).await?;
        let game_id = self.get_game(game_token).await?;
        let statement = "
            INSERT INTO user_games(user_id, game_id)
            VALUES ($1, $2)";
        self.client
            .execute(statement, &[&user_id, &game_id])
            .await?;
        info!(
            "user #{} ({}) joined game {}",
            user_id, username, game_token
        );
        Ok(())
    }

    pub async fn get_hosted_games(&self, user_token: &str) -> Result<Vec<Game>, DbError> {
        let (user_id, _) = self.get_account(user_token).await?;
        let statement = "
            SELECT token, name
            FROM games
            WHERE host=$1;";
        let rows = self.client.query(statement, &[&user_id]).await?;
        Ok(rows
            .into_iter()
            .map(|row| Game {
                token: row.get(0),
                name: row.get(1),
            })
            .collect())
    }

    pub async fn get_joined_games(&self, user_token: &str) -> Result<Vec<Game>, DbError> {
        let (user_id, _) = self.get_account(user_token).await?;
        let statement = "
            SELECT games.token, games.name
            FROM games
            INNER JOIN user_games
                ON user_games.user_id=$1
                    AND games.id=user_games.game_id;";
        let rows = self.client.query(statement, &[&user_id]).await?;
        Ok(rows
            .into_iter()
            .map(|row| Game {
                token: row.get(0),
                name: row.get(1),
            })
            .collect())
    }

    pub async fn create_map(
        &self,
        user_token: &str,
        name: &str,
        path: &str,
    ) -> Result<(), DbError> {
        let (user_id, username) = self.get_account(user_token).await?;
        let statement = "
            INSERT INTO maps (owner, name, path)
            VALUES ($1, $2, $3);";

        // TODO: Convert data to png

        match self
            .client
            .execute(statement, &[&user_id, &name, &path])
            .await
        {
            Ok(_) => {
                info!("added map \"{}\" to user #{} ({})", name, user_id, username);
                Ok(())
            }
            Err(_) => {
                // Assume name already exists
                Err(DbError::AlreadyExists)
            }
        }
    }

    pub async fn get_all_maps(&self, user_token: &str) -> Result<Vec<Map>, DbError> {
        let (user_id, _) = self.get_account(user_token).await?;
        let statement = "
            SELECT id, name
            FROM maps
            WHERE owner=$1;";
        let rows = self.client.query(statement, &[&user_id]).await?;
        Ok(rows
            .into_iter()
            .map(|row| Map {
                id: row.get(0),
                name: row.get(1),
            })
            .collect())
    }

    pub async fn get_map(&self, user_token: &str, name: &str) -> Result<String, DbError> {
        let (user_id, _) = self.get_account(user_token).await?;
        let statement = "
            SELECT path
            FROM maps
            WHERE owner=$1 AND name=$2;";
        let rows = self.client.query(statement, &[&user_id, &name]).await?;
        if rows.len() > 0 {
            let data = rows.get(0).ok_or(DbError::Auth)?.get(0);
            Ok(data)
        } else {
            Err(DbError::Auth)
        }
    }

    pub async fn check_game_permissions(
        &self,
        user_token: &str,
        game_token: &str,
    ) -> Result<GamePermission, DbError> {
        let statement = "
            SELECT id, host
            FROM games
            WHERE token=$1;";
        let row = self.client.query_one(statement, &[&game_token]).await?;
        let game_id: i32 = row.get(0);
        let host: i32 = row.get(1);

        let statement = "
            SELECT COUNT(1), user_id
            FROM user_games
            INNER JOIN user_accounts
                ON user_accounts.token=$2
                AND user_games.user_id=user_accounts.id
                AND user_games.game_id=$1
            GROUP BY user_id;";
        let row = self
            .client
            .query_one(statement, &[&game_id, &user_token])
            .await?;
        let count: i64 = row.get(0);
        let user: i32 = row.get(1);

        Ok(if user == host {
            GamePermission::Host
        } else if count > 0 {
            GamePermission::Player
        } else {
            GamePermission::None
        })
    }

    pub async fn check_token(&self, user_token: &str) -> Result<bool, DbError> {
        let statement = "
            SELECT COUNT(1)
            FROM user_accounts
            WHERE token=$1;";
        let row = self.client.query_one(statement, &[&user_token]).await?;
        let count: i64 = row.get(0);

        Ok(count > 0)
    }
}

#[cfg(test)]
mod tests {
    use crate::db::{DbManager, Game};
    use serial_test::serial;

    async fn new_test_user(db: &DbManager, name: &str) -> String {
        let token = db.create_user(name, "password", name).await.unwrap();
        db.confirm_user(name, &token).await.unwrap()
    }

    #[tokio::test]
    #[serial]
    async fn test_user_management() {
        // Set up environment
        dotenv::dotenv().unwrap();
        let db = DbManager::new().await.unwrap();
        db.clear_tables().await.unwrap();
        db.create_tables().await.unwrap();

        // Create and verify a user
        let email = "auth_user";
        new_test_user(&db, email).await;

        // Check authentication passes when it should and fails when it should
        assert!(db.auth_user(email, "password").await.is_ok());
        assert!(db.auth_user(email, "not-password").await.is_err());
    }

    #[tokio::test]
    #[serial]
    async fn test_game_management() {
        // Set up environment
        dotenv::dotenv().unwrap();
        let db = DbManager::new().await.unwrap();
        db.clear_tables().await.unwrap();
        db.create_tables().await.unwrap();

        // Create a host and a games
        let host_token = new_test_user(&db, "test_host").await;
        let game_token = db.create_game(&host_token, "game").await.unwrap();

        // Create a non-host user and join the games
        let player_token = new_test_user(&db, "test_player").await;
        db.join_game(&player_token, &game_token).await.unwrap();

        // Check hosted games
        let hosted = db.get_hosted_games(&host_token).await.unwrap();
        let game = Game {
            token: game_token.clone(),
            name: "game".to_string(),
        };
        assert_eq!(hosted.len(), 1);
        assert!(hosted.contains(&game));

        // Check joined games
        let joined = db.get_joined_games(&player_token).await.unwrap();
        let game = Game {
            token: game_token,
            name: "game".to_string(),
        };
        assert_eq!(joined.len(), 1);
        assert!(joined.contains(&game));

        // let map_data = vec![0xde, 0xad, 0xbe, 0xef];
        //
        // // Create a map
        // db.create_map(&host_token, "foobar", &map_data)
        //     .await
        //     .unwrap();
        //
        // let map = db.get_map(&host_token, "foobar").await.unwrap();
        // assert_eq!(map, map_data);
    }
}
