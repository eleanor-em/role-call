import * as React from 'react';

export interface HelloProps { compiler: string; framework: string; }

export const Hello = function (props: HelloProps): React.ReactElement {
    return (<h1>Hello from {props.compiler} and {props.framework}</h1>);
};