export const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

export const eventUsesHighResTimeStamp = (function (): () => boolean {
    const eventUsesHighResTimeStamp: boolean = new Event('').timeStamp < 1000 * 60 * 60;
    return function (): boolean {
        return eventUsesHighResTimeStamp;
    };
})();

export const hasPointerEvents = !!window.PointerEvent;

export const isCssMinMaxSupported = (function (): () => boolean {
    let result: boolean | undefined;

    function test(): void {
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.top = '0';
        div.style.left = 'max(0px, 25px)';
        document.body.append(div);
        setTimeout(function () {
            result = div.offsetLeft === 25;
            div.remove();
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
        if (result === undefined) {
            throw new Error('isCssMinMaxSupported not initialized');
        }
        return result;
    };
})();

export const canShareFiles = function (): boolean {
    return 'share' in navigator && 'canShare' in navigator;
};

type THandler = 'onchange' | 'onclick' | 'onkeyup';
export function unsetEventHandler(obj: HTMLElement, ...handlers: [...THandler[]]): void {
    handlers.forEach((handler) => {
        // (disabled) eslint-disable-next-line no-null/no-null
        obj[handler] = null;
    });
}
