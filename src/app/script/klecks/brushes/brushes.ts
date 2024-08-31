import { PenBrush } from './pen-brush';
import { BlendBrush } from './blend-brush';
import { SketchyBrush } from './sketchy-brush';
import { PixelBrush } from './pixel-brush';
import { EraserBrush } from './eraser-brush';
import { SmudgeBrush } from './smudge-brush';
import { ChemyBrush } from './chemy-brush';

export type TBrush =
    | PenBrush
    | BlendBrush
    | SketchyBrush
    | PixelBrush
    | ChemyBrush
    | SmudgeBrush
    | EraserBrush;

export const brushes = {
    PenBrush,
    BlendBrush,
    SketchyBrush,
    PixelBrush,
    ChemyBrush,
    SmudgeBrush,
    EraserBrush,
};
