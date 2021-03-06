#![feature(proc_macro_hygiene, decl_macro, async_closure)]
#[macro_use] extern crate rocket;
#[macro_use] extern crate lazy_static;
#[macro_use] extern crate log;

pub mod db;
pub mod web;
pub mod game;
pub mod config;