import { TBounds } from '../../bb/bb-types';
import { transformBounds } from '../../bb/transform/transform-bounds';
import { integerBounds } from '../../bb/math/math';
import { TSelectionSample } from './kl-canvas-transform';

export function getSelectionSampleBounds(selectionSample: TSelectionSample): TBounds | undefined {
    if (!selectionSample.image) {
        return undefined;
    }
    return integerBounds(
        transformBounds(
            {
                x1: 0,
                y1: 0,
                x2: selectionSample.image.width,
                y2: selectionSample.image.height,
            },
            selectionSample.transformation,
        ),
    );
}
