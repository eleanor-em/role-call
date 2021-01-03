import * as React from 'react';
import {useEffect, useLayoutEffect, useState} from 'react';
import '../../css/App.css';
import {Comms} from './CommsComponent';
import {ArrowKey, drawToken, HighlightType, TokenManager, TokenType} from './TokenManager';
import {StoredPlayer} from "./GameLanding";
import {GameObj} from "../../models/GameObj";
import {drawSelectedObject, ObjManager} from "./ObjManager";

function useWindowSize() {
    const [size, setSize] = useState([0, 0]);
    useLayoutEffect(() => {
        function updateSize() {
            setSize([window.innerWidth, window.innerHeight]);
        }

        window.addEventListener('resize', updateSize);
        updateSize();
        return () => window.removeEventListener('resize', updateSize);
    }, []);
    return size;
}

export interface Point {
    x: number,
    y: number
}

export interface GameStageProps {
    comms: Comms,
    tokenColour: string,
    tokenType: TokenType,

    setTokenType(type: TokenType): void,
    setObject(obj: GameObj): void,

    selectedObj: GameObj,
    players: StoredPlayer[],
}

export class Renderer {
    // 4 / 5 due to flex in CSS
    width = window.innerWidth * 4 / 5;
    // this number is fudged, sorry
    height = window.innerHeight * 0.96;
    cellSize = 64;
    renderListenerDepths: Record<string, number> = {};
    renderListeners: Record<string, (ctx: CanvasRenderingContext2D, cellSize: number) => void> = {};
    matrix: DOMMatrix = null;

    getScale(): number {
        return this.matrix ? this.matrix.a : 1;
    }

    transform(point: Point): Point {
        if (this.matrix) {
            const scale = this.matrix.a;
            const transX = this.matrix.e;
            const transY = this.matrix.f;
            return {
                x: Math.round((point.x - transX) / scale),
                y: Math.round((point.y - transY) / scale),
            };
        } else {
            console.log('missing matrix');
            return point;
        }
    }

    // Listeners should use a unique reference string, to prevent duplicate listeners.
    addRenderListener(ref: string, listener: ((ctx: CanvasRenderingContext2D, cellSize: number) => void), depth = 0): void {
        this.renderListeners[ref] = listener;
        this.renderListenerDepths[ref] = depth;
    }

    snapToGrid(point: Point): Point {
        const x = Math.floor(point.x / this.cellSize) * this.cellSize;
        const y = Math.floor(point.y / this.cellSize) * this.cellSize;
        return {x, y};
    }

    render(translation: Point, scale: number): void {
        const canvas = document.getElementById('stage') as HTMLCanvasElement;
        const ctx = canvas.getContext('2d');

        // Handle transforms
        ctx.resetTransform();
        ctx.clearRect(0, 0, this.width, this.height);
        ctx.setTransform(scale, 0, 0, scale, translation.x, translation.y);
        this.matrix = ctx.getTransform();

        // Draw content
        this.renderGrid(ctx);
        Object.keys(this.renderListeners)
            // descending order by depth
            .sort((a, b) => this.renderListenerDepths[b] - this.renderListenerDepths[a])
            .map(key => this.renderListeners[key])
            .forEach(op => op(ctx, this.cellSize));
    }

    renderGrid(ctx: CanvasRenderingContext2D): void {
        const transform = ctx.getTransform();
        const scale = transform.a;
        const transX = transform.e;
        const transY = transform.f;
        // Ensure we cover the entire screen if it has been translated
        const x0 = Math.ceil(Math.abs(transX / scale / this.cellSize)) * this.cellSize;
        const y0 = Math.ceil(Math.abs(transY / scale / this.cellSize)) * this.cellSize;

        ctx.lineWidth = 1;
        ctx.strokeStyle = '#777777';

        ctx.beginPath();
        // vertical lines
        for (let x = this.cellSize - x0; x < this.width / scale + x0; x += this.cellSize) {
            ctx.moveTo(x, -y0);
            ctx.lineTo(x, this.height / scale + y0);
        }

        // horizontal lines
        for (let y = this.cellSize - y0; y < this.height / scale + y0; y += this.cellSize) {
            ctx.moveTo(-x0, y);
            ctx.lineTo(this.width / scale + x0, y);
        }
        ctx.closePath();

        ctx.stroke();
    }
}

let prevTypeToPlace = TokenType.None;
let typeToPlace = TokenType.None;
let renderer: Renderer = null;

let loaded = false;
let tokenManager: TokenManager = null;
let objManager: ObjManager = null;

