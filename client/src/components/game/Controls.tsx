import * as React from 'react';
import { useState } from 'react';
import { TokenControls } from './TokenControls';

export interface ControlsProps {
    setTokenColour(col: string): void,
}

export function Controls(props: ControlsProps): React.ReactElement {
    const [tab, setTab] = useState(0);
    const headings = ['Maps', 'Tokens', 'Props'];

    function getContents(): React.ReactElement {
        switch (headings[tab]) {
            case 'Maps':
                break;
            case 'Tokens':
                return (<TokenControls setTokenColour={props.setTokenColour} />);
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