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

export interface FailedConnectionMessage {
    FailedConnection: {
        reason: string,
    }
}

export class Comms {
    socket: W3cWebSocket;
    placeTokenListeners: Record<string, (msg: PlaceTokenMessage) => void>;
    connectListeners: Record<string, (msg: ConnectMessage) => void>;
    failedListeners: Record<string, (msg: FailedConnectionMessage) => void>;
    failed: boolean;

    constructor(socket: W3cWebSocket, props: CommsProps) {
        this.socket = socket;
        this.placeTokenListeners = {};
        this.connectListeners = {};
        this.failedListeners = {};
        this.failed = false;

        socket.onopen = () => {
            props.onConnect(this);
            socket.send(props.user.token);
            socket.send(props.gameToken);
        };

        socket.onclose = () => {
            if (!this.failed && confirm('Warning: game has been disconnected. Refresh the page?')) {
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
                case 'FailedConnection': {
                    this.failed = true;
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

    addPlaceTokenListener(ref: string, listener: ((msg: PlaceTokenMessage) => void)): void {
        this.placeTokenListeners[ref] = listener;
    }

    addConnectListener(ref: string, listener: ((msg: ConnectMessage) => void)): void {
        this.connectListeners[ref] = listener;
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
        console.log('setting up websocket');
        new Comms(new W3cWebSocket('ws://localhost:9000'), props);
    }, []);

    return (null);
}