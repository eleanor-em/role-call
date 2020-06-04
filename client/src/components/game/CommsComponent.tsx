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

export class Comms {
    socket: W3cWebSocket;
    placeTokenListeners: Record<string, (msg: PlaceTokenMessage) => void>;

    constructor(socket: W3cWebSocket, props: CommsProps) {
        this.socket = socket;
        this.placeTokenListeners = {};

        socket.onopen = () => {
            props.onConnect(this);
            socket.send(props.user.token);
            socket.send(props.gameToken);
        };

        socket.onclose = () => {
            if (confirm('Warning: game has been disconnected. Refresh the page?')) {
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