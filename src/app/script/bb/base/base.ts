import { TKeyString, TSize2D, TSvg, TVector2D } from '../bb-types';

export function insertAfter(referenceNode: Element, newNode: Element): void {
    if (referenceNode.parentNode) {
        referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
    }
}

export function loadImage(im: HTMLImageElement, callback: () => void): void {
    let counter = 0;

    function check(): void {
        if (counter === 1000) {
            alert("couldn't load");
            return;
        }
        if (im.complete) {
            counter++;
            callback();
        } else {
            setTimeout(check, 1);
        }
    }

    check();
}

export function asyncLoadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

export function css(el: HTMLElement | SVGElement, styleObj: Partial<CSSStyleDeclaration>): void {
    const elStyle: any = el.style;
    Object.keys(styleObj).forEach((key) => {
        const property = key as keyof CSSStyleDeclaration;
        elStyle[property] = styleObj[property];
        if (property === 'userSelect') {
            elStyle.webkitUserSelect = styleObj[property]; // Safari support
        }
    });
}

export function setAttributes(el: Element, attrObj: TKeyString): void {
    const keyArr = Object.keys(attrObj);
    let keyStr;
    for (let i = 0; i < keyArr.length; i++) {
        keyStr = keyArr[i];
        el.setAttribute(keyStr, attrObj[keyStr]);
    }
}

/**
 * append a list to DOM element
 */
export function append(target: HTMLElement, els: (HTMLElement | string | undefined)[]): void {
    const fragment = document.createDocumentFragment();
    els.forEach((item) => item && fragment.append(item));
    target.append(fragment);
}

/**
 * a needs to fit into b
 */
export function fitInto(aw: number, ah: number, bw: number, bh: number, min?: number): TSize2D {
    let width = aw * bw,
        height = ah * bw;
    if (width > bw) {
        height = (bw / width) * height;
        width = bw;
    }
    if (height > bh) {
        width = (bh / height) * width;
        height = bh;
    }
    if (min) {
        width = Math.max(min, width);
        height = Math.max(min, height);
    }
    return { width, height };
}

/**
 * center b in a
 * @param aw
 * @param ah
 * @param bw
 * @param bh
 */
export function centerWithin(aw: number, ah: number, bw: number, bh: number): TVector2D {
    return {
        x: aw / 2 - bw / 2,
        y: ah / 2 - bh / 2,
    };
}

export function getDate(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const minutes = (date.getHours() * 60 + date.getMinutes()).toString(36).padStart(3, '0');

    return year + '_' + month + '_' + day + '_' + minutes + '_';
}

export function gcd(a: number, b: number): number {
    return b ? gcd(b, a % b) : a;
}

export function reduce(numerator: number, denominator: number): [number, number] {
    const g = gcd(numerator, denominator);
    return [numerator / g, denominator / g];
}

export function decToFraction(decimalNumber: number): [number, number] {
    const len = decimalNumber.toString().length - 2;
    const denominator = Math.pow(10, len);
    const numerator = decimalNumber * denominator;
    return reduce(numerator, denominator);
}

export function isBlob(maybeBlob: unknown): maybeBlob is Blob {
    return (
        maybeBlob instanceof Blob || Object.prototype.toString.call(maybeBlob) === '[object Blob]'
    );
}

/**
 * blobObj isn't always a Blob, but rather an object, because Blob doesn't exist.
 * @param blobObj
 * @returns {string}
 */
export function imageBlobToUrl(blobObj: Blob): string {
    if (!blobObj) {
        throw new Error('blobObj is undefined or null');
    }
    if (window.Blob && blobObj instanceof Blob) {
        return URL.createObjectURL(blobObj); // object url
    } else if (blobObj.constructor.name === 'Object') {
        const fauxBlob = blobObj as unknown as {
            type: string;
            encoding: string;
            data: string;
        };
        return 'data:' + fauxBlob.type + ';' + fauxBlob.encoding + ',' + fauxBlob.data; // data url
    } else {
        throw new Error('unknown blob format');
    }
}

export function dateDayDifference(dateA: string | Date, dateB: string | Date): number {
    dateA = new Date(dateA);
    dateB = new Date(dateB);
    dateA.setHours(0, 0, 0, 0);
    dateB.setHours(0, 0, 0, 0);
    return (dateB.getTime() - dateA.getTime()) / (1000 * 60 * 60 * 24);
}

