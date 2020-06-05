import * as React from 'react';
import '../../css/App.css';
import { Stage, Layer, Line } from 'react-konva';
import { useState, useEffect } from 'react';
import { TokenFactory, TokenType } from './util/TokenFactory';
import { Comms } from './CommsComponent';
import { TokenLayer } from './TokenLayer';

function generateGrid(gridWidth: number, gridHeight: number, cellSize: number, topLeft: Point): React.ReactElement[] {
    const x0 = -cellSize + topLeft.x % cellSize;
    const y0 = -cellSize + topLeft.y % cellSize;
    const lines = [];

    // vertical lines
    for (let x = x0 + cellSize; x < gridWidth; x += cellSize) {
        lines.push((<Line
            points={[x, 0, x, gridHeight]}
            stroke={'white'}
            strokeWidth={1}
            dash={[5, 3]}
            key={`x${x}`}
        />));
    }
    // horizontal lines
    for (let y = cellSize + y0; y < gridHeight; y += cellSize) {
        lines.push((<Line
            points={[0, y, gridWidth, y]}
            stroke={'white'}
            strokeWidth={1}
            dash={[5, 3]}
            key={`y${y}`}
        />));
    }
    return lines;
}

export interface Point {
    x: number,
    y: number
}

export interface GameStageProps {
    comms: Comms,
}

export function GameStage(props: GameStageProps): React.ReactElement {
    const [selected, setSelected] = useState(TokenType.None);
    const [prevSelected, setPrevSelected] = useState(TokenType.None);
    const [mouseCoord, setMouseCoord] = useState({ x: 0, y: 0 });
    const [dragGrid, setDragGrid] = useState(false);
    const [cursor, setCursor] = useState('default');
    const [topLeft, setTopLeft] = useState({ x: 0, y: 0 });

    useEffect(() => {
        setSelected(TokenType.Circle);
    }, []);

    // 5 / 6 due to flex in CSS
    const width = window.innerWidth * 5 / 6;
    const height = window.innerHeight * 0.95;
    const cellSize = 64;
    const grid = generateGrid(width, height, cellSize, topLeft);

    const tokenFactory = new TokenFactory(cellSize);

    function handleMouseMove(ev: any): void {
        const offsetX = ev.currentTarget.content.offsetLeft;
        const offsetY = ev.currentTarget.content.offsetTop;
        const x = ev.evt.clientX - offsetX;
        const y = ev.evt.clientY - offsetY;

        if (dragGrid) {
            const nx = topLeft.x + x - mouseCoord.x;
            const ny = topLeft.y + y - mouseCoord.y;
            setTopLeft({ x: nx, y: ny });
        }
        
        if (x != mouseCoord.x || y != mouseCoord.y) {
            setMouseCoord({ x, y });
        }
    }

    function handleMouseDown(ev: any): void {
        // 0 is the left mouse button, 1 is the middle mouse button
        if (ev.evt.button == 0) {
            if (ev.evt.shiftKey) {
                onDragStart();
            } else if (selected != TokenType.None) {
                const { x, y } = snapToGrid(mouseCoord.x, mouseCoord.y);
                props.comms?.placeToken(selected, x - topLeft.x, y - topLeft.y);
            }
        } else if (ev.evt.button == 1) {
            onDragStart();
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

    function snapToGrid(x: number, y: number): Point {
        x = Math.floor((x - topLeft.x) / cellSize) * cellSize + topLeft.x;
        y = Math.floor((y - topLeft.y) / cellSize) * cellSize + topLeft.y;
        return { x, y };
    }

    const { x, y } = snapToGrid(mouseCoord.x, mouseCoord.y);
    const token = tokenFactory.make(selected, x, y);

    return (
        <Stage
            width={width}
            height={height}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            style={{ cursor, border: '1px solid white' }}>
            <Layer>
                {grid}
            </Layer>
            <TokenLayer
                comms={props.comms}
                tokenFactory={tokenFactory}
                topLeft={topLeft}
                width={width}
                height={height}
                cellSize={cellSize}/>
            {(
                <Layer>
                    {token}
                </Layer>
            )}
        </Stage>
    );
}