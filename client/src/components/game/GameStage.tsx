import * as React from 'react';
import '../../css/App.css';
import { useState, useEffect } from 'react';
import { Comms } from './CommsComponent';
import { TokenManager, TokenType, drawToken } from './TokenManager';

export interface Point {
    x: number,
    y: number
}

export interface GameStageProps {
    comms: Comms,
}

export class Renderer {
    // 5 / 6 due to flex in CSS
    width = window.innerWidth * 5 / 6;
    height = window.innerHeight * 0.95;
    cellSize = 64;
    renderListeners: Record<string, (ctx: CanvasRenderingContext2D, cellSize: number) => void>;
    matrix: DOMMatrix = null;

    constructor() {
        this.renderListeners = {};
    }

    invTransform(point: Point): Point {
        const scale = this.matrix.a;
        const transX = this.matrix.e;
        const transY = this.matrix.f;
        const result =  {
            x: Math.round((point.x - transX) / scale),
            y: Math.round((point.y - transY) / scale),
        };
        return result;
    }

    transform(point: Point): Point {
        const scale = this.matrix.a;
        const transX = this.matrix.e;
        const transY = this.matrix.f;
        const result =  {
            x: Math.round(point.x * scale + transX),
            y: Math.round(point.y * scale + transY),
        };
        return result;
    }

    // Listeners should use a unique reference string, to prevent duplicate listeners.
    addRenderListener(ref: string, listener: ((ctx: CanvasRenderingContext2D, cellSize: number) => void)): void {
        this.renderListeners[ref] = listener;
    }

    snapToGrid(point: Point): Point {
        const x = Math.floor(point.x / this.cellSize) * this.cellSize;
        const y = Math.floor(point.y / this.cellSize) * this.cellSize;
        return { x, y };
    }

    render(translation: Point, scale: number, zoomOffset: Point): void {
        console.log('render');
        const canvas = document.getElementById('stage') as HTMLCanvasElement;
        const ctx = canvas.getContext('2d');

        // Handle transforms
        ctx.resetTransform();
        ctx.clearRect(0, 0, this.width, this.height);

        ctx.setTransform(scale, 0, 0, scale, translation.x, translation.y);
        this.matrix = ctx.getTransform();
        
        // Draw content
        this.renderGrid(ctx);
        Object.values(this.renderListeners).forEach(op => op(ctx, this.cellSize));
    }

    renderGrid(ctx: CanvasRenderingContext2D): void {
        const transform = ctx.getTransform();
        const scale = transform.a;
        const transX = transform.e;
        const transY = transform.f;
        // Ensure we cover the entire screen if it has been translated
        const x0 = Math.ceil(Math.abs(transX / scale / this.cellSize)) * this.cellSize;
        const y0 = Math.ceil(Math.abs(transY / scale / this.cellSize)) * this.cellSize;

        ctx.lineWidth = 1;
        ctx.strokeStyle = 'white';

        ctx.beginPath();
        // vertical lines
        for (let x = this.cellSize - x0; x < this.width / scale + x0; x += this.cellSize) {
            ctx.moveTo(x, -y0);
            ctx.lineTo(x, this.height / scale + y0);
        }

        // horizontal lines
        for (let y = this.cellSize - y0; y < this.height / scale + y0; y += this.cellSize) {
            ctx.moveTo(-x0, y);
            ctx.lineTo(this.width / scale + x0, y);
        }
        ctx.closePath();
        
        ctx.stroke();
    }
}

const renderer = new Renderer();

