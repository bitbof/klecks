import { eventUsesHighResTimeStamp, hasPointerEvents, isFirefox } from '../base/browser';
import { IWheelCleanerEvent, WheelCleaner } from './wheel-cleaner';
import {
    IPointerEvent,
    IWheelEvent,
    TPointerButton,
    TPointerEventType,
    TPointerType,
} from './event.types';
import { PressureNormalizer } from './pressure-normalizer';

export interface IPointerListenerParams {
    target: HTMLElement | SVGElement;
    onPointer?: (pointerEvent: IPointerEvent) => void;
    onWheel?: (wheelEvent: IWheelEvent) => void;
    useDirtyWheel?: boolean; // default false - use dirty wheel events - not just increments of 1
    isWheelPassive?: boolean; // default false
    onEnterLeave?: (isOver: boolean) => void; // optional
    maxPointers?: number; // int [1,n] default is 1 - how many concurrent pointers to pay attention to
    fixScribble?: boolean; // fix ipad scribble issue - TODO remove, fixed start of 2022 -> https://bugs.webkit.org/show_bug.cgi?id=217430#c2
}

interface IPointer {
    pointerId: number;
    lastPageX: number | null;
    lastPageY: number | null;
}

interface IDragObj {
    pointerId: number; // long
    pointerType?: TPointerType;
    downPageX: number; //where was pointer when down-event occurred
    downPageY: number;
    buttons: number; // long
    lastPageX: number; //pageX in previous event - only for touch events, because they don't have movementX/Y
    lastPageY: number;
    lastTimeStamp?: number;
}

interface ICoalescedPointerEvent {
    pageX: number;
    pageY: number;
    clientX: number;
    clientY: number;
    movementX: number;
    movementY: number;
    timeStamp: number;
    pressure: number;
}

interface ICorrectedPointerEvent {
    pointerId: number;
    pointerType: string;
    pageX: number;
    pageY: number;
    clientX: number;
    clientY: number;
    movementX: number;
    movementY: number;
    timeStamp: number;
    pressure: number; // normalized
    buttons: number;
    button: number;
    coalescedArr: ICoalescedPointerEvent[];
    eventPreventDefault: () => void;
    eventStopPropagation: () => void;
}

interface TExtendedDOMPointerEvent extends PointerEvent {
    corrected: ICorrectedPointerEvent;
}

// keeping track of pointers for movement fallback
const pointerArr: IPointer[] = [];

function addPointer(event: ICorrectedPointerEvent): IPointer {
    const pointerObj: IPointer = {
        pointerId: event.pointerId,
        lastPageX: null,
        lastPageY: null,
    };
    pointerArr.push(pointerObj);

    if (pointerArr.length > 15) {
        pointerArr.shift();
    }

    return pointerObj;
}

function getPointer(event: ICorrectedPointerEvent): IPointer | null {
    for (let i = pointerArr.length - 1; i >= 0; i--) {
        if (event.pointerId === pointerArr[i].pointerId) {
            return pointerArr[i];
        }
    }
    return null;
}

function getButtonStr(buttons: number): TPointerButton | undefined {
    switch (buttons) {
        case 1:
            return 'left';
        case 2:
            return 'right';
        case 4:
            return 'middle';
        default:
            return undefined;
    }
}

const pressureNormalizer = new PressureNormalizer();
const timeStampOffset = eventUsesHighResTimeStamp() ? 0 : -performance.timing.navigationStart;

const pointerDownEvt = (hasPointerEvents ? 'pointerdown' : 'mousedown') as 'pointerdown';
const pointerMoveEvt = (hasPointerEvents ? 'pointermove' : 'mousemove') as 'pointermove';
const pointerUpEvt = (hasPointerEvents ? 'pointerup' : 'mouseup') as 'pointerup';
const pointerCancelEvt = (hasPointerEvents ? 'pointercancel' : 'mousecancel') as 'pointercancel';
const pointerLeaveEvt = (hasPointerEvents ? 'pointerleave' : 'mouseleave') as 'pointerleave';
const pointerEnterEvt = (hasPointerEvents ? 'pointerenter' : 'mouseenter') as 'pointerenter';

