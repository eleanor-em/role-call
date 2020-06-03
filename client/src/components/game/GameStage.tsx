import * as React from 'react';
import '../../css/App.css';
import { Stage, Layer, Line } from 'react-konva';
import Konva from 'konva';

export function GameStage(): React.ReactElement {
    return (
        <Stage width={300} height={window.innerHeight * 0.95}>
            <Layer>
                <Line
                    points={[0, 0, 200, 0]}
                    stroke={'white'}
                    strokeWidth={2}
                />
            </Layer>
        </Stage>
    );
}