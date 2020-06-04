import * as React from 'react';
import '../../css/App.css';
import { User } from '../../models/User';
import { Greeting } from '../Greeting';
import { GameStage } from './GameStage';
import { CommsComponent } from './CommsComponent';
import { useState } from 'react';
import { LoadDisplay } from '../LoadDisplay';


export interface GameLandingProps {
    user: User,
    gameToken: string,
}

export const GameLanding = function(props: GameLandingProps): React.ReactElement {
    const [comms, setComms] = useState(null);

    return (
        <div style={{display: 'flex', flex: 1}}>
            <div className="GameContainer">
                <GameStage comms={comms} />
            </div>
            <div style={{flex: 1, flexDirection: 'row', height: '90%'}}>
                {comms ? <Greeting user={props.user} /> : <LoadDisplay />}
                <CommsComponent
                    user={props.user}
                    gameToken={props.gameToken}
                    onConnect={setComms}
                />
            </div>
        </div>
    );
}