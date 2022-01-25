import {defaultBrushUi} from './default-brush-ui';
import {smoothBrushUi} from './smooth-brush-ui';
import {sketchyBrushUi} from './sketchy-brush-ui';
import {pixelBrushUi} from './pixel-brush-ui';
import {eraserBrushUi} from './eraser-brush-ui';

/**
 * UI for brushes.
 * each brush ui carries the brush with it.
 * so if you want to draw, you do it through the UI. should be changed sometime
 *
 * each brush: {
 *     image: str,
 *     tooltip: str,
 *     sizeSlider: {
 *         min: number,
 *         max: number,
 *         curve: [] // optional
 *     },
 *     opacitySlider: same as size slider,
 *     Ui: function(p)
 * }
 *
 */

export const brushesUI = {
    defaultBrush: defaultBrushUi,
    smoothBrush: smoothBrushUi,
    sketchy: sketchyBrushUi,
    pixel: pixelBrushUi,
    eraser: eraserBrushUi,
};
