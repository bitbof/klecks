import {IFilter} from '../kl.types';
// @ts-ignore
import glBrightnessContrastImg from 'url:~/src/app/img/ui/edit-brightness-contrast.svg';
// @ts-ignore
import cropExtendImg from 'url:~/src/app/img/ui/edit-crop.svg';
// @ts-ignore
import glCurvesImg from 'url:~/src/app/img/ui/edit-curves.svg';
// @ts-ignore
import flipImg from 'url:~/src/app/img/ui/edit-flip.svg';
// @ts-ignore
import glHueSaturationImg from 'url:~/src/app/img/ui/edit-hue-saturation.svg';
// @ts-ignore
import invertImg from 'url:~/src/app/img/ui/edit-invert.png';
// @ts-ignore
import glPerspectiveImg from 'url:~/src/app/img/ui/edit-perspective.svg';
// @ts-ignore
import resizeImg from 'url:~/src/app/img/ui/edit-resize.svg';
// @ts-ignore
import rotateImg from 'url:~/src/app/img/ui/edit-rotate.svg';
// @ts-ignore
import glTiltShiftImg from 'url:~/src/app/img/ui/edit-tilt-shift.png';
// @ts-ignore
import toAlphaImg from 'url:~/src/app/img/ui/edit-to-alpha.svg';
// @ts-ignore
import transformImg from 'url:~/src/app/img/ui/edit-transform.svg';
// @ts-ignore
import glBlurImg from 'url:~/src/app/img/ui/edit-triangle-blur.png';
// @ts-ignore
import glUnsharpMaskImg from 'url:~/src/app/img/ui/edit-unsharp-mask.png';
// @ts-ignore
import aImg from 'url:~/src/app/img/ui/';


export const filterLibStatus = {
    isLoaded: false,
};
export const filterLib: {
    [key:string]: IFilter;
} = {
    glBrightnessContrast: {
        name: "Brightness / Contrast",
        buttonLabel: "Bright/Contrast",
        webgl: true,
        updateContext: true,
        icon: glBrightnessContrastImg,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    cropExtend: {
        name: "Crop / Extend",
        buttonLabel: "Crop/Extend",
        icon: cropExtendImg,
        webgl: false,
        neededWithWebGL: true,
        updateContext: true,
        updatePos: true,
        getDialog: null,
        apply: null,
        inEmbed: false,
    },
    glCurves: {
        name: "Curves",
        icon: glCurvesImg,
        webgl: true,
        updateContext: true,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    flip: {
        name: "Flip",
        icon: flipImg,
        webgl: false,
        neededWithWebGL: true,
        updateContext: true,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    glHueSaturation: {
        name: "Hue / Saturation",
        buttonLabel: "Hue/Saturation",
        icon: glHueSaturationImg,
        webgl: true,
        updateContext: true,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    invert: {
        name: "Invert",
        icon: invertImg,
        webgl: true,
        updateContext: true,
        updatePos: false,
        isInstant: true,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    glPerspective: {
        name: "Perspective",
        icon: glPerspectiveImg,
        webgl: true,
        updateContext: true,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    resize: {
        name: "Resize",
        icon: resizeImg,
        webgl: false,
        neededWithWebGL: true,
        updateContext: true,
        updatePos: true,
        getDialog: null,
        apply: null,
        inEmbed: false,
    },
    rotate: {
        name: "Rotate",
        icon: rotateImg,
        webgl: false,
        neededWithWebGL: true,
        updateContext: true,
        updatePos: true,
        getDialog: null,
        apply: null,
        inEmbed: false,
    },
    glTiltShift: {
        name: "Tilt Shift",
        icon: glTiltShiftImg,
        webgl: true,
        updateContext: true,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    toAlpha: {
        name: "To Alpha",
        icon: toAlphaImg,
        webgl: true,
        updateContext: false,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    transform: {
        name: "Transform",
        icon: transformImg,
        webgl: false,
        neededWithWebGL: true,
        updateContext: true,
        updatePos: false,
        ieFails: true,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    glBlur: {
        name: "Triangle Blur",
        icon: glBlurImg,
        webgl: true,
        updateContext: true,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    glUnsharpMask: {
        name: "Unsharp Mask",
        icon: glUnsharpMaskImg,
        webgl: true,
        updateContext: true,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    }
};