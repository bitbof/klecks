import {clamp, dist, mix, pointsToAngleRad} from '../math/math';


type ChainOutFunc = (event?) => void;

/**
 * for chaining event processing. useful for gestures (double tap, pinch zoom, max pointer filter).
 * each element in the chain might hold back the events, swallow them, or transform them
 *
 * p = {
 *     chainArr: ChainElement[]
 * }
 *
 * chainIn(event): null - feed an event into the chain
 * setChainOut(func): void - func(event) <- called when passed through chain
 * ^ each ChainElement needs these methods too
 *
 * @param p
 * @constructor
 */
export const EventChain = function (p) {

    const chainArr = p.chainArr;
    let chainOut: ChainOutFunc = () => undefined;

    function continueChain(i, event) {
        for (; i < chainArr.length; i++) {
            event = chainArr[i].chainIn(event);
            if (event === null) {
                return null;
            }
        }
        chainOut(event);
        return null;
    }

    for (let i = 0; i < chainArr.length; i++) {
        (function (i) {
            chainArr[i].setChainOut(function (event) {
                continueChain(i + 1, event);
            });
        })(i);
    }

    // --- interface ---

    this.chainIn = function (event) {
        return continueChain(0, event);
    };
    this.setChainOut = function (func) {
        chainOut = func;
    };
};


/**
 * A ChainElement. Detects double taps.
 *
 * p = {
 *     onDoubleTap: function({pageX: number, pageY: number}) - fires when double tap occurs
 * }
 *
 * chainIn
 * setChainOut
 * setAllowedPointerTypeArr(string[]): void - which pointer types are allowed
 * setAllowedButtonArr(string[]): void - which buttons are allowed
 *
 * @param p
 * @constructor
 */
