use futures::executor;
use rocket::http::ContentType;
use rocket::response::Content;
use rocket::{Data, State};
use rocket_contrib::json::Json;
use rocket_contrib::serve::StaticFiles;
use rocket_multipart_form_data::{
    MultipartFormData, MultipartFormDataField, MultipartFormDataOptions,
};
use serde::{Deserialize, Serialize};

use std::error::Error;
use std::sync::Arc;

use crate::config::CONFIG;
use crate::db::{DbError, DbManager, Game, Map};

// use futures::task::Context;
use std::fs;
use std::fs::File;
use std::io::Write;
use uuid::Uuid;

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
        rocket::ignite()
            .mount(
                "/",
                routes![
                    index,
                    game,
                    new_user,
                    check_user,
                    auth_user,
                    new_game,
                    join_game,
                    hosted_games,
                    joined_games,
                    create_map,
                    get_map,
                    get_all_maps,
                ],
            )
            .mount("/static", StaticFiles::from("./public/"))
            .mount("/dist", StaticFiles::from("../client/dist"))
            .mount(
                "/react",
                StaticFiles::from("../client/node_modules/react/umd/"),
            )
            .mount(
                "/react-dom",
                StaticFiles::from("../client/node_modules/react-dom/umd/"),
            )
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

#[derive(Serialize, Deserialize, FromForm)]
struct MapCreateRequest {
    token: String,
    name: String,
    data: String,
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

#[derive(Debug, Serialize, Deserialize)]
pub struct MapResponse {
    pub status: bool,
    pub msg: Option<String>,
    pub data: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ListMapsResponse {
    pub status: bool,
    pub msg: Option<String>,
    pub maps: Option<Vec<Map>>,
}

#[post("/api/users", format = "json", data = "<user>")]
fn new_user(state: State<'_, Api>, user: Json<UserCreateRequest>) -> Json<UserResponse> {
    let result = executor::block_on(state.db.create_user(
        &user.email,
        &user.password,
        &user.nickname,
    ));

    match result {
        Ok(_) => Json(UserResponse {
            status: true,
            msg: None,
            token: None,
            username: None,
        }),
        Err(_) => Json(UserResponse {
            status: true,
            msg: Some("miscellaneous error".to_string()),
            token: None,
            username: None,
        }),
    }
}

#[post("/api/users/check", format = "json", data = "<user>")]
fn check_user(state: State<'_, Api>, user: Json<Request>) -> Json<Response> {
    let result = executor::block_on(state.db.check_token(&user.token));
    match result {
        Ok(true) => Json(Response {
            status: true,
            msg: None,
        }),
        Ok(false) => Json(Response {
            status: false,
            msg: Some("token expired".to_string()),
        }),
        Err(_) => Json(Response {
            status: false,
            msg: Some("miscellaneous error".to_string()),
        }),
    }
}

#[post("/api/users/auth", format = "json", data = "<user>")]
fn auth_user(state: State<'_, Api>, user: Json<UserAuthRequest>) -> Json<UserResponse> {
    let result = executor::block_on(state.db.auth_user(&user.email, &user.password));

    match result {
        Ok((token, username)) => Json(UserResponse {
            status: true,
            msg: None,
            token: Some(token),
            username: Some(username),
        }),
        Err(DbError::Auth) => Json(UserResponse {
            status: false,
            msg: Some("user not found".to_string()),
            token: None,
            username: None,
        }),
        Err(e) => {
            warn!("API: error: {}", e);
            Json(UserResponse {
                status: false,
                msg: Some("miscellaneous error".to_string()),
                token: None,
                username: None,
            })
        }
    }
}

#[post("/api/games", format = "json", data = "<game>")]
fn new_game(state: State<'_, Api>, game: Json<GameCreateRequest>) -> Json<GameResponse> {
    let result = executor::block_on(state.db.create_game(&game.user_token, &game.name));

    match result {
        Ok(token) => Json(GameResponse {
            status: true,
            msg: None,
            token: Some(token),
            username: None,
        }),
        Err(DbError::Auth) => Json(GameResponse {
            status: false,
            msg: Some("user not found".to_string()),
            token: None,
            username: None,
        }),
        Err(e) => {
            warn!("ERROR: {}", e);
            Json(GameResponse {
                status: false,
                msg: Some("miscellaneous error".to_string()),
                token: None,
                username: None,
            })
        }
    }
}

#[post("/api/games/hosted", format = "json", data = "<req>")]
fn hosted_games(state: State<'_, Api>, req: Json<Request>) -> Json<ListGamesResponse> {
    let result = executor::block_on(state.db.get_hosted_games(&req.token));

    match result {
        Ok(games) => Json(ListGamesResponse {
            status: true,
            msg: None,
            games: Some(games),
        }),
        Err(DbError::Auth) => Json(ListGamesResponse {
            status: false,
            msg: Some("user not found".to_string()),
            games: None,
        }),
        Err(e) => {
            warn!("ERROR: {}", e);
            Json(ListGamesResponse {
                status: false,
                msg: Some("miscellaneous error".to_string()),
                games: None,
            })
        }
    }
}

#[post("/api/games/joined", format = "json", data = "<req>")]
fn joined_games(state: State<'_, Api>, req: Json<Request>) -> Json<ListGamesResponse> {
    let result = executor::block_on(state.db.get_joined_games(&req.token));

    match result {
        Ok(games) => Json(ListGamesResponse {
            status: true,
            msg: None,
            games: Some(games),
        }),
        Err(DbError::Auth) => Json(ListGamesResponse {
            status: false,
            msg: Some("user not found".to_string()),
            games: None,
        }),
        Err(e) => {
            warn!("ERROR: {}", e);
            Json(ListGamesResponse {
                status: false,
                msg: Some("miscellaneous error".to_string()),
                games: None,
            })
        }
    }
}

#[post("/api/games/<game_token>/join", format = "json", data = "<req>")]
fn join_game(state: State<'_, Api>, game_token: String, req: Json<Request>) -> Json<Response> {
    let result = executor::block_on(state.db.join_game(&req.token, &game_token));

    match result {
        Ok(_) => Json(Response {
            status: true,
            msg: None,
        }),
        Err(DbError::Auth) => Json(Response {
            status: false,
            msg: Some("user not found".to_string()),
        }),
        Err(e) => {
            warn!("ERROR: {}", e);
            Json(Response {
                status: false,
                msg: Some("miscellaneous error".to_string()),
            })
        }
    }
}
fn write_data(path: &str, data: &Vec<u8>) -> Result<(), Box<dyn Error>> {
    let mut file = File::create(path)?;
    file.write_all(data)?;
    Ok(())
}

// Unfortunately a lot of things still refuse to allow data with GET, so we can't use GET /api/maps.
// This leaves us with a meh REST endpoint here.
#[post("/api/maps/new", data = "<data>")]
fn create_map(state: State<'_, Api>, content_type: &ContentType, data: Data) -> Json<Response> {
    // Encoding the map straight as text is a bit awkward, but we're saving it directly to the
    // database, not as a file on the filesystem.
    let options = MultipartFormDataOptions::with_multipart_form_data_fields(vec![
        MultipartFormDataField::bytes("data"),
        MultipartFormDataField::text("token"),
        MultipartFormDataField::text("name"),
    ]);

    let mut multipart_form_data = MultipartFormData::parse(content_type, data, options).unwrap();
    let data = multipart_form_data.raw.remove("data");
    let token = multipart_form_data.texts.remove("token");
    let name = multipart_form_data.texts.remove("name");

    // Validate the inputs.
    // TODO: check that the data does actually form an image, isn't too large, etc.
    if data.is_none() {
        warn!("ERROR: malformed file data");
        return Json(Response {
            status: false,
            msg: Some("malformed file data".to_string()),
        });
    }

    if token.is_none() {
        warn!("ERROR: malformed user token");
        return Json(Response {
            status: false,
            msg: Some("malformed user token".to_string()),
        });
    }

    if name.is_none() {
        warn!("ERROR: malformed map name");
        return Json(Response {
            status: false,
            msg: Some("malformed map name".to_string()),
        });
    }

    let data = data.unwrap().remove(0).raw;
    info!("{}", base64::encode(&data));
    let token = token.unwrap().remove(0).text;
    let name = name.unwrap().remove(0).text;

    let uuid = Uuid::new_v4();
    let path = format!("{}/{}.png", CONFIG.upload_dir, uuid);

    // Save data to file
    if let Err(e) = write_data(&path, &data) {
        warn!("ERROR saving image file: {}", e);
        return Json(Response {
            status: false,
            msg: Some("upload error".to_string()),
        });
    }

    let result = executor::block_on(state.db.create_map(&token, &name, &path));

    match result {
        Ok(_) => Json(Response {
            status: true,
            msg: None,
        }),
        Err(DbError::Auth) => Json(Response {
            status: false,
            msg: Some("user not found".to_string()),
        }),
        Err(DbError::AlreadyExists) => Json(Response {
            status: false,
            msg: Some("name already used".to_string()),
        }),
        Err(e) => {
            warn!("ERROR: {}", e);
            Json(Response {
                status: false,
                msg: Some("miscellaneous error".to_string()),
            })
        }
    }
}

#[post("/api/maps/all", format = "json", data = "<req>")]
fn get_all_maps(state: State<'_, Api>, req: Json<Request>) -> Json<ListMapsResponse> {
    let result = executor::block_on(state.db.get_all_maps(&req.token));

    match result {
        Ok(data) => Json(ListMapsResponse {
            status: true,
            msg: None,
            maps: Some(data),
        }),
        Err(DbError::Auth) => Json(ListMapsResponse {
            status: false,
            msg: Some("user not found".to_string()),
            maps: None,
        }),
        Err(e) => {
            warn!("ERROR: {}", e);
            Json(ListMapsResponse {
                status: false,
                msg: Some("miscellaneous error".to_string()),
                maps: None,
            })
        }
    }
}

#[post("/api/maps/one/<name>", format = "json", data = "<req>")]
fn get_map(state: State<'_, Api>, name: String, req: Json<Request>) -> Json<MapResponse> {
    let result = executor::block_on(state.db.get_map(&req.token, &name));

    match result {
        Ok(path) => match fs::read(&path) {
            Ok(data) => Json(MapResponse {
                status: true,
                msg: None,
                data: Some(base64::encode(data)),
            }),
            Err(e) => {
                warn!("ERROR loading image file: {}", e);
                Json(MapResponse {
                    status: false,
                    msg: Some("miscellaneous error".to_string()),
                    data: None,
                })
            }
        },
        Err(DbError::Auth) => Json(MapResponse {
            status: false,
            msg: Some("user not found".to_string()),
            data: None,
        }),
        Err(e) => {
            warn!("ERROR: {}", e);
            Json(MapResponse {
                status: false,
                msg: Some("miscellaneous error".to_string()),
                data: None,
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
