import * as React from 'react';
import {useEffect, useState} from 'react';
import {ColourSelector} from '../ColourSelector';
import {drawToken, TokenType} from './TokenManager';

export interface TokenControlsProps {
    setTokenColour(col: string): void,
    setTokenType(type: TokenType): void,
}

const colours = [
    '#ff0000',
    '#ffff00',
    '#ff00ff',
    '#00ff00',
    '#00ffff',
    '#0000ff',
];

export function TokenControls(props: TokenControlsProps): React.ReactElement {
    const [col, setCol] = useState('#ff0000');
    const cellSize = 64;

    useEffect(() => {
        const container = document.getElementById('TokenControlContainer');
        const canvas = document.getElementById('TokenControlCanvas') as HTMLCanvasElement;

        canvas.width = container.clientWidth;

        const ctx = canvas.getContext('2d');

        let x = 0;
        let y = 0;
        for (const type of [TokenType.Circle, TokenType.Square, TokenType.Triangle, TokenType.Diamond]) {
            drawToken(ctx, type, x, y, 64, col);

            x += cellSize;
            if (x > canvas.width) {
                x = 0;
                y += cellSize;
            }
        }
    }, [window.innerWidth, window.innerHeight, col]);

    useEffect(() => {
        props.setTokenColour(col);
    }, [col]);


    return (
        <div id="TokenControlContainer">
            <div className="ColourContainer">
                {colours.map(col => (<ColourSelector key={col} col={col} onClick={setCol} />))}
            </div>
            <canvas id="TokenControlCanvas" width={0} height={window.innerHeight * 0.5} />
        </div>
    );
}