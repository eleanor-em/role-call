import * as React from 'react';
import { w3cwebsocket as W3cWebSocket } from 'websocket';
import { useState, useEffect } from 'react';
import { User } from '../../models/User';
import { TokenType } from './util/TokenFactory';

export interface PlaceTokenMessage {
    PlaceToken: {
        kind: TokenType,
        x: number,
        y: number
    }
}

export interface ConnectMessage {
    Connect: {
        username: string,
        host: boolean,
    }
}

export interface DisconnectMessage {
    Disconnect: {
        username: string,
    }
}

export interface FailedConnectionMessage {
    FailedConnection: {
        reason: string,
    }
}

export class Comms {
    socket: W3cWebSocket;
    placeTokenListeners: Record<string, (msg: PlaceTokenMessage) => void>;
    connectListeners: Record<string, (msg: ConnectMessage) => void>;
    disconnectListeners: Record<string, (msg: DisconnectMessage) => void>;
    failedListeners: Record<string, (msg: FailedConnectionMessage) => void>;
    shouldShowRefresh: boolean;

    constructor(socket: W3cWebSocket, props: CommsProps) {
        this.socket = socket;
        this.placeTokenListeners = {};
        this.connectListeners = {};
        this.disconnectListeners = {};
        this.failedListeners = {};
        this.shouldShowRefresh = true;

        socket.onopen = () => {
            props.onConnect(this);
            socket.send(props.user.token);
            socket.send(props.gameToken);
        };

        socket.onclose = () => {
            if (this.shouldShowRefresh && confirm('Warning: game has been disconnected. Refresh the page?')) {
                window.location.reload();
            }
        };

        socket.onmessage = message => {
            const data: any = JSON.parse(message.data.toString());
            switch (Object.keys(data)[0]) {
                case 'PlaceToken': {
                    data.PlaceToken.kind = TokenType[data.PlaceToken.kind];
                    Object.values(this.placeTokenListeners).forEach(op => op(data));
                    break;
                }
                case 'Connect': {
                    data.Connect.kind = TokenType[data.Connect.kind];
                    Object.values(this.connectListeners).forEach(op => op(data));
                    break;
                }
                case 'Disconnect': {
                    data.Disconnect.kind = TokenType[data.Disconnect.kind];
                    Object.values(this.disconnectListeners).forEach(op => op(data));
                    break;
                }
                case 'FailedConnection': {
                    // If the websocket failed, don't pop up since the user will see a splash screen
                    this.shouldShowRefresh = false;
                    data.FailedConnection.kind = TokenType[data.FailedConnection.kind];
                    Object.values(this.failedListeners).forEach(op => op(data));
                    break;
                }
            }
        };
    }

    placeToken(type: TokenType, x: number, y: number): void {
        const kind = TokenType[type];
        this.socket.send(JSON.stringify({
            PlaceToken: { kind, x, y }
        }));
    }

    // Listeners should use a unique reference string, to prevent duplicate listeners.
    addPlaceTokenListener(ref: string, listener: ((msg: PlaceTokenMessage) => void)): void {
        this.placeTokenListeners[ref] = listener;
    }

    addConnectListener(ref: string, listener: ((msg: ConnectMessage) => void)): void {
        this.connectListeners[ref] = listener;
    }

    addDisconnectListener(ref: string, listener: ((msg: DisconnectMessage) => void)): void {
        this.disconnectListeners[ref] = listener;
    }

    addFailedListener(ref: string, listener: ((msg: FailedConnectionMessage) => void)): void {
        this.failedListeners[ref] = listener;
    }
}

export interface CommsProps {
    user: User,
    gameToken: string,
    onConnect(comms: Comms): void,
}

export function CommsComponent(props: CommsProps): React.ReactElement {
    useEffect(() => {
        new Comms(new W3cWebSocket(process.env.RC_WEBSOCKET_URL), props);
    }, []);

    return (null);
}