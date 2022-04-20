import * as BBEventListener from './input/event-listener';
import {
    addClassName, append, centerWithin, copyObj, createSvg,
    css, dateDayDifference, decToFraction,
    fitInto, gcd, getDate,
    handleClick, imageBlobToUrl,
    insertAfter, loadImage,
    reduce,
    removeClassName, setAttributes, shareCanvas
} from './base/base';
import {
    canShareFiles,
    eventUsesHighResTimeStamp,
    getVisitor,
    hasPointerEvents,
    hasWebGl,
    isCssMinMaxSupported,
    mouseEventHasMovement
} from './base/browser';
import {KeyListener, sameKeys} from './input/key-listener';
import {PointerListener} from './input/pointer-listener';
import * as EventChain from './input/event-chain';
import {
    convertToAlphaChannelCanvas,
    copyCanvas,
    createCheckerCanvas, createCheckerDataUrl,
    drawTransformedImageOnCanvas,
    drawTransformedImageWithBounds, freeCanvas, resizeCanvas, testShouldPixelate
} from './base/canvas';
import {Matrix} from './math/matrix';
import {Vec2} from './math/vec2';
import {BezierLine, PointLine, projectPointOnLine, quadraticSplineInput, SplineInterpolator} from './math/line';
import {CMYK, ColorConverter, HSV, RGB, testIsWhiteBestContrast} from './color/color';
import {appendTextDiv, clearSelection, destroyEl, el, isInputFocused, makeUnfocusable} from './base/ui';
import {
    pointsToAngleDeg,
    clamp,
    dist,
    mix,
    pointsToAngleRad,
    rotate,
    rotateAround,
    intDxy,
    roundEven, roundUneven, distSquared, lenSquared, updateBounds, boundsInArea
} from './math/math';
import {createCanvas} from './base/create-canvas';
import {BbLog} from './base/bb-log';
import {LocalStorage} from './base/local-storage';

export const BB = {

    // ---- browser ----
    eventUsesHighResTimeStamp,
    mouseEventHasMovement,
    hasPointerEvents,
    hasWebGl,
    getVisitor,
    isCssMinMaxSupported,
    canShareFiles,

    // ---- base ----
    insertAfter,
    loadImage,
    css,
    setAttributes,
    addClassName,
    removeClassName,
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

    // ---- math ----
    mix,
    dist,
    distSquared,
    lenSquared,
    pointsToAngleRad,
    pointsToAngleDeg,
    clamp,
    rotate,
    rotateAround,
    Matrix,
    Vec2,
    intDxy,
    roundEven,
    roundUneven,
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
    copyCanvas,
    testShouldPixelate,
    drawTransformedImageWithBounds,
    drawTransformedImageOnCanvas,
    createCheckerCanvas,
    createCheckerDataUrl,
    resizeCanvas,
    convertToAlphaChannelCanvas,
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
    makeUnfocusable,
    el,
    destroyEl,
    isInputFocused: isInputFocused,


    // ---- events / input ----

    addEventListener: BBEventListener.addEventListener,
    removeEventListener: BBEventListener.removeEventListener,
    setEventListener: BBEventListener.setEventListener,

    KeyListener,
    PointerListener,
    sameKeys,

    EventChain,

};
