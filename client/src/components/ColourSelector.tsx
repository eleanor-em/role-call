import * as React from 'react';

export interface ColourSelectorProps {
    col: string,
    onClick: (col: string) => void,
}

export function ColourSelector(props: ColourSelectorProps): React.ReactElement {
    return (
        <span className="ColourSelector" style={{ backgroundColor: props.col }} onClick={() => props.onClick(props.col)}>&nbsp;</span>
    );
}