/**
 * More trustworthy pointer attributes. that behave the same across browsers.
 * returns a new object. Also attaches itself to the orig event. -> event.corrected
 */
function correctPointerEvent(
    event: PointerEvent | TExtendedDOMPointerEvent,
): ICorrectedPointerEvent {
    if ('corrected' in event) {
        return event.corrected;
    }

    function determineButtons(): number {
        if (event.buttons !== undefined) {
            return event.buttons;
        }
        /*
                button -> buttons
        none:	undefined -> 0
        left:	0 -> 1
        middle:	1 -> 4
        right:	2 -> 2
        fourth:	3 -> 8
        fifth:	4 -> 16
         */
        if (event.button !== undefined) {
            // old safari on mac has no buttons. remove eventually.
            return [1, 4, 2, 8, 16][event.button];
        }
        return 0;
    }

    const correctedObj: ICorrectedPointerEvent = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        pageX: event.pageX,
        pageY: event.pageY,
        clientX: event.clientX,
        clientY: event.clientY,
        movementX: event.movementX,
        movementY: event.movementY,
        timeStamp: event.timeStamp + timeStampOffset,
        pressure: pressureNormalizer.normalize(event.pressure),
        buttons: determineButtons(),
        button: event.button,
        coalescedArr: [],
        eventPreventDefault: () => event.preventDefault(),
        eventStopPropagation: () => event.stopPropagation(),
    };
    (event as TExtendedDOMPointerEvent).corrected = correctedObj;

    let customPressure = null;
    if ('pointerId' in event) {
        if ('pressure' in event && event.buttons !== 0) {
            if (event.pointerType === 'touch' && event.pressure === 0) {
                correctedObj.pressure = 1;
                customPressure = 1;
            }
            // Spec: If there's no pressure support, pressure is 0.5.
            // https://w3c.github.io/pointerevents/#dom-pointerevent-pressure
            if (event.pointerType === 'mouse' && event.pressure === 0.5) {
                correctedObj.pressure = 1;
                customPressure = 1;
            }
        }
    } else {
        correctedObj.pointerId = 0;
        correctedObj.pointerType = 'mouse';
        correctedObj.pressure = (event as PointerEvent).buttons !== 0 ? 1 : 0;
        customPressure = correctedObj.pressure;
    }

    if (
        isFirefox &&
        event.pointerType != 'mouse' &&
        event.type === 'pointermove' &&
        event.buttons === 0
    ) {
        // once again firefox
        correctedObj.buttons = 1; // todo wrong if no buttons actually pressed
    }

    let coalescedEventArr: PointerEvent[] = [];
    if ('getCoalescedEvents' in event) {
        coalescedEventArr = event.getCoalescedEvents();
    }

    // chrome somehow movementX not same scale as pageX. todo: only chrome?
    // so make my own

    const pointerObj: IPointer = getPointer(correctedObj) || addPointer(correctedObj);

    const totalLastX = pointerObj.lastPageX;
    const totalLastY = pointerObj.lastPageY;

    for (let i = 0; i < coalescedEventArr.length; i++) {
        const eventItem = coalescedEventArr[i];

        correctedObj.coalescedArr.push({
            pageX: eventItem.pageX,
            pageY: eventItem.pageY,
            clientX: eventItem.clientX,
            clientY: eventItem.clientY,
            movementX: pointerObj.lastPageX === null ? 0 : eventItem.pageX - pointerObj.lastPageX,
            movementY: pointerObj.lastPageY === null ? 0 : eventItem.pageY - pointerObj.lastPageY,
            timeStamp:
                eventItem.timeStamp === 0
                    ? correctedObj.timeStamp
                    : eventItem.timeStamp + timeStampOffset, // 0 in firefox
            pressure:
                customPressure === null
                    ? pressureNormalizer.normalize(eventItem.pressure)
                    : customPressure,
        });

        pointerObj.lastPageX = eventItem.pageX;
        pointerObj.lastPageY = eventItem.pageY;
    }

    pointerObj.lastPageX = correctedObj.pageX;
    pointerObj.lastPageY = correctedObj.pageY;
    correctedObj.movementX = totalLastX === null ? 0 : pointerObj.lastPageX - totalLastX;
    correctedObj.movementY = totalLastY === null ? 0 : pointerObj.lastPageY - totalLastY;

    return correctedObj;
}