export const DoubleTapper = function (p) {

    let chainOut: ChainOutFunc = function () {
    };
    const minSilenceBeforeDurationMs = 400;
    const maxPressedDurationMs = 300;
    const maxPressedDistancePx = 10;
    const maxInbetweenDistancePx = 19;
    const maxUpToUpDurationMs = 500;
    const maxUntilSecondDownDurationMs = 300;
    const minSilenceAfterMs = 250;

    let allowedPointerTypeArr = ['touch', 'mouse', 'pen'];
    let allowedButtonArr = ['left'];

    let sequenceArr = [];
    const pointersDownIdArr = [];
    let lastUpTime = 0;
    let nowTime = 0;

    let eventQueueArr = [];


    function fail() {
        if (sequenceArr.length === 0) { // no gesture started -> can be ignored
            return;
        }
        clearTimeout(timeoutObj.fail);
        clearTimeout(timeoutObj.maxUntilSecondDown);
        clearTimeout(timeoutObj.success);
        timeoutObj.fail = null;
        timeoutObj.maxUntilSecondDown = null;
        timeoutObj.success = null;


        for (let i = 0; i < eventQueueArr.length; i++) {
            chainOut(eventQueueArr[i]);
        }
        eventQueueArr = [];

        sequenceArr = [];
    }

    // double tap achieved
    function success() {
        timeoutObj.fail = null;
        timeoutObj.success = null;
        eventQueueArr = []; // events get swallowed
        const lastSequenceItem = sequenceArr[sequenceArr.length - 1];
        sequenceArr = [];
        p.onDoubleTap({pageX: lastSequenceItem.pageX, pageY: lastSequenceItem.pageY});
    }


    const timeoutObj = {
        fail: null,
        maxUntilSecondDown: null,
        success: null
    };

    //returns false if time already up. otherwise sets up timeout
    function setupTimeout(timeoutStr, targetFunc, timeMS) {
        const diff = timeMS - nowTime;
        //console.log(fingers + ': ' + timeoutStr + ' diff', diff);
        if (diff <= 0) { // time already up
            return false;
        }
        timeoutObj[timeoutStr] = setTimeout(targetFunc, diff);
        return true;
    }


    /**
     * @param event object - a pointer event from BB.PointerListener
     */
    function processEvent(event) {

        if (event.type === 'pointerdown') {
            pointersDownIdArr.push(event.pointerId);
        } else if (event.type === 'pointerup') {
            for (let i = 0; i < pointersDownIdArr.length; i++) {
                if (pointersDownIdArr[i] === event.pointerId) {
                    pointersDownIdArr.splice(i, 1);
                    break;
                }
            }
        }

        if (!allowedPointerTypeArr.includes(event.pointerType)) { //wrong input type -> fail
            //console.log('wrong input type -> fail');
            fail();
            return;
        }

        nowTime = performance.now();
        const lastSequenceItem = sequenceArr.length > 0 ? sequenceArr[sequenceArr.length - 1] : null;
        if (event.type === 'pointerup') {
            lastUpTime = event.time;
        }

        if (event.type === 'pointerdown') {
            if (pointersDownIdArr.length > 1) { // more than one pointer down -> fail
                //console.log('more than one pointer down -> fail');
                fail();
                return;
            }
            if (timeoutObj.success !== null) { // silence-after not achieved -> fail
                //console.log('silence-after not achieved -> fail');
                fail();
                return;
            }
            if (sequenceArr.length === 0 && nowTime - lastUpTime < minSilenceBeforeDurationMs) { // silence before not achieved -> fail
                //console.log('silence before not achieved -> fail');
                fail();
                return;
            }
            if (!allowedButtonArr.includes(event.button)) { // wrong button -> fail
                //console.log('wrong button -> fail', event.button, allowedButtonArr);
                fail();
                return;
            }
            if (lastSequenceItem && lastSequenceItem.isDown || sequenceArr.length > 2) { // jumbled -> fail
                //console.log('jumbled -> fail');
                fail();
                return;
            }
            if (lastSequenceItem) {
                const distance = dist(lastSequenceItem.position[0], lastSequenceItem.position[1], event.pageX, event.pageY);
                if (distance > maxInbetweenDistancePx) { //moved too much -> reset
                    //console.log('maxInbetweenDistancePx -> reset');
                    fail();

                    if (nowTime - lastSequenceItem.time < minSilenceBeforeDurationMs) { //silence before not achieved -> fail
                        return;
                    }
                }
            }
            sequenceArr.push({
                isDown: true,
                time: nowTime,
                position: [event.pageX, event.pageY],
                pointerId: event.pointerId
            });
            //maxUntilSecondDown

            if (sequenceArr.length > 1) {
                clearTimeout(timeoutObj.maxUntilSecondDown);
            } else if (!setupTimeout('maxUntilSecondDown', fail, event.time + maxUntilSecondDownDurationMs)) {
                //console.log('event.time + maxPressedDurationMs -> fail');
                fail();
                return;
            }


            clearTimeout(timeoutObj.fail);
            if (!setupTimeout('fail', fail, event.time + maxPressedDurationMs)) {
                //console.log('event.time + maxPressedDurationMs -> fail');
                fail();
                return;
            }
        }
        if (lastSequenceItem && event.type === 'pointermove' && lastSequenceItem.pointerId === event.pointerId) {
            /*if (lastSequenceItem.pointerId !== event.pointerId) { //another pointer mixing in -> fail
                console.log('another pointer mixing in -> fail');
                fail();
                return;
            }*/
            const distance = dist(lastSequenceItem.position[0], lastSequenceItem.position[1], event.pageX, event.pageY);
            if (distance > maxPressedDistancePx) { //moved too much -> fail
                //console.log('maxPressedDistancePx -> fail');
                fail();
                return;
            }
        }
        if (lastSequenceItem && event.type === 'pointerup') {
            if (lastSequenceItem.pointerId !== event.pointerId) { //another pointer mixing in -> fail
                fail();
                return;
            }
            if (nowTime >= lastSequenceItem.time + maxPressedDurationMs) { //pressed too long -> fail
                fail();
                return;
            }
            clearTimeout(timeoutObj.fail);

            if (sequenceArr.length < 3) {
                if (!setupTimeout('fail', fail, event.time + maxUpToUpDurationMs)) {
                    fail();
                    return;
                }

                sequenceArr = [
                    lastSequenceItem,
                    {
                        isUp: true,
                        time: nowTime,
                        position: [event.pageX, event.pageY]
                    }
                ];
                return;
            }

            if (nowTime < sequenceArr[1].time + maxUpToUpDurationMs) {
                // double tap almost success
                // only needs silence
                sequenceArr.push({
                    pageX: event.pageX,
                    pageY: event.pageY
                });
                if (!setupTimeout('success', success, event.time + minSilenceAfterMs)) {
                    fail();
                }
            } else { // time up -> fail
                fail();
            }

        }
    }


    // --- interface ---

    this.chainIn = function (event) {

        processEvent(event);

        if (sequenceArr.length === 0) { //existing events can not become a double tap
            fail();
            return event;
        }
        // events might become a double tap -> queue
        eventQueueArr.push(event);
        return null;
    };

    this.setChainOut = function (func) {
        chainOut = func;
    };

    this.setAllowedPointerTypeArr = function (arr) {
        allowedPointerTypeArr = arr;
    };

    this.setAllowedButtonArr = function (arr) {
        allowedButtonArr = arr;
    };
};


