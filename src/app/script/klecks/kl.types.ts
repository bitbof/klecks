import {KlHistoryInterface} from './history/kl-history';
import {KlCanvas} from './canvas/kl-canvas';
import {TTranslationCode} from '../../languages/languages';

export interface IFilterApply {
    context: CanvasRenderingContext2D;
    canvas: KlCanvas;
    input: any;
    history: KlHistoryInterface;
}

export interface IFilterGetDialogParam {
    context: CanvasRenderingContext2D;
    canvas: KlCanvas;
    maxWidth: number;
    maxHeight: number;
    currentColorRgb: IRGB;
    secondaryColorRgb: IRGB;
}

export interface IFilter {
    lang: {name: TTranslationCode; button: TTranslationCode};
    name: string;
    buttonLabel?: string;
    neededWithWebGL?: boolean;
    webgl: boolean;
    updateContext: boolean;
    icon: string;
    ieFails?: boolean;
    isInstant?: boolean;
    updatePos: boolean;
    inEmbed: boolean;
    getDialog: null | ((p: IFilterGetDialogParam) => any);
    apply: null | ((p: IFilterApply) => boolean);
}

export interface ITransform {
    x: number;
    y: number;
    scale: number;
    angle: number; // rad
}

export type IMixMode = (
    'source-over' | // default aka normal
    'darken' |
    'multiply' |
    'color-burn' |
    'lighten' |
    'screen' |
    'color-dodge' |
    'overlay' |
    'soft-light' |
    'hard-light' |
    'difference' |
    'exclusion' |
    'hue' |
    'saturation' |
    'color' |
    'luminosity'
);

export type IKlBasicLayer = {
    opacity: number; // 0 - 1
    mixModeStr?: IMixMode; // default "source-over"
    image: HTMLImageElement | HTMLCanvasElement; // already loaded
};

export type IKlProject = {
    width: number; // int
    height: number; // int
    layers: {
        name: string;
        opacity: number; // 0 - 1
        mixModeStr?: IMixMode; // default "source-over"
        image: HTMLImageElement | HTMLCanvasElement; // already loaded
    }[],
};

// stored in indexedDB
export type IKlStorageProject = {
    id: 1;
    timestamp: number;
    thumbnail?: Blob; // png - may not exist pre 0.5.1
    width: number; // int
    height: number; // int
    layers: {
        name: string;
        opacity: number; // 0 - 1
        mixModeStr?: IMixMode; // default "source-over"
        blob: Blob; // png
    }[],
};

export interface IRGB {
    r: number;
    g: number;
    b: number;
}

export interface IRGBA {
    r: number;
    g: number;
    b: number;
    a: number;
}

export interface IInitState {
    canvas: KlCanvas;
    focus: number; // index of selected layer
    brushes: any; // todo type
}

export interface IShapeToolObject {
    type: 'rect' | 'ellipse' | 'line';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    angleRad: number; // angle of canvas
    isOutwards: boolean; // center is x1 y1
    opacity: number; // 0-1
    isEraser: boolean;
    fillRgb?: { r: number; g: number; b: number }; // for rect or ellipse
    strokeRgb?: { r: number; g: number; b: number }; // needed for line
    lineWidth?: number; // needed for line
    isAngleSnap?: boolean; // 45° angle snapping
    isFixedRatio?: boolean; // 1:1 for rect or ellipse
}

export interface IKlSliderConfig {
    min: number;
    max: number;
    curve?: [number, number][] | 'quadratic';
    isDisabled?: boolean; // default enabled
}

export interface ISliderConfig {
    sizeSlider: IKlSliderConfig;
    opacitySlider: IKlSliderConfig;
}

export interface IBrushUi extends ISliderConfig {
    image: string;
    tooltip: string;
    Ui: (
        p: {
            onSizeChange: (size: number) => void,
            onOpacityChange: (size: number) => void,
            onConfigChange: () => void,
        }
    ) => void;
}

export type TKlPsdError = 'mask' | 'clipping' | 'group' | 'adjustment' | 'layer-effect' | 'smart-object' | 'blend-mode' | 'bits-per-channel';

/**
 * Psd interpreted for usage in Klecks.
 */
export interface IKlPsd {
    type: 'psd';
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    layers?: { // not there if flattened
            name: string;
            mixModeStr: IMixMode;
            opacity: number;
            image: HTMLCanvasElement;
    }[];
    // if one of these features show up, they become a warning
    // because Klecks can't properly represent them (yet)
    warningArr?: TKlPsdError[];
    error?: boolean; // true if flattened (too many layers)
}
