import { genBrushAlpha01, genBrushAlpha02 } from './alphas/brush-alphas';

export const alphaImArr: HTMLCanvasElement[] = []; //used by default brush
alphaImArr[1] = genBrushAlpha01(128);
alphaImArr[2] = genBrushAlpha02(128);