const OPTIONS_PASSIVE = {
    passive: false,
};

/**
 * PointerListener - for pointer events, wheel events. uses fallbacks. ideally consistent behavior across browsers.
 * Has some workarounds for browser specific bugs. As browsers evolve this constructor should get smaller.
 */
export class PointerListener {
    private isDestroyed: boolean = false;

    // ts has problems with (HTMLElement|SVGElement) when adding event listeners
    // https://github.com/microsoft/TypeScript/issues/46819
    private readonly targetElement: HTMLElement;
    private readonly onPointerCallback: undefined | ((pointerEvent: IPointerEvent) => void);
    private readonly onWheelCallback: undefined | ((wheelEvent: IWheelEvent) => void);
    private readonly onEnterLeaveCallback: undefined | ((isOver: boolean) => void);
    private readonly maxPointers: number;
    private readonly wheelCleaner: WheelCleaner | undefined;
    private isOverCounter: number = 0;

    // pointers that are pressing a button
    private dragObjArr: IDragObj[] = [];
    private dragPointerIdArr: number[] = [];

    // chrome input glitch workaround
    private lastPointerType: TPointerType | null = null;
    private didSkip: boolean = false;

    // listeners
    private readonly onPointerEnter: (() => void) | undefined;
    private readonly onPointerLeave: (() => void) | undefined;
    private readonly onPointerMove: ((event: PointerEvent) => void) | undefined;
    private readonly onPointerDown:
        | ((event: PointerEvent, skipGlobal?: boolean) => void)
        | undefined;
    private readonly onWheel: ((e: WheelEvent) => void) | undefined;
    private readonly onTouchMoveScribbleFix: ((e: TouchEvent) => void) | undefined;
    private readonly windowOnPointerMove: ((event: PointerEvent) => void) | undefined;
    private readonly windowOnPointerUp: ((event: PointerEvent) => void) | undefined;
    private readonly windowOnPointerLeave: ((event: PointerEvent) => void) | undefined;
    // fallback pre pointer events (iOS < 13, as of 2023-02, still 4.4% of iOS users)
    private readonly onTouchStart: ((e: TouchEvent) => void) | undefined;
    private readonly onTouchMove: ((e: TouchEvent) => void) | undefined;
    private readonly onTouchEnd: ((e: TouchEvent) => void) | undefined;
    private readonly onTouchCancel: ((e: TouchEvent) => void) | undefined;

    private getDragObj(pointerId: number): IDragObj | null {
        for (let i = 0; i < this.dragObjArr.length; i++) {
            if (pointerId === this.dragObjArr[i].pointerId) {
                return this.dragObjArr[i];
            }
        }
        return null;
    }

    private removeDragObj(pointerId: number): IDragObj | null {
        let removedDragObj: IDragObj | null = null;
        for (let i = 0; i < this.dragPointerIdArr.length; i++) {
            if (this.dragPointerIdArr[i] === pointerId) {
                removedDragObj = this.dragObjArr[i];
                this.dragObjArr.splice(i, 1);
                this.dragPointerIdArr.splice(i, 1);
                i--;
            }
        }
        return removedDragObj;
    }

