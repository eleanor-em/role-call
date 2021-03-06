import * as React from 'react';
import '../css/App.css';
import { User } from '../models/User';
import { api } from '../api';
import { useState } from 'react';

export interface CreateGameProps {
    user: User,
    createGameCallback(name: string, token: string): void,
    setMessage(msg: string): void,
}

export const CreateGame = function(props: CreateGameProps): React.ReactElement {
    const [name, setName] = useState('');
    const [showButton, setShowButton] = useState(true);

    async function handleSubmit() {
        try {
            const response = await api.createGame(props.user, name);
            if (response.status) {
                props.createGameCallback(name, response.token);
                setShowButton(false);
                const interval = setInterval(() => {
                    setShowButton(true);
                    clearInterval(interval);
                }, 2000);
            } else {
                props.setMessage(`Failed to create game: ${response.msg}`);
            }
        } catch (_) {
            props.setMessage(`Error contacting server.`);
        }
    }

    return (
        <form>
            <div className="FormRow">
                <label>
                    Name:
                </label>
                <input type="text" value={name} onChange={ev => setName(ev.target.value)} />
            </div>
            {showButton
                ? (
                    <div className="FormRow">
                        <input type="button" value="Create Game" onClick={() => handleSubmit()}/>
                    </div>
                )
                : (
                    <div className="FormRow">
                        <p>Created!</p>
                    </div>
                )
            }
        </form>
    );
};