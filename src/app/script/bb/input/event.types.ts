export type TPointerEventType = 'pointerdown' | 'pointermove' | 'pointerup';
export type TPointerType = 'touch' | 'mouse' | 'pen';
export type TPointerButton = 'left' | 'middle' | 'right';

export interface IPointerEvent {
    type: TPointerEventType;
    pointerId: number; // long
    pointerType: TPointerType;
    pageX: number; // todo docs
    pageY: number;
    clientX: number; // todo docs
    clientY: number; // todo docs
    relX: number; // position relative to top left of target - todo what scale tho
    relY: number;
    dX: number; // movementX not supported by safari on iOS, so need my own
    dY: number;

    coalescedArr?: {
        pageX: number;
        pageY: number;
        clientX: number;
        clientY: number;
        relX: number; // position relative to top left of target
        relY: number;
        dX: number;
        dY: number;
        time: number; // same timescale as performance.now() - might be exact same number as in parent
    }[];
    time: number; // same timescale as performance.now()

    button?: TPointerButton;
    pressure?: number; // float [0,1] always 1 for touch and mouse
    downPageX?: number; // where was pointer when down-event occurred - set for down|move|up
    downPageY?: number;

    eventPreventDefault: () => void;
    eventStopPropagation: () => void;
}

export interface IWheelEvent {
    deltaY: number; // increments of 1
    pageX: number; // todo docs
    pageY: number;
    relX: number; // todo docs
    relY: number;
    event?: WheelEvent;
}
