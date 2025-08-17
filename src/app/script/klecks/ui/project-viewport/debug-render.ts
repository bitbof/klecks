import { BB } from '../../../bb/bb';
import { throwIfNull } from '../../../bb/base/base';
import { HISTORY_TILE_SIZE } from '../../history/kl-history';

export const DEBUG_RENDERER_ENABLED = false;

export type TDebugRenderFunc = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    scale: number,
) => void;

/**
 * renders into all ProjectViewports
 */
class DebugRender {
    private internalRenderFuncs: TDebugRenderFunc[] = [];
    private renderFuncs: TDebugRenderFunc[] = [];

    // --------------- public ---------------------
    constructor() {
        if (DEBUG_RENDERER_ENABLED) {
            // draw checkerboard
            const checkerCanvas = BB.createCheckerCanvas(256, false);
            const pattern = throwIfNull(
                BB.ctx(BB.canvas(HISTORY_TILE_SIZE, HISTORY_TILE_SIZE)).createPattern(
                    checkerCanvas,
                    'repeat',
                ),
            );
            this.internalRenderFuncs.push((ctx, width, height) => {
                ctx.fillStyle = pattern;
                ctx.globalAlpha = 0.2;
                ctx.fillRect(0, 0, width, height);
            });
        }
    }

    render(ctx: CanvasRenderingContext2D, width: number, height: number, scale: number) {
        this.internalRenderFuncs.forEach((func) => {
            ctx.save();
            func(ctx, width, height, scale);
            ctx.restore();
        });
        this.renderFuncs.forEach((func) => {
            ctx.save();
            func(ctx, width, height, scale);
            ctx.restore();
        });
    }

    // add something to be rendered
    add(func: TDebugRenderFunc) {
        this.renderFuncs.push(func);
    }

    remove(func: TDebugRenderFunc) {
        for (let i = 0; i < this.renderFuncs.length; i++) {
            if (this.renderFuncs[i] === func) {
                this.renderFuncs.splice(i, 1);
                return;
            }
        }
    }

    clear(): void {
        this.renderFuncs = [];
    }
}

export const DEBUG_RENDER = new DebugRender();