    /**
     * Creates a value for onPointer, from a pointer event handler.
     */
    private createPointerOutEvent(
        typeStr: TPointerEventType,
        correctedEvent: ICorrectedPointerEvent,
        custom?: Partial<IPointerEvent>,
    ): IPointerEvent {
        const bounds: DOMRect = this.targetElement.getBoundingClientRect();
        const result: IPointerEvent = {
            type: typeStr,
            pointerId: correctedEvent.pointerId,
            pointerType: correctedEvent.pointerType as TPointerType,
            pageX: correctedEvent.pageX,
            pageY: correctedEvent.pageY,
            clientX: correctedEvent.clientX,
            clientY: correctedEvent.clientY,
            relX: correctedEvent.clientX - bounds.left + this.targetElement.scrollLeft,
            relY: correctedEvent.clientY - bounds.top + this.targetElement.scrollTop,
            dX: correctedEvent.movementX,
            dY: correctedEvent.movementY,
            time: correctedEvent.timeStamp,
            eventPreventDefault: correctedEvent.eventPreventDefault,
            eventStopPropagation: correctedEvent.eventStopPropagation,
            ...custom,
        };

        if (typeStr === 'pointermove') {
            result.coalescedArr = [];
            if (correctedEvent.coalescedArr.length > 1) {
                let coalescedItem;
                for (let i = 0; i < correctedEvent.coalescedArr.length; i++) {
                    coalescedItem = correctedEvent.coalescedArr[i];
                    result.coalescedArr.push({
                        pageX: coalescedItem.pageX,
                        pageY: coalescedItem.pageY,
                        clientX: coalescedItem.clientX,
                        clientY: coalescedItem.clientY,
                        relX: coalescedItem.clientX - bounds.left + this.targetElement.scrollLeft,
                        relY: coalescedItem.clientY - bounds.top + this.targetElement.scrollTop,
                        dX: coalescedItem.movementX,
                        dY: coalescedItem.movementY,
                        time: coalescedItem.timeStamp,
                    });
                }
            }
        }

        return result;
    }

    private setupDocumentListeners() {
        this.windowOnPointerMove &&
            document.addEventListener(pointerMoveEvt, this.windowOnPointerMove, OPTIONS_PASSIVE);
        this.windowOnPointerUp &&
            document.addEventListener(pointerUpEvt, this.windowOnPointerUp, OPTIONS_PASSIVE);
        this.windowOnPointerLeave &&
            document.addEventListener(pointerCancelEvt, this.windowOnPointerLeave, OPTIONS_PASSIVE);
        this.windowOnPointerLeave &&
            document.addEventListener(pointerLeaveEvt, this.windowOnPointerLeave, OPTIONS_PASSIVE);
    }

    private destroyDocumentListeners() {
        this.windowOnPointerMove &&
            document.removeEventListener(pointerMoveEvt, this.windowOnPointerMove);
        this.windowOnPointerUp &&
            document.removeEventListener(pointerUpEvt, this.windowOnPointerUp);
        this.windowOnPointerLeave &&
            document.removeEventListener(pointerCancelEvt, this.windowOnPointerLeave);
        this.windowOnPointerLeave &&
            document.removeEventListener(pointerLeaveEvt, this.windowOnPointerLeave);
    }

    // ----------------------------------- public -----------------------------------

