import * as React from 'react';
import { ColourSelector } from '../ColourSelector';
import { useEffect, useState } from 'react';
import { drawToken, TokenType } from './TokenManager';

export interface TokenControlsProps {
    setTokenColour(col: string): void,
}

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
                <ColourSelector col='#ff0000' onClick={setCol} />
                <ColourSelector col='#00ff00' onClick={setCol} />
                <ColourSelector col='#0000ff' onClick={setCol} />
                <ColourSelector col='#ff00ff' onClick={setCol} />
                <ColourSelector col='#00ffff' onClick={setCol} />
                <ColourSelector col='#ffff00' onClick={setCol} />
            </div>
            <canvas id="TokenControlCanvas" width={0} height={window.innerHeight * 0.5} />
        </div>
    );
}