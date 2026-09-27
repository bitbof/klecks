import { LocalStorage } from '../../../bb/base/local-storage';
import { LANG } from '../../../language/language';
import { Checkbox } from './checkbox';

const LS_PIXELATED_ZOOM_KEY = 'klecks-pixelated-zoom';
const changeEventTarget = new EventTarget();
let isEnabled = LocalStorage.getItem(LS_PIXELATED_ZOOM_KEY) === 'true';

// is the zoom always pixelated
export function isPixelatedZoomEnabled(): boolean {
    return isEnabled;
}

export function addIsPixelatedZoomListener(func: () => void): void {
    changeEventTarget.addEventListener('change', func);
}

export function removeIsPixelatedZoomListener(func: () => void): void {
    changeEventTarget.removeEventListener('change', func);
}

function setIsPixelatedZoomEnabled(value: boolean): void {
    if (isEnabled === value) {
        return;
    }
    isEnabled = value;
    if (isEnabled) {
        LocalStorage.setItem(LS_PIXELATED_ZOOM_KEY, 'true');
    } else {
        LocalStorage.removeItem(LS_PIXELATED_ZOOM_KEY);
    }
    changeEventTarget.dispatchEvent(new Event('change'));
}

export class PixelatedZoomToggle {
    private readonly checkbox: Checkbox;

    constructor() {
        this.checkbox = new Checkbox({
            label: LANG('settings-pixelated-zoom'),
            init: isPixelatedZoomEnabled(),
            callback: setIsPixelatedZoomEnabled,
            name: 'pixelated-zoom',
            css: {
                display: 'inline-block',
            },
        });
    }

    getElement(): HTMLElement {
        return this.checkbox.getElement();
    }

    destroy(): void {
        this.checkbox.destroy();
    }
}
