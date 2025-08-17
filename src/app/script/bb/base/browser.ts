export const IS_FIREFOX = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

export const EVENT_USES_HIGH_RES_TIMESTAMP = (function (): () => boolean {
    const eventUsesHighResTimeStamp: boolean = new Event('').timeStamp < 1000 * 60 * 60;
    return function (): boolean {
        return eventUsesHighResTimeStamp;
    };
})();

export const HAS_POINTER_EVENTS = !!window.PointerEvent;

export const IS_CSS_MIN_MAX_SUPPORTED = (function (): () => boolean {
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

export function printStorageQuota(): void {
    navigator.storage.estimate().then((estimate) => {
        if (estimate.quota === undefined || estimate.usage === undefined) {
            console.log('no quota info');
            return;
        }
        console.log(
            `using ${((estimate.usage / estimate.quota) * 100).toFixed(2)}% of total quota`,
        );

        console.log('usage (GB)', (estimate.usage / 1024 / 1024 / 1024).toFixed(2));
        console.log('quota (GB)', (estimate.quota / 1024 / 1024 / 1024).toFixed(2));
    });
}