/**
 * A ChainElement. Detects a single tap, done with N 'touch' pointers
 *
 * p = {
 *      fingers: number - number of fingers
 *      onTap: function() - fires when tap occurs
 * }
 *
 * chainIn
 * setChainOut
 *
 * @param p
 * @constructor
 */
export const NFingerTapper = function (p) {

    const fingers = p.fingers;
    let chainOut: ChainOutFunc = function () {
    };

    const minSilenceBeforeDurationMs = 50; //250;
    const maxTapMs = 500;
    const maxFirstLastFingerDownMs = 250;
    const maxPressedDistancePx = 12; //5 + fingers * 5;
    const silenceAfterDurationMs = 250;


    /*
        fingerObj = {
            pointerId: number,
            downTime: number,
            downPageX: number,
            downPageY: number,
            isUp: boolean
        }
     */
    let fingerArr = [];
    let firstDownTime;
    let eventQueueArr = [];
    let lastEventTime = 0;
    const pointersDownIdArr = [];

    function fail() {
        if (eventQueueArr.length === 0) {
            return;
        }
        clearTimeout(timeoutObj.firstLastDownTimeout);
        clearTimeout(timeoutObj.tapTimeout);
        for (let i = 0; i < eventQueueArr.length; i++) {
            chainOut(eventQueueArr[i]);
        }
        eventQueueArr = [];
        fingerArr = [];
    }

    function success() {
        clearTimeout(timeoutObj.firstLastDownTimeout);
        clearTimeout(timeoutObj.tapTimeout);
        eventQueueArr = []; // events get swallowed
        fingerArr = [];
        p.onTap();
    }

    let nowTime;
    const timeoutObj = {
        firstLastDownTimeout: null,
        tapTimeout: null
    };

    function setupTimeout(timeoutStr, timeMS) {
        const diff = timeMS - nowTime;
        //console.log(fingers + ': ' + timeoutStr + ' diff', diff);
        if (diff <= 0) { // time already up
            return false;
        }
        timeoutObj[timeoutStr] = setTimeout(fail, diff);
        return true;
    }

    function processEvent(event) {

        const tempLastEventTime = lastEventTime;
        lastEventTime = event.time;

        if (event.type === 'pointerdown') {
            pointersDownIdArr.push(event.pointerId);
        } else if (event.type === 'pointerup') {
            for (let i = 0; i < pointersDownIdArr.length; i++) {
                if (pointersDownIdArr[i] === event.pointerId) {
                    pointersDownIdArr.splice(i, 1);
                    break;
                }
            }
        }

        if (event.pointerType !== 'touch') {
            if (fingerArr.length > 0) { // already in gesture -> fail
                fail();
            }
            return;
        }

        nowTime = performance.now();

        if (event.type === 'pointerdown') {
            //console.log('down');
            if (fingerArr.length + 1 !== pointersDownIdArr.length) { // failed before, and some fingers are still down -> fail
                fail();
                return;
            }
            if (fingerArr.length === fingers) { // too many fingers down -> fail
                //console.log(fingers + ': too many fingers down -> fail');
                fail();
                return;
            }
            if (fingerArr.length > 0 && event.time - maxFirstLastFingerDownMs > fingerArr[0].downTime) { // took too long to touch with all fingers -> fail
                //console.log(fingers + ': took too long to touch with all fingers -> fail');
                fail();
                return;
            }
            if (fingerArr.length === 0 && event.time - minSilenceBeforeDurationMs < tempLastEventTime) { // not enough silence before -> fail
                //console.log(fingers + ': not enough silence before -> fail');
                fail();
                return;
            }

            if (fingerArr.length === 0) {
                firstDownTime = event.time;

                if (!setupTimeout('firstLastDownTimeout', event.time + maxFirstLastFingerDownMs) || !setupTimeout('tapTimeout', event.time + maxTapMs)) { // timeouts already up -> fail
                    fail();
                    return;
                }

            }
            fingerArr.push({
                pointerId: event.pointerId,
                downTime: event.time,
                downPageX: event.pageX,
                downPageY: event.pageY
            });
            return;

        }

        if (event.type === 'pointermove') {

            if (fingerArr.length === 0) {
                //not in a gesture -> ignore
                return;
            }

            let fingerObj = null;
            for (let i = 0; i < fingerArr.length; i++) {
                if (fingerArr[i].pointerId === event.pointerId) {
                    fingerObj = fingerArr[i];
                    break;
                }
            }
            if (fingerObj === null) { // finger not part of the tap is on screen -> fail
                fail();
                return;
            }

            if (event.time - maxTapMs > firstDownTime) { // tap took too long -> fail
                //console.log(fingers + ': tap took too long -> fail');
                fail();
                return;
            }

            const distance = dist(event.pageX, event.pageY, fingerObj.downPageX, fingerObj.downPageY);
            if (distance > maxPressedDistancePx) { // finger moved too much -> fail
                //console.log(fingers + ': a finger moved too much -> fail', distance);
                fail();
                return;
            }

        }

        if (event.type === 'pointerup') {

            if (fingerArr.length === 0) {
                //not in a gesture -> ignore
                return;
            }

            //console.log('up', event.pageX, event.pageY);
            if (fingerArr.length !== fingers) { // not enough fingers -> fail
                //console.log(fingers + ': not enough fingers -> fail');
                fail();
                return;
            }

            let fingerObj = null;
            let i = 0;
            for (; i < fingerArr.length; i++) {
                if (fingerArr[i].pointerId === event.pointerId) {
                    fingerObj = fingerArr[i];
                    break;
                }
            }
            if (fingerObj === null) {
                //do nothing
                return;
            }

            if (event.time - maxTapMs > firstDownTime) { // tap took too long -> fail
                //console.log(fingers + ': tap took too long -> fail');
                fail();
                return;
            }

            const distance = dist(event.pageX, event.pageY, fingerObj.downPageX, fingerObj.downPageY);
            if (distance > maxPressedDistancePx) { // finger moved too much -> fail
                //console.log(fingers + ': b finger moved too much -> fail', distance, event.pageX, event.pageY);
                //console.log(fingerArr);
                fail();
                return;
            }

            fingerObj.isUp = true;

            let allAreUp = true;
            for (let i = 0; i < fingerArr.length; i++) {
                if (!fingerArr[i].isUp) {
                    allAreUp = false;
                    break;
                }
            }
            //console.log('fingerArr', fingerArr);

            if (allAreUp) { // success
                success();
                return true;
            }

        }


    }


    // --- interface ---

    this.chainIn = function (event) {

        const result = processEvent(event);

        //console.log(fingerArr.length);

        if (result === true) {
            //tap success -> event gets swallowed
            return null;
        }
        if (fingerArr.length === 0) {
            return event;
        } else {
            eventQueueArr.push(event);
        }

        return null;

    };

    this.setChainOut = function (func) {
        chainOut = func;
    };
};


