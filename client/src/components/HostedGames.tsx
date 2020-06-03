import * as React from 'react';
import '../css/App.css';
import { User } from '../models/User';
import { Game } from '../models/Game';

export interface HostedGamesProps {
    user: User,
    games: Game[],
}

export const HostedGames = function(props: HostedGamesProps): React.ReactElement {
    return (
        <ul>
            {props.games && props.games.map(({ name, token }) => (
                <li key={token}>
                    <a href={`games/${token}`}>{name}</a>
                </li>
            ))}
        </ul>
    );
};