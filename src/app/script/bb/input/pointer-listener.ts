import {addEventListener, removeEventListener} from './event-listener';


/**
 * Filters wheel events. removes swipe scrolling and pinch scrolling that trackpads do. (as best as it can)
 * Normalizes regular scrolls.
 *
 * Why:
 * - trackpad scrolling is different from old school mouse scrolling
 * - but there is not way to learn from the browser if it's trackpad scrolling
 * - browsers don't even give access to the raw swiping or pinching movement, but some abstraction on top, making the scrolling
 *      continue an arbitrary amount, at an arbitrary scale
 * - each browser does this differently. So you can't offer a coherent experience
 *
 * - also trackpads are painful to draw with. So supporting a trackpad-based workflow makes not much sense.
 *
 * @param callback - func({deltaY: number, pageX: number, pageY: number, clientX: number, clientY: number}
 * @constructor
 */
import {eventUsesHighResTimeStamp, hasPointerEvents, isFirefox} from '../base/browser';
import {mix} from '../math/math';

const WheelCleaner = function (callback) {
    const sequenceTimeoutMs = 200;

    const knownUnitArr = [100];
    let sequenceLength = 0;
    let sequenceUnit = null;
    let endSequenceTimeout;
    let toEmitDelta = null;
    let position = null;


    function emit(delta) {
        callback({
            deltaY: Math.round(delta / sequenceUnit),
            pageX: position.pageX,
            pageY: position.pageY,
            clientX: position.clientX,
            clientY: position.clientY,
        });
    }

    function endSequence() {
        if (toEmitDelta !== null) {
            emit(toEmitDelta);
            toEmitDelta = null;
        }
        if (sequenceUnit !== null && !(knownUnitArr.includes(sequenceUnit))) {
            knownUnitArr.push(sequenceUnit);
        }
        sequenceLength = 0;
        sequenceUnit = null;
    }

    // --- interface ---
    this.process = function (event) {

        position = {
            pageX: event.pageX,
            pageY: event.pageY,
            clientX: event.clientX,
            clientY: event.clientY,
        };

        clearTimeout(endSequenceTimeout);
        endSequenceTimeout = setTimeout(endSequence, sequenceTimeoutMs);

        //prep delta
        let delta = event.deltaY;
        if ('deltaMode' in event && event.deltaMode === 1) {
            delta *= 100 / 3;
        }
        const absDelta = Math.abs(delta);


        if (sequenceLength > 0 && sequenceUnit === null) {
            //previously determined dirty sequence
            toEmitDelta = null;
            return;
        }

        //sequence begins
        if (sequenceLength === 0) {
            sequenceLength++;
            if (absDelta < 50) {
                //dirty - probably a swipe scroll or pinch scroll on trackpad
                return;
            }

            sequenceUnit = absDelta;
            if (knownUnitArr.includes(sequenceUnit)) {
                //we know this unit - emit right away
                emit(delta);
            } else {
                //unknown unit - wait until next event or sequence end, to have more certainty that it's clean
                toEmitDelta = delta;
            }
            return;
        }

        //sequence continues
        if (absDelta === 0) {
            //ignore zero scroll
            return;
        }
        if (
            absDelta === sequenceUnit ||
            (absDelta / sequenceUnit) % 1 < 0.0001// a multiple
        ) {
            //fine
        } else if ((sequenceUnit / absDelta) % 1 < 0.0001) {
            //unit was actually a multiple - update it
            sequenceUnit = absDelta;

        } else if (absDelta !== sequenceUnit) {
            //not clean - delta is varying - probably a swipe scroll or pinch scroll on trackpad
            sequenceUnit = null;
            toEmitDelta = null;
            return;
        }


        if (toEmitDelta !== null) {
            emit(toEmitDelta);
            toEmitDelta = null;
        }
        emit(delta);
    };
};


