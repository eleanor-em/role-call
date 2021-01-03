import * as React from "react";
import {Point} from "./GameStage";

export enum Anchor {
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
    Top,
    Right,
    Bottom,
    Left
}

const iconBackground = '#444444';
const iconNotHighlighted = '#999999';
const iconHighlighted = '#ffffff';

export class PopupButton {
    defaultRadius = 15;
    radius = 15;
    offsetX = 6;
    offsetY = 8;
    textWidth = (this.radius * 2) * 0.9;
    bkgOffsetY = 2;

    anchor: Anchor;

    x: number;
    y: number;
    content: string;
    hovered = false;
    cellSize: number;

    setForceCursor: (cursor: string) => void;
    handleClickAction: () => void;

    constructor(cellX: number, cellY: number, cellSize: number, anchor: Anchor, content: string,
                setForceCursor: (cursor: string) => void, handleClickAction: () => void) {
        this.content = content;
        this.setForceCursor = setForceCursor;
        this.handleClickAction = handleClickAction;
        this.cellSize = cellSize;
        this.anchor = anchor;

        this.setPosition(cellX, cellY);
    }

    setPosition(cellX: number, cellY: number) {
        const centreScale = 2;
        switch (this.anchor) {
            case Anchor.TopLeft:
                this.x = cellX - this.offsetX;
                this.y = cellY - this.offsetY;
                break;

            case Anchor.TopRight:
                this.x = cellX + this.cellSize + this.offsetX;
                this.y = cellY - this.offsetY;
                break;

            case Anchor.BottomLeft:
                this.x = cellX - this.offsetX;
                this.y = cellY + this.cellSize + this.offsetY;
                break;

            case Anchor.BottomRight:
                this.x = cellX + this.cellSize + this.offsetX;
                this.y = cellY + this.cellSize + this.offsetY;
                break;

            case Anchor.Top:
                this.x = cellX + this.cellSize / 2;
                this.y = cellY - this.offsetY * centreScale;
                break;

            case Anchor.Right:
                this.x = cellX + this.cellSize + this.offsetX * centreScale;
                this.y = cellY + this.cellSize / 2;
                break;

            case Anchor.Bottom:
                this.x = cellX + this.cellSize / 2;
                this.y = cellY + this.cellSize + this.offsetY * centreScale;
                break;
        }
    }

    setMouseCoord(relMouseCoord: Point): void {
        const left = this.x - this.radius;
        const right = this.x + this.radius;
        const top = this.y - this.radius;
        const bottom = this.y + this.radius;

        this.hovered = relMouseCoord.x > left && relMouseCoord.x <  right
            && relMouseCoord.y > top && relMouseCoord.y < bottom;
    }

    onTokenMove(delta: Point): void {
        this.x += delta.x;
        this.y += delta.y;
    }

    // returns true if the action was performed
    onClick(): boolean {
        if (this.hovered) {
            this.handleClickAction();
            return true;
        } else {
            return false;
        }
    }

    setScale(scale: number) {
        this.radius = this.defaultRadius / scale;
    }

    render(ctx: CanvasRenderingContext2D): void {
        ctx.fillStyle = iconBackground;
        ctx.beginPath();
        ctx.arc(this.x, this.y + this.bkgOffsetY, this.radius * 1.1, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = this.hovered ? iconHighlighted : iconNotHighlighted;
        ctx.font = `${Math.round(1.8 * this.radius)}px FontAwesome`;
        ctx.textAlign = 'center';
        ctx.fillText(this.content, this.x, this.y + this.radius * 0.8);

        if (this.hovered) {
            this.setForceCursor('pointer');
        }
    }
}