import * as React from 'react';
import { Comms, PlaceTokenMessage } from './CommsComponent';
import { TokenFactory, TokenType } from './util/TokenFactory';
import { Layer } from 'react-konva';
import { useState, Key } from 'react';
import { Point } from './GameStage';

function unique<T>(arr: T[], key: ((elem: T) => Key)): T[] {
    if (arr == null) {
        return arr;
    }

    const seen: Record<Key, any> = {};
    return arr.filter(elem => seen[key(elem)] = !Object.prototype.hasOwnProperty.call(seen, key(elem)));
}

export interface TokenLayerProps {
    comms: Comms,
    tokenFactory: TokenFactory,
    topLeft: Point,
    width: number,
    height: number,
    cellSize: number,
}

export function TokenLayer(props: TokenLayerProps): React.ReactElement {
    const [tokens, setTokens] = useState([] as PlaceTokenMessage[]);

    function addToken(msg: PlaceTokenMessage): void {
        if (msg.PlaceToken.kind != TokenType.None) {
            setTokens(tokens.concat([msg]));
        }
    }
    
    props.comms?.addPlaceTokenListener('TokenLayerAdd', addToken);

    const filteredTokens = tokens.map(token => {
        return {
            kind: token.PlaceToken.kind,
            x: token.PlaceToken.x + props.topLeft.x,
            y: token.PlaceToken.y + props.topLeft.y
        };
    }).filter(token => token.x >= -props.cellSize
            && token.x <= props.width
            && token.y >= -props.cellSize
            && token.y <= props.height)
        .map(token => props.tokenFactory.make(token.kind, token.x, token.y));
    
    const toDisplay = unique(filteredTokens, elem => elem.key);

    return (
        <Layer>
            {toDisplay}
        </Layer>
    );
}