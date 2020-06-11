import * as React from 'react';
import { ColourSelector } from '../ColourSelector';
import { useEffect, useState } from 'react';
import { drawToken, TokenType } from './TokenManager';

export interface TokenControlsProps {
    setTokenColour(col: string): void,
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


    useEffect(() => {
        const container = document.getElementById('TokenControlContainer');
        const canvas = document.getElementById('TokenControlCanvas') as HTMLCanvasElement;
        const w = container.clientWidth;
        canvas.width = w;

        const ctx = canvas.getContext('2d');
        drawToken(ctx, TokenType.Circle, 0, 0, 64, col);
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