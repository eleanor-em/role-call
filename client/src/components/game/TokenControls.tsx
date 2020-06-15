import * as React from 'react';
import {useEffect, useState} from 'react';
import {ColourSelector} from '../ColourSelector';
import {drawToken, HighlightType, TokenType} from './TokenManager';

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

let selected = TokenType.None;

export function TokenControls(props: TokenControlsProps): React.ReactElement {
    const [col, setCol] = useState('#ff0000');
    const [mouseX, setMouseX] = useState(0);
    const [mouseY, setMouseY] = useState(0);
    const [cursor, setCursor] = useState('default');
    const cellSize = 64;

    useEffect(() => {
        const container = document.getElementById('TokenControlContainer');
        const canvas = document.getElementById('TokenControlCanvas') as HTMLCanvasElement;

        canvas.width = container.clientWidth;

        const ctx = canvas.getContext('2d');

        let x = 0;
        let y = 0;
        let onSomething = false;
        for (const type of [TokenType.Circle, TokenType.Square, TokenType.Triangle, TokenType.Diamond]) {
            let highlight = false;
            if (mouseX > x && mouseY > y && mouseX < x + cellSize && mouseY < y + cellSize) {
                selected = type;
                highlight = true;
                onSomething = true;
            }
            drawToken(ctx, type, x, y, 64, col, highlight ? HighlightType.Hover : HighlightType.None);

            x += cellSize;
            if (x > canvas.width) {
                x = 0;
                y += cellSize;
            }
        }

        if (!onSomething) {
            selected = TokenType.None;
            if (cursor != 'default') {
                setCursor('default');
            }
        } else if (cursor != 'pointer') {
            setCursor('pointer');
        }
    }, [window.innerWidth, window.innerHeight, col, mouseX, mouseY]);

    useEffect(() => {
        props.setTokenColour(col);
    }, [col]);

    function handleMouseMove(ev: any): void {
        const bounds = ev.target.getBoundingClientRect();
        setMouseX(ev.clientX - Math.round(bounds.left));
        setMouseY(ev.clientY - Math.round(bounds.top));
    }

    function handleMouseDown(ev: any): void {
        if (ev.button == 0 && selected != TokenType.None) {
            props.setTokenType(selected);
        }
    }

    function resetMouse(): void {
        selected = TokenType.None;
        setMouseX(0);
        setMouseY(0);
    }

    return (
        <div id="TokenControlContainer">
            <div className="ColourContainer">
                {colours.map(col => (<ColourSelector key={col} col={col} onClick={setCol} />))}
            </div>
            <canvas id="TokenControlCanvas"
                    width={0}
                    height={window.innerHeight * 0.5}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseEnter={handleMouseMove}
                    onMouseLeave={resetMouse}
                    onBlur={resetMouse}
                    style={{ cursor }}/>
        </div>
    );
}