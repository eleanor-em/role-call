import { Game } from './models/Game';
import { User } from './models/User';
import {GameMap} from "./models/GameMap";

const BASE_URL = process.env.RC_API_URL;

export interface AuthResponse {
    status: boolean,
    msg?: string,
    token?: string,
    username?: string,
}

export interface CreateGameResponse {
    status: boolean,
    msg?: string,
    token?: string,
}

export interface ListGamesResponse {
    status: boolean,
    msg?: string,
    games?: [Game],
}

export interface CheckResponse {
    status: boolean,
    msg?: string,
}

export interface ListMapsResponse {
    status: boolean,
    msg?: string,
    maps?: [GameMap],
}

export interface MapResponse {
    status: boolean,
    msg?: string,
    data?: string,
}

async function check(token: string): Promise<CheckResponse> {
    const response = await fetch(`${BASE_URL}/api/users/check`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json;charset=utf-8'
        },
        body: JSON.stringify({ token })
    });
    return await response.json();
}

async function auth(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${BASE_URL}/api/users/auth`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json;charset=utf-8'
        },
        body: JSON.stringify({ email, password })
    });
    return await response.json();
}

async function createGame(user: User, name: string): Promise<CreateGameResponse> {
    const response = await fetch(`${BASE_URL}/api/games`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json;charset=utf-8'
        },
        body: JSON.stringify({
            user_token: user.token,
            name
        })
    });
    return await response.json();
}

async function hostedGames(user: User): Promise<ListGamesResponse> {
    const response = await fetch(`${BASE_URL}/api/games/hosted`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json;charset=utf-8'
        },
        body: JSON.stringify(user)
    });
    return await response.json();   
}

async function joinedGames(user: User): Promise<ListGamesResponse> {
    const response = await fetch(`${BASE_URL}/api/games/joined`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json;charset=utf-8'
        },
        body: JSON.stringify(user)
    });
    return await response.json();   
}

async function createMap(user: User, name: string, file: File): Promise<CheckResponse> {
    const buffer = await file.arrayBuffer();

    const data = new FormData();
    data.append('token', user.token);
    data.append('name', name);
    data.append('data', file);
    const response = await fetch(`${BASE_URL}/api/maps/new`, {
        method: 'POST',
        body: data
    });
    return await response.json();
}

async function getAllMaps(user: User): Promise<ListMapsResponse> {
    const response = await fetch(`${BASE_URL}/api/maps/all`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json;charset=utf-8'
        },
        body: JSON.stringify(user)
    });
    return await response.json();
}

async function getMap(user: User, name: string): Promise<MapResponse> {
    const response = await fetch(`${BASE_URL}/api/maps/one/${name}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json;charset=utf-8'
        },
        body: JSON.stringify(user)
    });
    return await response.json();
}

export const api = {
    check,
    auth,
    createGame,
    hostedGames,
    joinedGames,
    createMap,
    getAllMaps,
    getMap,
};