/**
 * A ChainElement. Detects a pinch zooming (2 touch pointers). If one finger lifts, then will use the remaining.
 * Further pointers are ignored, but their events get swallowed during the pinching.
 * pinching ends when ALL pointers are lifted.
 * Events passed through if no pinching.
 *
 * p = {
 *      onPinch: function({type: 'end'} | {
 *          type: 'move',
 *          relX: number,
 *          relY: number,
 *          downRelX: number,
 *          downRelY: number,
 *          angleDeg: number,
 *          scale: number
 *      }) - fires when pinching occurs
 * }
 *
 * chainIn
 * setChainOut
 *
 * @param p
 * @constructor
 */
export const PinchZoomer = function (p) {

    const firstFingerMaxDistancePx = 10;
    const untilSecondFingerDurationMs = 250;

    let chainOut: ChainOutFunc = function () {
    };
    const pointersDownIdArr = [];
    /*
    gestureObj = {
        touchPointerArr: Array of {
            pointerId: number,
            relX: number,
            relY: number,
            downRelX: number, // only for first
            downRelY: number
        },
        otherPointerIdArr: number[],
        isInProgress: boolean
    }
    */
    let gestureObj = null;
    let eventQueueArr = [];


    function end() {
        gestureObj = null;
        eventQueueArr = [];
    }

    function fail(doSwallow?) {
        if (!gestureObj) { // no gesture happening -> ignore
            return;
        }

        clearTimeout(timeoutObj.secondFingerTimeout);
        if (!doSwallow) {
            for (let i = 0; i < eventQueueArr.length; i++) {
                chainOut(eventQueueArr[i]);
            }
        }
        end();
    }


    let nowTime;
    const timeoutObj = {
        secondFingerTimeout: null
    };

    function setupTimeout(timeoutStr, targetFunc, timeMS) {
        const diff = timeMS - nowTime;
        if (diff <= 0) { // time already up
            return false;
        }
        timeoutObj[timeoutStr] = setTimeout(targetFunc, diff);
        return true;
    }


    function processEvent(event) {

        if (event.type === 'pointerdown') {
            pointersDownIdArr.push(event.pointerId);

        } else if (event.type === 'pointerup') {
            for (let i = 0; i < pointersDownIdArr.length; i++) {
                if (pointersDownIdArr[i] === event.pointerId) {
                    pointersDownIdArr.splice(i, 1);
                    break;
                }
            }
        }

        //pass through scenarios
        if (
            !gestureObj && (
                event.pointerType !== 'touch' || // wrong pointer type
                (event.type === 'pointermove' && pointersDownIdArr.length > 0) || // failed before
                pointersDownIdArr.length > 1 || // failed before
                event.type === 'pointerup' // failed before
            )
        ) {
            return;
        }

        nowTime = performance.now();


        //pointer down
        if (event.type === 'pointerdown') {

            if (gestureObj) {
                if (event.pointerType === 'touch') { // touch finger down - as nth pointer

                    gestureObj.touchPointerArr.push({
                        pointerId: event.pointerId,
                        relX: event.relX,
                        relY: event.relY
                    });

                    if (gestureObj.isInProgress) {
                        continuePinch(gestureObj, {
                            type: 'down',
                            index: gestureObj.touchPointerArr.length - 1
                        });
                    } else {
                        clearTimeout(timeoutObj.secondFingerTimeout);
                        gestureObj.isInProgress = true;
                        beginPinch(gestureObj);
                    }
                    return;

                } else { // non-touch finger down - as nth pointer

                    if (gestureObj.isInProgress) {
                        gestureObj.otherPointerIdArr.push(event.pointerId);
                    } else { // second pointer wrong type -> fail
                        fail();
                    }
                    return;
                }


            } else {
                // first finger down - can only be touch if no gestureObj
                gestureObj = {
                    touchPointerArr: [{
                        pointerId: event.pointerId,
                        relX: event.relX,
                        relY: event.relY,
                        downRelX: event.relX,
                        downRelY: event.relY
                    }],
                    otherPointerIdArr: [],
                    isInProgress: false
                };
                if (!setupTimeout('secondFingerTimeout', function () {
                    fail();
                }, event.time + untilSecondFingerDurationMs)) { // time ran out -> fail
                    fail();
                    return;
                }
                return;
            }

        }


        //pointer move
        if (event.type === 'pointermove' && event.pointerType === 'touch') {
            //gesture object should always exist here

            let touchPointerObj = null;
            let i = 0;
            for (; i < gestureObj.touchPointerArr.length; i++) {
                if (event.pointerId === gestureObj.touchPointerArr[i].pointerId) {
                    touchPointerObj = gestureObj.touchPointerArr[i];
                    break;
                }
            }

            //null should not be possible

            touchPointerObj.relX = event.relX;
            touchPointerObj.relY = event.relY;

            if (!gestureObj.isInProgress) { // only one finger down & pinching hasn't started
                const distance = dist(touchPointerObj.downRelX, touchPointerObj.downRelY, touchPointerObj.relX, touchPointerObj.relY);
                if (distance > firstFingerMaxDistancePx) { // moved too much -> fail
                    fail();
                    return;
                }

            } else {
                if (i < 2) { // only first two touches can affect pinching
                    continuePinch(gestureObj, {
                        type: 'move',
                        index: i
                    });
                }
            }

            return;
        }


        //pointer up
        if (event.type === 'pointerup') {
            //gesture object should always exist here

            if (event.pointerType === 'touch') {
                let i = 0;
                for (; i < gestureObj.touchPointerArr.length; i++) {
                    if (gestureObj.touchPointerArr[i].pointerId === event.pointerId) {
                        gestureObj.touchPointerArr.splice(i, 1);
                        break;
                    }
                }
                if (gestureObj.touchPointerArr.length > 0) {
                    continuePinch(gestureObj, {
                        type: 'up',
                        index: i
                    });
                }

            } else { // non-touch
                for (let i = 0; i < gestureObj.otherPointerIdArr.length; i++) {
                    if (gestureObj.otherPointerIdArr[i] === event.pointerId) {
                        gestureObj.otherPointerIdArr.splice(i, 1);
                        break;
                    }
                }
            }

            //all fingers lifted?
            if (gestureObj.touchPointerArr.length === 0 && gestureObj.otherPointerIdArr.length === 0) {
                if (gestureObj.isInProgress) { // lifted last finger -> end of pinching
                    end();
                    endPinch();
                } else { // lifted finger again before pinching started -> fail
                    fail();
                }
                return;
            }

        }


    }


    // --- actual pinch transform logic ---

    let pincherArr = [];

    function beginPinch(gestureObj) {

        for (let i = 0; i < gestureObj.touchPointerArr.length; i++) {
            const pointerObj = gestureObj.touchPointerArr[i];
            pincherArr.push({
                pointerId: pointerObj.pointerId,
                relX: pointerObj.relX,
                relY: pointerObj.relY,
                downRelX: pointerObj.relX,
                downRelY: pointerObj.relY
            });
        }

        const event: any = {
            type: 'move',
            angleRad: 0,
            scale: 1
        };

        if (pincherArr.length === 1) {
            event.relX = pincherArr[0].downRelX;
            event.relY = pincherArr[0].downRelY;
        } else {
            event.relX = 0.5 * (pincherArr[0].downRelX + pincherArr[1].downRelX);
            event.relY = 0.5 * (pincherArr[0].downRelY + pincherArr[1].downRelY);
        }
        event.downRelX = event.relX;
        event.downRelY = event.relY;

        p.onPinch(event);

    }

    //actionObj = {type: 'down'|'move'|'up', index: number}
    function continuePinch(gestureObj, actionObj) {

        if (actionObj.index > 1) { // only first two pointers matter
            return;
        }

        if (actionObj.type === 'move') {

            let event;
            pincherArr[actionObj.index].relX = gestureObj.touchPointerArr[actionObj.index].relX;
            pincherArr[actionObj.index].relY = gestureObj.touchPointerArr[actionObj.index].relY;

            if (pincherArr.length === 1) {

                event = {
                    type: 'move',
                    downRelX: pincherArr[0].downRelX,
                    downRelY: pincherArr[0].downRelY,
                    relX: pincherArr[0].relX,
                    relY: pincherArr[0].relY,
                    angleRad: 0,
                    scale: 1
                };

            } else {

                const startDist = dist(pincherArr[0].downRelX, pincherArr[0].downRelY, pincherArr[1].downRelX, pincherArr[1].downRelY);
                const distance = dist(pincherArr[0].relX, pincherArr[0].relY, pincherArr[1].relX, pincherArr[1].relY);

                const startAngle = pointsToAngleRad({
                    x: pincherArr[0].downRelX,
                    y: pincherArr[0].downRelY
                }, {x: pincherArr[1].downRelX, y: pincherArr[1].downRelY});
                const angle = pointsToAngleRad({
                    x: pincherArr[0].relX,
                    y: pincherArr[0].relY
                }, {x: pincherArr[1].relX, y: pincherArr[1].relY});

                event = {
                    type: 'move',
                    downRelX: 0.5 * (pincherArr[0].downRelX + pincherArr[1].downRelX),
                    downRelY: 0.5 * (pincherArr[0].downRelY + pincherArr[1].downRelY),
                    relX: 0.5 * (pincherArr[0].relX + pincherArr[1].relX),
                    relY: 0.5 * (pincherArr[0].relY + pincherArr[1].relY),
                    angleRad: angle - startAngle,
                    scale: distance / startDist
                };

            }

            p.onPinch(event);

        } else if (actionObj.type === 'down' || actionObj.type === 'up') {
            endPinch();
            beginPinch(gestureObj);
        }

    }

    function endPinch() {
        pincherArr = [];
        p.onPinch({
            type: 'end'
        });
    }


    // --- interface ---

    this.chainIn = function (event) {
        processEvent(event);
        if (gestureObj) {
            if (!gestureObj.isInProgress) { // might still fail -> into queue
                eventQueueArr.push(event);
            }
        } else {
            return event;
        }
        return null;
    };

    this.setChainOut = function (func) {
        chainOut = func;
    };
};


