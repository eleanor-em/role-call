import * as React from 'react';
import '../css/App.css';
import { User, stripUserTag } from '../models/User';

export interface GreetingProps {
    user: User
}

export function Greeting(props: GreetingProps): React.ReactElement {
    return (
        <span className="Greeting">Stay a while and listen
            {props.user && `, ${stripUserTag(props.user.username)}`}
        .</span>
    );
}