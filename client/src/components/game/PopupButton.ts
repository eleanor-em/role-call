import * as React from "react";
import {Point} from "./GameStage";

export enum Anchor {
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
}

const iconBackground = '#333333';
const iconNotHighlighted = '#666666';
const iconHighlighted = '#aaaaaa';

export class PopupButton {
    radius = 14;
    offsetX = 6;
    offsetY = 8;
    textWidth = (this.radius * 2) * 0.9;
    bkgOffsetY = 2;

    x: number;
    y: number;
    content: string;
    hovered = false;

    setForcePointer: (force: boolean) => void;
    handleClickAction: () => void;

    constructor(cellX: number, cellY: number, cellSize: number, anchor: Anchor, content: string,
                setForcePointer: (force: boolean) => void, handleClickAction: () => void) {
        this.content = content;
        this.setForcePointer = setForcePointer;
        this.handleClickAction = handleClickAction;

        switch (anchor) {
            case Anchor.TopLeft:
                this.x = cellX - this.offsetX;
                this.y = cellY - this.offsetY;
                break;

            case Anchor.TopRight:
                this.x = cellX + cellSize + this.offsetX;
                this.y = cellY - this.offsetY;
                break;

            case Anchor.BottomLeft:
                this.x = cellX - this.offsetX;
                this.y = cellY + cellSize + this.offsetY;
                break;

            case Anchor.BottomRight:
                this.x = cellX + cellSize + this.offsetX;
                this.y = cellY + cellSize + this.offsetY;
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

    render(ctx: CanvasRenderingContext2D): void {
        ctx.fillStyle = iconBackground;
        ctx.beginPath();
        ctx.arc(this.x, this.y + this.bkgOffsetY, this.radius * 1.1, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = this.hovered ? iconHighlighted : iconNotHighlighted;
        ctx.font = `${2 * this.radius}px FontAwesome`;
        this.textWidth = ctx.measureText(this.content).width;
        ctx.fillText(this.content, this.x - this.textWidth / 2, this.y + this.textWidth / 2);

        if (this.hovered) {
            this.setForcePointer(true);
        }
    }
}