/**
 * A ChainElement. Splits up coalesced events into their own pointermove events. Otherwise regular pass through.
 *
 * @constructor
 */
export const CoalescedExploder = function () {

    let chainOut: ChainOutFunc = function () {
    };

    // --- interface ---

    this.chainIn = function (event) {

        if (event.type === 'pointermove') {

            if (event.coalescedArr.length > 0) {

                let eventCopy = JSON.parse(JSON.stringify(event));
                eventCopy.coalescedArr = [];
                let coalescedItem;

                for (let i = 0; i < event.coalescedArr.length; i++) {

                    if (i > 0) {
                        eventCopy = JSON.parse(JSON.stringify(event));
                    }
                    coalescedItem = event.coalescedArr[i];

                    eventCopy.pageX = coalescedItem.pageX;
                    eventCopy.pageY = coalescedItem.pageY;
                    eventCopy.relX = coalescedItem.relX;
                    eventCopy.relY = coalescedItem.relY;
                    eventCopy.dX = coalescedItem.dX;
                    eventCopy.dY = coalescedItem.dY;
                    eventCopy.time = coalescedItem.time;
                    if (i < event.coalescedArr.length - 1) {
                        eventCopy.isCoalesced = true;
                    }

                    chainOut(eventCopy);
                }

            } else {
                return event;
            }
        } else {
            return event;
        }

        return null;
    };

    this.setChainOut = function (func) {
        chainOut = func;
    };
};

