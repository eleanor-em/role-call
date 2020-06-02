use rocket::{State, Response};
use rocket::http::Status;
use rocket_contrib::json::Json;
use serde::Deserialize;
use futures::executor;

use std::io::Cursor;
use std::sync::Arc;

use crate::db::{DbManager, DbError};
use rocket::response::Responder;

pub struct Api {
    db: Arc<DbManager>,
}

impl Api {
    pub fn new(db: Arc<DbManager>) -> Self {
        Self { db }
    }

    pub fn start(self) {
        rocket::ignite().mount("/api/",
                               routes![index,
                                    new_user,
                                    auth_user,
                                    new_game,
                                    join_game])
            .manage(self)
            .launch();
    }
}

#[derive(Deserialize)]
struct Request {
    token: String,
}

#[derive(Deserialize)]
struct UserRequest {
    email: String,
    password: String
}

#[derive(Debug, Deserialize)]
pub struct UserResponse {
    pub status: bool,
    pub msg: Option<String>,
    pub token: Option<String>,
}

#[derive(Deserialize)]
struct GameRequest {
    token: String,
    name: String,
}

pub type GameResponse = UserResponse;

#[derive(Deserialize)]
struct JoinRequest {
    token: String,
    nick: String,
}

#[derive(Debug, Deserialize)]
pub struct JoinResponse {
    pub status: bool,
    pub msg: Option<String>,
}

#[get("/")]
fn index() -> &'static str {
    "Hello, world!"
}

#[post("/users", format = "json", data = "<user>")]
fn new_user(state: State<'_, Api>, user: Json<UserRequest>) -> impl Responder<'_> {
    let result = executor::block_on(state.db.create_user(&user.email, &user.password));

    let mut response = Response::new();
    response.set_status(Status::Ok);
    match result {
        Ok(_) => {
            response.set_sized_body(Cursor::new("{\"status\":true}"));
        },
        Err(_) => {
            response.set_sized_body(Cursor::new("{\"status\":false,\"msg\":\"miscellaneous error\"}"));
        }
    }
    response
}

#[post("/users/auth", format = "json", data = "<user>")]
fn auth_user(state: State<'_, Api>, user: Json<UserRequest>) -> impl Responder<'_> {
    let result = executor::block_on(state.db.auth_user(&user.email, &user.password));

    let mut response = Response::new();
    response.set_status(Status::Ok);

    match result {
        Ok(token) => {
            response.set_sized_body(Cursor::new(format!("{{\"status\":true,\"token\":\"{}\"}}", token)));
        },
        Err(DbError::Auth) => {
            response.set_sized_body(Cursor::new("{\"status\":false,\"msg\":\"user not found\"}"));
        }
        Err(e) => {
            eprintln!("ERROR: {}", e);
            response.set_sized_body(Cursor::new("{\"status\":false,\"msg\":\"miscellaneous error\"}"));
        }
    }
    response
}

#[post("/games", format = "json", data = "<game>")]
fn new_game(state: State<'_, Api>, game: Json<GameRequest>) -> impl Responder<'_> {
    let result = executor::block_on(state.db.create_game(&game.token, &game.name));

    let mut response = Response::new();
    response.set_status(Status::Ok);

    match result {
        Ok(token) => {
            response.set_sized_body(Cursor::new(format!("{{\"status\":true,\"token\":\"{}\"}}", token)));
        },
        Err(DbError::Auth) => {
            response.set_sized_body(Cursor::new("{\"status\":false,\"msg\":\"user not found\"}"));
        }
        Err(e) => {
            eprintln!("ERROR: {}", e);
            response.set_sized_body(Cursor::new("{\"status\":false,\"msg\":\"miscellaneous error\"}"));
        }
    }
    response
}

#[post("/games/hosted", format = "json", data = "<req>")]
fn hosted_games(state: State<'_, Api>, req: Json<Request>) -> impl Responder<'_> {
    let result = executor::block_on(state.db.get_hosted_games(&req.token));

    let mut response = Response::new();
    response.set_status(Status::Ok);

    match result {
        Ok(games) => {
            // TODO: fix below formatting
            response.set_sized_body(Cursor::new(format!("{{\"status\":true}}")));
        },
        Err(DbError::Auth) => {
            response.set_sized_body(Cursor::new("{\"status\":false,\"msg\":\"user not found\"}"));
        }
        Err(e) => {
            eprintln!("ERROR: {}", e);
            response.set_sized_body(Cursor::new("{\"status\":false,\"msg\":\"miscellaneous error\"}"));
        }
    }
    response
}

#[post("/games/<game_token>/join", format = "json", data = "<req>")]
fn join_game(state: State<'_, Api>, game_token: String, req: Json<JoinRequest>) -> impl Responder<'_> {
    let result = executor::block_on(state.db.join_game(&req.token, &game_token, &req.nick));

    let mut response = Response::new();
    response.set_status(Status::Ok);

    match result {
        Ok(_) => {
            response.set_sized_body(Cursor::new("{\"status\":true}"));
        },
        Err(DbError::Auth) => {
            response.set_sized_body(Cursor::new("{\"status\":false,\"msg\":\"user not found\"}"));
        }
        Err(e) => {
            eprintln!("ERROR: {}", e);
            response.set_sized_body(Cursor::new("{\"status\":false,\"msg\":\"miscellaneous error\"}"));
        }
    }
    response
}