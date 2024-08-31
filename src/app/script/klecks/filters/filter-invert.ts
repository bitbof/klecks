import { getSharedFx } from '../../fx-canvas/shared-fx';
import { IFilterApply } from '../kl-types';
import { TFilterHistoryEntry } from './filters';

export type TFilterInvertInput = null;

export type TFilterInvertHistoryEntry = TFilterHistoryEntry<'invert', TFilterInvertInput>;

export const filterInvert = {
    apply(params: IFilterApply<TFilterInvertInput>): boolean {
        const context = params.context;
        const history = params.history;
        if (!context) {
            return false;
        }

        const fxCanvas = getSharedFx();
        if (!fxCanvas) {
            return false;
        }

        history?.pause(true);

        const texture = fxCanvas.texture(context.canvas);
        fxCanvas.draw(texture).invert().update();
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        context.drawImage(fxCanvas, 0, 0);
        texture.destroy();

        history?.pause(false);
        history?.push({
            tool: ['filter', 'invert'],
            action: 'apply',
            params: [
                {
                    input: params.input,
                },
            ],
        } as TFilterInvertHistoryEntry);
        return true;
    },
};
