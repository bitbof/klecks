import {IFilter} from '../kl-types';
import glBrightnessContrastImg from '/src/app/img/ui/edit-brightness-contrast.svg';
import cropExtendImg from '/src/app/img/ui/edit-crop.svg';
import glCurvesImg from '/src/app/img/ui/edit-curves.svg';
import flipImg from '/src/app/img/ui/edit-flip.svg';
import glHueSaturationImg from '/src/app/img/ui/edit-hue-saturation.svg';
import invertImg from '/src/app/img/ui/edit-invert.png';
import glPerspectiveImg from '/src/app/img/ui/edit-perspective.svg';
import resizeImg from '/src/app/img/ui/edit-resize.svg';
import rotateImg from '/src/app/img/ui/edit-rotate.svg';
import glTiltShiftImg from '/src/app/img/ui/edit-tilt-shift.png';
import toAlphaImg from '/src/app/img/ui/edit-to-alpha.svg';
import transformImg from '/src/app/img/ui/edit-transform.svg';
import glBlurImg from '/src/app/img/ui/edit-triangle-blur.png';
import glUnsharpMaskImg from '/src/app/img/ui/edit-unsharp-mask.png';
import gridImg from '/src/app/img/ui/edit-grid.svg';
import noiseImg from '/src/app/img/ui/edit-noise.svg';
import patternImg from '/src/app/img/ui/edit-pattern.svg';
import vanishPointImg from '/src/app/img/ui/edit-vanish-point.svg';
import distortImg from '/src/app/img/ui/edit-distort.svg';
import {THistoryEntryG} from '../history/kl-history';

export type TFilterHistoryEntry<Filter extends string, Input> = THistoryEntryG<['filter', Filter], 'apply', [{ input: Input }]>;

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
        webGL: true,
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
        webGL: true,
    },
    distort: {
        lang: {name: 'filter-distort', button: 'filter-distort'},
        icon: distortImg,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
        webGL: true,
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
        darkNoInvert: true,
        webGL: true,
    },
    invert: {
        lang: {name: 'filter-invert', button: 'filter-invert'},
        icon: invertImg,
        updatePos: false,
        isInstant: true,
        getDialog: null,
        apply: null,
        inEmbed: true,
        darkNoInvert: true,
        webGL: true,
    },
    perspective: {
        lang: {name: 'filter-perspective-title', button: 'filter-perspective'},
        icon: glPerspectiveImg,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
        webGL: true,
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
        webGL: true,
    },
    toAlpha: {
        lang: {name: 'filter-to-alpha-title', button: 'filter-to-alpha'},
        icon: toAlphaImg,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
        darkNoInvert: true,
        webGL: true,
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
        darkNoInvert: true,
        webGL: true,
    },
    unsharpMask: {
        lang: {name: 'filter-unsharp-mask-title', button: 'filter-unsharp-mask'},
        icon: glUnsharpMaskImg,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
        darkNoInvert: true,
        webGL: true,
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
        webGL: true,
    },
    pattern: {
        lang: {name: 'filter-pattern', button: 'filter-pattern'},
        icon: patternImg,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    vanishPoint: {
        lang: {name: 'filter-vanish-point-title', button: 'filter-vanish-point'},
        icon: vanishPointImg,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
};
