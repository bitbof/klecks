import {eventUsesHighResTimeStamp, hasPointerEvents, isFirefox} from '../base/browser';
import {WheelCleaner} from './wheel-cleaner';
import {IPointerEvent, IWheelEvent, TPointerButton, TPointerEventType, TPointerType} from './event.types';
import {PressureNormalizer} from './pressure-normalizer';

export interface IPointerListenerParams {
    target: HTMLElement | SVGElement;
    onPointer?: (pointerEvent: IPointerEvent) => void;
    onWheel?: (wheelEvent: IWheelEvent) => void;
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

function addPointer (event: ICorrectedPointerEvent): IPointer {
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

function getPointer (event: ICorrectedPointerEvent): IPointer | null {
    for (let i = pointerArr.length - 1; i >= 0; i--) {
        if (event.pointerId === pointerArr[i].pointerId) {
            return pointerArr[i];
        }
    }
    return null;
}

function getButtonStr (buttons: number): TPointerButton | undefined {
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


const pointerDownEvt = hasPointerEvents ? 'pointerdown' : 'mousedown';
const pointerMoveEvt = hasPointerEvents ? 'pointermove' : 'mousemove';
const pointerUpEvt = hasPointerEvents ? 'pointerup' : 'mouseup';
const pointerCancelEvt = hasPointerEvents ? 'pointercancel' : 'mousecancel';
const pointerLeaveEvt = hasPointerEvents ? 'pointerleave' : 'mouseleave';
const pointerEnterEvt = hasPointerEvents ? 'pointerenter' : 'mouseenter';




/**
 * More trustworthy pointer attributes. that behave the same across browsers.
 * returns a new object. Also attaches itself to the orig event. -> event.corrected
 */
function correctPointerEvent (event: PointerEvent | TExtendedDOMPointerEvent): ICorrectedPointerEvent {
    if ('corrected' in event) {
        return event.corrected;
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
        buttons: event.buttons,
        button: event.button,
        coalescedArr: [],
        eventPreventDefault: () => event.preventDefault(),
        eventStopPropagation: () => event.stopPropagation(),
    };
    (event as TExtendedDOMPointerEvent).corrected = correctedObj;

    let customPressure = null;
    if ('pointerId' in event) {
        if ('pressure' in event && event.buttons !== 0 && (['mouse'].includes(event.pointerType) || (event.pointerType === 'touch' && event.pressure === 0))) {
            correctedObj.pressure = 1;
            customPressure = 1;
        }
    } else {
        correctedObj.pointerId = 0;
        correctedObj.pointerType = 'mouse';
        correctedObj.pressure = (event as PointerEvent).buttons !== 0 ? 1 : 0;
        customPressure = correctedObj.pressure;
    }

    if (isFirefox && event.pointerType != 'mouse' && event.type === 'pointermove' && event.buttons === 0) { // once again firefox
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
            timeStamp: eventItem.timeStamp === 0 ? correctedObj.timeStamp : (eventItem.timeStamp + timeStampOffset), // 0 in firefox
            pressure: customPressure === null ? pressureNormalizer.normalize(eventItem.pressure) : customPressure,
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

/**
 * PointerListener - for pointer events, wheel events. uses fallbacks. ideally consistent behavior across browsers.
 * Has some workarounds for browser specific bugs. As browsers evolve this constructor should get smaller.
 */
export class PointerListener {

    private isDestroyed: boolean = false;

    private readonly targetElement: HTMLElement | SVGElement;
    private readonly onPointerCallback: undefined | ((pointerEvent: IPointerEvent) => void);
    private readonly onWheelCallback: undefined | ((wheelEvent: IWheelEvent) => void);
    private readonly onEnterLeaveCallback: undefined | ((isOver: boolean) => void);
    private readonly maxPointers: number;
    private readonly wheelCleaner: WheelCleaner;
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
    private readonly onPointerDown: ((event: PointerEvent) => void) | undefined;
    private readonly onWheel: ((e: WheelEvent) => void) | undefined;
    private readonly onTouchMove: ((e: TouchEvent) => void) | undefined;
    private readonly windowOnPointerMove: ((event: PointerEvent) => void) | undefined;
    private readonly windowOnPointerUp: ((event: PointerEvent) => void) | undefined;
    private readonly windowOnPointerLeave: ((event: PointerEvent) => void) | undefined;

    private getDragObj (pointerId: number): IDragObj | null {
        for (let i = 0; i < this.dragObjArr.length; i++) {
            if (pointerId === this.dragObjArr[i].pointerId) {
                return this.dragObjArr[i];
            }
        }
        return null;
    }

    private removeDragObj (pointerId: number): IDragObj | null {
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
    private createPointerOutEvent (
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

    private setupDocumentListeners () {
        this.windowOnPointerMove && document.addEventListener(pointerMoveEvt, this.windowOnPointerMove);
        this.windowOnPointerUp && document.addEventListener(pointerUpEvt, this.windowOnPointerUp);
        this.windowOnPointerLeave && document.addEventListener(pointerCancelEvt, this.windowOnPointerLeave);
        this.windowOnPointerLeave && document.addEventListener(pointerLeaveEvt, this.windowOnPointerLeave);
    }

    private destroyDocumentListeners () {
        this.windowOnPointerMove && document.removeEventListener(pointerMoveEvt, this.windowOnPointerMove);
        this.windowOnPointerUp && document.removeEventListener(pointerUpEvt, this.windowOnPointerUp);
        this.windowOnPointerLeave && document.removeEventListener(pointerCancelEvt, this.windowOnPointerLeave);
        this.windowOnPointerLeave && document.removeEventListener(pointerLeaveEvt, this.windowOnPointerLeave);
    }


    // ---- public ----

    constructor (p: IPointerListenerParams) {
        this.targetElement = p.target;
        this.onPointerCallback = p.onPointer;
        this.onWheelCallback = p.onWheel;
        this.onEnterLeaveCallback = p.onEnterLeave;
        this.maxPointers = Math.max(1, p.maxPointers || 1);


        this.wheelCleaner = new WheelCleaner((cleanerEvent) => {
            if (this.isDestroyed || !this.onWheelCallback) {
                return;
            }
            const bounds = this.targetElement.getBoundingClientRect();
            const whlEvent = {
                ...cleanerEvent,
                relX: cleanerEvent.clientX - bounds.left + this.targetElement.scrollLeft,
                relY: cleanerEvent.clientY - bounds.top + this.targetElement.scrollTop,
            };
            this.onWheelCallback(whlEvent);
        });

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
                if (!this.didSkip && correctedEvent.pointerType === 'mouse' && tempLastPointerType === 'pen') {
                    this.didSkip = true;
                    return;
                }
                this.didSkip = false;

                const outEvent = this.createPointerOutEvent('pointermove', correctedEvent);
                this.onPointerCallback && this.onPointerCallback(outEvent);
            };

            this.onPointerDown = (event: PointerEvent) => {

                //BB.throwOut('pointerdown ' + event.pointerId + ' | ' + dragPointerIdArr.length);
                const correctedEvent = correctPointerEvent(event);
                ////console.log('debug: ' + event.pointerId + ' pointerdown');
                if (this.dragPointerIdArr.includes(correctedEvent.pointerId) || this.dragPointerIdArr.length === this.maxPointers || !([1, 2, 4].includes(correctedEvent.buttons))) {
                    //BB.throwOut('pointerdown ignored');
                    return;
                }

                //set up global listeners
                if (this.dragObjArr.length === 0) {
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

                const outEvent: IPointerEvent = this.createPointerOutEvent('pointerdown', correctedEvent, {
                    downPageX: correctedEvent.pageX,
                    downPageY: correctedEvent.pageY,
                    button: getButtonStr(correctedEvent.buttons),
                    pressure: correctedEvent.pressure,
                });

                this.onPointerCallback && this.onPointerCallback(outEvent);
            };

            this.windowOnPointerMove = (event: PointerEvent) => {
                //BB.throwOut('pointermove ' + event.pointerId);
                const correctedEvent = correctPointerEvent(event);
                ////console.log('debug: ' + event.pointerId + ' GLOBALpointermove');
                if (!(this.dragPointerIdArr.includes(correctedEvent.pointerId))) {
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
                if (!(this.dragPointerIdArr.includes(correctedEvent.pointerId))) {
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
                if (!(this.dragPointerIdArr.includes(correctedEvent.pointerId))) { //} || event.target !== document) {
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

            this.targetElement.addEventListener(pointerMoveEvt, this.onPointerMove);
            this.targetElement.addEventListener(pointerDownEvt, this.onPointerDown);
        }
        if (this.onWheelCallback) {
            this.onWheel = (e: WheelEvent) => {
                this.wheelCleaner.process(e);
            };
            this.targetElement.addEventListener('wheel', this.onWheel);
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

            this.targetElement.addEventListener(pointerEnterEvt, this.onPointerEnter);
            this.targetElement.addEventListener(pointerLeaveEvt, this.onPointerLeave);
        }

        if (p.fixScribble) {
            //ipad scribble workaround https://developer.apple.com/forums/thread/662874
            this.onTouchMove = (e: TouchEvent) => e.preventDefault();
            this.targetElement.addEventListener('touchmove', this.onTouchMove);
        }
    }

    destroy (): void {
        if (this.isDestroyed) {
            return;
        }
        this.isDestroyed = true;
        this.onPointerEnter && this.targetElement.removeEventListener(pointerEnterEvt, this.onPointerEnter);
        this.onPointerLeave && this.targetElement.removeEventListener(pointerLeaveEvt, this.onPointerLeave);
        this.onPointerMove && this.targetElement.removeEventListener(pointerMoveEvt, this.onPointerMove);
        this.onPointerDown && this.targetElement.removeEventListener(pointerDownEvt, this.onPointerDown);
        this.onWheel && this.targetElement.removeEventListener('wheel', this.onWheel);
        this.destroyDocumentListeners();
        this.onTouchMove && document.removeEventListener('touchmove', this.onTouchMove);
    }

}

