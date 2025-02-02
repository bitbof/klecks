import { genBrushAlpha01, genBrushAlpha02 } from './alphas/brush-alphas';

export const ALPHA_IM_ARR: HTMLCanvasElement[] = []; // used by default brush
ALPHA_IM_ARR[1] = genBrushAlpha01(128);
ALPHA_IM_ARR[2] = genBrushAlpha02(128);
