import { TPointerEvent, TPointerType, TWheelEvent } from '../../../bb/input/event.types';
import { KeyListener, TOnBlur, TOnKeyDown, TOnKeyUp } from '../../../bb/input/key-listener';
import {
    TProjectViewportProject,
    TViewportTransform,
    TViewportTransformXY,
} from '../project-viewport/project-viewport';
import { TSize2D, TVector2D } from '../../../bb/bb-types';
import { MultiPolygon } from 'polygon-clipping';
import { TEMP_TRIGGERS } from './easel.config';

// allows a TEaselTool instance to interact with Easel
export type TEaselInterface = {
    // css cursor of easel
    setCursor: (cursor: string) => void;
    getTransform: () => TViewportTransform;
    getTargetTransform: () => TViewportTransform;
    setTransform: (transform: TViewportTransform, isImmediate?: boolean) => void;
    setAngleDeg: (angleDeg: number, isRelative: undefined | boolean) => void;
    minScale: number;
    maxScale: number;
    // size of DOM element
    getSize: () => TSize2D;
    getProjectSize: () => TSize2D;
    requestRender: () => void;
    keyListener: KeyListener;
    isKeyPressed: (keyStr: string) => boolean;
    // the tool changed doubleTapPointerTypes
    updateDoubleTapPointerTypes: () => void;
    // overwrite selection of project
    setRenderedSelection: (selection?: MultiPolygon) => void;
    // To render project's selection again.
    // isImmediate = false -> update when project updates. true -> immediately
    clearRenderedSelection: (isImmediate?: boolean) => void;

    // todo: get rid after refactor
    onWheel: (e: TWheelEvent) => void;
    // todo: get rid after refactor
    getElement: () => HTMLElement;
};
export type TEaselToolTrigger = (typeof TEMP_TRIGGERS)[number];
export type TArrowKey = 'left' | 'right' | 'up' | 'down';

export type TEaselTool = {
    tempTriggers?: TEaselToolTrigger[];
    // tool won't switch to temp tool when trigger blocked
    blockTrigger?: TEaselToolTrigger;
    // true -> cancel default
    onArrowKeys?: (key: TArrowKey) => boolean;
    // which pointer types can trigger double-tap gesture
    doubleTapPointerTypes?: TPointerType[];
    onPointer: (e: TPointerEvent) => void;
    onPointerLeave?: () => void;
    onKeyDown?: TOnKeyDown;
    onKeyUp?: TOnKeyUp;
    // window.blur
    onBlur?: TOnBlur;
    getSvgElement: () => SVGElement;
    // can be interactive
    getHtmlOverlayElement?: () => HTMLElement;
    // provides access to easel
    setEaselInterface?: (easelInterface: TEaselInterface) => void;
    // whenever transform updates
    onUpdateTransform?: (transform: TViewportTransform) => void;
    onUpdateSelection?: (selection?: MultiPolygon) => void;
    // if returns true, can't change mode -> e.g. while drawing
    getIsLocked?: () => boolean;
    // called when easel tool switched
    onTool?: (toolId: string) => void;
    // tells tool when it is active; last undefined if cursor left easel.
    activate?: (last?: TVector2D, poppedTemp?: boolean) => void;
    onResize?: (width: number, height: number) => void;
    renderAfterViewport?: (ctx: CanvasRenderingContext2D, transform: TViewportTransformXY) => void;
    // clicked outside of easel
    onClickOutside?: () => void;
};

export type TEaselProject = TProjectViewportProject & {
    selection?: MultiPolygon;
};
