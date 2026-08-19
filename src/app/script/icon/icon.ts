import { type IconName, icons } from '../../icons/icons';
import { css } from '../bb/base/base';
import { TCss } from '../bb/bb-types';

type TObjectUrl = string;

const objectUrlByIcon = new Map<IconName, TObjectUrl>();
const elementTemplateByIcon = new Map<IconName, SVGSVGElement>();
let isIconCssInitialized = false;

// icon as a data url
export function getIconDataUrl(icon: IconName): string {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(icons[icon])}`;
}

// icon as an object url
export function getIconUrl(icon: IconName): TObjectUrl {
    const cachedUrl = objectUrlByIcon.get(icon);
    if (cachedUrl) {
        return cachedUrl;
    }

    const objectUrl = URL.createObjectURL(
        new Blob([icons[icon]], {
            type: 'image/svg+xml',
        }),
    );
    objectUrlByIcon.set(icon, objectUrl);
    return objectUrl;
}

// icon as a svg element
export function getIconSvg(icon: IconName, styleObj?: TCss): SVGSVGElement {
    let template = elementTemplateByIcon.get(icon);
    if (!template) {
        const parsedDocument = new DOMParser().parseFromString(icons[icon], 'image/svg+xml');
        if (parsedDocument.documentElement.localName !== 'svg') {
            throw new Error(`Failed to parse icon: ${icon}`);
        }
        const parsedSvg = parsedDocument.documentElement as unknown as SVGSVGElement;
        template = document.importNode(parsedSvg, true);
        elementTemplateByIcon.set(icon, template);
    }
    const result = template.cloneNode(true) as SVGSVGElement;
    css(result, {
        display: 'block',
        ...styleObj,
    });
    return result;
}

// icon as an image element
export function getIconImg(icon: IconName, styleObj?: TCss): HTMLImageElement {
    const result = document.createElement('img');
    result.src = getIconUrl(icon);
    result.alt = '';
    result.draggable = false;
    css(result, {
        display: 'block',
        ...styleObj,
    });
    return result;
}

// Makes every icon available to css as --icon-{name}
export function initIconCss(): void {
    if (isIconCssInitialized) {
        return;
    }
    isIconCssInitialized = true;

    // Data URLs because Firefox has trouble loading object urls across domains:
    // e.g. Security Error: Content at https://foo.com/style.css may not load data from blob:https://bar.com/e249649e-be93-4d2c-bf43-009b633b3841.
    const declarations = (Object.keys(icons) as IconName[])
        .map((icon) => `--icon-${icon}: url("${getIconDataUrl(icon)}")`)
        .join(';');
    const styleEl = document.createElement('style');
    styleEl.id = 'icon-urls';
    document.head.append(styleEl);
    const sheet = styleEl.sheet;
    if (!sheet) {
        throw new Error('Failed to create icon stylesheet');
    }
    sheet.insertRule(`:root {${declarations}}`);
}

export type { IconName };
