import { TFilterApply } from '../kl-types';
import { applyFxFilter } from './apply-fx-filter';

export type TFilterInvertInput = null;

export const filterInvert = {
    apply(params: TFilterApply<TFilterInvertInput>): boolean {
        const context = params.layer.context;
        const klHistory = params.klHistory;
        if (!context) {
            return false;
        }
        return applyFxFilter(
            context,
            params.klCanvas.getSelection(),
            (fxCanvas) => {
                fxCanvas.invert();
            },
            klHistory,
        );
    },
};
