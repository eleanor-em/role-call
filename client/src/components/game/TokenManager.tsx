import * as React from 'react';
import {Comms, uuidv4} from './CommsComponent';
import {Point, Renderer} from './GameStage';
import {Anchor, PopupButton} from "./PopupButton";

export enum TokenType {
    None,
    Circle,
    Square,
    Triangle,
    Diamond
}

export enum HighlightType {
    None,
    Select,
    Hover
}

export function drawToken(ctx: CanvasRenderingContext2D,
    type: TokenType,
    x: number,
    y: number,
    cellSize: number,
    colour: string,
    highlight=HighlightType.None): void {

    const padding = cellSize * 0.15;
    const radius = (cellSize - 2 * padding) / 2;

    ctx.lineWidth = 2;
    ctx.strokeStyle = 'black';
    switch (highlight) {
        case HighlightType.Hover:
            ctx.strokeStyle = '#bbbbbb';
            break;
        case HighlightType.Select:
            ctx.strokeStyle = 'white';
            break;

    }
    ctx.fillStyle = colour;

    switch (type) {
        case TokenType.Circle:
            ctx.beginPath();
            ctx.arc(x + cellSize / 2, y + cellSize / 2, radius, 0, Math.PI * 2);
            ctx.closePath();
            
            ctx.fill();
            ctx.stroke();
            break;

        case TokenType.Square:
            ctx.beginPath();
            ctx.moveTo(x + padding, y + padding);
            ctx.lineTo(x + cellSize - padding, y + padding);
            ctx.lineTo(x + cellSize - padding, y + cellSize - padding);
            ctx.lineTo(x + padding, y + cellSize - padding);
            ctx.closePath();

            ctx.fill();
            ctx.stroke();
            break;
        
        case TokenType.Triangle:
            ctx.beginPath();
            ctx.moveTo(x + cellSize / 2, y + padding);
            ctx.lineTo(x + cellSize - padding, y + cellSize - padding);
            ctx.lineTo(x + padding, y + cellSize - padding);
            ctx.closePath();

            ctx.fill();
            ctx.stroke();
            break;
        
        case TokenType.Diamond:
            ctx.beginPath();
            ctx.moveTo(x + padding, y + cellSize / 2);
            ctx.lineTo(x + cellSize / 2, y + padding);
            ctx.lineTo(x + cellSize - padding, y + cellSize / 2);
            ctx.lineTo(x + cellSize / 2, y + cellSize - padding);
            ctx.closePath();

            ctx.fill();
            ctx.stroke();
            break;
    }
}

export enum ArrowKey {
    Left,
    Right,
    Up,
    Down
}

export interface Token {
    id?: string,
    kind: TokenType,
    x: number,
    y: number,
    colour: string,
    controller?: string,
}

export function getTokenCoord(token?: Token): Point {
    if (token) {
        return {
            x: token.x,
            y: token.y
        };
    } else {
        return null;
    }
}


class TentativeMovement {
    delta: Point;
    timestamp: Date;

    timeout = 1000;

    constructor(delta: Point) {
        this.delta = delta;
        this.timestamp = new Date();
    }

    timedOut(): boolean {
        return (new Date().getMilliseconds() - this.timestamp.getMilliseconds()) > this.timeout;
    }
}

export class TokenManager {
    renderer: Renderer;
    comms: Comms;
    mouseCoord = { x: 0, y: 0};
    tokens: Record<string, Token> = {};
    hoveredToken: Token = null;
    selectedToken: Token = null;
    deleteButton: PopupButton = null;
    optionButton: PopupButton = null;
    forceRender: () => void;

    // Token ID -> Movement ID -> Movement
    // this exists to make movement feel more responsive to the user
    tentativeMovements: Record<string, Record<string, TentativeMovement>> = {};

