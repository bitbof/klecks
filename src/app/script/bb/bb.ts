import {
    append,
    centerWithin,
    copyObj,
    createSvg,
    dateDayDifference,
    decToFraction,
    fitInto,
    gcd,
    handleClick,
    insertAfter,
    isDark,
    nullToUndefined,
    reduce,
    setAttributes,
    shareCanvas,
    throwIfNull,
} from './base/base';
import { canShareFiles, EVENT_USES_HIGH_RES_TIMESTAMP, HAS_POINTER_EVENTS } from './base/browser';
import { KeyListener, sameKeys } from './input/key-listener';
import { PointerListener } from './input/pointer-listener';
import {
    copyToCanvas,
    createCheckerCanvas,
    createCheckerDataUrl,
    ctx,
    drawTransformedImageWithBounds,
    freeCanvas,
    resizeCanvas,
    testShouldPixelate,
} from './base/canvas';
import { Matrix } from './math/matrix';
import { Vec2 } from './math/vec2';
import {
    BezierLine,
    PointLine,
    powerSplineInput,
    projectPointOnLine,
    SplineInterpolator,
} from './math/line';
import { CMYK, ColorConverter, HSV, RGB, testIsWhiteBestContrast } from './color/color';
import { appendTextDiv, clearSelection, el, isInputFocused, unfocusAnyInput } from './base/ui';
import {
    clamp,
    dist,
    distSquared,
    indexBoundsInArea,
    intDxy,
    isInsideRect,
    lenSquared,
    mix,
    pointsToAngleDeg,
    pointsToAngleRad,
    rotate,
    rotateAround,
    round,
    roundEven,
    roundUneven,
    updateBounds,
} from './math/math';
import { createCanvas } from './base/create-canvas';
import { LocalStorage } from './base/local-storage';
import { CoalescedExploder } from './input/event-chain/coalesced-exploder';
import { NFingerTapper } from './input/event-chain/n-finger-tapper';
import { PinchZoomer } from './input/event-chain/pinch-zoomer';
import { DoubleTapper } from './input/event-chain/double-tapper';
import { OnePointerLimiter } from './input/event-chain/one-pointer-limiter';
import { EventChain } from './input/event-chain/event-chain';

export const BB = {
    // ---- browser ----
    eventUsesHighResTimeStamp: EVENT_USES_HIGH_RES_TIMESTAMP,
    hasPointerEvents: HAS_POINTER_EVENTS,
    canShareFiles: canShareFiles,

    // ---- base ----
    insertAfter,
    setAttributes,
    append,
    fitInto,
    centerWithin,
    gcd,
    reduce,
    decToFraction,
    dateDayDifference,
    copyObj,
    shareCanvas,
    handleClick,
    createSvg,
    LocalStorage,
    throwIfNull,
    nullToUndefined,
    isDark,

    // ---- math ----
    mix,
    dist,
    distSquared,
    lenSquared,
    pointsToAngleRad,
    pointsToAngleDeg,
    isInsideRect,
    clamp,
    rotate,
    rotateAround,
    Matrix,
    Vec2,
    intDxy,
    roundEven,
    roundUneven,
    round,
    updateBounds,
    indexBoundsInArea,

    // ---- line ----
    projectPointOnLine,
    PointLine,
    BezierLine,
    SplineInterpolator,
    powerSplineInput,

    // ---- canvas ----
    canvas: createCanvas,
    ctx,
    copyToCanvas,
    testShouldPixelate,
    drawTransformedImageWithBounds,
    createCheckerCanvas,
    createCheckerDataUrl,
    resizeCanvas,
    freeCanvas,

    // ---- color ----
    HSV,
    RGB,
    CMYK,
    ColorConverter,
    testIsWhiteBestContrast,

    // ---- UI ----
    appendTextDiv,
    clearSelection,
    el,
    isInputFocused,
    unfocusAnyInput,

    // ---- events / input ----

    KeyListener,
    PointerListener,
    sameKeys,

    EventChain,
    DoubleTapper,
    NFingerTapper,
    PinchZoomer,
    CoalescedExploder,
    OnePointerLimiter,
};

Object.keys(BB); // without this, parcel build may break this object
