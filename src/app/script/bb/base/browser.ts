import {createCanvas} from './create-canvas';

export const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

export const eventUsesHighResTimeStamp = (function() {

    let eventUsesHighResTimeStamp: boolean | null = null;
    if (document.body) {
        (function() {
            const event = new Event('');
            eventUsesHighResTimeStamp = event.timeStamp < 1000 * 60 * 60;
        })();
    } else {
        window.addEventListener('DOMContentLoaded', function(event) {
            eventUsesHighResTimeStamp = event.timeStamp < 1000 * 60 * 60;
        });
    }

    return function(): boolean {
        if (eventUsesHighResTimeStamp === null) {
            throw 'eventUsesHighResTimeStamp not initialized';
        }
        return eventUsesHighResTimeStamp;
    }
})();

export const mouseEventHasMovement = (() => {

    // no support: IE, Safari, Safari iOS
    // supported but broken: Firefox

    if (!('MouseEvent' in window)) {
        return false;
    }
    let mouseEvent;
    try {
        mouseEvent = new MouseEvent('mousemove'); // browsers not supporting the constructor don't have it
    } catch (e) {
        return false;
    }
    if (!('movementX' in mouseEvent)) {
        return false; // likely safari
    }
    return !isFirefox;
})();

export const hasPointerEvents = !!window.PointerEvent;

export const hasWebGl = (function() {

    const hasWebgl = (function() {
        const canvas = createCanvas();
        try {
            canvas.getContext('experimental-webgl', { premultipliedAlpha: false });
            return true;
        } catch (e) {
            return false;
        }
    })();

    return function() {
        return hasWebgl;
    }
})();

export const getVisitor = (function () {
    const visitor = {
        chrome: false,
        gl: false
    };
    //Chrome
    if ((window as any).chrome && (window as any).chrome.app) {
        visitor.chrome = true;
    }
    //WebGL
    visitor.gl = hasWebGl();
    return function () {
        return JSON.parse(JSON.stringify(visitor));
    }
})();

export const isCssMinMaxSupported = (function() {
    let result: boolean | null = null;

    function test() {
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.top = '0';
        div.style.left = 'max(0px, 25px)';
        document.body.appendChild(div);
        setTimeout(function() {
            result = div.offsetLeft === 25;
            document.body.removeChild(div);
        }, 25);
    }

    if (document.body) {
        test();
    } else {
        window.addEventListener('DOMContentLoaded', function() {
            test();
        });
    }

    return function(): boolean {
        if (result === null) {
            throw new Error('isCssMinMaxSupported not initialized');
        }
        return result;
    };
})();

export const canShareFiles = function(): boolean {
    return 'share' in navigator && 'canShare' in navigator;
};