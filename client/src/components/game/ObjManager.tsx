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

export function drawSelectedObject(ctx: CanvasRenderingContext2D, x: number, y: number, elem: HTMLImageElement): void {
    ctx.globalAlpha = 0.4;
    if (elem) {
        ctx.drawImage(elem, x - elem.width / 2, y - elem.height / 2);
    }
    ctx.globalAlpha = 1.0;
}

function intersectsObj(coord: Point, obj: PlacedObj): boolean {
    return coord.x >= obj.x && coord.x <= obj.x + obj.width
        && coord.y >= obj.y && coord.y <= obj.y + obj.height;
}

function drawOutline(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, selected: boolean): void {
    ctx.strokeRect(x, y, width, height);
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
                let xx = x + width * (i / 2) - controlSize / 2;
                let yy = y + height * (j / 2) - controlSize / 2;
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
    const {x, y} = coords;
    switch (x) {
        case 0:
            switch (y) {
                case 0:
                    return DragDirection.TopLeft;
                case 1:
                    return DragDirection.Left;
                case 2:
                    return DragDirection.BottomLeft;
            }
        case 1:
            return y == 0
                ? DragDirection.Top
                : DragDirection.Bottom;
        case 2:
            switch (y) {
                case 0:
                    return DragDirection.TopRight;
                case 1:
                    return DragDirection.Right;
                case 2:
                    return DragDirection.BottomRight;
            }
    }
}

function dragDirToCursor(dir: DragDirection): string {
    switch (dir) {
        case DragDirection.TopLeft:
            return 'nw-resize';
        case DragDirection.Top:
            return 'n-resize';
        case DragDirection.TopRight:
            return 'ne-resize';
        case DragDirection.Right:
            return 'e-resize';
        case DragDirection.BottomRight:
            return 'se-resize';
        case DragDirection.Bottom:
            return 's-resize';
        case DragDirection.BottomLeft:
            return 'sw-resize';
        case DragDirection.Left:
            return 'w-resize';
        default:
            return '';
    }
}

export class ObjManager {
    renderer: Renderer;
    comms: Comms;
    objs: Record<string, PlacedObj> = {};
    loading = false;

    forceRender: () => void;
    setForceCursor: (cursor: string) => void;
    players: StoredPlayer[] = [];

    mouseCoord: Point;
    hoveredObj: string;
    hoveredTopLeft: Point;
    hoveredObjDims: Point;
    selectedObj: string;
    deleteButton: PopupButton = null;

    draggingDir: DragDirection = null;
    dragOrigin: Point = null;
    dragObjOriginTopLeft: Point = null;
    dragObjOriginDims: Point = null;

