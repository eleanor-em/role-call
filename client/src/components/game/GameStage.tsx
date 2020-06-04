import * as React from 'react';
import '../../css/App.css';
import { Stage, Layer, Line } from 'react-konva';
import { useState, useEffect } from 'react';
import { TokenFactory, TokenType } from './util/TokenFactory';
import { Comms } from './CommsComponent';
import { TokenLayer } from './TokenLayer';

function generateGrid(gridWidth: number, gridHeight: number, cellSize: number): React.ReactElement[] {
    const lines = [];
    // vertical lines
    for (let x = cellSize; x < gridWidth; x += cellSize) {
        lines.push((<Line
            points={[x, 0, x, gridHeight]}
            stroke={'white'}
            strokeWidth={1}
            dash={[5, 3]}
            key={`x${x}`}
        />));
    }
    // horizontal lines
    for (let y = cellSize; y < gridHeight; y += cellSize) {
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
    const [mouseCoord, setMouseCoord] = useState({ x: 0, y: 0 });

    useEffect(() => {
        setSelected(TokenType.Circle);
    }, []);

    // 5 / 6 due to flex in CSS
    const width = window.innerWidth * 5 / 6;
    const height = window.innerHeight * 0.95;
    const cellSize = 64;
    const grid = generateGrid(width, height, cellSize);

    const tokenFactory = new TokenFactory(cellSize);

    function handleMouseMove(ev: any): void {
        const offsetX = ev.currentTarget.content.offsetLeft;
        const offsetY = ev.currentTarget.content.offsetTop;
        const mx = ev.evt.clientX - offsetX;
        const my = ev.evt.clientY - offsetY;
        const { x, y } = snapToGrid(mx, my);
        if (x != mouseCoord.x || y != mouseCoord.y) {
            setMouseCoord({ x, y });
        }
    }

    function handleMouseClick(ev: any): void {
        props.comms?.placeToken(selected, mouseCoord.x, mouseCoord.y
            );
    }

    function snapToGrid(x: number, y: number): Point {
        x = Math.floor(x / cellSize) * cellSize;
        y = Math.floor(y / cellSize) * cellSize;
        return { x, y };
    }

    return (
        <Stage
            width={width}
            height={height}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseClick}>
            <Layer>
                {grid}
            </Layer>
            <TokenLayer
                comms={props.comms}
                tokenFactory={tokenFactory} />
            {(
                <Layer>
                    {tokenFactory.make(selected, mouseCoord.x, mouseCoord.y)}
                </Layer>
            )}
        </Stage>
    );
}