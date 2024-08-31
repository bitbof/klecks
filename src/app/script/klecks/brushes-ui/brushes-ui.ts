import { penBrushUi } from './pen-brush-ui';
import { blendBrushUi } from './blend-brush-ui';
import { sketchyBrushUi } from './sketchy-brush-ui';
import { pixelBrushUi } from './pixel-brush-ui';
import { eraserBrushUi } from './eraser-brush-ui';
import { smudgeBrushUi } from './smudge-brush-ui';
import { chemyBrushUi } from './chemy-brush-ui';
import { IBrushUi } from '../kl-types';

/**
 * UI for brushes.
 * Each brush ui carries the brush with it.
 * So if you want to draw, you do it through the UI. should be changed sometime.
 */

export const brushesUI: {
    [key: string]: IBrushUi<any>;
} = {
    penBrush: penBrushUi,
    blendBrush: blendBrushUi,
    sketchyBrush: sketchyBrushUi,
    pixelBrush: pixelBrushUi,
    chemyBrush: chemyBrushUi,
    smudgeBrush: smudgeBrushUi,
    eraserBrush: eraserBrushUi,
};