    constructor(comms: Comms, renderer: Renderer, forceRender: () => void, setForceCursor: (cursor: string) => void) {
        this.comms = comms;
        this.mouseCoord = {x: 0, y: 0};
        this.renderer = renderer;
        this.forceRender = forceRender;
        this.setForceCursor = setForceCursor;

        renderer.addRenderListener('ObjManagerRender', (ctx, _) => {
            setForceCursor('');
            this.hoveredObj = null;
            this.deleteButton?.render(ctx);

            if (this.draggingDir) {
                setForceCursor(dragDirToCursor(this.draggingDir));
            } else {
                setForceCursor(dragDirToCursor(this.checkHoveringControls()));
            }

            for (const id in this.objs) {
                const obj = this.objs[id];
                const elem = comms.getObjectImageElem(obj.obj_id);
                if (elem !== null) {
                    ctx.drawImage(elem, obj.x, obj.y, obj.width, obj.height);
                }

                // drawObject(ctx, obj.x, obj.y, elem);
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
                            x: obj.x,
                            y: obj.y,
                        };
                        this.hoveredObjDims = {x: obj.width, y: obj.height};
                        ctx.strokeStyle = '#dddddd';
                        draw = true;
                    }
                    if (this.selectedObj == id) {
                        ctx.strokeStyle = 'white';
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

        comms.addDeleteObjListener('ObjManagerDelete', ({obj_id}) => {
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

        // handle dragging
        if (this.draggingDir !== null) {
            const dx = this.dragOrigin.x - this.mouseCoord.x;
            const dy = this.dragOrigin.y - this.mouseCoord.y;
            const {x, y} = this.dragObjOriginTopLeft;
            const {x: w, y: h} = this.dragObjOriginDims;
            const aspect = w / h;
            let s;
            let preserveAspect = false;

            let nx = x, ny = y, nw = w, nh = h;
            switch (this.draggingDir) {
                case DragDirection.TopLeft:
                    s = Math.max(dx, dy);
                    nx = x - s;
                    ny = y - s / aspect;
                    nw = w + s;
                    preserveAspect = true;
                    break;
                case DragDirection.Top:
                    ny = y - dy;
                    nh = h + dy;
                    break;
                case DragDirection.TopRight:
                    s = Math.max(-dx, dy);
                    ny = y - s / aspect;
                    nw = w + s;
                    preserveAspect = true;
                    break;
                case DragDirection.Right:
                    nw = w - dx;
                    break;
                case DragDirection.BottomRight:
                    s = Math.max(-dx, -dy);
                    nw = w + s;
                    preserveAspect = true;
                    break;
                case DragDirection.Bottom:
                    nh = h - dy;
                    break;
                case DragDirection.BottomLeft:
                    s = Math.max(dx, -dy);
                    nx = x - s;
                    nw = w + s;
                    preserveAspect = true;
                    break;
                case DragDirection.Left:
                    nx = x - dx;
                    nw = w + dx;
                    break;
            }

            // Prevent making it too small (would cause memory leaks)
            nw = nw < 16 ? 16 : nw;
            nh = nh < 16 / aspect ? 16 / aspect : nh;

            // Snap to grid
            const snapTolerance = 8;

            let snapX = Math.round(nx / this.renderer.cellSize) * this.renderer.cellSize;

            if (Math.abs(snapX - nx) < snapTolerance) {
                const delta = snapX - nx;
                nx += delta;
                nw -= delta;
                if (preserveAspect) {
                    ny += delta / aspect;
                }
            }

            snapX = Math.round((nx + nw) / this.renderer.cellSize) * this.renderer.cellSize;
            if (Math.abs(snapX - (nx + nw)) < snapTolerance) {
                const delta = snapX - (nx + nw);
                nw += delta;
            }

            // Only snap in y if we aren't preserving aspect ratio.
            // This is a bit of a hack.
            if (!preserveAspect) {
                let snapY = Math.round(ny / this.renderer.cellSize) * this.renderer.cellSize;
                if (Math.abs(snapY - ny) < snapTolerance) {
                    const delta = snapY - ny;
                    ny += delta;
                    nh -= delta;
                }

                snapY = Math.round((ny + nh) / this.renderer.cellSize) * this.renderer.cellSize;
                if (Math.abs(snapY - (ny + nh)) < snapTolerance) {
                    const delta = snapY - (ny + nh);
                    nh += delta;
                }
            }

            if (preserveAspect) {
                nh = nw / aspect;
            }

            this.objs[this.selectedObj].x = nx;
            this.objs[this.selectedObj].y = ny;
            this.objs[this.selectedObj].width = nw;
            this.objs[this.selectedObj].height = nh;
        }
    }

    checkHoveringControls(): DragDirection {
        if (!this.selectedObj) {
            return null;
        }
        const obj = this.objs[this.selectedObj];

        for (let i = 0; i < 3; ++i) {
            for (let j = 0; j < 3; ++j) {
                if (i == 1 && j == 1) {
                    continue;
                }
                // recycled from controls drawing
                let xx = obj.x + obj.width * (i / 2) - controlSize / 2;
                let yy = obj.y + obj.height * (j / 2) - controlSize / 2;

                if (this.mouseCoord.x >= xx && this.mouseCoord.x <= xx + controlSize
                    && this.mouseCoord.y >= yy && this.mouseCoord.y <= yy + controlSize) {
                    return coordsToDragDirection({x: i, y: j});
                }
            }
        }

        return null;
    }

    onClick(): void {
        if (this.deleteButton?.onClick()) {
            return;
        }

        if (this.selectedObj != null) {
            this.draggingDir = this.checkHoveringControls();
            if (this.draggingDir !== null) {
                const obj = this.objs[this.selectedObj];
                this.dragOrigin = this.mouseCoord;
                this.dragObjOriginTopLeft = {x: obj.x, y: obj.y};
                this.dragObjOriginDims = {x: obj.width, y: obj.height};
            } else {
                this.selectedObj = null;
                this.deleteButton = null;
            }
        } else {
            const prevSelected = this.selectedObj;

            if (this.hoveredObj != null) {
                this.selectedObj = this.hoveredObj;

                if (this.selectedObj != prevSelected) {
                    this.deleteButton = new PopupButton(this.hoveredTopLeft.x - 10, this.hoveredTopLeft.y - 10,
                        this.renderer.cellSize, Anchor.TopLeft, '\uf014',
                        force => force ? this.setForceCursor('pointer') : this.setForceCursor(''),
                        () => this.onDelete());
                }
            } else {
                this.selectedObj = null;
                this.deleteButton = null;
            }
        }
    }

    onMouseUp(): void {
        if (this.selectedObj) {
            this.comms.moveObj(this.objs[this.selectedObj]);
        }
        this.draggingDir = null;
        this.dragOrigin = null;
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