export function GameStage(props: GameStageProps): React.ReactElement {
    const [selected, setSelected] = useState(TokenType.None);
    const [prevSelected, setPrevSelected] = useState(TokenType.None);

    // mouseAbsCoord: the untransformed coordinate of the mouse
    // relative to the canvas
    const [mouseAbsCoord, setMouseAbsCoord] = useState({ x: 0, y: 0 });
    // mouseGridCoord: the transformed coordinate of the mouse, snapped to the grid
    const [mouseGridCoord, setMouseGridCoord] = useState({ x: 0, y: 0 });
    // zoomOffset: the position last zoomed in/out
    const [zoomOffset, setZoomOffset] = useState({ x: 0, y: 0 });

    const [dragGrid, setDragGrid] = useState(false);
    const [cursor, setCursor] = useState('default');

    const [scaleCounter, setScaleCounter] = useState(0);
    const [scale, setScale] = useState(1);
    const [translation, setTranslation] = useState({ x: 0, y: 0 });

    // Invert this flag to force a re-render despite useEffect tags
    const [forceRender, setForceRender] = useState(false);
    
    const scaleFactor = 0.4;

    useEffect(() => {
        setSelected(TokenType.Circle);
    }, []);
    
    renderer.addRenderListener('SelectedPreview', (ctx, cellSize) => {
        const { x, y } = renderer.snapToGrid(renderer.invTransform(mouseAbsCoord));
        drawToken(ctx, selected, x, y, cellSize);
    });


    function handleMouseMove(ev: any): void {
        const bounds = ev.target.getBoundingClientRect();
        const mx = ev.clientX - Math.round(bounds.left);
        const my = ev.clientY - Math.round(bounds.top);

        if (dragGrid) {
            const dx = mx - mouseAbsCoord.x;
            const dy = my - mouseAbsCoord.y;
            setTranslation({ x: translation.x + dx, y: translation.y + dy });
        }

        const coord = { x: mx, y: my };
        
        setMouseAbsCoord(coord);
        const { x, y } = renderer.snapToGrid(coord);
        if (x != mouseGridCoord.x || y != mouseGridCoord.y) {
            setMouseGridCoord({ x, y });
        }
    }

    function handleMouseDown(ev: any): void {
        const bounds = ev.target.getBoundingClientRect();
        const mx = ev.clientX - Math.round(bounds.left);
        const my = ev.clientY - Math.round(bounds.top);
        const mouse = { x: mx, y: my };
        // 0 is the left mouse button, 1 is the middle mouse button, 2 is the right
        if (ev.button == 0) {
            if (ev.shiftKey) {
                onDragStart();
            } else if (ev.ctrlKey) {
                if (ev.altKey) {
                    onZoomOut(mouse);
                } else {
                    onZoomIn(mouse);
                }
            } else if (selected != TokenType.None) {
                const { x, y } = renderer.snapToGrid(renderer.invTransform(mouseAbsCoord));
                props.comms?.placeToken(selected, x, y);
            }
        } else if (ev.button == 1) {
            onDragStart();
        } else if (ev.button == 2 && ev.ctrlKey) {
            onZoomOut(mouse);
        }
    }

    function onZoomIn(mouse: Point) {
        const newScale = Math.exp((scaleCounter + 1) * scaleFactor);
        setScaleCounter(scaleCounter + 1);
        setScale(newScale);

        setTranslation({
            x: mouse.x - (mouse.x - translation.x) * newScale / scale,
            y: mouse.y - (mouse.y - translation.y) * newScale / scale,
        });
    }

    function onZoomOut(mouse: Point) {
        const newScale = Math.exp((scaleCounter - 1) * scaleFactor);
        setScaleCounter(scaleCounter - 1);
        setScale(newScale);

        setTranslation({
            x: mouse.x - (mouse.x - translation.x) * (newScale / scale),
            y: mouse.y - (mouse.y - translation.y) * (newScale / scale),
        });
    }

    function onDragStart() {
        setCursor('move');
        setPrevSelected(selected);
        setSelected(TokenType.None);
        setDragGrid(true);
    }

    function onDragEnd() {
        setCursor('default');
        setPrevSelected(TokenType.None);
        setSelected(prevSelected);
        setDragGrid(false);
        setForceRender(!forceRender);
    }

    function handleMouseUp(_: any): void {
        if (dragGrid) {
            onDragEnd();
        }
    }

    function handleMouseLeave(_: any): void {
        if (dragGrid) {
            onDragEnd();
        }
    }

    function handleKeyPress(ev: any): void {
        if (ev.key == ' ') {
            setTranslation({ x: 0, y: 0 });
            setScale(1);
            setScaleCounter(0);
            setZoomOffset({ x: 0, y: 0 });
        }
    }

    document.body.onkeypress = handleKeyPress;

    useEffect(() => {
        renderer.render(translation, scale, zoomOffset);
    }, [translation, mouseGridCoord, scale, forceRender]);


    return (
        <>
            <canvas id="stage" width={renderer.width} height={renderer.height}
                onMouseMove={handleMouseMove}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onContextMenu={e => e.preventDefault()} // disable context menu
                style={{ cursor, border: '1px solid white' }}
            />
            <TokenManager
                comms={props.comms}
                renderer={renderer}
            />
        </>
    );
}