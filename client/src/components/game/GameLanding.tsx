import * as React from 'react';
import '../../css/App.css';
import { User } from '../../models/User';
import { Greeting } from '../Greeting';
import { GameStage } from './GameStage';


export interface GameLandingProps {
    user: User,
    gameToken: string,
}

export const GameLanding = function(props: GameLandingProps): React.ReactElement {
    return (
        <div style={{display: 'flex', flex: 1}}>
            <div className="GameContainer">
                <GameStage />
            </div>
            <div style={{flex: 1, flexDirection: 'row', height: '90%'}}>
                <Greeting user={props.user} />
            </div>
        </div>
    );
}