    constructor(p: IPointerListenerParams) {
        this.targetElement = p.target as HTMLElement;
        this.onPointerCallback = p.onPointer;
        this.onWheelCallback = p.onWheel;
        this.onEnterLeaveCallback = p.onEnterLeave;
        this.maxPointers = Math.max(1, p.maxPointers ?? 1);

        const finalizeWheelEvent = (e: WheelEvent | IWheelCleanerEvent): void => {
            if (this.isDestroyed || !this.onWheelCallback) {
                return;
            }
            const bounds = this.targetElement.getBoundingClientRect();
            const whlEvent: IWheelEvent = {
                ...(e instanceof WheelEvent
                    ? { deltaY: e.deltaY / 120, pageX: e.pageX, pageY: e.pageY }
                    : e),
                relX: e.clientX - bounds.left + this.targetElement.scrollLeft,
                relY: e.clientY - bounds.top + this.targetElement.scrollTop,
                ...(e instanceof WheelEvent ? { event: e } : {}),
            };
            this.onWheelCallback(whlEvent);
        };
        this.wheelCleaner = p.useDirtyWheel ? undefined : new WheelCleaner(finalizeWheelEvent);

        if (this.onPointerCallback) {
            this.onPointerMove = (event: PointerEvent) => {
                const correctedEvent = correctPointerEvent(event);

                const tempLastPointerType = this.lastPointerType;
                this.lastPointerType = correctedEvent.pointerType as TPointerType;

                if (
                    this.dragPointerIdArr.includes(correctedEvent.pointerId) ||
                    this.dragPointerIdArr.length === this.maxPointers ||
                    correctedEvent.pointerType === 'touch'
                ) {
                    this.didSkip = false;
                    return;
                }

                // chrome input glitch workaround - throws in a random mouse event with the wrong position when using a stylus
                if (
                    !this.didSkip &&
                    correctedEvent.pointerType === 'mouse' &&
                    tempLastPointerType === 'pen'
                ) {
                    this.didSkip = true;
                    return;
                }
                this.didSkip = false;

                const outEvent = this.createPointerOutEvent('pointermove', correctedEvent);
                this.onPointerCallback && this.onPointerCallback(outEvent);
            };

            this.onPointerDown = (event: PointerEvent, onSkipGlobal?: boolean) => {
                //BB.throwOut('pointerdown ' + event.pointerId + ' | ' + dragPointerIdArr.length);
                const correctedEvent = correctPointerEvent(event);
                ////console.log('debug: ' + event.pointerId + ' pointerdown');
                if (
                    this.dragPointerIdArr.includes(correctedEvent.pointerId) ||
                    this.dragPointerIdArr.length === this.maxPointers ||
                    ![1, 2, 4].includes(correctedEvent.buttons)
                ) {
                    //BB.throwOut('pointerdown ignored');
                    return;
                }

                //set up global listeners
                if (this.dragObjArr.length === 0 && !onSkipGlobal) {
                    this.setupDocumentListeners();
                }
                const dragObj: IDragObj = {
                    pointerId: correctedEvent.pointerId,
                    pointerType: correctedEvent.pointerType as TPointerType,
                    downPageX: correctedEvent.pageX,
                    downPageY: correctedEvent.pageY,
                    buttons: correctedEvent.buttons,
                    lastPageX: correctedEvent.pageX,
                    lastPageY: correctedEvent.pageY,
                    lastTimeStamp: correctedEvent.timeStamp,
                };
                this.dragObjArr.push(dragObj);
                this.dragPointerIdArr.push(correctedEvent.pointerId);

                const outEvent: IPointerEvent = this.createPointerOutEvent(
                    'pointerdown',
                    correctedEvent,
                    {
                        downPageX: correctedEvent.pageX,
                        downPageY: correctedEvent.pageY,
                        button: getButtonStr(correctedEvent.buttons),
                        pressure: correctedEvent.pressure,
                    },
                );

                this.onPointerCallback && this.onPointerCallback(outEvent);
            };

            this.windowOnPointerMove = (event: PointerEvent) => {
                //BB.throwOut('pointermove ' + event.pointerId);
                const correctedEvent = correctPointerEvent(event);
                ////console.log('debug: ' + event.pointerId + ' GLOBALpointermove');
                if (!this.dragPointerIdArr.includes(correctedEvent.pointerId)) {
                    return;
                }

                const dragObj = this.getDragObj(correctedEvent.pointerId);

                if (!dragObj) {
                    // todo need to handle this!
                    return;
                }

                //if pointer changes button its pressing -> turn into pointerup
                if (correctedEvent.buttons !== dragObj.buttons) {
                    //pointer up

                    //remove listener
                    if (this.dragObjArr.length === 1) {
                        this.destroyDocumentListeners();
                    }
                    this.removeDragObj(correctedEvent.pointerId);

                    const outEvent = this.createPointerOutEvent('pointerup', correctedEvent, {
                        downPageX: dragObj.downPageX,
                        downPageY: dragObj.downPageY,
                    });
                    this.onPointerCallback && this.onPointerCallback(outEvent);
                    return;
                }

                // ipad likes to do this
                if (
                    correctedEvent.pointerType === 'pen' &&
                    correctedEvent.pageX === dragObj.lastPageX &&
                    correctedEvent.pageY === dragObj.lastPageY &&
                    correctedEvent.timeStamp === dragObj.lastTimeStamp
                ) {
                    //ignore
                    return;
                }

                const outEvent = this.createPointerOutEvent('pointermove', correctedEvent, {
                    downPageX: dragObj.downPageX,
                    downPageY: dragObj.downPageY,
                    button: getButtonStr(correctedEvent.buttons),
                    pressure: correctedEvent.pressure,
                });

                dragObj.lastPageX = correctedEvent.pageX;
                dragObj.lastPageY = correctedEvent.pageY;
                dragObj.lastTimeStamp = correctedEvent.timeStamp;

                this.onPointerCallback && this.onPointerCallback(outEvent);
            };

            this.windowOnPointerUp = (event: PointerEvent) => {
                //BB.throwOut('pointerup ' + event.pointerId);
                const correctedEvent = correctPointerEvent(event);
                ////console.log('debug: ' + event.pointerId + ' GLOBALpointerup');
                if (!this.dragPointerIdArr.includes(correctedEvent.pointerId)) {
                    return;
                }

                //remove listener
                if (this.dragObjArr.length === 1) {
                    this.destroyDocumentListeners();
                }
                const dragObj = this.removeDragObj(correctedEvent.pointerId);
                if (!dragObj) {
                    // todo need to handle this!
                    return;
                }

                const outEvent = this.createPointerOutEvent('pointerup', correctedEvent, {
                    downPageX: dragObj.downPageX,
                    downPageY: dragObj.downPageY,
                });
                this.onPointerCallback && this.onPointerCallback(outEvent);
            };

            this.windowOnPointerLeave = (event: PointerEvent) => {
                //BB.throwOut('pointerleave ' + event.pointerId);
                const correctedEvent = correctPointerEvent(event);
                ////console.log('debug: ' + event.pointerId + ' onGlobalPointerLeave', event);
                if (!this.dragPointerIdArr.includes(correctedEvent.pointerId)) {
                    //} || event.target !== document) {
                    return;
                }

                //remove listener
                if (this.dragObjArr.length === 1) {
                    this.destroyDocumentListeners();
                }
                const dragObj = this.removeDragObj(correctedEvent.pointerId);
                if (!dragObj) {
                    // todo need to handle this!
                    return;
                }

                const outEvent = this.createPointerOutEvent('pointerup', correctedEvent, {
                    downPageX: dragObj.downPageX,
                    downPageY: dragObj.downPageY,
                });
                this.onPointerCallback && this.onPointerCallback(outEvent);
            };

            this.targetElement.addEventListener(
                pointerMoveEvt,
                this.onPointerMove,
                OPTIONS_PASSIVE,
            );
            this.targetElement.addEventListener(
                pointerDownEvt,
                this.onPointerDown,
                OPTIONS_PASSIVE,
            );

            if (!hasPointerEvents) {
                const touchToFakePointer = (
                    touch: Touch,
                    touchEvent: TouchEvent,
                    isDown: boolean,
                ) => {
                    return {
                        pointerId: touch.identifier,
                        pointerType: 'touch',
                        pageX: touch.pageX,
                        pageY: touch.pageY,
                        clientX: touch.clientX,
                        clientY: touch.clientY,
                        button: isDown ? 0 : undefined,
                        buttons: isDown ? 1 : 0,
                        timeStamp: touchEvent.timeStamp,
                        target: touchEvent.target,
                        pressure: isDown ? 1 : 0,
                        preventDefault: () => touchEvent.preventDefault(),
                        stopPropagation: () => touchEvent.stopPropagation(),
                    };
                };

                const handleTouch = (
                    e: TouchEvent,
                    type: 'start' | 'move' | 'end' | 'cancel',
                ): void => {
                    for (let i = 0; i < e.changedTouches.length; i++) {
                        const touch = e.changedTouches[i];
                        const fakePointer = touchToFakePointer(
                            touch,
                            e,
                            ['start', 'move'].includes(type),
                        );
                        if (type === 'start') {
                            this.onPointerDown!(fakePointer as PointerEvent, false);
                        } else if (type === 'move') {
                            this.windowOnPointerMove!(fakePointer as PointerEvent);
                        } else if (type === 'end') {
                            this.windowOnPointerUp!(fakePointer as PointerEvent);
                        } else {
                            this.windowOnPointerLeave!(fakePointer as PointerEvent);
                        }
                    }
                };

                this.onTouchStart = (e: TouchEvent): void => {
                    e.preventDefault();
                    handleTouch(e, 'start');
                };
                this.onTouchMove = (e: TouchEvent): void => {
                    handleTouch(e, 'move');
                };
                this.onTouchEnd = (e: TouchEvent): void => {
                    handleTouch(e, 'end');
                };
                this.onTouchCancel = (e: TouchEvent): void => {
                    handleTouch(e, 'cancel');
                };

                this.targetElement.addEventListener(
                    'touchstart',
                    this.onTouchStart,
                    OPTIONS_PASSIVE,
                );
                this.targetElement.addEventListener('touchmove', this.onTouchMove, OPTIONS_PASSIVE);
                this.targetElement.addEventListener('touchend', this.onTouchEnd, OPTIONS_PASSIVE);
                this.targetElement.addEventListener(
                    'touchcancel',
                    this.onTouchCancel,
                    OPTIONS_PASSIVE,
                );
            }
        }
        if (this.onWheelCallback) {
            this.onWheel = (e: WheelEvent) => {
                if (this.wheelCleaner) {
                    this.wheelCleaner.process(e);
                } else {
                    finalizeWheelEvent(e);
                }
            };
            this.targetElement.addEventListener('wheel', this.onWheel, {
                passive: !!p.isWheelPassive,
            });
        }
        if (this.onEnterLeaveCallback) {
            this.onPointerEnter = () => {
                this.isOverCounter++;
                this.onEnterLeaveCallback && this.onEnterLeaveCallback(true);
            };

            this.onPointerLeave = () => {
                this.isOverCounter--;
                this.onEnterLeaveCallback && this.onEnterLeaveCallback(false);
            };

            this.targetElement.addEventListener(
                pointerEnterEvt,
                this.onPointerEnter,
                OPTIONS_PASSIVE,
            );
            this.targetElement.addEventListener(
                pointerLeaveEvt,
                this.onPointerLeave,
                OPTIONS_PASSIVE,
            );
        }

        if (p.fixScribble) {
            //ipad scribble workaround https://developer.apple.com/forums/thread/662874
            this.onTouchMoveScribbleFix = (e: TouchEvent) => e.preventDefault();
            this.targetElement.addEventListener(
                'touchmove',
                this.onTouchMoveScribbleFix,
                OPTIONS_PASSIVE,
            );
        }
    }

    destroy(): void {
        if (this.isDestroyed) {
            return;
        }
        this.isDestroyed = true;
        this.onPointerEnter &&
            this.targetElement.removeEventListener(pointerEnterEvt, this.onPointerEnter);
        this.onPointerLeave &&
            this.targetElement.removeEventListener(pointerLeaveEvt, this.onPointerLeave);
        this.onPointerMove &&
            this.targetElement.removeEventListener(pointerMoveEvt, this.onPointerMove);
        this.onPointerDown &&
            this.targetElement.removeEventListener(pointerDownEvt, this.onPointerDown);
        this.onWheel && this.targetElement.removeEventListener('wheel', this.onWheel);
        this.destroyDocumentListeners();
        this.onTouchMoveScribbleFix &&
            document.removeEventListener('touchmove', this.onTouchMoveScribbleFix);

        this.onTouchStart &&
            this.targetElement.removeEventListener('touchstart', this.onTouchStart);
        this.onTouchMove && this.targetElement.removeEventListener('touchmove', this.onTouchMove);
        this.onTouchEnd && this.targetElement.removeEventListener('touchend', this.onTouchEnd);
        this.onTouchCancel &&
            this.targetElement.removeEventListener('touchcancel', this.onTouchCancel);
    }
}
