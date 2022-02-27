import {defaultBrushUi} from './default-brush-ui';
import {blendBrushUi} from './blend-brush-ui';
import {sketchyBrushUi} from './sketchy-brush-ui';
import {pixelBrushUi} from './pixel-brush-ui';
import {eraserBrushUi} from './eraser-brush-ui';
import {smudgeBrushUi} from './smudge-brush-ui';

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
    blendBrush: blendBrushUi,
    sketchy: sketchyBrushUi,
    pixel: pixelBrushUi,
    displace: smudgeBrushUi,
    eraser: eraserBrushUi,
};
