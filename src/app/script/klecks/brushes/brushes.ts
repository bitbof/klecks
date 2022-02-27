import {defaultBrush} from './default-brush';
import {BlendBrush} from './blend-brush';
import {sketchyBrush} from './sketchy-brush';
import {pixelBrush} from './pixel-brush';
import {eraserBrush} from './eraser-brush';
import {smudgeBrush} from './smudge-brush';

export const brushes = {
    defaultBrush: defaultBrush,
    BlendBrush,
    sketchy: sketchyBrush,
    pixel: pixelBrush,
    smudge: smudgeBrush,
    eraser: eraserBrush,
}