import * as React from 'react';
import { Comms, PlaceTokenMessage } from './CommsComponent';
import { TokenFactory } from './util/TokenFactory';
import { Layer } from 'react-konva';
import { useState } from 'react';

function unique<T>(arr: T[], key: ((elem: T) => string)): T[] {
    const seen: Record<string, any> = {};
    return arr.filter(elem => seen[key(elem)] = !Object.prototype.hasOwnProperty.call(seen, key(elem)));
}

export interface TokenLayerProps {
    comms: Comms,
    tokenFactory: TokenFactory,
}

export function TokenLayer(props: TokenLayerProps): React.ReactElement {
    const [tokens, setTokens] = useState([]);

    function addToken(msg: PlaceTokenMessage): void {
        const token = props.tokenFactory.make(msg.PlaceToken.kind, msg.PlaceToken.x, msg.PlaceToken.y); 
        setTokens(tokens.concat([token]));
    }
    
    props.comms?.addPlaceTokenListener('TokenLayerAdd', addToken);

    return (
        <Layer>
            {unique(tokens, elem => elem.key)}
        </Layer>
    );
}