export const OnePointerLimiter = function (pointers?) {

    let chainOut: ChainOutFunc = function () {
    };

    let downPointerId = null;
    const ignorePointerIdArr = [];


    // --- interface ---

    this.chainIn = function (event) {

        if (ignorePointerIdArr.includes(event.pointerId)) {
            if (event.type === 'pointerup') {
                for (let i = 0; i < ignorePointerIdArr.length; i++) {
                    if (ignorePointerIdArr[i] === event.pointerId) {
                        ignorePointerIdArr.splice(i, 1);
                        break;
                    }
                }
            }
            return null;
        }

        if (downPointerId === null) {
            if (event.type === 'pointerdown') {
                downPointerId = event.pointerId;
            }
            return event;

        } else {
            if (event.pointerId !== downPointerId) {
                if (event.type === 'pointerdown') {
                    ignorePointerIdArr.push(event.pointerId);
                }
                return null;
            }
            if (event.type === 'pointerup') {
                downPointerId = null;
            }
            return event;
        }

        return null;

    };

    this.setChainOut = function (func) {
        chainOut = func;
    };

};


/**
 * Not really and event chain element. but pretty similar.
 *
 * Processes draw input events. When shift held -> linetool
 * line events - what KlCanvasWorkspace passes onDraw(e)
 *
 * p = {
 *     onDraw: function(drawEvent)
 * }
 *
 * pass input in with process(drawEvent)
 *
 * modifies draw event to include such events:
 * {
 *     type: 'line',
 *     x0: null, // you have to fill that in
 *     y0: null, // you have to fill that in
 *     pressure0: null, // you have to fill that in
 *     x1: number,
 *     y1: number,
 *     pressure1: number
 * }
 *
 * @param p
 * @constructor
 */
