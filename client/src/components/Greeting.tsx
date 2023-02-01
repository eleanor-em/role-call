import * as React from 'react';
import '../css/App.css';
import { User, stripUserTag } from '../models/User';

export interface GreetingProps {
    user: User
}

export function Greeting(props: GreetingProps): React.ReactElement {
    return (
        <div>
            <span className="Greeting">
            Stay a while and listen{props.user && `, ${stripUserTag(props.user.username)}`}.<br/>
            Tip: scroll to zoom, middle click to pan.<br/>
        </span>
        <span className="Greeting">
        Test users:
            <ul>
                <li>&#123;"email" = "admin", "password" = "password"&#125;</li>
                <li>&#123;"email" = "player", "password" = "password"&#125;</li>
            </ul>
        </span>
        </div>
    );
}