import * as React from 'react';
import '../../css/App.css';
import { User } from '../../models/User';
import { Greeting } from '../Greeting';
import { GameStage } from './GameStage';
import { CommsComponent, Comms } from './CommsComponent';
import { useState } from 'react';
import { LoadDisplay } from '../LoadDisplay';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCrown } from '@fortawesome/free-solid-svg-icons';

export interface GameLandingProps {
    user: User,
    gameToken: string,
}

interface StoredPlayer {
    name: string,
    host: boolean,
}

export const GameLanding = function(props: GameLandingProps): React.ReactElement {
    const [comms, setComms] = useState(null as Comms);
    const [players, setPlayers] = useState([] as StoredPlayer[]);
    const [failed, setFailed] = useState('');
    
    comms?.addConnectListener('GameLandingConnect', msg => {
        const player = { name: msg.Connect.username, host: msg.Connect.host };
        for (const existing of players) {
            if (existing.name == player.name) {
                return;
            }
        }

        if (player.host) {
            setPlayers([player].concat(players));
        } else {
            setPlayers(players.concat([player]));
        }
    });

    comms?.addDisconnectListener('GameLandingDisconnect', msg => {
        setPlayers(players.filter(({ name }) => name != msg.Disconnect.username));
    });

    comms?.addFailedListener('GameLandingFailed', msg => {
        alert(`Failed to connect to game: ${msg.FailedConnection.reason}`);
        setFailed(msg.FailedConnection.reason);
    });

    const playerList = (
        <div style={{paddingTop: '1em'}}>
            {players.map(player => (
                <div className="PlayerName" key={player.name}>
                    {player.host
                        ? (<FontAwesomeIcon style={{ paddingLeft: '0.5em', paddingRight: '0.5em' }} icon={faCrown} />)
                        : (<span style={{ paddingLeft: '0.75em', paddingRight: '1.25em' }}>-</span>)}
                    {player.name}
                </div>
            ))}
        </div>
    );

    return failed ? (
        <div style={{flex: 1, flexDirection: 'row', height: '90%'}}>
            <img src="/static/favicon-128.png" /> <br/>
            Failed to connect to game: {failed}. <br/>
            <a href="/">Go back home</a>
        </div>
    ) : (
        <div style={{display: 'flex', flex: 1}}>
            <CommsComponent
                user={props.user}
                gameToken={props.gameToken}
                onConnect={setComms}
            />
            <div className="GameContainer">
                <GameStage comms={comms} />
            </div>
            <div className="GameSidebar">
                <a href="/"><img src="/static/favicon-128.png" onClick={() => { if (comms) { comms.shouldShowRefresh = false; } }} /></a>
                {comms ? <Greeting user={props.user} /> : <LoadDisplay />}
                {playerList}
            </div>
        </div>
    );
}