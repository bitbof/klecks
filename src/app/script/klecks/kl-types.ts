import { KlCanvas, TKlCanvasLayer } from './canvas/kl-canvas';
import { TTranslationCode } from '../../languages/languages';
import { KlHistory } from './history/kl-history';
import { THistoryEntryDataComposed, THistoryEntryLayerTile } from './history/history.types';

export type TFilterApply<T = unknown> = {
    layer: TKlCanvasLayer; // active layer
    klCanvas: KlCanvas;
    input: T; // parameters chosen in modal
    klHistory: KlHistory;
};

export type TFilterGetDialogParam = {
    context: CanvasRenderingContext2D; // context of selected layer
    klCanvas: KlCanvas;
    composed: THistoryEntryDataComposed;
    maxWidth: number; // limit for klCanvas size
    maxHeight: number;
    currentColorRgb: TRgb;
    secondaryColorRgb: TRgb;
};

export type TFilterGetDialogResult<T = unknown> =
    | {
          element: HTMLElement; // contents of modal (excluding title, dialog buttons)
          destroy?: () => void; // called when modal closed
          width?: number; // custom modal width
          getInput?: () => T; // called when Ok pressed
          errorCallback?: (e: Error) => void; // dialog can call this if error happens and cancel dialog
      }
    | { error: string };

export type TFilter = {
    lang: {
        name: TTranslationCode; // title in modal
        button: TTranslationCode; // text on button in filter tab
        description?: TTranslationCode;
    };
    updatePos: boolean; // changes size/orientation of klCanvas
    icon: string; // image url
    isInstant?: boolean; // default false - if instant no modal
    inEmbed: boolean; // is available in embed
    getDialog: null | ((p: TFilterGetDialogParam) => any);
    apply: null | ((p: TFilterApply) => boolean);
    darkNoInvert?: boolean;
    webGL?: boolean; // does the filter require webgl
};

export type TLayerFromKlCanvas = {
    context: CanvasRenderingContext2D;
    isVisible: boolean;
    opacity: number;
    name: string;
    id: number; // actually the index
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

export type TLayerFill = { fill: string }; // css color string. hex, rgb, rgba, color name

export function isLayerFill(obj: unknown): obj is TLayerFill {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        'fill' in obj &&
        typeof (obj as any).fill === 'string'
    );
}

export type TKlBasicLayer = {
    opacity: number; // 0 - 1
    isVisible: boolean;
    mixModeStr?: TMixMode; // default "source-over"
    image: HTMLImageElement | HTMLCanvasElement; // already loaded
};

export type TKlProjectLayer = {
    name: string;
    isVisible: boolean;
    opacity: number; // 0 - 1
    mixModeStr?: TMixMode; // default "source-over"
    image: HTMLImageElement | HTMLCanvasElement | TLayerFill | THistoryEntryLayerTile[]; // image already loaded
};

// A UUID, to make the project identifiable. (Not the recovery indexedDb key)
// Used to test if current project is equal to what is in Browser Storage.
// If they're not equal, it's possible to show the user a warning.
export type TProjectId = string;

export type TKlProject = {
    width: number; // int
    height: number; // int
    layers: TKlProjectLayer[];
    projectId: TProjectId;
};

export type TKlProjectWithOptionalId = {
    width: number; // int
    height: number; // int
    layers: TKlProjectLayer[];
    projectId?: TProjectId;
};

export type TRawMeta = {
    timestamp: number;
    thumbnail: Blob;
    projectId: TProjectId;
};

export type TKlProjectMeta = {
    timestamp: number;
    thumbnail: HTMLImageElement | HTMLCanvasElement;
    projectId: TProjectId;
};

export type TDeserializedKlStorageProject = {
    project: TKlProject;
    timestamp: number;
    thumbnail: HTMLImageElement | HTMLCanvasElement;
};

export type TDropOption = 'default' | 'layer' | 'image';

export type TRgb = {
    r: number; // [0, 255]
    g: number;
    b: number;
};

export type TRgba = {
    r: number; // [0, 255]
    g: number;
    b: number;
    a: number; // [0, 1]
};

export type TGradientType = 'linear' | 'linear-mirror' | 'radial';

export type TGradient = {
    type: TGradientType;
    color1: TRgb;
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
};

export type TShapeToolType = 'rect' | 'ellipse' | 'line';

export type TShapeToolMode = 'stroke' | 'fill';

export type TShapeToolObject = {
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
};

export type TKlSliderConfig = {
    min: number;
    max: number;
    curve?: [number, number][] | 'quadratic';
    isDisabled?: boolean; // default enabled
};

export type TSliderConfig = {
    sizeSlider: TKlSliderConfig;
    opacitySlider: TKlSliderConfig;
    scatterSlider: TKlSliderConfig;
};

export type TBrushUiInstance<GBrush> = {
    increaseSize: (f: number) => void;
    decreaseSize: (f: number) => void;
    getSize: () => number;
    setSize: (size: number) => void;
    getOpacity: () => number;
    setOpacity: (opacity: number) => void;
    getScatter: () => number;
    setScatter: (opacity: number) => void;
    setColor: (c: TRgb) => void;
    setLayer: (layer: TKlCanvasLayer) => void;
    startLine: (x: number, y: number, p: number) => void;
    goLine: (x: number, y: number, p: number, isCoalesced?: boolean) => void;
    endLine: () => void;
    getBrush: () => GBrush;
    isDrawing: () => boolean;
    getElement: () => HTMLElement;
    getIsTransparentBg?: () => boolean;
    getSeed?: () => number;
    setSeed?: (s: number) => void;
    toggleEraser?: () => void;
};

export type TBrushUi<GBrush> = TSliderConfig & {
    image: string;
    tooltip: string;
    Ui: (
        this: TBrushUiInstance<GBrush>,
        p: {
            klHistory: KlHistory;
            onSizeChange: (size: number) => void;
            onOpacityChange: (size: number) => void;
            onScatterChange: (size: number) => void;
            onConfigChange: () => void;
        },
    ) => TBrushUiInstance<GBrush>;
};

export type TPressureInput = {
    x: number;
    y: number;
    pressure: number;
};

export type TDrawDownEvent = {
    type: 'down';
    scale: number;
    shiftIsPressed: boolean;
    pressure: number;
    isCoalesced: boolean;
    x: number;
    y: number;
};

export type TDrawMoveEvent = {
    type: 'move';
    scale: number;
    shiftIsPressed: boolean;
    pressure: number;
    isCoalesced: boolean;
    x: number;
    y: number;
};

export type TDrawUpEvent = {
    type: 'up';
    scale: number;
    shiftIsPressed: boolean;
    isCoalesced: boolean;
};

export type TDrawLine = {
    type: 'line';
    x0: number | null;
    y0: number | null;
    x1: number;
    y1: number;
    pressure0: number | null;
    pressure1: number;
};

export type TDrawEvent = TDrawDownEvent | TDrawMoveEvent | TDrawUpEvent | TDrawLine;

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
export type TKlPsd = {
    type: 'psd';
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    layers?: TKlPsdLayer[]; // not there if flattened
    // if one of these features show up, they become a warning
    // because Klecks can't properly represent them (yet)
    warningArr?: TKlPsdError[];
    error?: boolean; // true if flattened (too many layers)
};

export type TFillSampling = 'current' | 'all' | 'above';

export type TUiLayout = 'left' | 'right';
export type TExportType = 'png' | 'layers' | 'psd';
export type TInterpolationAlgorithm = 'smooth' | 'pixelated';
