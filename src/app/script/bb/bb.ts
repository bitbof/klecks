import {
    append,
    centerWithin,
    copyObj,
    createSvg,
    css,
    dateDayDifference,
    decToFraction,
    fitInto,
    gcd,
    getDate,
    handleClick,
    imageBlobToUrl,
    insertAfter,
    isDark,
    loadImage,
    nullToUndefined,
    reduce,
    setAttributes,
    shareCanvas,
    throwIfNull,
} from './base/base';
import {
    canShareFiles,
    eventUsesHighResTimeStamp,
    hasPointerEvents,
    isCssMinMaxSupported,
    unsetEventHandler,
} from './base/browser';
import { KeyListener, sameKeys } from './input/key-listener';
import { PointerListener } from './input/pointer-listener';
import {
    canvasBounds,
    convertToAlphaChannelCanvas,
    copyCanvas,
    createCheckerCanvas,
    createCheckerDataUrl,
    ctx,
    drawTransformedImageOnCanvas,
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
    projectPointOnLine,
    quadraticSplineInput,
    SplineInterpolator,
} from './math/line';
import { CMYK, ColorConverter, HSV, RGB, testIsWhiteBestContrast } from './color/color';
import {
    appendTextDiv,
    clearSelection,
    destroyEl,
    el,
    isInputFocused,
    makeUnfocusable,
    unfocusAnyInput,
} from './base/ui';
import {
    boundsInArea,
    clamp,
    dist,
    distSquared,
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
import { BbLog } from './base/bb-log';
import { LocalStorage } from './base/local-storage';
import { CoalescedExploder } from './input/event-chain/coalesced-exploder';
import { NFingerTapper } from './input/event-chain/n-finger-tapper';
import { PinchZoomer } from './input/event-chain/pinch-zoomer';
import { DoubleTapper } from './input/event-chain/double-tapper';
import { OnePointerLimiter } from './input/event-chain/one-pointer-limiter';
import { EventChain } from './input/event-chain/event-chain';

export const BB = {
    // ---- browser ----
    eventUsesHighResTimeStamp,
    hasPointerEvents,
    isCssMinMaxSupported,
    canShareFiles,
    unsetEventHandler,

    // ---- base ----
    insertAfter,
    loadImage,
    css,
    setAttributes,
    append,
    fitInto,
    centerWithin,
    getDate,
    gcd,
    reduce,
    decToFraction,
    imageBlobToUrl,
    dateDayDifference,
    copyObj,
    shareCanvas,
    handleClick,
    createSvg,
    BbLog,
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
    boundsInArea,

    // ---- line ----
    projectPointOnLine,
    PointLine,
    BezierLine,
    SplineInterpolator,
    quadraticSplineInput,

    // ---- canvas ----
    canvas: createCanvas,
    ctx,
    copyCanvas,
    testShouldPixelate,
    drawTransformedImageWithBounds,
    drawTransformedImageOnCanvas,
    createCheckerCanvas,
    createCheckerDataUrl,
    resizeCanvas,
    convertToAlphaChannelCanvas,
    freeCanvas,
    canvasBounds,

    // ---- color ----
    HSV,
    RGB,
    CMYK,
    ColorConverter,
    testIsWhiteBestContrast,

    // ---- UI ----
    appendTextDiv,
    clearSelection,
    makeUnfocusable,
    el,
    destroyEl,
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
