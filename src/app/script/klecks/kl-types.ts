import { KlHistory } from './history/kl-history';
import { KlCanvas } from './canvas/kl-canvas';
import { TTranslationCode } from '../../languages/languages';

export interface IFilterApply<T = unknown> {
    context: CanvasRenderingContext2D; // context of selected layer
    klCanvas: KlCanvas;
    input: T; // parameters chosen in modal
    history?: KlHistory;
}

export interface IFilterGetDialogParam {
    context: CanvasRenderingContext2D; // context of selected layer
    klCanvas: KlCanvas;
    maxWidth: number; // limit for klCanvas size
    maxHeight: number;
    currentColorRgb: IRGB;
    secondaryColorRgb: IRGB;
}

export type TFilterGetDialogResult<T = unknown> =
    | {
          element: HTMLElement; // contents of modal (excluding title, dialog buttons)
          destroy?: () => void; // called when modal closed
          width?: number; // custom modal width
          getInput?: () => T; // called when Ok pressed
          errorCallback?: (e: Error) => void; // dialog can call this if error happens and cancel dialog
      }
    | { error: string };

export interface IFilter {
    lang: {
        name: TTranslationCode; // title in modal
        button: TTranslationCode; // text on button in filter tab
        description?: TTranslationCode;
    };
    updatePos: boolean; // changes size/orientation of klCanvas
    icon: string; // image url
    isInstant?: boolean; // default false - if instant no modal
    inEmbed: boolean; // is available in embed
    getDialog: null | ((p: IFilterGetDialogParam) => any);
    apply: null | ((p: IFilterApply) => boolean);
    darkNoInvert?: boolean;
    webGL?: boolean; // does the filter require webgl
}

export interface ITransform {
    x: number;
    y: number;
    scale: number;
    angle: number; // rad
}

export type TKlCanvasLayer = {
    context: CanvasRenderingContext2D;
    isVisible: boolean;
    opacity: number;
    name: string;
    id: number;
};

// a subset of CanvasRenderingContext2D.globalCompositeOperation
export type TMixMode =
    | 'source-over' // default aka normal
    | 'darken'
    | 'multiply'
    | 'color-burn'
    | 'lighten'
    | 'screen'
    | 'color-dodge'
    | 'overlay'
    | 'soft-light'
    | 'hard-light'
    | 'difference'
    | 'exclusion'
    | 'hue'
    | 'saturation'
    | 'color'
    | 'luminosity';

export type IKlBasicLayer = {
    opacity: number; // 0 - 1
    isVisible: boolean;
    mixModeStr?: TMixMode; // default "source-over"
    image: HTMLImageElement | HTMLCanvasElement; // already loaded
};

export type IKlProject = {
    width: number; // int
    height: number; // int
    layers: {
        name: string;
        isVisible: boolean;
        opacity: number; // 0 - 1
        mixModeStr?: TMixMode; // default "source-over"
        image: HTMLImageElement | HTMLCanvasElement; // already loaded
    }[];
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
        isVisible: boolean;
        opacity: number; // 0 - 1
        mixModeStr?: TMixMode; // default "source-over"
        blob: Blob; // png
    }[];
};

export type TDropOption = 'default' | 'layer' | 'image';

export interface IRGB {
    r: number; // [0, 255]
    g: number;
    b: number;
}

export interface IRGBA {
    r: number; // [0, 255]
    g: number;
    b: number;
    a: number; // [0, 1]
}

export interface TOldestProjectState {
    canvas: KlCanvas;
    focus: number; // index of selected layer
    brushes: any; // todo type
}

export type TGradientType = 'linear' | 'linear-mirror' | 'radial';

export interface IGradient {
    type: TGradientType;
    color1: IRGB;
    isReversed: boolean; // color1 actually color2
    opacity: number; // [0, 1]
    doLockAlpha: boolean;
    doSnap: boolean; // 45° deg angle snapping
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    angleRad: number; // angle of canvas
    isEraser: boolean;
}

export type TShapeToolType = 'rect' | 'ellipse' | 'line';

