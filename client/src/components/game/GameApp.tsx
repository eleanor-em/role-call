import * as React from 'react';
import '../../css/App.css';
import { User, stripUserTag } from '../../models/User';
import { Login } from '../Login';
import { useState, useEffect } from 'react';
import { useCookies } from 'react-cookie';
import { api } from '../../api';
import { LoadDisplay } from '../LoadDisplay';
import { GameLanding } from './GameLanding';

export interface GameProps {
    gameToken: string,
}

enum AppState {
    Login,
    Loading,
    LoggedIn,
}

export const GameApp = function(props: GameProps): React.ReactElement {
    const [message, setMessage] = useState('');
    const [appState, setAppState] = useState(AppState.Loading);
    const [user, setUser] = useState(null as User);
    const [cookies, setCookie, removeCookie] = useCookies([]);
    
    async function login(email: string, password: string): Promise<void> {
        setMessage('');
        setAppState(AppState.Loading);
        const result = await api.auth(email, password);
        if (result.status) {
            const user = {
                token: result.token,
                username: result.username,
            };
            setUser(user);
            setCookie('session', user, { sameSite: 'lax' });
            setAppState(AppState.LoggedIn);
        } else {
            setMessage('Invalid email or password.');
            setAppState(AppState.Login);
        }
    }

    useEffect(() => {
        if ('session' in cookies) {
            setUser(cookies.session);
            setAppState(AppState.LoggedIn);
        } else {
            setAppState(AppState.Login);
        }
    }, []);

    function getContents(): React.ReactElement {
        switch (appState) {
            case AppState.Login:
                return (<Login loginCallback={login} />);
            case AppState.Loading:
                return (<LoadDisplay />);
            case AppState.LoggedIn:
                return (<GameLanding user={user} gameToken={props.gameToken} />);
        }
    }

    return (
        <div className="App">
            {message && (<div>{message}</div>)}
            {getContents()}
        </div>
    );
}