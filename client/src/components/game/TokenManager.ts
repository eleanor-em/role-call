import {Comms, uuidv4} from './CommsComponent';
import {Point, Renderer} from './GameStage';
import {Anchor, PopupButton} from "./PopupButton";
import {StoredPlayer} from "./GameLanding";

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
    name?: string,
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
    editButton: PopupButton = null;
    options: Options = null;

    forceRender: () => void;
    setForceCursor: (cursor: string) => void;
    players: StoredPlayer[] = [];

    // Token ID -> Movement ID -> Movement
    // this exists to make movement feel more responsive to the user
    tentativeMovements: Record<string, Record<string, TentativeMovement>> = {};

    constructor(comms: Comms, renderer: Renderer, forceRender: () => void, setForceCursor: (cursor: string) => void) {
        this.comms = comms;
        this.renderer = renderer;
        this.forceRender = forceRender;
        this.setForceCursor = setForceCursor;

        comms.addPlaceTokenListener('TokenLayerAdd', msg => {
            if (msg.kind != TokenType.None) {
                this.tokens[msg.id] = msg;
                this.forceRender();
            }
        });

        comms.addDeleteTokenListener('TokenLayerDelete', ({ token_id }) => {
            if (this.selectedToken.id == token_id) {
                this.selectedToken = null;
                this.deleteButton = null;
                this.optionButton = null;
                this.editButton = null;
            }

            delete this.tokens[token_id];
            this.forceRender();
        });

        comms.addMoveTokenListener('TokenLayerMove', ({ id, token_id, dx, dy }) => {
            if (token_id in this.tentativeMovements) {
                delete this.tentativeMovements[token_id][id];
            }
            const delta = { x: dx, y: dy };
            // todo: should use tentative structure
            this.deleteButton?.onTokenMove(delta);
            this.optionButton?.onTokenMove(delta);
            this.editButton?.onTokenMove(delta);

            this.tokens[token_id].x += dx;
            this.tokens[token_id].y += dy;
            this.forceRender();
        });

        comms.addRenameTokenListener('TokenLayerRename', ({ token_id, name }) => {
            this.tokens[token_id].name = name;
        });

        comms.addSetControllerListener('TokenLayerSetCtrl', ({ token_id, new_controller }) => {
            this.tokens[token_id].controller = new_controller;
            this.forceRender();
        });

        renderer.addRenderListener('TokenManagerRender', (ctx, _) => {
            setForceCursor('');
            this.hoveredToken = null;
            this.deleteButton?.setScale(this.renderer.getScale());
            this.deleteButton?.render(ctx);
            this.optionButton?.setScale(this.renderer.getScale());
            this.optionButton?.render(ctx);
            this.editButton?.setScale(this.renderer.getScale());
            this.editButton?.render(ctx);

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
                    this.options?.updatePosition(tx, ty, this.renderer.cellSize);
                }

                // check for controllable shadow
                if (token.controller == this.comms.user.username) {
                    // calculate centre
                    const cx = tx + this.renderer.cellSize / 2;
                    const cy = ty + this.renderer.cellSize / 2;
                    const r0 = Math.round(this.renderer.cellSize * 0.3);
                    const r1 = Math.round(this.renderer.cellSize * 0.5);

                    let grd = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
                    grd.addColorStop(0, 'white');
                    grd.addColorStop(1, '#00000000');
                    ctx.fillStyle = grd;
                    ctx.fillRect(tx - this.renderer.cellSize, ty - this.renderer.cellSize,
                        tx + this.renderer.cellSize, ty + this.renderer.cellSize);
                }

                // draw name if it exists
                if (token.name) {
                    ctx.font = "bold 18pt 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif";
                    ctx.textAlign = 'center';

                    // Name plate
                    const metrics = ctx.measureText(token.name);
                    ctx.fillStyle = '#00000099';
                    const padding = 8;

                    const nameX = tx + this.renderer.cellSize / 2;
                    const nameY = ty - 2;

                    const left = nameX - metrics.actualBoundingBoxLeft - padding;
                    const width = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight + 2 * padding;
                    const top = nameY - metrics.actualBoundingBoxAscent - padding;
                    const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent + 2 * padding;
                    ctx.fillRect(left, top, width, height);

                    ctx.fillStyle = '#ffffffff';
                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = 1;
                    ctx.fillText(token.name, nameX, nameY);
                    ctx.strokeText(token.name, nameX, nameY);
                }

                drawToken(ctx, token.kind, tx, ty, this.renderer.cellSize, token.colour, highlight);
            }

            this.options?.render(ctx);
        });
    }

    onSelectToken(): void {
        // check that we are host, if not don't show options
        if (!this.comms.isHost) {
            return;
        }

        this.options = null;
        if (this.selectedToken == null) {
            this.deleteButton = null;
            this.optionButton = null;
            this.editButton = null;
        } else {
            this.deleteButton = new PopupButton(this.selectedToken.x, this.selectedToken.y,
                this.renderer.cellSize, Anchor.BottomLeft, '\uf014', this.setForceCursor,
                () => this.onDelete());

            this.optionButton = new PopupButton(this.selectedToken.x, this.selectedToken.y,
                this.renderer.cellSize, Anchor.BottomRight, '\uf013', this.setForceCursor,
                () => this.onShowOptions());

            this.editButton = new PopupButton(this.selectedToken.x, this.selectedToken.y,
                this.renderer.cellSize, Anchor.Bottom, '\uf044', this.setForceCursor,
                () => this.onEditName());
        }
    }

    onEditName(): void {
        if (this.selectedToken) {
            this.selectedToken.name = prompt('Enter a new name:', this.selectedToken.name || '');
            this.comms.renameToken(this.selectedToken.id, this.selectedToken.name);
        }
    }

    onClick(): void {
        // check if we clicked on a dropdown box
        if (this.options?.onClick()) {
            return;
        }
        // if not, hide the dropdown
        this.options = null;

        // check if we clicked on a button
        if (this.deleteButton?.onClick() || this.optionButton?.onClick() || this.editButton?.onClick()) {
            return;
        }

        const lastSelected = this.selectedToken;

        // find the hovered token if any
        this.selectedToken = null;
        for (const token_id in this.tokens) {
            const token = this.tokens[token_id];
            if (token.x == this.mouseCoord.x && token.y == this.mouseCoord.y) {
                this.selectedToken = token;
                break;
            }
        }

        if (lastSelected != this.selectedToken) {
            this.onSelectToken();
        }
    }

    onShowOptions(): void {
        if (this.selectedToken) {
            this.options = new Options(this.selectedToken.x, this.selectedToken.y, this.renderer.cellSize,
                this.players, new_controller => this.comms.setController(this.selectedToken.id, new_controller),
                this.setForceCursor);
            this.options.setMouseCoord(this.mouseCoord);
        }
    }

    onDelete(): void {
        if (this.selectedToken) {
            if (confirm('Delete this token?')) {
                this.comms.deleteToken(this.selectedToken.id);
            }
        }
    }

    onEscKey(): void {
        this.selectedToken = null;
        this.optionButton = null;
        this.deleteButton = null;
        this.editButton = null;
        this.options = null;
    }

    onArrowKey(key: ArrowKey): void {
        if (this.selectedToken && (this.comms.isHost || this.selectedToken.controller == this.comms.user.username)) {
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
        this.editButton?.setMouseCoord(relMouseCoord);
        this.options?.setMouseCoord(relMouseCoord);

        this.mouseCoord = this.renderer.snapToGrid(relMouseCoord);
    }
}