export function GameStage(props: GameStageProps): React.ReactElement {
    const [hideToken, setHideToken] = useState(false);
    const [cursor, setCursor] = useState('default');
    const [forceCursor, setForceCursor] = useState('');

    const [mouseCoord, setMouseCoord] = useState({x: 0, y: 0});
    // grid coord is used to hook updates since we don't need to update if we haven't moved to a new cell
    const [mouseGridCoord, setMouseGridCoord] = useState({x: 0, y: 0});

    const [dragGrid, setDragGrid] = useState(false);
    const [scale, setScale] = useState(1);
    const [translation, setTranslation] = useState({x: 0, y: 0});
    const [winWidth, winHeight] = useWindowSize();

    const [modifiers, setModifiers] = useState({
        ctrl: false,
        alt: false,
        shift: false,
    });
    const [hoverCanvas, setHoverCanvas] = useState(false);

    // Set up initial objects
    if (renderer == null) {
        renderer = new Renderer();
    }
    if (!loaded && props.comms != null) {
        objManager = new ObjManager(props.comms, renderer, forceRender, setForceCursor);
        tokenManager = new TokenManager(props.comms, renderer, forceRender, setForceCursor);
        loaded = true;
    }
    useEffect(() => {
        renderer.width = window.innerWidth * 4 / 5;
        renderer.height = window.innerHeight * 0.96;
    }, [window.innerWidth, window.innerHeight]);

    // Re-render when the window size changes
    useEffect(forceRender, [winWidth, winHeight]);

    // Update the token manager every time we get a new player list
    tokenManager.players = props.players;
    objManager.players = props.players;

    // Invert this flag to force a re-render despite useEffect tags
    const [forceRenderFlag, setForceRender] = useState(false);

    function forceRender() {
        setForceRender(!forceRenderFlag);
    }

    // Set shadow token data
    if (!hideToken && typeToPlace != props.tokenType) {
        typeToPlace = props.tokenType;
    }
    if (hideToken && prevTypeToPlace != props.tokenType) {
        prevTypeToPlace = props.tokenType;
    }

    function renderPreview(ctx: CanvasRenderingContext2D, cellSize: number): void {
        const {x: mx, y: my} = renderer.transform(mouseCoord);

        if (!modifiers.shift && !modifiers.ctrl) {
            if (typeToPlace != TokenType.None) {
                const {x, y} = renderer.snapToGrid({x: mx, y: my});
                drawToken(ctx, typeToPlace, x, y, cellSize, props.tokenColour, HighlightType.Select);
            } else if (props.selectedObj != null) {
                drawSelectedObject(ctx, mx, my, props.comms.getObjectImageElem(props.selectedObj.id));
            }
        }
    }

    renderer?.addRenderListener('SelectedPreview', renderPreview, -1);

    function handleMouseMove(ev: any): void {
        handleMouseEnter(ev);

        const bounds = ev.target.getBoundingClientRect();
        const mx = ev.clientX - Math.round(bounds.left);
        const my = ev.clientY - Math.round(bounds.top);

        if (dragGrid) {
            const dx = mx - mouseCoord.x;
            const dy = my - mouseCoord.y;
            setTranslation({x: translation.x + dx, y: translation.y + dy});
        }

        const coord = {x: mx, y: my};
        setMouseCoord(coord);
        tokenManager?.setMouseCoord(coord);
        objManager?.setMouseCoord(coord);

        const {x, y} = renderer.snapToGrid(coord);
        if (x != mouseGridCoord.x || y != mouseGridCoord.y) {
            setMouseGridCoord({x, y});
            forceRender();
        }
    }

    function handleMouseDown(ev: any): void {
        const bounds = ev.target.getBoundingClientRect();
        const mx = ev.clientX - Math.round(bounds.left);
        const my = ev.clientY - Math.round(bounds.top);
        const mouse = {x: mx, y: my};

        switch (ev.button) {
            case 0:
                // left click
                handleLeftMouse(mouse);
                break;
            case 1:
                // middle click
                setDragGrid(true);
                break;
            case 2:
                // right click
                if (modifiers.ctrl) {
                    onZoomOut(mouse, 0.4);
                }
                break;
        }
    }

    function handleLeftMouse(mouse: Point): void {
        if (modifiers.shift) {
            setDragGrid(true);
        } else if (modifiers.ctrl) {
            if (modifiers.alt) {
                // larger modifier for click zooming
                onZoomOut(mouse, 0.4);
            } else {
                onZoomIn(mouse, 0.4);
            }
        } else if (typeToPlace != TokenType.None) {
            onPlaceToken(mouse);
        } else if (props.selectedObj) {
            onPlaceObj(mouse);
        } else {
            tokenManager?.onClick();
            objManager?.onClick();
        }
        forceRender();
    }

    function onPlaceToken(mouse: Point): void {
        // send a place message and reset the selected typeStoredPlayer
        const {x, y} = renderer.snapToGrid(renderer.transform(mouse));
        props.comms?.placeToken(typeToPlace, x, y, props.tokenColour);
        props.setTokenType(TokenType.None);
    }

    function onPlaceObj(mouse: Point): void {
        const {x, y} = renderer.transform(mouse);
        const elem = props.comms.getObjectImageElem(props.selectedObj.id);
        props.comms?.placeObj(props.selectedObj.id, x - elem.width / 2, y - elem.height / 2, elem.width, elem.height);
        props.setObject(null);
    }

    function onZoomIn(mouse: Point, scaleFactor: number): void {
        const delta = Math.exp(scaleFactor);
        const newScale = scale * delta;

        if (newScale < 4) {
            setScale(scale * delta);

            setTranslation({
                x: mouse.x - (mouse.x - translation.x) * delta,
                y: mouse.y - (mouse.y - translation.y) * delta,
            });
        }
    }

    function onZoomOut(mouse: Point, scaleFactor: number): void {
        const delta = 1 / Math.exp(scaleFactor);
        const newScale = scale * delta;

        if (newScale > 0.2) {
            setScale( scale * delta);

            setTranslation({
                x: mouse.x - (mouse.x - translation.x) * delta,
                y: mouse.y - (mouse.y - translation.y) * delta
            });
        }
    }

    function startHideToken(): void {
        if (!hideToken) {
            prevTypeToPlace = typeToPlace;
            typeToPlace = TokenType.None;
            setHideToken(true);
            forceRender();
        }
    }

    function endHideToken(): void {
        if (hideToken) {
            typeToPlace = prevTypeToPlace;
            prevTypeToPlace = TokenType.None;
            setHideToken(false);
        }
    }

    function handleMouseUp(_: any): void {
        setDragGrid(false);
        objManager?.onMouseUp();
    }

    function handleMouseLeave(_: any): void {
        startHideToken();
        setDragGrid(false);
        setCursor('default');
        setHoverCanvas(false);
    }

    function handleMouseEnter(ev: any): void {
        const mods = {
            ctrl: ev.ctrlKey,
            alt: ev.altKey,
            shift: ev.shiftKey,
        };

        endHideToken();
        if (mods.shift || mods.ctrl) {
            startHideToken();
        }
        updateCursor(mods);
        setHoverCanvas(true);
        setModifiers(mods);
    }

    function handleKeyDown(ev: any): void {
        const mods = {...modifiers};

        switch (ev.key) {
            case 'Control':
                mods.ctrl = true;
                break;
            case 'Alt':
                mods.alt = true;
                break;
            case 'Shift':
                mods.shift = true;
                break;
            case 'Delete':
                tokenManager?.onDelete();
                objManager?.onDelete();
                forceRender();
                break;
            case 'Escape':
                prevTypeToPlace = TokenType.None;
                typeToPlace = TokenType.None;
                tokenManager?.onEscKey();
                objManager?.onEscKey();
                forceRender();
                break;
            case 'ArrowLeft':
                tokenManager?.onArrowKey(ArrowKey.Left);
                break;
            case 'ArrowRight':
                tokenManager?.onArrowKey(ArrowKey.Right);
                break;
            case 'ArrowUp':
                tokenManager?.onArrowKey(ArrowKey.Up);
                break;
            case 'ArrowDown':
                tokenManager?.onArrowKey(ArrowKey.Down);
                break;
        }

        updateCursor(mods);
        setModifiers(mods);
    }

    function handleKeyUp(ev: any): void {
        const mods = {...modifiers};
        switch (ev.key) {
            case 'Control':
                mods.ctrl = false;
                break;
            case 'Alt':
                mods.alt = false;
                break;
            case 'Shift':
                mods.shift = false;
                break;
        }
        updateCursor(mods);
        setModifiers(mods);
    }

    function handleKeyPress(ev: any): void {
        if (ev.key == ' ') {
            setTranslation({x: 0, y: 0});
            setScale(1);
        }
    }

    function handleFocus(ev: any): void {
        const mods = {
            ctrl: ev.ctrlKey,
            alt: ev.altKey,
            shift: ev.shiftKey,
        };

        updateCursor(mods);
        setModifiers(mods);
    }

    function handleOnWheel(ev: any): void {
        ev.preventDefault();
        if (ev.deltaY < 0) {
            onZoomIn(mouseCoord, 0.1);
        } else {
            onZoomOut(mouseCoord, 0.1);
        }
    }

    function updateCursor(mods: { ctrl: boolean, alt: boolean, shift: boolean }): void {
        if (hoverCanvas) {
            if (mods.shift || dragGrid) {
                startHideToken();
                setCursor('move');
            } else if (mods.ctrl) {
                startHideToken();
                setCursor('zoom-in');
            } else if (tokenManager?.hoveredToken || objManager?.hoveredObj) {
                setCursor('pointer');
            } else {
                setCursor('default');
                endHideToken();
            }
        }
    }

    // useEffect to ensure the cursor updates after finishing drag
    useEffect(() => updateCursor(modifiers), [dragGrid]);

    document.body.onkeydown = handleKeyDown;
    document.body.onkeyup = handleKeyUp;
    document.body.onkeypress = handleKeyPress;
    document.body.onfocus = handleFocus;

    useEffect(() => {
        renderer.render(translation, scale);
    }, [translation, mouseGridCoord, scale, modifiers, forceRenderFlag]);

    let finalCursor = cursor;
    if (forceCursor.length > 0) {
        finalCursor = forceCursor;
    }

    return (
        <>
            <canvas id="stage" width={renderer.width} height={renderer.height}
                    onMouseMove={handleMouseMove}
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                    onMouseEnter={handleMouseEnter}
                    onWheel={handleOnWheel}
                    onContextMenu={e => e.preventDefault()} // disable context menu
                    style={{cursor: finalCursor, border: '1px solid white'}}
            />
        </>
    );
}