/**
 * PointerListener - for pointer events, wheel events. uses fallbacks. ideally consistent behavior across browsers
 * Has some workarounds for browser specific bugs. As browsers get better, this constructor should get smaller
 *
 * p = {
 *     target: DOM element,
 *     onPointer: func (pointerEvent), //optional
 *     onWheel: func (wheelEvent), //optional
 *     onEnterLeave: func (isOver: boolean), //optional
 *     maxPointers: int (1 - n), //default is 1
 *     fixScribble: boolean, // fix ipad scribble issue
 * }
 *
 * pointerEvent = {
 *     type: 'pointerdown'|'pointermove'|'pointerup',
 *     pointerId: long,
 *     pointerType: 'touch'|'mouse'|'pen',
 *     pageX: number,
 *     pageY: number,
 *     clientX: number,
 *     clientY: number,
 *     relX: number, //position relative to top left of target
 *     relY: number,
 *     dX: number, //movementX not supported by safari on iOS, so need my own
 *     dY: number,
 *     downPageX: number, //where was pointer when down-event occurred - set for down|move|up
 *     downPageY: number,
 *     coalescedArr: Array of {
 *         pageX: number,
 *         pageY: number,
 *         clientX: number,
 *         clientY: number,
 *         relX: number, //position relative to top left of target
 *         relY: number,
 *         dX: number,
 *         dY: number,
 *         time: number// same timescale as performance.now() - might be exact same number as in parent
 *     },
 *     time: number, // same timescale as performance.now()
 *     button: 'left'|'middle'|'right',
 *     pressure: number (0-1), // always 1 for touch and mouse
 *     eventPreventDefault: function(),
 *     eventStopPropagation: function(),
 * }
 *
 * wheelEvent = {
 *     deltaY: number, // increments of 1
 *     pageX: number,
 *     pageY: number,
 *     relX: number,
 *     relY: number,
 * }
 *
 * isOver(): boolean - if pointer over the target
 *
 * @param p
 */
