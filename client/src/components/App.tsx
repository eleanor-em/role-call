import * as React from 'react';
import '../css/App.css';
import { Login } from './Login';
import { useState, useEffect } from 'react';
import { LoadDisplay } from './LoadDisplay';
import { api } from '../api';
import { Landing } from './Landing';
import { User } from '../models/User';
import { useCookies } from 'react-cookie';
import { Greeting } from './Greeting';

enum AppState {
    Login,
    Loading,
    LoggedIn,
}

export const App = function(): React.ReactElement {
    const [message, setMessage] = useState('');
    const [appState, setAppState] = useState(AppState.Loading);
    const [user, setUser] = useState(null as User);
    const [cookies, setCookie, removeCookie] = useCookies([]);

    async function login(email: string, password: string): Promise<void> {
        setMessage('');
        setAppState(AppState.Loading);
        try {
            const result = await api.auth(email, password);
            if (result.status) {
                const user = {
                    token: result.token,
                    username: result.username,
                };
                setUser(user);
                setCookie('session', user, { sameSite: 'lax', path: '/' });
                setCookie('session', user, { sameSite: 'lax', path: '/games' });
                setAppState(AppState.LoggedIn);
            } else {
                setMessage('Invalid email or password.');
                setAppState(AppState.Login);
            }
        } catch (e) {
            setMessage('Error contacting server.');
            setAppState(AppState.Login);
        }
    }

    function getContents(): React.ReactElement {
        switch (appState) {
            case AppState.Login:
                return (<Login loginCallback={login} />);
            case AppState.Loading:
                return (<LoadDisplay />);
            case AppState.LoggedIn:
                return (<Landing user={user} />);
        }
    }

    useEffect(() => {
        if ('session' in cookies) {
            const task = async () => {
                try {
                    const response = await api.check(cookies.session.token);
                    if (response.status) {
                        setUser(cookies.session);
                        setAppState(AppState.LoggedIn);
                    } else {
                        setAppState(AppState.Login);
                    }
                } catch (_) {
                    setMessage('Error contacting server.');
                    setAppState(AppState.Login);
                }
            };
            task();
        } else {
            setAppState(AppState.Login);
        }
    }, []);

    return (
        <div className="App">
            <header className="AppHeader">
                <p>
                    <span className="Title"><img className="HeadlineImage" src="/static/favicon-128.png" />RoleCall</span>
                    <Greeting user={user} />
                </p>
            </header>
            {message && (<div>{message}</div>)}
            {getContents()}
        </div>
    );
};