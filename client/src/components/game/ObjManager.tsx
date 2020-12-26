import * as React from 'react';
import {Point, Renderer} from "./GameStage";
import {StoredPlayer} from "./GameLanding";
import {Comms} from "./CommsComponent";
import {Anchor, PopupButton} from "./PopupButton";

export interface PlacedObj {
    id?: string,
    obj_id: number,
    x: number,
    y: number,
    width: number,
    height: number,
    controller?: string,
}

const controlSize = 10;

function drawObject(ctx: CanvasRenderingContext2D, x: number, y: number, elem: HTMLImageElement): void {
    if (elem) {
        ctx.drawImage(elem, x - elem.width / 2, y - elem.height / 2);
    }
}

export function drawSelectedObject(ctx: CanvasRenderingContext2D, x: number, y: number, elem: HTMLImageElement): void {
    ctx.globalAlpha = 0.4;
    drawObject(ctx, x, y, elem);
    ctx.globalAlpha = 1.0;
}

function intersectsObj(coord: Point, obj: PlacedObj): boolean {
    return coord.x >= obj.x - obj.width / 2 && coord.x <= obj.x + obj.width / 2
        && coord.y >= obj.y - obj.height / 2 && coord.y <= obj.y + obj.height / 2;
}

function drawOutline(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, selected: boolean): void {
    ctx.strokeRect(x - width / 2, y - height / 2, width, height);
    if (selected) {
        // Draw control points
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;

        for (let i = 0; i < 3; ++i) {
            for (let j = 0; j < 3; ++j) {
                if (i == j && i == 1) {
                    continue;
                }
                ctx.beginPath();
                let xx = x - width / 2 + width * (i / 2) - controlSize / 2;
                let yy = y - height / 2 + height * (j / 2) - controlSize / 2;
                ctx.rect(xx, yy, controlSize, controlSize);
                ctx.fill();
                ctx.stroke();
            }
        }
    }
}

enum DragDirection {
    TopLeft,
    Top,
    TopRight,
    Right,
    BottomRight,
    Bottom,
    BottomLeft,
    Left,
}

function coordsToDragDirection(coords: Point): DragDirection {
    const { x, y } = coords;
    switch (x) {
        case 0:
            switch (y) {
                case 0: return DragDirection.TopLeft;
                case 1: return DragDirection.Left;
                case 2: return DragDirection.BottomLeft;
            }
        case 1:
            return y == 0 ? DragDirection.Top : DragDirection.Bottom;
        case 2:
            switch (y) {
                case 0: return DragDirection.TopRight;
                case 1: return DragDirection.Right;
                case 2: return DragDirection.BottomRight;
            }
    }
}

export class ObjManager {
    renderer: Renderer;
    comms: Comms;
    objs: Record<string, PlacedObj> = {};
    loading = false;

    forceRender: () => void;
    setForcePointer: (force: boolean) => void;
    players: StoredPlayer[] = [];

    mouseCoord: Point;
    hoveredObj: string;
    hoveredTopLeft: Point;
    hoveredObjDims: Point;
    selectedObj: string;
    selectedObjTopLeft: Point;
    selectedObjDims: Point;
    deleteButton: PopupButton = null;

    draggingDir: DragDirection = null;

