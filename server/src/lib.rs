#![feature(proc_macro_hygiene, decl_macro, async_closure)]
#[macro_use] extern crate rocket;

pub mod db;
pub mod web;
pub mod game;