import { IPointerEvent, TPointerType } from '../../../bb/input/event.types';
import { KeyListener, TOnBlur, TOnKeyDown, TOnKeyUp } from '../../../bb/input/key-listener';
import {
    TProjectViewportProject,
    TViewportTransform,
    TViewportTransformXY,
} from '../project-viewport/project-viewport';
import { ISize2D, IVector2D } from '../../../bb/bb-types';
import { MultiPolygon } from 'polygon-clipping';
import { TEMP_TRIGGERS } from './easel.config';

// allows EaselTool to interact with Easel
export type TEaselInterface = {
    setCursor: (cursor: string) => void; // css cursor of easel
    getTransform: () => TViewportTransform;
    getTargetTransform: () => TViewportTransform;
    setTransform: (transform: TViewportTransform, isImmediate?: boolean) => void;
    setAngleDeg: (angleDeg: number, isRelative: undefined | boolean) => void;
    minScale: number;
    maxScale: number;
    getSize: () => ISize2D; // size of DOM element
    getProjectSize: () => ISize2D;
    requestRender: () => void;
    keyListener: KeyListener;
    isKeyPressed: (keyStr: string) => boolean;
    updateDoubleTapPointerTypes: () => void; // the tool changed doubleTapPointerTypes
    setRenderedSelection: (selection?: MultiPolygon) => void; // overwrite selection of project
    // To render project's selection again.
    // isImmediate = false -> update when project updates. true -> immediately
    clearRenderedSelection: (isImmediate?: boolean) => void;
};
export type TEaselToolTrigger = (typeof TEMP_TRIGGERS)[number];
export type TArrowKey = 'left' | 'right' | 'up' | 'down';

export type TEaselTool = {
    tempTriggers?: TEaselToolTrigger[];
    blockTrigger?: TEaselToolTrigger; // tool won't switch to temp tool when trigger blocked
    onArrowKeys?: (key: TArrowKey) => boolean; // true -> cancel default
    doubleTapPointerTypes?: TPointerType[]; // which pointer types can trigger double-tap gesture
    onPointer: (e: IPointerEvent) => void;
    onPointerLeave?: () => void;
    onKeyDown?: TOnKeyDown;
    onKeyUp?: TOnKeyUp;
    onBlur?: TOnBlur; // window.blur
    getSvgElement: () => SVGElement;
    setEaselInterface?: (easelInterface: TEaselInterface) => void; // provides access to easel
    onUpdateTransform?: (transform: TViewportTransform) => void; // whenever transform updates
    onUpdateSelection?: (selection?: MultiPolygon) => void;
    getIsLocked?: () => boolean; // if returns true, can't change mode -> e.g. while drawing
    activate?: (last?: IVector2D, poppedTemp?: boolean) => void; // tells tool when it is active; last undefined if cursor left easel.
    onResize?: (width: number, height: number) => void;
    renderAfterViewport?: (ctx: CanvasRenderingContext2D, transform: TViewportTransformXY) => void;
    onClickOutside?: () => void; // clicked outside of easel
};

export type TEaselProject = TProjectViewportProject & {
    selection?: MultiPolygon;
};
