import * as React from 'react';
import { w3cwebsocket as W3cWebSocket } from 'websocket';
import { useEffect } from 'react';
import { User } from '../../models/User';
import { TokenType, Token } from './TokenManager';

export type PlaceTokenMessage = Token;

export interface DeleteTokenMessage {
    x: number,
    y: number
}

export interface ConnectMessage {
    username: string,
    host: boolean,
}

export interface DisconnectMessage {
    username: string,
}

export interface FailedConnectionMessage {
    reason: string,
}

export class Comms {
    socket: W3cWebSocket;
    placeTokenListeners: Record<string, (msg: PlaceTokenMessage) => void> = {};
    deleteTokenListeners: Record<string, (msg: DeleteTokenMessage) => void> = {};
    connectListeners: Record<string, (msg: ConnectMessage) => void> = {};
    disconnectListeners: Record<string, (msg: DisconnectMessage) => void> = {};
    failedListeners: Record<string, (msg: FailedConnectionMessage) => void> = {};
    shouldShowRefresh: boolean = true;

    constructor(socket: W3cWebSocket, props: CommsProps) {
        this.socket = socket;

        socket.onopen = () => {
            props.onConnect(this);
            socket.send(props.user.token);
            socket.send(props.gameToken);
        };

        socket.onclose = props.onDisconnect;

        socket.onmessage = message => {
            // Interface with Rust JSON serialiser
            const rawData: any = JSON.parse(message.data.toString());
            const kind = Object.keys(rawData)[0];
            const data = rawData[kind];

            switch (kind) {
                case 'PlaceToken': {
                    data.kind = TokenType[data.kind];
                    Object.values(this.placeTokenListeners).forEach(op => op(data));
                    break;
                }
                case 'DeleteToken': {
                    Object.values(this.deleteTokenListeners).forEach(op => op(data));
                    break;
                }
                case 'Connect': {
                    Object.values(this.connectListeners).forEach(op => op(data));
                    break;
                }
                case 'Disconnect': {
                    Object.values(this.disconnectListeners).forEach(op => op(data));
                    break;
                }
                case 'FailedConnection': {
                    // If the websocket failed, don't pop up since the user will see a splash screen
                    this.shouldShowRefresh = false;
                    Object.values(this.failedListeners).forEach(op => op(data));
                    break;
                }
            }
        };
    }

    placeToken(type: TokenType, x: number, y: number, colour: string): void {
        // Need to convert to name for transport
        const kind = TokenType[type];
        this.socket.send(JSON.stringify({
            PlaceToken: {
                kind, x, y, colour
            }
        }));
    }

    deleteToken(x: number, y: number): void {
        this.socket.send(JSON.stringify({
            DeleteToken: {
                x, y
            }
        }));
    }

    // Listeners should use a unique reference string, to prevent duplicate listeners.
    addPlaceTokenListener(ref: string, listener: ((msg: PlaceTokenMessage) => void)): void {
        this.placeTokenListeners[ref] = listener;
    }

    // Listeners should use a unique reference string, to prevent duplicate listeners.
    addDeleteTokenListener(ref: string, listener: ((msg: DeleteTokenMessage) => void)): void {
        this.deleteTokenListeners[ref] = listener;
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
    onDisconnect(): void,
}

export function CommsComponent(props: CommsProps): Comms {
    return new Comms(new W3cWebSocket(process.env.RC_WEBSOCKET_URL), props);
}