import { Game } from './models/Game';
import { User } from './models/User';

const BASE_URL = 'http://localhost:8000';

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

export const api = {
    auth,
    createGame,
    hostedGames,
    joinedGames,
};