class Options {
    padding = 14;
    hExtraPadding = 32;
    x: number;
    y: number;
    players: StoredPlayer[];

    lineHeight = 0;
    lineWidth = 0;
    font: string;

    mouseCoord: Point;
    hoveredName: string;
    setController: (new_controller: string) => void;

    setForceCursor: (cursor: string) => void;

    constructor(cellX: number, cellY: number, cellSize: number, players: StoredPlayer[],
                setController: (new_controller: string) => void, setForceCursor: (cursor: string) => void) {
        this.updatePosition(cellX, cellY, cellSize);
        this.players = players;
        this.setController = setController;
        this.setForceCursor = setForceCursor;
        // load the font from the DOM
        const elem = document.getElementsByTagName('body')[0];
        const fontParts = window.getComputedStyle(elem, null)
            .getPropertyValue('font-family')
            .split(' ');
        // Extract the family name
        fontParts.shift();
        this.font = `20px ${fontParts.join(' ')}`;
    }

    updatePosition(cellX: number, cellY: number, cellSize: number) {
        const xOffset = 30;
        const yOffset = 32;

        this.x = cellX + cellSize + xOffset;
        this.y = cellY + yOffset + cellSize;
    }

    calculateSizes(ctx: CanvasRenderingContext2D) {
        if (this.lineHeight == 0) {
            // hack: height is roughly equal to the width of M
            ctx.font = this.font;
            // add 1 for border
            this.lineHeight = ctx.measureText('M').width + 1;

            // find longest name
            this.lineWidth = this.players.map(player => ctx.measureText(player.name).width)
                    .reduce((acc, cur) => cur > acc ? cur : acc, 0)
                + this.padding;
        }
    }

    render(ctx: CanvasRenderingContext2D): void {
        this.calculateSizes(ctx);

        // Draw menu background
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#0f111a';
        this.hoveredName = null;

        // Draw player selections
        for (const i in this.players) {
            const name = this.players[i].name;

            const x = this.x - this.padding;
            const y = this.y + parseInt(i) * (this.lineHeight  + this.padding) - this.padding;
            const w = this.lineWidth + this.padding + this.hExtraPadding;
            const h = this.lineHeight + this.padding;

            if (this.mouseCoord.x > x && this.mouseCoord.x < x + w
                && this.mouseCoord.y > y && this.mouseCoord.y < y + h) {
                this.hoveredName = name;
                ctx.fillStyle = '#444C7B';
            } else {
                ctx.fillStyle = '#2D3354';
            }
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);

            ctx.textAlign = 'left';
            ctx.font = this.font;
            ctx.fillStyle = '#e2cca4';
            ctx.fillText(name, x + this.padding, y + h - this.padding / 2);
        }

        if (this.hoveredName) {
            this.setForceCursor('pointer');
        }
    }

    onClick(): boolean {
        if (this.hoveredName) {
            this.setController(this.hoveredName);
            return true;
        } else {
            return false;
        }
    }

    setMouseCoord(relMouseCoord: Point): void {
        this.mouseCoord = relMouseCoord;
    }
}