export type TShapeToolMode = 'stroke' | 'fill';

export interface IShapeToolObject {
    type: TShapeToolType;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    angleRad?: number; // angle of canvas, default 0
    isOutwards?: boolean; // center is x1 y1, default false
    opacity?: number; // 0-1, default 1
    isEraser?: boolean; // default false
    fillRgb?: { r: number; g: number; b: number }; // for rect or ellipse
    strokeRgb?: { r: number; g: number; b: number }; // needed for line
    lineWidth?: number; // needed for line
    isAngleSnap?: boolean; // 45° deg angle snapping
    isFixedRatio?: boolean; // 1:1 for rect or ellipse
    doLockAlpha?: boolean; // default false
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

export type TBrushUiInstance<GBrush> = {
    increaseSize: (f: number) => void;
    decreaseSize: (f: number) => void;
    getSize: () => number;
    setSize: (size: number) => void;
    getOpacity: () => number;
    setOpacity: (opacity: number) => void;
    setColor: (c: IRGB) => void;
    setContext: (ctx: CanvasRenderingContext2D) => void;
    startLine: (x: number, y: number, p: number) => void;
    goLine: (x: number, y: number, p: number, isCoalesced: boolean) => void;
    endLine: (x: number, y: number) => void;
    getBrush: () => GBrush;
    isDrawing: () => boolean;
    getElement: () => HTMLElement;
    getIsTransparentBg?: () => boolean;
    getSeed?: () => number;
    setSeed?: (s: number) => void;
    toggleEraser?: () => void;
};

export interface IBrushUi<GBrush> extends ISliderConfig {
    image: string;
    tooltip: string;
    Ui: (
        this: TBrushUiInstance<GBrush>,
        p: {
            history: KlHistory;
            onSizeChange: (size: number) => void;
            onOpacityChange: (size: number) => void;
            onConfigChange: () => void;
        },
    ) => TBrushUiInstance<GBrush>;
}

export type TPressureInput = {
    x: number;
    y: number;
    pressure: number;
};

export interface IDrawDownEvent {
    type: 'down';
    scale: number;
    shiftIsPressed: boolean;
    pressure: number;
    isCoalesced: boolean;
    x: number;
    y: number;
}

export interface IDrawMoveEvent {
    type: 'move';
    scale: number;
    shiftIsPressed: boolean;
    pressure: number;
    isCoalesced: boolean;
    x: number;
    y: number;
}

export interface IDrawUpEvent {
    type: 'up';
    scale: number;
    shiftIsPressed: boolean;
    isCoalesced: boolean;
}

export interface IDrawLine {
    type: 'line';
    x0: number | null;
    y0: number | null;
    x1: number;
    y1: number;
    pressure0: number | null;
    pressure1: number;
}

export type TDrawEvent = IDrawDownEvent | IDrawMoveEvent | IDrawUpEvent | IDrawLine;

export type TToolType = 'brush' | 'paintBucket' | 'text' | 'shape' | 'gradient' | 'hand' | 'select';

export type TKlPsdError =
    | 'mask'
    | 'clipping'
    | 'group'
    | 'adjustment'
    | 'layer-effect'
    | 'smart-object'
    | 'blend-mode'
    | 'bits-per-channel';

export type TKlPsdLayer = {
    name: string;
    isVisible: boolean;
    mixModeStr: TMixMode;
    opacity: number;
    image: HTMLCanvasElement;
};

/**
 * Psd interpreted for usage in Klecks.
 */
export interface IKlPsd {
    type: 'psd';
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    layers?: TKlPsdLayer[]; // not there if flattened
    // if one of these features show up, they become a warning
    // because Klecks can't properly represent them (yet)
    warningArr?: TKlPsdError[];
    error?: boolean; // true if flattened (too many layers)
}

export type TFillSampling = 'current' | 'all' | 'above';

export type TUiLayout = 'left' | 'right';
export type TExportType = 'png' | 'layers' | 'psd';

export interface Style {
    id: string;
    name: string;
    imageUrl: string;
    darkInvert?: boolean; // Optional: whether the image should be inverted in dark mode
}
