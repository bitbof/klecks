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
import {LANG, languageStrings} from '../../language/language';


export const filterLibStatus = {
    isLoaded: false,
};
export const filterLib: {
    [key:string]: IFilter;
} = {
    glBrightnessContrast: {
        lang: {name: 'filter-bright-contrast-title', button: 'filter-bright-contrast'},
        name: '',
        buttonLabel: '',
        webgl: true,
        updateContext: true,
        icon: glBrightnessContrastImg,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    cropExtend: {
        lang: {name: 'filter-crop-title', button: 'filter-crop-extend'},
        name: '',
        buttonLabel: '',
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
        lang: {name: 'filter-curves-title', button: 'filter-curves'},
        name: '',
        buttonLabel: '',
        icon: glCurvesImg,
        webgl: true,
        updateContext: true,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    flip: {
        lang: {name: 'filter-flip-title', button: 'filter-flip'},
        name: '',
        buttonLabel: '',
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
        lang: {name: 'filter-hue-sat-title', button: 'filter-hue-sat'},
        name: '',
        buttonLabel: '',
        icon: glHueSaturationImg,
        webgl: true,
        updateContext: true,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    invert: {
        lang: {name: 'filter-invert', button: 'filter-invert'},
        name: '',
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
        lang: {name: 'filter-perspective-title', button: 'filter-perspective'},
        name: '',
        buttonLabel: '',
        icon: glPerspectiveImg,
        webgl: true,
        updateContext: true,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    resize: {
        lang: {name: 'filter-resize-title', button: 'filter-resize'},
        name: '',
        buttonLabel: '',
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
        lang: {name: 'filter-rotate-title', button: 'filter-rotate'},
        name: '',
        buttonLabel: '',
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
        lang: {name: 'filter-tilt-shift-title', button: 'filter-tilt-shift'},
        name: '',
        buttonLabel: '',
        icon: glTiltShiftImg,
        webgl: true,
        updateContext: true,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    toAlpha: {
        lang: {name: 'filter-to-alpha-title', button: 'filter-to-alpha'},
        name: '',
        buttonLabel: '',
        icon: toAlphaImg,
        webgl: true,
        updateContext: false,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    transform: {
        lang: {name: 'filter-transform-title', button: 'filter-transform'},
        name: '',
        buttonLabel: '',
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
        lang: {name: 'filter-triangle-blur-title', button: 'filter-triangle-blur'},
        name: '',
        buttonLabel: '',
        icon: glBlurImg,
        webgl: true,
        updateContext: true,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    },
    glUnsharpMask: {
        lang: {name: 'filter-unsharp-mask-title', button: 'filter-unsharp-mask'},
        name: '',
        buttonLabel: '',
        icon: glUnsharpMaskImg,
        webgl: true,
        updateContext: true,
        updatePos: false,
        getDialog: null,
        apply: null,
        inEmbed: true,
    }
};

function updateNames() {
    const keys = Object.keys(filterLib);
    keys.forEach(item => {
        filterLib[item].name = LANG(filterLib[item].lang.name);
        filterLib[item].buttonLabel = LANG(filterLib[item].lang.button);
    });
}
updateNames();

languageStrings.subscribe(() => {
    updateNames();
});