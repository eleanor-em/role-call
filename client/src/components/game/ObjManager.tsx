import * as React from 'react';
import {Renderer} from "./GameStage";
import {StoredPlayer} from "./GameLanding";
import {Comms} from "./CommsComponent";
import {GameObj} from "../../models/GameObj";

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

export class ObjManager {
    renderer: Renderer;
    comms: Comms;
    objs: Record<string, PlacedObj> = {};
    loading = false;

    forceRender: () => void;
    setForcePointer: (force: boolean) => void;
    players: StoredPlayer[] = [];

    constructor(comms: Comms, renderer: Renderer, forceRender: () => void, setForcePointer: (force: boolean) => void) {
        this.comms = comms;

        renderer.addRenderListener('ObjManagerRender', (ctx, _) => {
            for (const id in this.objs) {
                const obj = this.objs[id];
                const elem = comms.getObjectImageElem(obj.obj_id);
                drawObject(ctx, obj.x, obj.y, elem);
            }
        });

        comms.addPlaceObjListener('ObjLayerAdd', msg => {
            this.objs[msg.id] = msg;
            forceRender();
        });
    }
}