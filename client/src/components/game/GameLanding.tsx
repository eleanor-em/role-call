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
import { Controls } from './Controls';
import {TokenType} from "./TokenManager";

export interface GameLandingProps {
    user: User,
    gameToken: string,
    setMessage(msg: string): void,
}

interface StoredPlayer {
    name: string,
    host: boolean,
}

export const GameLanding = function(props: GameLandingProps): React.ReactElement {
    const [comms, setComms] = useState(null as Comms);
    const [players, setPlayers] = useState([] as StoredPlayer[]);
    const [failed, setFailed] = useState('');
    const [isHost, setIsHost] = useState(false);
    const [tokenType, setTokenType] = useState(TokenType.Circle);
    const [tokenColour, setTokenColour] = useState('#ff0000');
    
    comms?.addConnectListener('GameLandingConnect', msg => {
        const player = { name: msg.Connect.username, host: msg.Connect.host };
        if (player.name == props.user.username && player.host) {
            setIsHost(true);
        }

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
            <img src={"/static/favicon-128.png"} alt="logo" /> <br/>
            Failed to connect to game: {failed}. <br/>
            <a href="/">Go back home</a>
        </div>
    ) : (
        <div style={{display: 'flex', flex: 1}}>
            <CommsComponent
                user={props.user}
                gameToken={props.gameToken}
                onConnect={setComms}
                onDisconnect={() => props.setMessage('Connection lost. Try reloading the page.')}
            />
            <div className="GameContainer">
                <GameStage comms={comms} tokenColour={tokenColour} tokenType={tokenType} />
            </div>
            <div className="GameSidebar">
                <div className="GameGreeting">
                    <a href="/"><img src={"/static/favicon-128.png"} onClick={() => { if (comms) { comms.shouldShowRefresh = false; } }} alt="logo"/></a>
                    {comms ? <Greeting user={props.user} /> : <LoadDisplay />}
                    {playerList}
                </div>
                <div className="GameControls">
                    {isHost && <Controls setTokenColour={setTokenColour} setTokenType={setTokenType}/>}
                </div>
            </div>
        </div>
    );
}