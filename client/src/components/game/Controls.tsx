import * as React from 'react';
import { useState } from 'react';
import { TokenControls } from './TokenControls';
import {TokenType} from "./TokenManager";
import {Comms} from "./CommsComponent";
import {ObjControls} from "./ObjControls";
import {GameObj} from "../../models/GameObj";

export interface ControlsProps {
    setTokenColour(col: string): void,
    setTokenType(type: TokenType): void,
    setObject(obj: GameObj): void,
    comms: Comms,
    selectedObjName: string,
}

enum MenuItem {
    Tokens = 'Tokens',
    Objects = 'Objects',
    Tiles = 'Tiles',
}

const menuItems = [MenuItem.Tokens, MenuItem.Objects, MenuItem.Tiles];

export function Controls(props: ControlsProps): React.ReactElement {
    const [tab, setTab] = useState(MenuItem.Tokens);

    function getContents(): React.ReactElement {
        switch (tab) {
            case MenuItem.Tokens:
                return (<TokenControls setTokenColour={props.setTokenColour} setTokenType={props.setTokenType} />);

            case MenuItem.Objects:
                return (<ObjControls selectedObj={props.selectedObjName} setObject={props.setObject} comms={props.comms} />);
        }
        return (<span>Quis custodiet ipsos custodes?</span>);
    }

    const contents = getContents();

    return (
        <div className="GameMenu">
            <div className="TabContainer">
                {menuItems.map(item => {
                    return (
                        <span
                            key={item}
                            className={tab === item ? 'SelectedTab' : 'UnselectedTab'}
                            onClick={() => setTab(item)}>
                            {item}
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