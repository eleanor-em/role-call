import * as React from 'react';

interface ObjThumbnailProps {
    name: string,
    url: string,
    selected: boolean,
    deleteObjSync(): void,
    objSelected(): void,
}

export function ObjThumbnail(props: ObjThumbnailProps): React.ReactElement {
    const className = 'object-container' + (props.selected ? ' object-selected' : '');

    return (
        <div className={className} onClick={props.objSelected}>
            <img className="objThumbnail" src={props.url} alt={props.name}/>
            <br/>
            {props.name}
            &nbsp;
            (<span title={"delete"}>
                <a href="#" onClick={props.deleteObjSync}>x</a>
            </span>)
        </div>
    );
}