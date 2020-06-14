import * as React from 'react';
import { Comms, PlaceTokenMessage } from './CommsComponent';
import { useState } from 'react';
import {Point, Renderer} from './GameStage';

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
        case HighlightType.Select:
            ctx.strokeStyle = '#D8D8D8';
            break;
        case HighlightType.Hover:
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

export interface Token {
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

export interface TokenManagerProps {
    comms: Comms,
    renderer: Renderer,
    mouseHoverCoord: Point,
    selectedTokenCoord?: Point
}

export function TokenManager(props: TokenManagerProps): React.ReactElement {
    const [tokens, setTokens] = useState([] as Token[]);

    function addToken(msg: PlaceTokenMessage): void {
        if (msg.kind != TokenType.None) {
            setTokens(tokens.concat([msg]));
        }
    }

    props.comms?.addPlaceTokenListener('TokenLayerAdd', addToken);
    props.renderer.addRenderListener('TokenManagerRender', (ctx, cellSize) => {
        for (const token of tokens) {
            let highlight = HighlightType.None;
            if (token.x == props.mouseHoverCoord.x && token.y == props.mouseHoverCoord.y) {
                highlight = HighlightType.Hover;
            }
            if (props.selectedTokenCoord) {
                if (token.x == props.selectedTokenCoord.x && token.y == props.selectedTokenCoord.y) {
                    highlight = HighlightType.Select;
                }
            }

            drawToken(ctx, token.kind, token.x, token.y, cellSize, token.colour, highlight);
        }
    });

    return null;
}