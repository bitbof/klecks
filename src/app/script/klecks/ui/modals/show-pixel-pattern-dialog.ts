import { css } from '../../../bb/base/base';
import { ctx, freeCanvas } from '../../../bb/base/canvas';
import { createCanvas } from '../../../bb/base/create-canvas';
import { el } from '../../../bb/base/ui';
import { clamp } from '../../../bb/math/math';
import { TPointerEvent } from '../../../bb/input/event.types';
import { PointerListener } from '../../../bb/input/pointer-listener';
import { LANG } from '../../../language/language';
import {
    EDITABLE_PIXEL_PATTERN_SIZES,
    TPixelPattern,
    toEditablePixelPattern,
} from '../../brushes/pixel-brush-patterns';
import { Options } from '../components/options';
import { showModal, TModalButton } from './base/show-modal';

const GRID_SIZE = 281; // css px. 4 * 69 or 8 * 34 cells, plus 1px lines
const GRID_LINE_COLOR = '#bbb';
// tiled preview, in pattern pixels. displayed at 200%
const PREVIEW_WIDTH = 150;
const PREVIEW_HEIGHT = 28;

/**
 * Pixel pattern editor. Works on a copy; nothing changes until OK.
 * Without onDelete there's no delete button (e.g. when creating a new pattern).
 */
export function showPixelPatternDialog(p: {
    pattern: TPixelPattern;
    onOk: (pattern: TPixelPattern) => void;
    onDelete?: () => void;
}): void {
    let draft = toEditablePixelPattern(p.pattern);

    const dpr = window.devicePixelRatio || 1;
    const gridCanvas = createCanvas(Math.round(GRID_SIZE * dpr), Math.round(GRID_SIZE * dpr));
    const gridCtx = ctx(gridCanvas);
    gridCanvas.className = 'dark-invert';
    css(gridCanvas, {
        display: 'block',
        width: GRID_SIZE,
        height: GRID_SIZE,
        margin: '0 auto',
        touchAction: 'none',
    });

    const previewCanvas = createCanvas(PREVIEW_WIDTH, PREVIEW_HEIGHT);
    const previewCtx = ctx(previewCanvas);
    previewCanvas.className = 'dark-invert';
    css(previewCanvas, {
        display: 'block',
        width: '100%',
        aspectRatio: `${PREVIEW_WIDTH} / ${PREVIEW_HEIGHT}`,
        marginTop: 12,
        imageRendering: 'pixelated',
        boxShadow: `0 0 0 1px ${GRID_LINE_COLOR}`,
    });

    function draw(): void {
        const size = draft.width;
        const cellSize = (GRID_SIZE - (size + 1)) / size;
        gridCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        gridCtx.fillStyle = GRID_LINE_COLOR;
        gridCtx.fillRect(0, 0, GRID_SIZE, GRID_SIZE);
        draft.data.forEach((value, i) => {
            gridCtx.fillStyle = value ? '#000' : '#fff';
            gridCtx.fillRect(
                1 + (i % size) * (cellSize + 1),
                1 + Math.floor(i / size) * (cellSize + 1),
                cellSize,
                cellSize,
            );
        });

        // drawn directly. A new background image per change would flicker while it loads.
        previewCtx.fillStyle = '#fff';
        previewCtx.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
        previewCtx.fillStyle = '#000';
        for (let y = 0; y < PREVIEW_HEIGHT; y++) {
            for (let x = 0; x < PREVIEW_WIDTH; x++) {
                if (draft.data[(y % draft.height) * draft.width + (x % draft.width)]) {
                    previewCtx.fillRect(x, y, 1, 1);
                }
            }
        }
    }

    // the first touched pixel decides if the drag draws or erases
    let paintValue: number | undefined;
    let lastCell: [number, number] | undefined;
    function getCellAt(e: TPointerEvent): [number, number] {
        const rect = gridCanvas.getBoundingClientRect();
        const size = draft.width;
        return [
            clamp(Math.floor(((e.clientX - rect.left) / rect.width) * size), 0, size - 1),
            clamp(Math.floor(((e.clientY - rect.top) / rect.height) * size), 0, size - 1),
        ];
    }
    function paintAt(e: TPointerEvent): void {
        const size = draft.width;
        const [x1, y1] = getCellAt(e);
        if (paintValue === undefined) {
            paintValue = draft.data[y1 * size + x1] ? 0 : 1;
        }
        // fill the cells between events, fast drags skip cells otherwise
        const [x0, y0] = lastCell ?? [x1, y1];
        const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        for (let i = 0; i <= steps; i++) {
            const x = Math.round(x0 + ((x1 - x0) * i) / steps);
            const y = Math.round(y0 + ((y1 - y0) * i) / steps);
            draft.data[y * size + x] = paintValue;
        }
        lastCell = [x1, y1];
        draw();
    }
    const pointerListener = new PointerListener({
        target: gridCanvas,
        onPointer: (e) => {
            if (e.type === 'pointerdown' && e.button === 'left') {
                e.eventPreventDefault();
                paintValue = undefined;
                lastCell = undefined;
                paintAt(e);
            }
            if (e.type === 'pointermove' && e.button === 'left' && paintValue !== undefined) {
                paintAt(e);
            }
            if (e.type === 'pointerup') {
                paintValue = undefined;
            }
        },
    });

    const sizeOptions = new Options<number>({
        optionArr: EDITABLE_PIXEL_PATTERN_SIZES.map((size) => ({
            id: size,
            label: `${size}×${size}`,
        })),
        initId: draft.width,
        isSmall: true,
        isFocusable: true,
        onChange: (size) => {
            const old = draft;
            draft = {
                width: size,
                height: size,
                // bigger: repeats the tile, so it looks the same. smaller: crops the top left.
                data: Array.from({ length: size * size }, (_, i) => {
                    const x = (i % size) % old.width;
                    const y = Math.floor(i / size) % old.height;
                    return old.data[y * old.width + x];
                }),
            };
            draw();
        },
    });

    const invertButton = el({
        tagName: 'button',
        className: 'kl-button',
        textContent: LANG('filter-invert'),
        onClick: () => {
            draft.data = draft.data.map((value) => (value ? 0 : 1));
            draw();
        },
    });

    const rootEl = el({
        content: [
            el({
                content: [sizeOptions.getElement(), invertButton],
                css: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 10,
                },
            }),
            gridCanvas,
            previewCanvas,
        ],
    });

    draw();

    const buttons: TModalButton<'delete'>[] = p.onDelete
        ? [{ id: 'delete', label: LANG('brush-pixel-pattern-delete') }, 'Ok', 'Cancel']
        : ['Ok', 'Cancel'];
    showModal({
        message: '',
        div: rootEl,
        buttons,
        deleteButton: 'delete',
        clickOnEnter: 'Ok',
        callback: (result) => {
            pointerListener.destroy();
            sizeOptions.destroy();
            freeCanvas(gridCanvas);
            freeCanvas(previewCanvas);
            if (result === 'Ok') {
                p.onOk(draft);
            } else if (result === 'delete') {
                p.onDelete?.();
            }
        },
    });
}
