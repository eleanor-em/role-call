use rocket::State;
use rocket::response::Content;
use rocket::http::ContentType;
use rocket_contrib::json::Json;
use rocket_contrib::serve::StaticFiles;
use serde::{Serialize, Deserialize};
use futures::executor;

use std::sync::Arc;

use crate::db::{DbManager, DbError, Game};
use std::error::Error;

pub struct Api {
    db: Arc<DbManager>,
    index: String,
    game: String,
}

impl Api {
    pub fn new(db: Arc<DbManager>) -> Result<Self, Box<dyn Error>> {
        let index = process_html(std::fs::read_to_string("../client/index.html")?);
        let game = process_html(std::fs::read_to_string("../client/game.html")?);

        Ok(Self { db, index, game })
    }

    pub fn start(self) {
        rocket::ignite().mount("/",
                               routes![index,
                                    game,
                                    new_user,
                                    auth_user,
                                    new_game,
                                    join_game,
                                    hosted_games,
                                    joined_games])
            .mount("/dist", StaticFiles::from("../client/dist"))
            .mount("/react", StaticFiles::from("../client/node_modules/react/umd/"))
            .mount("/react-dom", StaticFiles::from("../client/node_modules/react-dom/umd/"))
            .manage(self)
            .launch();
    }
}

#[derive(Serialize, Deserialize)]
struct Request {
    token: String,
}

#[derive(Serialize, Deserialize)]
struct UserCreateRequest {
    email: String,
    password: String,
    nickname: String,
}

#[derive(Serialize, Deserialize)]
struct UserAuthRequest {
    email: String,
    password: String,
}

#[derive(Serialize, Deserialize)]
struct GameCreateRequest {
    user_token: String,
    name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserResponse {
    pub status: bool,
    pub msg: Option<String>,
    pub token: Option<String>,
    pub username: Option<String>,
}

pub type GameResponse = UserResponse;

#[derive(Debug, Serialize, Deserialize)]
pub struct Response {
    pub status: bool,
    pub msg: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ListGamesResponse {
    pub status: bool,
    pub msg: Option<String>,
    pub games: Option<Vec<Game>>,
}

#[post("/api/users", format = "json", data = "<user>")]
fn new_user(state: State<'_, Api>, user: Json<UserCreateRequest>) -> Json<UserResponse> {
    let result = executor::block_on(state.db.create_user(&user.email, &user.password, &user.nickname));

    match result {
        Ok(_) => {
            Json(UserResponse {
                status: true,
                msg: None,
                token: None,
                username: None
            })
        },
        Err(_) => {
            Json(UserResponse {
                status: true,
                msg: Some("miscellaneous error".to_string()),
                token: None,
                username: None
            })
        }
    }
}

#[post("/api/users/auth", format = "json", data = "<user>")]
fn auth_user(state: State<'_, Api>, user: Json<UserAuthRequest>) -> Json<UserResponse> {
    let result = executor::block_on(state.db.auth_user(&user.email, &user.password));

    match result {
        Ok((token, username)) => {
            Json(UserResponse {
                status: true,
                msg: None,
                token: Some(token),
                username: Some(username)
            })
        },
        Err(DbError::Auth) => {
            Json(UserResponse {
                status: false,
                msg: Some("user not found".to_string()),
                token: None,
                username: None
            })
        }
        Err(e) => {
            eprintln!("ERROR: {}", e);
            Json(UserResponse {
                status: false,
                msg: Some("miscellaneous error".to_string()),
                token: None,
                username: None
            })
        }
    }
}

#[post("/api/games", format = "json", data = "<game>")]
fn new_game(state: State<'_, Api>, game: Json<GameCreateRequest>) -> Json<GameResponse> {
    let result = executor::block_on(state.db.create_game(&game.user_token, &game.name));

    match result {
        Ok(token) => {;
            Json(GameResponse {
                status: true,
                msg: None,
                token: Some(token),
                username: None
            })
        },
        Err(DbError::Auth) => {
            Json(GameResponse {
                status: false,
                msg: Some("user not found".to_string()),
                token: None,
                username: None
            })
        }
        Err(e) => {
            eprintln!("ERROR: {}", e);
            Json(GameResponse {
                status: false,
                msg: Some("miscellaneous error".to_string()),
                token: None,
                username: None
            })
        }
    }
}

#[post("/api/games/hosted", format = "json", data = "<req>")]
fn hosted_games(state: State<'_, Api>, req: Json<Request>) -> Json<ListGamesResponse>{
    let result = executor::block_on(state.db.get_hosted_games(&req.token));

    match result {
        Ok(games) => {
            Json(ListGamesResponse {
                status: true,
                msg: None,
                games: Some(games)
            })
        },
        Err(DbError::Auth) => {
            Json(ListGamesResponse {
                status: false,
                msg: Some("user not found".to_string()),
                games: None
            })
        }
        Err(e) => {
            eprintln!("ERROR: {}", e);
            Json(ListGamesResponse {
                status: false,
                msg: Some("miscellaneous error".to_string()),
                games: None
            })
        }
    }
}

#[post("/api/games/joined", format = "json", data = "<req>")]
fn joined_games(state: State<'_, Api>, req: Json<Request>) -> Json<ListGamesResponse>{
    let result = executor::block_on(state.db.get_joined_games(&req.token));

    match result {
        Ok(games) => {
            Json(ListGamesResponse {
                status: true,
                msg: None,
                games: Some(games)
            })
        },
        Err(DbError::Auth) => {
            Json(ListGamesResponse {
                status: false,
                msg: Some("user not found".to_string()),
                games: None
            })
        }
        Err(e) => {
            eprintln!("ERROR: {}", e);
            Json(ListGamesResponse {
                status: false,
                msg: Some("miscellaneous error".to_string()),
                games: None
            })
        }
    }
}

#[post("/api/games/<game_token>/join", format = "json", data = "<req>")]
fn join_game(state: State<'_, Api>, game_token: String, req: Json<Request>) -> Json<Response> {
    let result = executor::block_on(state.db.join_game(&req.token, &game_token));

    match result {
        Ok(_) => {
            Json(Response {
                status: true,
                msg: None
            })
        },
        Err(DbError::Auth) => {
            Json(Response {
                status: false,
                msg: Some("user not found".to_string())
            })
        }
        Err(e) => {
            eprintln!("ERROR: {}", e);
            Json(Response {
                status: false,
                msg: Some("miscellaneous error".to_string())
            })
        }
    }
}

fn process_html(html: String) -> String {
    html.replace("./node_modules/react/umd", "/react")
        .replace("./node_modules/react-dom/umd", "/react-dom")
        .replace("./dist", "/dist")
}

#[get("/")]
fn index(state: State<'_, Api>) -> Content<String> {
    Content(ContentType::HTML, state.index.clone())
}

#[get("/games/<game_token>")]
fn game(state: State<'_, Api>, game_token: String) -> Content<String> {
    let game = state.game.clone();

    Content(ContentType::HTML, game.replace("GAMETOKEN", &game_token))
}