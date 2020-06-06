import * as React from 'react';
import { Comms, PlaceTokenMessage } from './CommsComponent';
import { useState } from 'react';
import { Renderer } from './GameStage';

export enum TokenType {
    None,
    Circle,
}

export function drawToken(ctx: CanvasRenderingContext2D, type: TokenType, x: number, y: number, cellSize: number): void {
    const radius = cellSize / 2 * 0.8;
    switch (type) {
        case TokenType.Circle:
            ctx.lineWidth = 4;
            ctx.strokeStyle = 'black';
            ctx.fillStyle = 'red';

            ctx.beginPath();
            ctx.arc(x + cellSize / 2, y + cellSize / 2, radius, 0, Math.PI * 2);
            ctx.closePath();
            
            ctx.fill();
            ctx.stroke();
            break;
    }
}

interface Token {
    kind: TokenType,
    x: number,
    y: number,
}

export interface TokenManagerProps {
    comms: Comms,
    renderer: Renderer,
}

export function TokenManager(props: TokenManagerProps): React.ReactElement {
    const [tokens, setTokens] = useState([] as Token[]);

    function addToken(msg: PlaceTokenMessage): void {
        if (msg.PlaceToken.kind != TokenType.None) {
            setTokens(tokens.concat([msg.PlaceToken]));
        }
    }

    props.comms?.addPlaceTokenListener('TokenLayerAdd', addToken);
    props.renderer.addRenderListener('TokenManagerRender', (ctx, cellSize) => {
        for (const token of tokens) {
            // const { x, y } = props.renderer.invTransform({ x: token.x, y: token.y });
            drawToken(ctx, token.kind, token.x, token.y, cellSize);
        }
    })

    return (null);
}