import { type IconName, icons } from '../../icons/icons';
import { css } from '../bb/base/base';
import { TCss } from '../bb/bb-types';

type TObjectUrl = string;

const objectUrlByIcon = new Map<IconName, TObjectUrl>();
const elementTemplateByIcon = new Map<IconName, SVGSVGElement>();
let isIconCssInitialized = false;
let nextSvgInstanceId = 0;

// The references occupy global namespace. Make them unique to avoid collisions.
function makeSvgIdsUnique(svg: SVGSVGElement): void {
    const elements = [svg, ...svg.querySelectorAll('*')];
    const idMap = new Map<string, string>();
    const prefix = `kl-icon-${nextSvgInstanceId++}-`;
    for (const element of elements) {
        if (element.hasAttribute('id')) {
            const id = element.id;
            const uniqueId = `${prefix}${id}`;
            idMap.set(id, uniqueId);
            element.id = uniqueId;
        }
    }
    if (!idMap.size) {
        return;
    }
    for (const element of elements) {
        for (const attribute of element.attributes) {
            // Match local references like url(#id), url('#id'), or url("#id"), allowing
            // surrounding whitespace inside the parentheses. Capture the optional quote
            // and ID; \1 requires the closing quote to match the opening quote.
            let value = attribute.value.replace(
                /url\(\s*(['"]?)#([^\s'"()]+)\1\s*\)/g,
                (match, _quote: string, id: string) => {
                    const uniqueId = idMap.get(id);
                    return uniqueId ? `url(#${uniqueId})` : match;
                },
            );
            if (attribute.localName === 'href' && value.startsWith('#')) {
                const uniqueId = idMap.get(value.slice(1));
                if (uniqueId) {
                    value = `#${uniqueId}`;
                }
            }
            // we iterate over *all* attributes but only reassign where there are references
            if (value !== attribute.value) {
                attribute.value = value;
            }
        }
    }
}

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
    makeSvgIdsUnique(result);
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
