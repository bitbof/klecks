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
import gridImg from 'url:~/src/app/img/ui/edit-grid.svg';
// @ts-ignore
import noiseImg from 'url:~/src/app/img/ui/edit-noise.svg';
// @ts-ignore
import patternImg from 'url:~/src/app/img/ui/edit-pattern.svg';
// @ts-ignore
import distortImg from 'url:~/src/app/img/ui/edit-distort.svg';


export const filterLibStatus = {
    isLoaded: false,
};
export const filterLib: {
    [key:string]: IFilter;
} = {
    brightnessContrast: {
        lang: {name: 'filter-bright-contrast-title', button: 'filter-bright-contrast'},
        icon: glBrightnessContrastImg,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    cropExtend: {
        lang: {name: 'filter-crop-title', button: 'filter-crop-extend'},
        icon: cropExtendImg,
        updatePos: true,
        getDialog: null,
        apply: null,
        inEmbed: false,
    },
    curves: {
        lang: {name: 'filter-curves-title', button: 'filter-curves'},
        icon: glCurvesImg,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    distort: {
        lang: {name: 'filter-distort', button: 'filter-distort'},
        icon: distortImg,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    flip: {
        lang: {name: 'filter-flip-title', button: 'filter-flip'},
        icon: flipImg,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    hueSaturation: {
        lang: {name: 'filter-hue-sat-title', button: 'filter-hue-sat'},
        icon: glHueSaturationImg,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    invert: {
        lang: {name: 'filter-invert', button: 'filter-invert'},
        icon: invertImg,
        updatePos: false,
        isInstant: true,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    perspective: {
        lang: {name: 'filter-perspective-title', button: 'filter-perspective'},
        icon: glPerspectiveImg,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    resize: {
        lang: {name: 'filter-resize-title', button: 'filter-resize'},
        icon: resizeImg,
        updatePos: true,
        getDialog: null,
        apply: null,
        inEmbed: false,
    },
    rotate: {
        lang: {name: 'filter-rotate-title', button: 'filter-rotate'},
        icon: rotateImg,
        updatePos: true,
        getDialog: null,
        apply: null,
        inEmbed: false,
    },
    tiltShift: {
        lang: {name: 'filter-tilt-shift-title', button: 'filter-tilt-shift'},
        icon: glTiltShiftImg,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    toAlpha: {
        lang: {name: 'filter-to-alpha-title', button: 'filter-to-alpha'},
        icon: toAlphaImg,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    transform: {
        lang: {name: 'filter-transform-title', button: 'filter-transform'},
        icon: transformImg,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    blur: {
        lang: {name: 'filter-triangle-blur-title', button: 'filter-triangle-blur'},
        icon: glBlurImg,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    unsharpMask: {
        lang: {name: 'filter-unsharp-mask-title', button: 'filter-unsharp-mask'},
        icon: glUnsharpMaskImg,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    grid: {
        lang: {name: 'filter-grid', button: 'filter-grid'},
        icon: gridImg,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    noise: {
        lang: {name: 'filter-noise', button: 'filter-noise'},
        icon: noiseImg,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    pattern: {
        lang: {name: 'filter-pattern', button: 'filter-pattern'},
        icon: patternImg,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
};