export function copyObj<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * triggers Web Share API - share feature on mobile devices
 * Only works if they support file sharing - e.g. Safari can't do this yet
 * only call if BB.canShareFiles() -> true
 *
 * p = {
 *     canvas: Canvas,
 *     fileName: string,
 *     title: string
 * }
 *
 * @param p
 */
export function shareCanvas(p: {
    canvas: HTMLCanvasElement;
    fileName: string;
    title: string;
    callback: () => void;
}): void {
    const mimetype = 'image/png';
    const err = (): void => alert('sharing not supported');
    p.canvas.toBlob(function (blob) {
        if (!blob) {
            err();
            p.callback();
            return;
        }
        try {
            const filesArray = [new File([blob], p.fileName, { type: mimetype })];
            navigator
                .share({
                    title: p.title,
                    files: filesArray,
                } as any)
                .then(() => {})
                .catch(() => {
                    err();
                });
        } catch (e) {
            err();
        }
        p.callback();
    }, mimetype);
}

/**
 * Prevent ipad from zooming in when double tapping. iPadOS 13 bug.
 * Give it your click event
 *
 * Can have GLOBAL EFFECT!
 *
 * @param clickEvent
 * @returns {boolean}
 */
export function handleClick(clickEvent: Event): boolean {
    const target: HTMLElement | null = clickEvent.target as HTMLElement;
    if (!target) {
        return false;
    }
    let el: HTMLElement | null = target;
    while (el) {
        if (['A', 'LABEL', 'INPUT', 'SUMMARY'].includes(el.tagName)) {
            return true;
        }
        el = el.parentElement;
    }
    clickEvent.preventDefault();
    return false;
}

export function createSvg(p: TSvg): SVGElement {
    const result = document.createElementNS('http://www.w3.org/2000/svg', p.elementType);
    Object.entries(p).forEach(([keyStr, item]) => {
        if (keyStr === 'childrenArr') {
            (item as TSvg[]).forEach((child) => {
                result.append(createSvg(child));
            });
        } else if (keyStr === 'css') {
            css(result, item as Partial<CSSStyleDeclaration>);
        } else if (keyStr !== 'elementType') {
            result.setAttribute(keyStr, item as string);
        }
    });
    return result;
}

export function throwIfNull<T>(v: T | null): T {
    // (disabled) eslint-disable-next-line no-null/no-null
    if (v === null) {
        throw new Error('value is null');
    }
    return v;
}

export function throwIfUndefined<T>(v: T | undefined, message = 'value is undefined'): T {
    if (v === undefined) {
        throw new Error(message);
    }
    return v;
}

export function nullToUndefined<T>(v: T | null): T | undefined {
    return v === null ? undefined : v;
}

const matchMediaDark =
    'matchMedia' in window ? window.matchMedia('(prefers-color-scheme: dark)') : false;

export function isDark(): boolean {
    return matchMediaDark && matchMediaDark.matches;
}

export function addIsDarkListener(func: () => void): void {
    matchMediaDark &&
        'addEventListener' in matchMediaDark &&
        matchMediaDark.addEventListener('change', func);
}

export function removeIsDarkListener(func: () => void): void {
    matchMediaDark &&
        'removeEventListener' in matchMediaDark &&
        matchMediaDark.removeEventListener('change', func);
}

export function base64ToBlob(base64Str: string): Blob {
    const parts = base64Str.match(/data:([^;]*)(;base64)?,([0-9A-Za-z+/]+)/) as [
        string,
        string,
        string,
        string,
    ];
    const binStr = atob(parts[3]);
    const buf = new ArrayBuffer(binStr.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < view.length; i++) {
        view[i] = binStr.charCodeAt(i);
    }
    return new Blob([view], { type: parts[1] });
}

export function createArray<T>(length: number, fillValue: T): T[] {
    return new Array(length).fill(fillValue);
}

export function randomUuid(): string {
    if ('randumUUID' in crypto) {
        return crypto.randomUUID();
    }
    // fallback just for dev
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0,
            v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// if a promise takes too long
export async function timeoutWrapper<G>(
    promise: Promise<G>,
    name: string,
    timeoutMs: number = 5000,
): Promise<G> {
    return Promise.race<G>([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Promise "${name}" timed out.`)), timeoutMs);
        }),
    ]);
}

export async function loadSvg(url: string): Promise<SVGSVGElement> {
    const response = await fetch(url);
    const svgText = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svg = doc.querySelector('svg');

    if (!svg) {
        throw new Error('No <svg> found in the file');
    }

    // Optional: Clone to prevent reusing the same node
    return svg.cloneNode(true) as SVGSVGElement;
}
