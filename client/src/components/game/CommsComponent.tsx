import * as React from 'react';
import { w3cwebsocket as W3cWebSocket } from 'websocket';
import { User } from '../../models/User';
import { TokenType, Token } from './TokenManager';
import {Point} from "./GameStage";
import {PlacedObj} from "./ObjManager";
import {api} from "../../api";
import {GameObj} from "../../models/GameObj";

export type PlaceTokenMessage = Token;

export interface DeleteTokenMessage {
    token_id: string,
}

export interface MoveTokenMessage {
    id: string,
    token_id: string,
    dx: number,
    dy: number,
}

export type PlaceObjMessage = PlacedObj;

export interface DeleteObjMessage {
    obj_id: number,
}

export interface SetControllerMessage {
    token_id: string,
    new_controller: string,
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

export interface Movement {
    id: string,
    token_id: string,
    delta: Point,
}

export class Comms {
    socket: W3cWebSocket;

    placeTokenListeners: Record<string, (msg: PlaceTokenMessage) => void> = {};
    deleteTokenListeners: Record<string, (msg: DeleteTokenMessage) => void> = {};
    moveTokenListeners: Record<string, (msg: MoveTokenMessage) => void> = {};
    setControllerListeners: Record<string, (msg: SetControllerMessage) => void> = {};

    placeObjListeners: Record<string, (msg: PlaceObjMessage) => void> = {};
    deleteObjListeners: Record<string, (msg: DeleteObjMessage) => void> = {};

    connectListeners: Record<string, (msg: ConnectMessage) => void> = {};
    disconnectListeners: Record<string, (msg: DisconnectMessage) => void> = {};

    failedListeners: Record<string, (msg: FailedConnectionMessage) => void> = {};

    shouldShowRefresh = true;
    isHost = false;
    hostId = -1;
    user: User = null;

    allObjs: Record<number, GameObj> = {};
    loading = false;

    constructor(socket: W3cWebSocket, props: CommsProps) {
        this.socket = socket;
        this.user = props.user;

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
                case 'Movement': {
                    Object.values(this.moveTokenListeners).forEach(op => op(data));
                    break;
                }
                case 'PlaceObj': {
                    Object.values(this.placeObjListeners).forEach(op => op(data));
                    break;
                }
                case 'DeleteObj': {
                    Object.values(this.deleteObjListeners).forEach(op => op(data));
                    break;
                }
                case 'SetController': {
                    Object.values(this.setControllerListeners).forEach(op => op(data));
                    break;
                }
                case 'Connect': {
                    this.hostId = data.host_id;
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
            PlaceToken: { kind, x, y, colour }
        }));
    }

    moveToken(id: string, token_id: string, dx: number, dy: number): void {
        this.socket.send(JSON.stringify({
            Movement: { id, token_id, dx, dy }
        }));
    }

    deleteToken(token_id: string): void {
        this.socket.send(JSON.stringify({
            DeleteToken: { token_id }
        }));
    }

    placeObj(obj_id: number, x: number, y: number, width: number, height: number) {
        x = Math.round(x);
        y = Math.round(y);
        width = Math.round(width);
        height = Math.round(height);

        this.socket.send(JSON.stringify({
            PlaceObj: { obj_id, x, y, width, height }
        }));
    }

    deleteObj(obj_id: string): void {
        this.socket.send(JSON.stringify({
            DeleteObj: { obj_id }
        }));
    }

    moveObj(obj: PlacedObj): void {
        this.socket.send(JSON.stringify({
            MoveObj: {
                obj_id: obj.id,
                x: Math.round(obj.x),
                y: Math.round(obj.y),
                w: Math.round(obj.width),
                h: Math.round(obj.height),
            }
        }))
    }

    setController(token_id: string, new_controller: string): void {
        this.socket.send(JSON.stringify({
            SetController: { token_id, new_controller }
        }));
    }

    // Listeners should use a unique reference string, to prevent duplicate listeners.
    addPlaceTokenListener(ref: string, listener: ((msg: PlaceTokenMessage) => void)): void {
        this.placeTokenListeners[ref] = listener;
    }

    addDeleteTokenListener(ref: string, listener: ((msg: DeleteTokenMessage) => void)): void {
        this.deleteTokenListeners[ref] = listener;
    }

    addPlaceObjListener(ref: string, listener: ((msg: PlaceObjMessage) => void)): void {
        this.placeObjListeners[ref] = listener;
    }

    addDeleteObjListener(ref: string, listener: ((msg: DeleteObjMessage) => void)): void {
        this.deleteObjListeners[ref] = listener;
    }

    addMoveTokenListener(ref: string, listener: ((msg: MoveTokenMessage) => void)): void {
        this.moveTokenListeners[ref] = listener;
    }

    addSetControllerListener(ref: string, listener: ((msg: SetControllerMessage) => void)): void {
        this.setControllerListeners[ref] = listener;
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

    async loadObjs(setObjs: (objs: GameObj[]) => void): Promise<void> {
        if (this.hostId >= 0) {
            const allObjs = this.isHost
                ? await api.getOwnedObjs(this.user)
                : await api.getOtherObjs(this.user, this.hostId);
            if (allObjs.status) {
                setObjs(allObjs.objs);
            } else {
                console.error('failed to get object list', allObjs);
            }
        } else {
            setObjs([]);
        }
    }

    loadObjsSync(setObjs: (objs: GameObj[]) => void): void {
        this.loadObjs(setObjs).then(_ => {
        });
    }

    // This function caches image downloads from the server
    getObjectImageElem(obj_id: number): HTMLImageElement {
        if (!(obj_id in this.allObjs)) {
            if (!this.loading) {
                this.loading = true;
                // re-download the object list
                // TODO: use cache diff instead
                this.loadObjsSync(res => {
                    for (const obj of res) {
                        this.allObjs[obj.id] = obj;
                    }
                    this.loading = false;
                });
            }
            return null;
        }

        // look for a hidden element
        const obj = this.allObjs[obj_id];
        let elem = document.getElementById(`hidden-object-${obj_id}`) as HTMLImageElement;
        if (!elem) {
            const img = document.createElement('img');
            img.id = `hidden-object-${obj_id}`;
            img.alt = '';
            img.src = obj.url;
            img.hidden = true;
            document.querySelector('body').appendChild(img);
            elem = img;
        }

        this.allObjs[obj_id].width = elem.width;
        this.allObjs[obj_id].height = elem.height;

        return elem as HTMLImageElement;
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

// https://stackoverflow.com/questions/105034/how-to-create-guid-uuid
export function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}