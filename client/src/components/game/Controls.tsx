import * as React from 'react';
import { useState } from 'react';
import { TokenControls } from './TokenControls';
import {TokenType} from "./TokenManager";
import {Comms} from "./CommsComponent";
import {MapControls} from "./MapControls";

export interface ControlsProps {
    setTokenColour(col: string): void,
    setTokenType(type: TokenType): void,
    comms: Comms,
}

export function Controls(props: ControlsProps): React.ReactElement {
    const [tab, setTab] = useState(0);
    const headings = ['Maps', 'Tokens', 'Props'];

    function getContents(): React.ReactElement {
        switch (headings[tab]) {
            case 'Maps':
                return (<MapControls comms={props.comms} />);
            case 'Tokens':
                return (<TokenControls setTokenColour={props.setTokenColour} setTokenType={props.setTokenType} />);
            case 'Props':
                break;
        }
        return (<span>Quis custodiet ipsos custodes?</span>);
    }

    const contents = getContents();

    return (
        <div className="GameMenu">
            <div className="TabContainer">
                {Object.keys(headings).map(i => {
                    const idx = parseInt(i);
                    return (
                        <span
                            key={i}
                            className={tab == idx ? 'SelectedTab' : 'UnselectedTab'}
                            onClick={() => setTab(idx)}>
                            {headings[idx]}
                        </span>
                    );
                })}
            </div>
            <div className="TabBody">
                {contents}
            </div>
        </div>
    );
}