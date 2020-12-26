import * as React from 'react';
import {Point, Renderer} from "./GameStage";
import {StoredPlayer} from "./GameLanding";
import {Comms} from "./CommsComponent";
import {GameObj} from "../../models/GameObj";
import {Anchor, PopupButton} from "./PopupButton";

export interface PlacedObj {
    id?: string,
    obj_id: number,
    x: number,
    y: number,
    controller?: string,
}

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

function intersectsObj(coord: Point, objX: number, objY: number, elem:HTMLImageElement): boolean {
    return coord.x >= objX && coord.x <= objX + elem.width
        && coord.y >= objY && coord.y <= objY + elem.height;
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
    selectedObj: string;
    deleteButton: PopupButton = null;

    constructor(comms: Comms, renderer: Renderer, forceRender: () => void, setForcePointer: (force: boolean) => void) {
        this.comms = comms;
        this.mouseCoord = { x: 0, y: 0 };
        this.renderer = renderer;
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
                    const strokeStyle = ctx.strokeStyle;
                    const lineWidth = ctx.lineWidth;
                    let draw = false;

                    // Draw outline
                    ctx.lineWidth = 2;
                    if (intersectsObj(this.mouseCoord, obj.x - elem.width / 2, obj.y - elem.height / 2, elem)) {
                        this.hoveredObj = obj.id;
                        this.hoveredTopLeft = {
                            x: obj.x - elem.width / 2,
                            y: obj.y - elem.height / 2,
                        };
                        ctx.strokeStyle = '#dddddd';
                        draw = true;
                    }
                    if (this.selectedObj == id) {
                        ctx.strokeStyle = 'white';
                        draw = true;
                    }

                    if (draw) {
                        ctx.strokeRect(obj.x - elem.width / 2, obj.y - elem.height / 2, elem.width, elem.height);
                    }

                    ctx.strokeStyle = strokeStyle;
                    ctx.lineWidth = lineWidth;
                }
            }
        });

        comms.addPlaceObjListener('ObjLayerAdd', msg => {
            this.objs[msg.id] = msg;
            forceRender();
        });
    }

    setMouseCoord(rawMouseCoord: Point): void {
        this.mouseCoord = this.renderer.transform(rawMouseCoord);
        this.deleteButton?.setMouseCoord(this.mouseCoord);
    }

    onClick(): void {
        if (this.deleteButton?.onClick()) {
            return;
        }
        this.selectedObj = this.hoveredObj;

        if (this.selectedObj == null) {
            this.deleteButton = null;
        } else {
            this.deleteButton = new PopupButton(this.hoveredTopLeft.x - 10, this.hoveredTopLeft.y - 10,
                this.renderer.cellSize, Anchor.TopLeft, '\uf014', this.setForcePointer,
                () => this.onDelete());
        }
    }

    onDelete(): void {
        // TODO
    }

    onEscKey(): void {
        this.selectedObj = null;
    }
}
