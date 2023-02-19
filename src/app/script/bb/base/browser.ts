import {createCanvas} from './create-canvas';

export const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

export const eventUsesHighResTimeStamp = (function () {
    const eventUsesHighResTimeStamp: boolean = new Event('').timeStamp < 1000 * 60 * 60;
    return function (): boolean {
        return eventUsesHighResTimeStamp;
    };
})();

export const hasPointerEvents = !!window.PointerEvent;

export const hasWebGl = (function () {

    const hasWebgl = (function () {
        const canvas = createCanvas();
        try {
            canvas.getContext('experimental-webgl', { premultipliedAlpha: false });
            return true;
        } catch (e) {
            return false;
        }
    })();

    return function () {
        return hasWebgl;
    };
})();

export const isCssMinMaxSupported = (function () {
    let result: boolean | null = null;

    function test () {
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.top = '0';
        div.style.left = 'max(0px, 25px)';
        document.body.append(div);
        setTimeout(function () {
            result = div.offsetLeft === 25;
            document.body.removeChild(div);
        }, 25);
    }

    if (document.body) {
        test();
    } else {
        window.addEventListener('DOMContentLoaded', function () {
            test();
        });
    }

    return function (): boolean {
        if (result === null) {
            throw new Error('isCssMinMaxSupported not initialized');
        }
        return result;
    };
})();

export const canShareFiles = function (): boolean {
    return 'share' in navigator && 'canShare' in navigator;
};