    constructor(comms: Comms, renderer: Renderer, forceRender: () => void) {
        this.comms = comms;
        this.renderer = renderer;
        this.forceRender = forceRender;

        comms.addPlaceTokenListener('TokenLayerAdd', msg => {
            if (msg.kind != TokenType.None) {
                this.tokens[msg.id] = msg;
                forceRender();
            }
        });

        comms.addDeleteTokenListener('TokenLayerDelete', ({ token_id }) => {
            if (this.selectedToken.id == token_id) {
                this.selectedToken = null;
                this.deleteButton = null;
                this.optionButton = null;
            }

            delete this.tokens[token_id];
        });

        comms.addMoveTokenListener('TokenLayerMove', ({ id, token_id, dx, dy }) => {
            if (token_id in this.tentativeMovements) {
                delete this.tentativeMovements[token_id][id];
            }
            const delta = { x: dx, y: dy };
            // todo: should use tentative structure
            this.deleteButton?.onTokenMove(delta);
            this.optionButton?.onTokenMove(delta);

            this.tokens[token_id].x += dx;
            this.tokens[token_id].y += dy;
            console.log(`moving token #${token_id} by (${dx}, ${dy})`);
        })

        renderer.addRenderListener('TokenManagerRender', (ctx, _) => {
            this.hoveredToken = null;
            this.deleteButton?.render(ctx);
            this.optionButton?.render(ctx);

            for (const token_id in this.tokens) {
                const token = this.tokens[token_id];

                // check tentative movements
                let tx = token.x;
                let ty = token.y;
                for (const id in this.tentativeMovements[token_id]) {
                    const move = this.tentativeMovements[token_id][id];

                    if (move.timedOut()) {
                        delete this.tentativeMovements[token_id][id];
                    } else {
                        tx += move.delta.x;
                        ty += move.delta.y;
                    }
                }

                // check for hover/selection
                let highlight = HighlightType.None;
                if (tx == this.mouseCoord.x && ty == this.mouseCoord.y) {
                    highlight = HighlightType.Hover;
                    this.hoveredToken = token;
                }
                if (this.selectedToken?.id == token_id) {
                    highlight = HighlightType.Select;
                }

                drawToken(ctx, token.kind, tx, ty, this.renderer.cellSize, token.colour, highlight);
            }
        });
    }

    onSelectToken(): void {
        if (this.selectedToken == null) {
            this.deleteButton = null;
            this.optionButton = null;
        } else {
            this.deleteButton = new PopupButton(this.selectedToken.x, this.selectedToken.y,
                this.renderer.cellSize, Anchor.TopLeft, '\uf014');
            this.deleteButton.setMouseCoord(this.mouseCoord);

            this.optionButton = new PopupButton(this.selectedToken.x, this.selectedToken.y,
                this.renderer.cellSize, Anchor.TopRight, '\uf013');
            this.optionButton.setMouseCoord(this.mouseCoord);

            this.forceRender();
        }
    }

    onClick(): void {
        this.deleteButton?.onClick();
        this.optionButton?.onClick();

        const lastSelected = this.selectedToken;

        // find the hovered token if any
        this.selectedToken = null;
        for (const token_id in this.tokens) {
            const token = this.tokens[token_id];
            console.log(`compare: token ${token_id}, (${token.x}, ${token.y}) vs (${this.mouseCoord.x}, ${this.mouseCoord.y})`);
            if (token.x == this.mouseCoord.x && token.y == this.mouseCoord.y) {
                this.selectedToken = token;
                break;
            }
        }

        if (lastSelected != this.selectedToken) {
            this.onSelectToken();
        }
    }

    onDelete(): void {
        if (this.selectedToken) {
            this.comms.deleteToken(this.selectedToken.id);
        }
    }

    onArrowKey(key: ArrowKey): void {
        if (this.selectedToken) {
            // construct the message
            const delta = this.arrowKeyToDelta(key);
            const id = uuidv4();
            this.comms.moveToken(id, this.selectedToken.id, delta.x, delta.y);

            // add to tentative movements for this token
            if (!(this.selectedToken.id in this.tentativeMovements)) {
                this.tentativeMovements[this.selectedToken.id] = {};
            }
            this.tentativeMovements[this.selectedToken.id][id] = new TentativeMovement(delta);
        }
    }

    arrowKeyToDelta(key: ArrowKey): Point {
        switch (key) {
            case ArrowKey.Left:
                return { x: -64, y: 0 };
            case ArrowKey.Right:
                return { x: 64, y: 0 };
            case ArrowKey.Up:
                return { x: 0, y: -64 };
            case ArrowKey.Down:
                return { x: 0, y: 64 };
        }
    }

    setMouseCoord(rawMouseCoord: Point): void {
        const relMouseCoord = this.renderer.transform(rawMouseCoord);

        this.deleteButton?.setMouseCoord(relMouseCoord);
        this.optionButton?.setMouseCoord(relMouseCoord);
        this.mouseCoord = this.renderer.snapToGrid(relMouseCoord);
    }
}