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

export class TokenManager {
    renderer: Renderer;
    comms: Comms;
    mouseCoord = { x: 0, y: 0};
    tokens: Token[] = [];
    hoveredIndex = -1;
    selectedIndex = -1;

    constructor(comms: Comms, renderer: Renderer, forceRender: () => void) {
        this.comms = comms;
        this.renderer = renderer;

        comms.addPlaceTokenListener('TokenLayerAdd', msg => {
            if (msg.kind != TokenType.None) {
                this.tokens.push(msg);
                forceRender();
            }
        });

        comms.addDeleteTokenListener('TokenLayerDelete', ({ x, y }) => {
            this.tokens = this.tokens.filter(token => token.x != x && token.y != y);
        });

        renderer.addRenderListener('TokenManagerRender', (ctx, cellSize) => {
            this.hoveredIndex = -1;
            for (let i = 0; i < this.tokens.length; ++i) {
                const token = this.tokens[i];
                let highlight = HighlightType.None;
                if (token.x == this.mouseCoord.x && token.y == this.mouseCoord.y) {
                    highlight = HighlightType.Hover;
                    this.hoveredIndex = i;
                }
                if (i == this.selectedIndex) {
                    highlight = HighlightType.Select;
                }

                drawToken(ctx, token.kind, token.x, token.y, cellSize, token.colour, highlight);
            }
        });
    }

    onClick(): void {
        // find the hovered token if any
        this.selectedIndex = -1;
        for (let i = 0; i < this.tokens.length; ++i) {
            const token = this.tokens[i];
            if (token.x == this.mouseCoord.x && token.y == this.mouseCoord.y) {
                this.selectedIndex = i;
                break;
            }
        }
    }

    onDelete(): void {
        if (this.selectedIndex != -1) {
            const selectedToken = this.tokens[this.selectedIndex];
            this.comms.deleteToken(selectedToken.x, selectedToken.y);
        }
    }

    setMouseCoord(rawMouseCoord: Point): void {
        this.mouseCoord = this.renderer.snapToGrid(this.renderer.transform(rawMouseCoord));
    }
}