
export interface IFilter {
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
    getDialog: null | ((p) => any);
    apply: null | ((p) => boolean);
}

export interface ITransform {
    x: number,
    y: number,
    scale: number,
    angle: number, // rad
}

export type IMixMode = (
    'source-over' |
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
