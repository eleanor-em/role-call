import * as React from 'react';
import '../css/App.css';
import { User } from '../models/User';
import { CreateGame } from './CreateGame';
import { api } from '../api';
import { useState, useEffect } from 'react';
import { HostedGames } from './HostedGames';


export interface LandingProps {
    user: User,
    setMessage(msg: string): void,
}

export const Landing = function(props: LandingProps): React.ReactElement {
    const [games, setGames] = useState([]);
    const [selectedTab, setSelectedTab] = useState(0);

    useEffect(() => {
        const task = async () => {
            try {
                const result = await api.hostedGames(props.user);
                if (result.status) {
                    setGames(result.games);
                } else {
                    props.setMessage(`Failed to load hosted games: ${result.msg}`);
                }
            } catch (_) {
                props.setMessage('Error contacting server.');
            }
        };
        task();
    }, []);

    function onCreateGame(name: string, token: string): void {
        setGames(games.concat([{ name, token }]));
    }

    const tabTitles = ['Hosted Games', 'Joined Games', 'New Game'];
    const tabClasses = Object.keys(tabTitles).map(i => i == selectedTab.toString() ? 'SelectedTab' : 'UnselectedTab');

    return (
        <div className="Content">
            <div className="TabContainer">
                {Object.keys(tabTitles).map(key => {
                    const i = parseInt(key);
                    return (
                        <span key={i}>
                            <span className={tabClasses[i]} onClick={() => setSelectedTab(i)}>
                                {tabTitles[i]}
                            </span>
                        </span>
                    );
                })}
            </div>
            <div className="TabBody">
                {selectedTab == 0 && (<HostedGames user={props.user} games={games} />)}
                {selectedTab == 2 && (
                    <CreateGame
                        user={props.user}
                        createGameCallback={onCreateGame}
                        setMessage={props.setMessage}
                    />
                )}
            </div>
        </div>
    );
};