import { TRgb, TSliderConfig } from '../kl-types';

export type TBrushSettingEmit =
    | { type: 'color'; value: TRgb }
    | { type: 'opacity'; value: number }
    | { type: 'size'; value: number }
    | { type: 'scatter'; value: number }
    | { type: 'sliderConfig'; value: TSliderConfig };

export type TBrushSettingSubscriber = (p: TBrushSettingEmit) => void;

export type TBrushSettingServiceParams = {
    onSetColor: (rgb: TRgb) => void;
    onSetSize: (size: number) => void;
    onSetOpacity: (opacity: number) => void;
    onSetScatter: (scatter: number) => void;
    onGetColor: () => TRgb;
    onGetSize: () => number;
    onGetOpacity: () => number;
    onGetScatter: () => number;
    onGetSliderConfig: () => TSliderConfig;
};

/**
 * Central place to update brush settings, and to subscribe to changes.
 */
export class BrushSettingService {
    private static instance: BrushSettingService;
    subscriberArr: TBrushSettingSubscriber[] = [];

    // from params
    private readonly onSetColor: (rgb: TRgb) => void;
    private readonly onSetSize: (size: number) => void;
    private readonly onSetOpacity: (opacity: number) => void;
    private readonly onSetScatter: (scatter: number) => void;
    private readonly onGetColor: () => TRgb;
    private readonly onGetSize: () => number;
    private readonly onGetOpacity: () => number;
    private readonly onGetScatter: () => number;
    private readonly onGetSliderConfig: () => TSliderConfig;

    private emit(obj: TBrushSettingEmit, skipSubscriber?: TBrushSettingSubscriber): void {
        for (let i = 0; i < this.subscriberArr.length; i++) {
            if (this.subscriberArr[i] === skipSubscriber) {
                continue;
            }
            this.subscriberArr[i](obj);
        }
    }

    // ----------------------------------- public -----------------------------------

    constructor(p: TBrushSettingServiceParams) {
        this.onSetColor = p.onSetColor;
        this.onSetSize = p.onSetSize;
        this.onSetOpacity = p.onSetOpacity;
        this.onSetScatter = p.onSetScatter;
        this.onGetColor = p.onGetColor;
        this.onGetSize = p.onGetSize;
        this.onGetOpacity = p.onGetOpacity;
        this.onGetScatter = p.onGetScatter;
        this.onGetSliderConfig = p.onGetSliderConfig;

        if (BrushSettingService.instance) {
            throw new Error('BrushSettingService already instantiated');
        }
        BrushSettingService.instance = this;
    }

    emitColor(color: TRgb, skipSubscriber?: TBrushSettingSubscriber): void {
        this.emit(
            {
                type: 'color',
                value: color,
            },
            skipSubscriber,
        );
    }

    emitSize(size: number, skipSubscriber?: TBrushSettingSubscriber): void {
        this.emit(
            {
                type: 'size',
                value: size,
            },
            skipSubscriber,
        );
    }

    emitOpacity(opacity: number, skipSubscriber?: TBrushSettingSubscriber): void {
        this.emit(
            {
                type: 'opacity',
                value: opacity,
            },
            skipSubscriber,
        );
    }

    emitScatter(scatter: number, skipSubscriber?: TBrushSettingSubscriber): void {
        this.emit(
            {
                type: 'scatter',
                value: scatter,
            },
            skipSubscriber,
        );
    }

    emitSliderConfig(sliderConfig: TSliderConfig, skipSubscriber?: TBrushSettingSubscriber) {
        this.emit(
            {
                type: 'sliderConfig',
                value: sliderConfig,
            },
            skipSubscriber,
        );
    }

    /**
     * set current brush color
     * @param color
     * @param skipSubscriber
     */
    setColor(color: TRgb, skipSubscriber?: TBrushSettingSubscriber) {
        this.onSetColor(color);
        this.emitColor(color, skipSubscriber);
    }

    /**
     * set current brush size
     * @param size
     * @param skipSubscriber
     */
    setSize(size: number, skipSubscriber?: TBrushSettingSubscriber) {
        this.onSetSize(size);
        // why not emitting?
    }

    /**
     * set current opacity
     * @param opacity
     * @param skipSubscriber
     */
    setOpacity(opacity: number, skipSubscriber?: TBrushSettingSubscriber) {
        this.onSetOpacity(opacity);
        // why not emitting?
    }

    /**
     * set current scatter
     * @param scatter
     * @param skipSubscriber
     */
    setScatter(scatter: number, skipSubscriber?: TBrushSettingSubscriber) {
        this.onSetScatter(scatter);
        // why not emitting?
    }

    /**
     * get current brush color
     */
    getColor(): TRgb {
        return this.onGetColor();
    }

    getSize(): number {
        return this.onGetSize();
    }

    getOpacity(): number {
        return this.onGetOpacity();
    }

    getScatter(): number {
        return this.onGetScatter();
    }

    getSliderConfig(): TSliderConfig {
        return this.onGetSliderConfig();
    }

    /**
     * subscribe to changes
     * @param func
     */
    subscribe(func: TBrushSettingSubscriber): void {
        if (this.subscriberArr.includes(func)) {
            return;
        }
        this.subscriberArr.push(func);
    }

    unsubscribe(func: TBrushSettingSubscriber): void {
        for (let i = 0; i < this.subscriberArr.length; i++) {
            if (func === this.subscriberArr[i]) {
                this.subscriberArr.splice(i, 1);
                i--;
            }
        }
    }
}