export const PointerListener = (function () {

    //keeping track of pointers for movement fallback
    const pointerArr = [];

    function addPointer(event) {
        const pointerObj = {
            pointerId: event.pointerId,
            lastPageX: null,
            lastPageY: null
        };
        pointerArr.push(pointerObj);

        if (pointerArr.length > 15) {
            pointerArr.shift();
        }

        return pointerObj;
    }

    function getPointer(event) {
        for (let i = pointerArr.length - 1; i >= 0; i--) {
            if (event.pointerId === pointerArr[i].pointerId) {
                return pointerArr[i];
            }
        }
        return null;
    }


    let pressureNormalizeAvgCount = 0;
    let pressureNormalizeAvgPressure = null;
    let pressureNormalizeIsComplete = false;
    let pressureNormalizeFactor = 1;

    return function (p) {
        const targetElement = p.target;
        const onPointerCallback = p.onPointer;
        const onWheelCallback = p.onWheel;
        const onEnterLeaveCallback = p.onEnterLeave;
        const maxPointers = 'maxPointers' in p ? p.maxPointers : 1;
        const buttonsToStr = { // translation
            '1': 'left',
            '2': 'right',
            '4': 'middle'
        };
        const wheelCleaner = new WheelCleaner(function (wheelEvent) {
            if (isDestroyed) {
                return;
            }
            if (onWheelCallback) {
                const bounds = targetElement.getBoundingClientRect();
                wheelEvent.relX = wheelEvent.clientX - bounds.left + targetElement.scrollLeft;
                wheelEvent.relY = wheelEvent.clientY - bounds.top + targetElement.scrollTop;
                onWheelCallback(wheelEvent);
            }
        });
        let isDestroyed = false;

        const timeStampOffset = eventUsesHighResTimeStamp() ? 0 : -performance.timing.navigationStart;


        //to circumvent a chrome input glitch
        let lastPointerType = '';
        let didSkip = false;


        /*
        pointers that are pressing a button
        dragObj = {
            pointerId: long,
            pointerType: 'mouse'|'pen'|'touch',
            downPageX: number, //where was pointer when down-event occurred
            downPageY: number,
            button: long,
            lastPageX: number, //pageX in previous event - only for touch events, because they don't have movementX/Y
            lastPageY: number,
            lastTimeStamp: number
        }
         */
        const dragObjArr = [];
        const dragPointerIdArr = [];

        function getDragObj(pointerId) {
            for (let i = 0; i < dragObjArr.length; i++) {
                if (pointerId === dragObjArr[i].pointerId) {
                    return dragObjArr[i];
                }
            }
            return null;
        }

        function removeDragObj(pointerId) {
            let removedDragObj = null;
            for (let i = 0; i < dragPointerIdArr.length; i++) {
                if (dragPointerIdArr[i] === pointerId) {
                    removedDragObj = dragObjArr[i];
                    dragObjArr.splice(i, 1);
                    dragPointerIdArr.splice(i, 1);
                    i--;
                }
            }
            return removedDragObj;
        }


        function normalizePressure(pressure, type?) {
            if (pressure === 0 || pressure === 1) {
                return pressure;
            }

            // was this there to prevent some glitch?
            /*if (pressureNormalizeIsComplete && type === 'pointerdown' && pressure !== 1) {
                pressure *= 0.004;
            }*/

            if (pressureNormalizeAvgCount < 60) {
                if (pressureNormalizeAvgCount === 0) {
                    pressureNormalizeAvgPressure = pressure;
                } else {
                    pressureNormalizeAvgPressure = mix(pressure, pressureNormalizeAvgPressure, 0.95);
                }
                pressureNormalizeAvgCount++;
            } else if (!pressureNormalizeIsComplete) {
                pressureNormalizeIsComplete = true;
                //BB.throwOut('avg pressure decision!' + pressureNormalizeAvgPressure);
                if (pressureNormalizeAvgPressure < 0.13) { // absurd pressure needed
                    pressureNormalizeFactor = 2.3;
                }
            }


            return Math.pow(pressure, 1 / pressureNormalizeFactor);
        }


        /**
         *
         * More trustworthy pointer attributes. that behave the same across browsers.
         * returns a new object. this object also gets attached to the orig event. -> event.corrected
         *
         * @param event
         * @returns {{pointerId: number, timeStamp: number, button, buttons, pointerType: (string|string|any), movementY: number, movementX: number, pressure, coalescedArr: [], pageY, pageX, clientX, clientY, eventPreventDefault: func, eventStopPropagation: func}
         */
        function correctPointerEvent(event) {
            if (event.corrected) {
                return event.corrected;
            }

            /*if (event.type === 'pointermove' && !window.hidePressureOut) {
                if (event.type === 'pointermove') {
                    BB.throwOut(event.pressure + ' ' + event.pointerType);
                }
            }*/

            const correctedObj = {
                pointerId: event.pointerId,
                pointerType: event.pointerType,
                pageX: event.pageX,
                pageY: event.pageY,
                clientX: event.clientX,
                clientY: event.clientY,
                movementX: event.movementX,
                movementY: event.movementY,
                timeStamp: event.timeStamp + timeStampOffset,
                pressure: normalizePressure(event.pressure, event.type),
                buttons: event.buttons,
                button: event.button,
                coalescedArr: [],
                eventPreventDefault: function () {
                    event.preventDefault();
                },
                eventStopPropagation: function () {
                    event.stopPropagation();
                }
            };
            event.corrected = correctedObj;

            let customPressure = null;
            if ('pointerId' in event) {
                if ('pressure' in event && event.buttons !== 0 && (['mouse'].includes(event.pointerType) || (event.pointerType === 'touch' && event.pressure === 0))) {
                    correctedObj.pressure = 1;
                    customPressure = 1;
                }
            } else {
                correctedObj.pointerId = 0;
                correctedObj.pointerType = 'mouse';
                correctedObj.pressure = event.buttons !== 0 ? 1 : 0;
                customPressure = correctedObj.pressure;
            }

            if (isFirefox && event.pointerType != 'mouse' && event.type === 'pointermove' && event.buttons === 0) { // once again firefox
                correctedObj.buttons = 1; //todo wrong if no buttons actually pressed
            }

            let coalescedEventArr = [];
            if ('getCoalescedEvents' in event) {
                coalescedEventArr = event.getCoalescedEvents();
            }

            // chrome somehow movementX not same scale as pageX. todo: only chrome?
            // so make my own

            let pointerObj = getPointer(correctedObj);
            if (pointerObj === null) {
                pointerObj = addPointer(correctedObj);
            }

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
                    pressure: customPressure === null ? normalizePressure(eventItem.pressure) : customPressure
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
         * creates a value for onPointer, from a pointer event handler
         *
         * @param typeStr string - 'pointerdown'|'pointermove'|'pointerup'
         * @param correctedEvent - corrected pointer event from correctPointerEvent()
         * @param custom - object for setting custom attributes
         * @returns {{pointerId: number, pointerType: *, dX: (*), relY: number, dY: (*), relX: number, type: *, event: *, pageY: *, pageX: *}}
         */
        function createPointerOutEvent(typeStr, correctedEvent, custom?) {

            const bounds = targetElement.getBoundingClientRect();
            const result: any = {
                type: typeStr,
                pointerId: correctedEvent.pointerId,
                pointerType: correctedEvent.pointerType,
                pageX: correctedEvent.pageX,
                pageY: correctedEvent.pageY,
                clientX: correctedEvent.clientX,
                clientY: correctedEvent.clientY,
                relX: correctedEvent.clientX - bounds.left + targetElement.scrollLeft,
                relY: correctedEvent.clientY - bounds.top + targetElement.scrollTop,
                dX: correctedEvent.movementX,
                dY: correctedEvent.movementY,
                time: correctedEvent.timeStamp,
                eventPreventDefault: correctedEvent.eventPreventDefault,
                eventStopPropagation: correctedEvent.eventStopPropagation
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
                            relX: coalescedItem.clientX - bounds.left + targetElement.scrollLeft,
                            relY: coalescedItem.clientY - bounds.top + targetElement.scrollTop,
                            dX: coalescedItem.movementX,
                            dY: coalescedItem.movementY,
                            time: coalescedItem.timeStamp
                        });
                    }
                }
            }

            if (custom) {
                const keyArr = Object.keys(custom);
                for (let i = 0; i < keyArr.length; i++) {
                    result[keyArr[i]] = custom[keyArr[i]];
                }
            }

            return result;
        }

        /**
         * creates a value for onPointer, from a fallback touch event handler
         *
         * @param typeStr string - 'pointerdown'|'pointermove'|'pointerup'
         * @param touchListItem - element from changed touch list
         * @param touchEvent - touch event
         * @param custom - object for setting custom attributes
         * @returns {{pointerId: number, pointerType: string, relY: number, relX: number, type: *, event: *, pageY: *, pageX: *}}
         */
        function createTouchOutEvent(typeStr, touchListItem, touchEvent, custom) {
            const bounds = targetElement.getBoundingClientRect();
            const result: any = {
                type: typeStr,
                pointerId: touchListItem.identifier,
                pointerType: 'touch',
                pageX: touchListItem.pageX,
                pageY: touchListItem.pageY,
                clientX: touchListItem.clientX,
                clientY: touchListItem.clientY,
                relX: touchListItem.pageX - bounds.left + targetElement.scrollLeft,
                relY: touchListItem.pageY - bounds.top + targetElement.scrollTop,
                time: touchEvent.timeStamp + timeStampOffset,
                eventPreventDefault: function() { touchEvent.preventDefault(); },
                eventStopPropagation: function() { touchEvent.stopPropagation(); }
            };

            if (typeStr === 'pointermove') {
                result.coalescedArr = [];
            }

            const keyArr = Object.keys(custom);
            for (let i = 0; i < keyArr.length; i++) {
                result[keyArr[i]] = custom[keyArr[i]];
            }

            return result;
        }

        function setupDocumentListeners() {
            addEventListener(document, 'pointermove', onGlobalPointerMove);
            addEventListener(document, 'pointerup', onGlobalPointerUp);
            addEventListener(document, 'pointerleave', onGlobalPointerLeave);
        }

        function destroyDocumentListeners() {
            removeEventListener(document, 'pointermove', onGlobalPointerMove);
            removeEventListener(document, 'pointerup', onGlobalPointerUp);
            removeEventListener(document, 'pointerleave', onGlobalPointerLeave);
        }

        let isOverCounter = 0; // might be multiple pointers
        function onPointerEnter() {
            isOverCounter++;
            if (onEnterLeaveCallback) {
                onEnterLeaveCallback(true);
            }
        }

        function onPointerLeave() {
            isOverCounter--;
            if (onEnterLeaveCallback) {
                onEnterLeaveCallback(false);
            }
        }

        function onPointermove(event) {
            event = correctPointerEvent(event);

            const tempLastPointerType = lastPointerType;
            lastPointerType = event.pointerType;

            if (dragPointerIdArr.includes(event.pointerId) || dragPointerIdArr.length === maxPointers || event.pointerType === 'touch') {
                didSkip = false;
                return;
            }

            // chrome input glitch workaround - throws in a random mouse event with the wrong position when using a stylus
            if (!didSkip && event.pointerType === 'mouse' && tempLastPointerType === 'pen') {
                didSkip = true;
                return;
            }
            didSkip = false;

            const outEvent = createPointerOutEvent('pointermove', event);
            onPointerCallback(outEvent);

        }

        function onPointerdown(event) {
            //BB.throwOut('pointerdown ' + event.pointerId + ' | ' + dragPointerIdArr.length);
            event = correctPointerEvent(event);
            ////console.log('debug: ' + event.pointerId + ' pointerdown');
            if (dragPointerIdArr.includes(event.pointerId) || dragPointerIdArr.length === maxPointers || !([1, 2, 4].includes(event.buttons))) {
                //BB.throwOut('pointerdown ignored');
                return;
            }


            //set up global listeners
            if (dragObjArr.length === 0) {
                setupDocumentListeners();
            }
            const dragObj = {
                pointerId: event.pointerId,
                pointerType: event.pointerType,
                downPageX: event.pageX,
                downPageY: event.pageY,
                buttons: event.buttons,
                lastPageX: event.pageX,
                lastPageY: event.pageY,
                lastTimeStamp: event.timeStamp
            };
            dragObjArr.push(dragObj);
            setTouchTimeout(dragObj);
            dragPointerIdArr.push(event.pointerId);

            const outEvent = createPointerOutEvent('pointerdown', event, {
                downPageX: event.pageX,
                downPageY: event.pageY,
                button: buttonsToStr[event.buttons],
                pressure: event.pressure
            });

            onPointerCallback(outEvent);
        }


        function onGlobalPointerMove(event) {
            //BB.throwOut('pointermove ' + event.pointerId);
            event = correctPointerEvent(event);
            ////console.log('debug: ' + event.pointerId + ' GLOBALpointermove');
            if (!(dragPointerIdArr.includes(event.pointerId))) {
                return;
            }

            const dragObj = getDragObj(event.pointerId);
            clearTouchTimeout(dragObj);

            //if pointer changes button its pressing -> turn into pointerup
            if (event.buttons !== dragObj.buttons) {
                //pointer up

                //remove listener
                if (dragObjArr.length === 1) {
                    destroyDocumentListeners();
                }
                removeDragObj(event.pointerId);

                const outEvent = createPointerOutEvent('pointerup', event, {
                    downPageX: dragObj.downPageX,
                    downPageY: dragObj.downPageY
                });
                onPointerCallback(outEvent);
                return;

            }

            setTouchTimeout(dragObj);

            // ipad likes to do this
            if (
                event.pointerType === 'pen' &&
                event.pageX === dragObj.lastPageX &&
                event.pageY === dragObj.lastPageY &&
                event.timeStamp === dragObj.lastTimeStamp
            ) {
                //ignore
                return;
            }

            const outEvent = createPointerOutEvent('pointermove', event, {
                downPageX: dragObj.downPageX,
                downPageY: dragObj.downPageY,
                button: buttonsToStr[event.buttons],
                pressure: event.pressure
            });

            dragObj.lastPageX = event.pageX;
            dragObj.lastPageY = event.pageY;
            dragObj.lastTimeStamp = event.timeStamp;

            onPointerCallback(outEvent);

        }

        function onGlobalPointerUp(event) {
            //BB.throwOut('pointerup ' + event.pointerId);
            event = correctPointerEvent(event);
            ////console.log('debug: ' + event.pointerId + ' GLOBALpointerup');
            if (!(dragPointerIdArr.includes(event.pointerId))) {
                return;
            }

            //remove listener
            if (dragObjArr.length === 1) {
                destroyDocumentListeners();
            }
            const dragObj = removeDragObj(event.pointerId);
            clearTouchTimeout(dragObj);

            const outEvent = createPointerOutEvent('pointerup', event, {
                downPageX: dragObj.downPageX,
                downPageY: dragObj.downPageY
            });
            onPointerCallback(outEvent);

        }

        function onGlobalPointerLeave(event) {
            //BB.throwOut('pointerleave ' + event.pointerId);
            event = correctPointerEvent(event);
            ////console.log('debug: ' + event.pointerId + ' onGlobalPointerLeave', event);
            if (!(dragPointerIdArr.includes(event.pointerId))) { //} || event.target !== document) {
                return;
            }

            //remove listener
            if (dragObjArr.length === 1) {
                destroyDocumentListeners();
            }
            const dragObj = removeDragObj(event.pointerId);
            clearTouchTimeout(dragObj);

            const outEvent = createPointerOutEvent('pointerup', event, {
                downPageX: dragObj.downPageX,
                downPageY: dragObj.downPageY
            });
            onPointerCallback(outEvent);
        }


        /*
        --- ipad pointer event glitch damage control ---

        ipad pointer events are glitchy. doesn't always fire pointerup.
        - when two fingers get really close to each other
        - when finger moves out and back in bottom

        This artificially fires a pointerup
        */
        function onTouchTimeout(dragObj) {

            //create fake event
            const fakeEvent = {
                pointerId: dragObj.pointerId,
                pointerType: dragObj.pointerType,
                type: 'pointerup',
                timeStamp: performance.now(),
                pageX: 0,
                pageY: 0,
                clientX: 0,
                clientY: 0,
                preventDefault: function () {
                },
                stopPropagation: function () {
                }
            };

            //call onGlobalPointerUp with it
            onGlobalPointerUp(fakeEvent);
        }

        function setTouchTimeout(dragObj) {
            if (dragObj.pointerType !== 'touch') {
                return;
            }
            dragObj.touchTimeout = setTimeout(function () {
                onTouchTimeout(dragObj);
            }, 2500); // 2.5 seconds
        }

        function clearTouchTimeout(dragObj) {
            if (!dragObj.touchTimeout) {
                return;
            }
            clearTimeout(dragObj.touchTimeout);
            dragObj.touchTimeout = null;
        }


        if (onEnterLeaveCallback) {
            addEventListener(targetElement, 'pointerenter', onPointerEnter);
            addEventListener(targetElement, 'pointerleave', onPointerLeave);
        }
        if (onPointerCallback) {
            addEventListener(targetElement, 'pointermove', onPointermove);
            addEventListener(targetElement, 'pointerdown', onPointerdown);
        }
        if (onWheelCallback) {
            addEventListener(targetElement, 'wheel', wheelCleaner.process);
        }


        let onTouchstart;
        let onTouchmove;
        let onTouchend;

        // --- touch fallback ---
        if (!(hasPointerEvents)) {

            onTouchstart = function (event) {
                ////console.log('onTouchstart', event, event.changedTouches.length);
                event.preventDefault(); // needs to stay, otherwise page scrolls on iOS12

                const touchArr = event.changedTouches;
                for (let i = 0; i < touchArr.length && dragObjArr.length < maxPointers; i++) {
                    const touchObj = touchArr[i];

                    //set up global listeners
                    if (dragObjArr.length === 0) {
                        addEventListener(document, 'touchmove', onTouchmove);
                        addEventListener(document, 'touchend', onTouchend);
                        addEventListener(document, 'touchcancel', onTouchend);
                    }
                    dragObjArr.push({
                        pointerId: touchObj.identifier,
                        downPageX: touchObj.pageX,
                        downPageY: touchObj.pageY,
                        buttons: 1,
                        lastPageX: touchObj.pageX,
                        lastPageY: touchObj.pageY,
                    });
                    dragPointerIdArr.push(touchObj.identifier);

                    const outEvent = createTouchOutEvent('pointerdown', touchObj, event, {
                        dX: 0,
                        dY: 0,
                        downPageX: touchObj.downPageX,
                        downPageY: touchObj.downPageY,
                        button: 'left',
                        pressure: 1
                    });
                    onPointerCallback(outEvent);
                }

            }

            onTouchmove = function (event) {
                event.preventDefault(); // needs to stay, otherwise page scrolls on iOS12


                const touchArr = event.changedTouches;
                for (let i = 0; i < touchArr.length; i++) {
                    const touchObj = touchArr[i];

                    if (!(dragPointerIdArr.includes(touchObj.identifier))) {
                        continue;
                    }
                    const dragObj = getDragObj(touchObj.identifier);

                    const outEvent = createTouchOutEvent('pointermove', touchObj, event, {
                        dX: touchObj.pageX - dragObj.lastPageX,
                        dY: touchObj.pageY - dragObj.lastPageY,
                        downPageX: dragObj.downPageX,
                        downPageY: dragObj.downPageY,
                        button: 'left',
                        isCoalesced: false,
                        pressure: 1
                    });
                    dragObj.lastPageX = touchObj.pageX;
                    dragObj.lastPageY = touchObj.pageY;
                    onPointerCallback(outEvent);

                }

            }

            onTouchend = function (event) {
                if (event.type !== 'touchcancel') {
                    event.preventDefault(); // needs to stay, otherwise page scrolls on iOS12
                }


                const touchArr = event.changedTouches;
                for (let i = 0; i < touchArr.length; i++) {
                    const touchObj = touchArr[i];

                    if (!(dragPointerIdArr.includes(touchObj.identifier))) {
                        continue;
                    }

                    //remove listener
                    if (dragObjArr.length === 1) {
                        removeEventListener(document, 'touchmove', onTouchmove);
                        removeEventListener(document, 'touchend', onTouchend);
                        removeEventListener(document, 'touchcancel', onTouchend);
                    }
                    const dragObj = removeDragObj(touchObj.identifier);

                    const outEvent = createTouchOutEvent('pointerup', touchObj, event, {
                        dX: touchObj.pageX - dragObj.lastPageX,
                        dY: touchObj.pageY - dragObj.lastPageY,
                        downPageX: dragObj.downPageX,
                        downPageY: dragObj.downPageY,
                    });

                    onPointerCallback(outEvent);
                }

            }

            if (onPointerCallback) {
                addEventListener(targetElement, 'touchstart', onTouchstart);
            }

        } else if (p.fixScribble) {
            //ipad scribble workaround https://developer.apple.com/forums/thread/662874
            onTouchmove = function(e) {
                e.preventDefault();
            }
            addEventListener(targetElement, 'touchmove', onTouchmove);

        }


        // --- interface ---

        this.isOver = function () {
            return isOverCounter > 0;
        };

        this.destroy = function () {
            if (isDestroyed) {
                return;
            }
            isDestroyed = true;
            removeEventListener(targetElement, 'pointerenter', onPointerEnter);
            removeEventListener(targetElement, 'pointerleave', onPointerLeave);
            removeEventListener(targetElement, 'pointermove', onPointermove);
            removeEventListener(targetElement, 'pointerdown', onPointerdown);
            removeEventListener(targetElement, 'wheel', wheelCleaner.process);
            if (dragObjArr.length > 0) {
                destroyDocumentListeners();
            }

            if (!(hasPointerEvents)) {
                removeEventListener(targetElement, 'touchstart', onTouchstart);
                if (dragObjArr.length > 0) {
                    removeEventListener(document, 'touchmove', onTouchmove);
                    removeEventListener(document, 'touchend', onTouchend);
                    removeEventListener(document, 'touchcancel', onTouchend);
                }
            } else {
                removeEventListener(targetElement, 'touchmove', onTouchmove);
            }
        };

    }
})();