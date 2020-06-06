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

    constructor() {
        this.renderListeners = {};
    }

    // Listeners should use a unique reference string, to prevent duplicate listeners.
    addRenderListener(ref: string, listener: ((ctx: CanvasRenderingContext2D, cellSize: number) => void)): void {
        this.renderListeners[ref] = listener;
    }

    snapToGrid(x: number, y: number): Point {
        x = Math.floor(x / this.cellSize) * this.cellSize;
        y = Math.floor(y / this.cellSize) * this.cellSize;
        return { x, y };
    }

    render(translation: Point, scale: number): void {
        console.log('render');
        const canvas = document.getElementById('stage') as HTMLCanvasElement;
        const ctx = canvas.getContext('2d');

        // Handle transforms
        ctx.resetTransform();
        ctx.clearRect(0, 0, this.width, this.height);
        ctx.setTransform(scale, 0, 0, scale, translation.x, translation.y);
        
        // Draw content
        this.renderGrid(ctx, translation, scale);
        Object.values(this.renderListeners).forEach(op => op(ctx, this.cellSize));
    }

    renderGrid(ctx: CanvasRenderingContext2D, translation: Point, scale: number): void {
        // Ensure we cover the entire screen if it has been translated
        const x0 = Math.ceil(Math.abs(translation.x / scale / this.cellSize)) * this.cellSize;
        const y0 = Math.ceil(Math.abs(translation.y / scale / this.cellSize)) * this.cellSize;

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
    // mouseCoord: the transformed coordinate of the mouse in the grid's coordinates
    const [mouseCoord, setMouseCoord] = useState({ x: 0, y: 0 });
    // mouseGridCoord: the transformed coordinate of the mouse, snapped to the grid
    const [mouseGridCoord, setMouseGridCoord] = useState({ x: 0, y: 0 });

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
        const { x, y } = renderer.snapToGrid(mouseCoord.x, mouseCoord.y);
        drawToken(ctx, selected, x, y, cellSize);
    });


    function handleMouseMove(ev: any): void {
        const bounds = ev.target.getBoundingClientRect();
        const mx = ev.clientX - Math.round(bounds.left);
        const my = ev.clientY - Math.round(bounds.top);
        const x = Math.round((mx - translation.x) / scale);
        const y = Math.round((my - translation.y) / scale);
        // console.log(`(${x}, ${y})`);

        if (dragGrid) {
            const dx = mx - mouseAbsCoord.x;
            const dy = my - mouseAbsCoord.y;
            setTranslation({ x: translation.x + dx, y: translation.y + dy });
        }
        
        setMouseAbsCoord({ x: mx, y: my });
        setMouseCoord({ x, y });
        const { x: gx, y: gy } = renderer.snapToGrid(x, y);
        if (gx != mouseGridCoord.x || gy != mouseGridCoord.y) {
            setMouseGridCoord({ x: gx, y: gy });
        }
    }

    function handleMouseDown(ev: any): void {
        // 0 is the left mouse button, 1 is the middle mouse button, 2 is the right
        if (ev.button == 0) {
            if (ev.shiftKey) {
                onDragStart();
            } else if (ev.ctrlKey) {
                setScaleCounter(scaleCounter + 1);
                setScale(Math.exp((scaleCounter + 1) * scaleFactor));
            } else if (selected != TokenType.None) {
                const { x, y } = renderer.snapToGrid(mouseCoord.x, mouseCoord.y);
                props.comms?.placeToken(selected, x, y);
            }
        } else if (ev.button == 1) {
            onDragStart();
        } else if (ev.button == 2 && ev.ctrlKey) {
            setScaleCounter(scaleCounter - 1);
            setScale(Math.exp((scaleCounter - 1) * scaleFactor));
        }
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


    useEffect(() => {
        renderer.render(translation, scale);
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