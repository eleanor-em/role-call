import * as React from 'react';
import '../../css/App.css';
import { User } from '../../models/User';
import { Greeting } from '../Greeting';


export interface GameLandingProps {
    user: User,
    gameToken: string,
}

export const GameLanding = function(props: GameLandingProps): React.ReactElement {
    return (
        <Greeting user={props.user} />
    );
}