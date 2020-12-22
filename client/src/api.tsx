import { Game } from './models/Game';
import { User } from './models/User';
import {GameObj} from "./models/GameObj";

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

export interface ListObjsResponse {
    status: boolean,
    msg?: string,
    objs?: [GameObj],
}

export interface ObjResponse {
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

async function createObj(user: User, name: string, file: File): Promise<CheckResponse> {
    // const buffer = await file.arrayBuffer();

    const data = new FormData();
    data.append('token', user.token);
    data.append('name', name);
    data.append('data', file);
    const response = await fetch(`${BASE_URL}/api/objs/new`, {
        method: 'POST',
        body: data
    });
    return await response.json();
}

async function getOwnedObjs(user: User): Promise<ListObjsResponse> {
    const response = await fetch(`${BASE_URL}/api/objs/owned`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json;charset=utf-8'
        },
        body: JSON.stringify(user)
    });
    return await response.json();
}

async function getOtherObjs(user: User, id: number): Promise<ListObjsResponse> {
    const response = await fetch(`${BASE_URL}/api/objs/owned/by/${id}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json;charset=utf-8'
        },
        body: JSON.stringify(user)
    });
    return await response.json();
}

async function getObj(user: User, name: string): Promise<ObjResponse> {
    const response = await fetch(`${BASE_URL}/api/objs/one/${name}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json;charset=utf-8'
        },
        body: JSON.stringify(user)
    });
    return await response.json();
}

async function deleteObj(user: User, name: string): Promise<Response> {
    const response = await fetch(`${BASE_URL}/api/objs/one/${name}`, {
        method: 'DELETE',
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
    createObj,
    getOwnedObjs,
    getOtherObjs,
    getObj,
    deleteObj,
};