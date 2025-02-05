import { TSelectionSample } from './kl-canvas';
import { IBounds } from '../../bb/bb-types';
import { transformBounds } from '../../bb/transform/transform-bounds';
import { integerBounds } from '../../bb/math/math';

export function getSelectionSampleBounds(selectionSample: TSelectionSample): IBounds | undefined {
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
