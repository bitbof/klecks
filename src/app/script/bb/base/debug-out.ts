import { el } from './ui';

// if no access to console

let debugOutEl: HTMLElement;
const outArr: string[] = [];

export function debugOut(str: string): void {
    if (!debugOutEl) {
        debugOutEl = el({
            css: {
                position: 'fixed',
                top: '0',
                left: '0',
                zIndex: '100000',
                color: 'white',
                backgroundColor: 'black',
                padding: '10px',
                pointerEvents: 'none',
            },
        });
        setTimeout(() => document.body.appendChild(debugOutEl));
    }

    outArr.push(str);
    debugOutEl.innerHTML = outArr.slice(-10).reverse().join('<br>');
}