export const LinetoolProcessor = function (p) {

    let downEvent = null;
    let eventQueue = [];
    let direction = null;
    const DIR_X = 0, DIR_Y = 1;

    this.process = function (event) {
        if (event.type === 'down') {
            downEvent = event;
            direction = null;

            if (event.shiftIsPressed) {

                p.onDraw({
                    type: 'line',
                    x0: null,
                    y0: null,
                    pressure0: null,
                    x1: event.x,
                    y1: event.y,
                    pressure1: event.pressure
                });

                eventQueue.push(event);
                return;
            }

        }

        if (event.type === 'move') {

            if (event.shiftIsPressed) {

                if (direction === null) {
                    const dX = Math.abs(event.x - downEvent.x);
                    const dY = Math.abs(event.y - downEvent.y);

                    if (dX > 5 || dY > 5) {
                        direction = dX > dY ? DIR_X : DIR_Y;

                        for (let i = 0; i < eventQueue.length; i++) {
                            const e = eventQueue[i];
                            if (direction === DIR_X) {
                                e.y = downEvent.y;
                            } else {
                                e.x = downEvent.x;
                            }
                            p.onDraw(JSON.parse(JSON.stringify(e)));
                        }
                        eventQueue = [];
                    }
                }

                if (direction === null) {
                    eventQueue.push(event);
                    return;
                }

                if (direction === DIR_X) {
                    event.y = downEvent.y;
                } else {
                    event.x = downEvent.x;
                }

            } else {
                if (eventQueue.length > 0) {
                    for (let i = 0; i < eventQueue.length; i++) {
                        p.onDraw(JSON.parse(JSON.stringify(eventQueue[i])));
                    }
                    eventQueue = [];
                }
            }

        }

        if (event.type === 'up') {
            eventQueue = [];
        }

        p.onDraw(JSON.parse(JSON.stringify(event)));
    };
};


