import * as React from 'react';
import { Circle } from 'react-konva';

export enum TokenType {
    None,
    Circle,
}

export class TokenFactory {
    cellSize: number;
    
    constructor(cellSize: number) {
        this.cellSize = cellSize;
    }

    make(type: TokenType, x: number, y: number, key=''): React.ReactElement {
        key = key || `${x},${y},${type}`;
        switch (type) {
            case TokenType.Circle:
                return <Circle
                    key={key}
                    x={x + this.cellSize / 2}
                    y={y + this.cellSize / 2}
                    radius={this.cellSize / 2.4} 
                    fill={'#cf1515'}
                    stroke={'black'}
                    strokeWidth={3}
                />;
        }

        return (null);
    }
}