    constructor(comms: Comms, renderer: Renderer, forceRender: () => void, setForcePointer: (force: boolean) => void) {
        this.comms = comms;
        this.mouseCoord = { x: 0, y: 0 };
        this.renderer = renderer;
        this.forceRender = forceRender;
        this.setForcePointer = setForcePointer;

        renderer.addRenderListener('ObjManagerRender', (ctx, _) => {
            setForcePointer(false);
            this.hoveredObj = null;
            this.deleteButton?.render(ctx);

            for (const id in this.objs) {
                const obj = this.objs[id];
                const elem = comms.getObjectImageElem(obj.obj_id);

                drawObject(ctx, obj.x, obj.y, elem);
                if (elem != null) {
                    const fillStyle = ctx.fillStyle;
                    const strokeStyle = ctx.strokeStyle;
                    const lineWidth = ctx.lineWidth;
                    let draw = false;

                    // Draw outline
                    ctx.lineWidth = 2;
                    if (intersectsObj(this.mouseCoord, obj)) {
                        this.hoveredObj = obj.id;
                        this.hoveredTopLeft = {
                            x: obj.x - elem.width / 2,
                            y: obj.y - elem.height / 2,
                        };
                        this.hoveredObjDims = { x: obj.width, y: obj.height };
                        ctx.strokeStyle = '#dddddd';
                        draw = true;
                    }
                    if (this.selectedObj == id) {
                        ctx.strokeStyle = 'white';
                        this.selectedObjDims = { x: obj.width, y: obj.height };
                        draw = true;
                    }

                    if (draw) {
                        drawOutline(ctx, obj.x, obj.y, obj.width, obj.height, this.selectedObj == id);
                    }

                    ctx.fillStyle = fillStyle;
                    ctx.strokeStyle = strokeStyle;
                    ctx.lineWidth = lineWidth;
                }
            }
        });

        comms.addPlaceObjListener('ObjLayerAdd', msg => {
            this.objs[msg.id] = msg;
            forceRender();
        });

        comms.addDeleteObjListener('ObjManagerDelete', ({ obj_id }) => {
            if (this.selectedObj === obj_id.toString()) {
                this.deleteButton = null;
                this.selectedObj = null;
            }

            delete this.objs[obj_id.toString()];
            this.forceRender();
        });
    }

    setMouseCoord(rawMouseCoord: Point): void {
        this.mouseCoord = this.renderer.transform(rawMouseCoord);
        this.deleteButton?.setMouseCoord(this.mouseCoord);
    }

    checkHoveringControls(): boolean {
        console.log(`target: (${this.mouseCoord.x}, ${this.mouseCoord.y})`);

        for (let i = 0; i < 3; ++i) {
            for (let j = 0; j < 3; ++j) {
                if (i == 1 && j == 1) {
                    continue;
                }
                // recycled from controls drawing
                let xx = this.selectedObjTopLeft.x + this.selectedObjDims.x * (i / 2) - controlSize / 2;
                let yy = this.selectedObjTopLeft.y + this.selectedObjDims.y * (j / 2) - controlSize / 2;

                console.log(`attempt: (${xx}, ${yy}) to (${xx + controlSize}, ${yy + controlSize})`);

                if (this.mouseCoord.x >= xx && this.mouseCoord.x <= xx + controlSize
                    && this.mouseCoord.y >= yy && this.mouseCoord.y <= yy + controlSize) {
                    // TODO: set appropriate cursor
                    this.draggingDir = coordsToDragDirection({ x: i, y: j });
                    console.log(this.draggingDir.toString());
                    return true;
                }
            }
        }

    }

    onClick(): void {
        if (this.deleteButton?.onClick()) {
            return;
        }

        if (this.selectedObj != null && this.checkHoveringControls()) {
            // TODO
        } else {
            const prevSelected = this.selectedObj;

            if (this.hoveredObj != null) {
                this.selectedObj = this.hoveredObj;
                this.selectedObjTopLeft = this.hoveredTopLeft;
                this.selectedObjDims = this.hoveredObjDims;

                if (this.selectedObj != prevSelected) {
                    this.deleteButton = new PopupButton(this.hoveredTopLeft.x - 10, this.hoveredTopLeft.y - 10,
                        this.renderer.cellSize, Anchor.TopLeft, '\uf014', this.setForcePointer,
                        () => this.onDelete());
                }
            } else {
                this.selectedObj = null;
                this.deleteButton = null;
            }
        }
    }

    onMouseUp(): void {
        this.draggingDir = null;
    }

    onDelete(): void {
        if (this.selectedObj) {
            if (confirm('Delete this object?')) {
                console.log('delete id: ' + this.selectedObj);
                this.comms.deleteObj(this.selectedObj);
            }
        }
    }

    onEscKey(): void {
        this.selectedObj = null;
    }
}