/**
 * cleans up DrawEvents. More trustworthy events. EventChain element
 *
 * that events can only go line this: down -> n x move -> up
 * so, sanitizes this: down, down, down. becomes only one down. the other downs are ignored/swallowed
 * @constructor
 */
export const LineSanitizer = function () {

    let chainOut: ChainOutFunc = function () {
    };

    let isDrawing = false;

    // --- interface ---
    this.chainIn = function (event) {

        if (event.type === 'down') {
            if (isDrawing) {
                //console.log('line sanitizer - down, but already drawing');
                chainOut({
                    type: 'up',
                    scale: event.scale,
                    shiftIsPressed: event.shiftIsPressed,
                    isCoalesced: false
                });
            } else {
                isDrawing = true;
            }
        }
        if (!isDrawing && (event.type === 'move' || event.type === 'up')) {
            //console.log('line sanitizer - ' + event.type + ' but not drawing');
            return null;
        }

        if (event.type === 'up' && isDrawing) {
            isDrawing = false;
        }

        return event;
    };
    this.setChainOut = function (func) {
        chainOut = func;
    };
    this.getIsDrawing = function () {
        return isDrawing;
    };
};


/**
 * Line smoothing. EventChain element. Smoothing via blending new position with old position.
 * for onDraw events from KlCanvasWorkspace.
 *
 * p = {
 *     smoothing: number, // 0-1, 0: no smoothing, 1: 100% smoothing -> would never catch up
 * }
 *
 * smoothing > 0: will fire DrawEvents in interval when no new move events
 *
 * type: 'line' Events are just passed through.
 *
 * @param p
 * @constructor
 */
export const LineSmoothing = function (p) {

    let chainOut: ChainOutFunc = function () {
    };
    let smoothing = clamp(p.smoothing, 0, 1);
    let lastMixedInput;
    let interval;
    let timeout;

    // --- interface ---

    this.chainIn = function (event) {
        event = JSON.parse(JSON.stringify(event));
        clearTimeout(timeout);
        clearInterval(interval);

        if (event.type === 'down') {
            lastMixedInput = {
                x: event.x,
                y: event.y,
                pressure: event.pressure
            };
        }

        if (event.type === 'move') {

            const inputX = event.x;
            const inputY = event.y;
            const inputPressure = event.pressure;

            event.x = mix(event.x, lastMixedInput.x, smoothing);
            event.y = mix(event.y, lastMixedInput.y, smoothing);
            event.pressure = mix(event.pressure, lastMixedInput.pressure, smoothing);
            lastMixedInput = {
                x: event.x,
                y: event.y,
                pressure: event.pressure
            };

            if (smoothing > 0) {
                timeout = setTimeout(function () {
                    interval = setInterval(function () {
                        event = JSON.parse(JSON.stringify(event));

                        event.x = mix(inputX, lastMixedInput.x, smoothing);
                        event.y = mix(inputY, lastMixedInput.y, smoothing);
                        event.pressure = mix(inputPressure, lastMixedInput.pressure, smoothing);
                        lastMixedInput = {
                            x: event.x,
                            y: event.y,
                            pressure: event.pressure
                        };

                        chainOut(event);
                    }, 35);
                }, 80);
            }

        }

        return event;
    };

    this.setChainOut = function (func) {
        chainOut = func;
    };

    this.setSmoothing = function (s) {
        smoothing = clamp(s, 0, 1);
    };
};
