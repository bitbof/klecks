import {BB} from '../../bb/bb';
import {IRect} from '../../bb/bb.types';

export interface IRenderTextParam {
    textStr: string; // text to be drawn. can contain newlines
    x: number;
    y: number;
    size: number;
    font: 'serif' | 'monospace' | 'sans-serif' | 'cursive' | 'fantasy'; // default sans-serif
    align: 'left' | 'center' | 'right'; // default 'left'
    isBold: boolean; // default false
    isItalic: boolean; // default false
    angleRad: number; // default 0 - rotates around x y
    lineHeight?: number; // pixels
    color: string;
    isDebug?: boolean;
}


/**
 * Draw text on a canvas.
 *
 * @param canvas
 * @param p
 * @returns - bounds. coords relative to p.x p.y
 */
export function renderText(canvas: HTMLCanvasElement, p: IRenderTextParam): IRect {

    // always at least a space. so bounds aren't just a dot
    let textStr = p.textStr === '' ? ' ' : p.textStr;

    // --- create el ---
    // create an actual dom element. figure out where exactly each letter is positioned.
    // that way multiline is feasible. canvas can't do multiline or text-align
    let outer = BB.el({
        css: {
            position: 'fixed',
            left: '0',
            top: '0',
            width: '100000px',
            fontSize: p.size + 'px',
            lineHeight: p.lineHeight ? p.lineHeight + 'px' : 'default',
        }
    });
    let div = BB.el({
        parent: outer,
        css: {
            display: 'inline-block',
            textAlign: p.align ? p.align : 'left',
            fontFamily: p.font ? p.font : 'sans-serif',
            fontSize: p.size + 'px',
            fontWeight: p.isBold ? 'bold' : 'normal',
            fontStyle: p.isItalic ? 'italic' : 'normal',
            lineHeight: p.lineHeight ? p.lineHeight + 'px' : 'default',


            opacity: '0',
            pointerEvents: 'none'
        }
    });
    let spanStr = '';
    let replaceObj = {
        "\n": '<br>',
        " ": '&nbsp;',
        "	": '&nbsp;&nbsp;&nbsp;&nbsp;',
    };
    for (let i = 0; i < textStr.length; i++) {
        if (textStr[i] === "\n") {
            div.appendChild(BB.el({
                tagName: 'span',
                textContent: spanStr,
                css: {
                    whiteSpace: 'pre'
                }
            }));
            spanStr = '';
            div.appendChild(BB.el({
                tagName: 'br'
            }));
            continue;
        }
        spanStr += textStr[i].replace("\t", '    ');
    }
    div.appendChild(BB.el({
        tagName: 'span',
        textContent: spanStr,
        css: {
            whiteSpace: 'pre'
        }
    }));
    document.body.appendChild(outer);


    // --- determine bounds ---
    let bounds = {
        x0: 99999999,
        y0: 99999999,
        x1: 0,
        y1: 0
    }
    for (let i = 0; i < div.children.length; i++) {
        let el = div.children[i] as HTMLElement;
        bounds.x0 = Math.min(bounds.x0, el.offsetLeft);
        bounds.y0 = Math.min(bounds.y0, el.offsetTop);
        bounds.x1 = Math.max(bounds.x1, el.offsetLeft + el.offsetWidth);
        bounds.y1 = Math.max(bounds.y1, el.offsetTop + el.offsetHeight);
    }

    // --- draw ---
    let ctx = canvas.getContext('2d');
    ctx.save();

    let font = [];
    if (p.isItalic) {
        font.push('italic');
    }
    if (p.isBold) {
        font.push('bold');
    }
    font.push(p.size + 'px ' + (p.font ? p.font : 'sans-serif'));
    ctx.font = font.join(' ');
    ctx.fillStyle = p.color ? p.color : '#000';

    let x = p.x;
    let y = p.y;
    if (p.align === 'right') {
        x += -bounds.x1 + bounds.x0;
    }
    if (p.align === 'center') {
        x += (-bounds.x1 + bounds.x0) / 2;
    }
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angleRad ? -p.angleRad : 0);
    ctx.translate(-p.x, -p.y);
    ctx.translate(x, y);

    // fill
    for (let i = 0; i < div.children.length; i++) {
        let el = div.children[i] as HTMLElement;

        //ctx.fillText(el.innerText, 0, 0);
        ctx.fillText(el.innerText, el.offsetLeft, el.offsetTop);
    }

    if (p.isDebug) {
        ctx.lineWidth = 1;
        ctx.strokeRect(0, -p.size * 0.85, bounds.x1, bounds.y1);
        ctx.restore();
        ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    } else {
        ctx.restore();
    }

    document.body.removeChild(outer);

    return {
        x: x - p.x,
        y: y - p.y -p.size * 0.85,
        width: bounds.x1 - bounds.x0,
        height: bounds.y1 - bounds.y0
    };
}