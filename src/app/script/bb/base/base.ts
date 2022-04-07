import {IKeyString, ISize2D, ISVG, IVector2D} from '../BB.types';

export function insertAfter (referenceNode: Element, newNode: Element): void {
    if (referenceNode.parentNode) {
        referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
    }
}

export function loadImage (im: HTMLImageElement, callback: () => void): void {
    let counter = 0;

    function check() {
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

export function css (el: HTMLElement | SVGElement, styleObj: IKeyString): void {
    const keyArr = Object.keys(styleObj);
    let keyStr: string;
    const style = (el.style as unknown) as IKeyString;
    for (let i = 0; i < keyArr.length; i++) {
        keyStr = keyArr[i];
        style[keyStr] = styleObj[keyStr];
        style.alignContent = 'true';
        if (keyStr === 'userSelect') {
            style.webkitUserSelect = styleObj[keyStr]; // safari
        }
    }
}

export function setAttributes (el: HTMLElement, attrObj: IKeyString): void {
    const keyArr = Object.keys(attrObj);
    let keyStr;
    for (let i = 0; i < keyArr.length; i++) {
        keyStr = keyArr[i];
        el.setAttribute(keyStr, attrObj[keyStr]);
    }
}

export function addClassName (el: HTMLElement | SVGElement, classStr: string): void {
    const classAttr = el.getAttribute('class');
    const splitArr = classAttr === null ? [] : classAttr.split(' ');
    if (splitArr.includes(classStr)) {
        return;
    }
    splitArr.push(classStr);
    el.setAttribute('class', splitArr.join(' '));
}

export function removeClassName (el: HTMLElement | SVGElement, classStr: string): void {
    const classAttr = el.getAttribute('class');
    const splitArr = classAttr === null ? [] : classAttr.split(' ');
    if (!splitArr.includes(classStr)) {
        return;
    }
    for (let i = 0; i < splitArr.length; i++) {
        if (splitArr[i] === classStr) {
            splitArr.splice(i, 1);
            i--;
        }
    }
    el.setAttribute('class', splitArr.join(' '));
}

/**
 * appendChild with an array
 * @param target
 * @param els
 */
export function append(target: HTMLElement, els: (HTMLElement | string | null)[]) {
    const fragment = document.createDocumentFragment();
    els.forEach(item => item ? fragment.append(item) : null);
    target.append(fragment);
}

/**
 * a needs to fit into b
 * @param aw
 * @param ah
 * @param bw
 * @param bh
 * @param min
 */
export function fitInto (aw: number, ah: number, bw: number, bh: number, min?: number): ISize2D {
    let width = aw * bw, height = ah * bw;
    if (width > bw) {
        height = bw / width * height;
        width = bw;
    }
    if (height > bh) {
        width = bh / height * width;
        height = bh;
    }
    if (min) {
        width = Math.max(min, width);
        height = Math.max(min, height);
    }
    return {width, height};
}

/**
 * center b in a
 * @param aw
 * @param ah
 * @param bw
 * @param bh
 */
export function centerWithin (aw: number, ah: number, bw: number, bh: number): IVector2D {
    return {
        x: aw / 2 - bw / 2,
        y: ah / 2 - bh / 2
    };
}

export function getDate (): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const minutes = (date.getHours() * 60 + date.getMinutes()).toString(36).padStart(3, '0');

    return year + '_' + month + '_' + day + '_' + minutes + '_';
}

export function gcd (a: number, b: number): number {
    return b ? gcd(b, a % b) : a;
}

export function reduce (numerator: number, denominator: number): [number, number] {
    const g = gcd(numerator, denominator);
    return [numerator / g, denominator / g];
}

export function decToFraction (decimalNumber: number): [number, number] {
    const len = decimalNumber.toString().length - 2;
    const denominator = Math.pow(10, len);
    const numerator = decimalNumber * denominator;
    return reduce(numerator, denominator);
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
        const fauxBlob = (blobObj as unknown) as {type: string, encoding: string, data: string};
        return 'data:' + fauxBlob.type + ';' + fauxBlob.encoding + ',' + fauxBlob.data; // data url
    } else {
        throw new Error('unknown blob format');
    }
}

export function dateDayDifference (dateA: string | Date, dateB: string | Date): number {
    dateA = new Date(dateA);
    dateB = new Date(dateB);
    dateA.setHours(0, 0, 0, 0);
    dateB.setHours(0, 0, 0, 0);
    return (dateB.getTime() - dateA.getTime()) / (1000 * 60 * 60 * 24);
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function copyObj (obj: any): any {
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
export function shareCanvas (p: {canvas: HTMLCanvasElement, fileName:string, title: string, callback: () => void}): void {
    const mimetype = 'image/png';
    const err = () => alert('sharing not supported');
    p.canvas.toBlob(function(blob) {
        if (blob === null) {
            err();
            p.callback();
            return;
        }
        try {
            const filesArray = [new File([blob], p.fileName, {type: mimetype})];
            navigator.share({
                title: p.title,
                files: filesArray,
            } as any)
                .then(r => {

                })
                .catch(e => {
                    err();
            });
        } catch(e) {
            err();
        }
        p.callback();
    }, mimetype);
}

/**
 * Prevent ipad from zooming in when double tapping. iPadOS 13 bug.
 * Give it your click event
 *
 * @param clickEvent
 * @returns {boolean}
 */
export function handleClick (clickEvent: MouseEvent): boolean {
    const target: HTMLElement | null = clickEvent.target as HTMLElement;
    if (!target) {
        return false;
    }
    if (['A', 'LABEL', 'INPUT'].includes(target.tagName) || (target as any).allowClick) {
        return true;
    }
    clickEvent.preventDefault();
    return false;
}


/**
 * @param el {elementType: string, childrenArr: []el, ...svg attributes...}
 * @returns svg element tree
 */
export function createSvg (el: ISVG): SVGElement {
    const result = document.createElementNS('http://www.w3.org/2000/svg', el.elementType);
    const keyArr = Object.keys(el);
    let keyStr;
    for (let i = 0; i < keyArr.length; i++) {
        keyStr = keyArr[i];
        if (keyStr === 'childrenArr') {
            for (let e = 0; e < el.childrenArr.length; e++) {
                result.appendChild(createSvg(el.childrenArr[e]));
            }
        } else if (keyStr !== 'elementType') {
            result.setAttribute(keyStr, el[keyStr] as string);
        }
    }
    return result;
}