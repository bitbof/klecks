import { el } from '../../../bb/base/ui';
import { LANG } from '../../../language/language';
import { MobileSlider } from './mobile-slider';
import {
    MobileToolSelection,
    TMobileBrush,
    TMobileTool,
    TMobileToolSelectionValue,
} from './mobile-tool-selection';
import { BrushSettingService, TBrushSettingEmit } from '../../brushes-ui/brush-setting-service';
import { TToolType, TUiLayout } from '../../kl-types';
import { TSelectToolMode } from '../tool-tabs/select-ui';
import { TBrushId } from '../../brushes-ui/brushes-ui';

export type TMobileToolUiParams = {
    brushArr: TMobileBrush[]; // excluding eraser
    brushSettingService: BrushSettingService;
    getToolId: () => TToolType;
    getSelectMode: () => TSelectToolMode;
    getCurrentBrushId: () => TBrushId;
    getLastNonEraserBrushId: () => TBrushId;
    onBrush: (brushId: TBrushId) => void;
    // return false if tool-change was rejected
    onTool: (toolId: TMobileTool) => boolean;
};

/**
 * Tool selection (incl. brush/eraser swap), brush size & opacity sliders.
 */
export class MobileToolUi {
    private readonly rootEl: HTMLElement;
    private readonly sizeSlider: MobileSlider;
    private readonly opacitySlider: MobileSlider;
    private readonly onBrush: TMobileToolUiParams['onBrush'];
    private readonly onTool: TMobileToolUiParams['onTool'];
    private readonly getToolId: TMobileToolUiParams['getToolId'];
    private readonly getSelectMode: TMobileToolUiParams['getSelectMode'];
    private readonly getCurrentBrushId: TMobileToolUiParams['getCurrentBrushId'];
    private readonly toolSelection: MobileToolSelection;

    private getMobileToolId(): TMobileTool | 'brush' {
        const toolId = this.getToolId();
        if (toolId === 'select' && this.getSelectMode() === 'transform') {
            return 'transform';
        }
        return toolId;
    }

    private getToolSelectionValue(): TMobileToolSelectionValue {
        const toolId = this.getMobileToolId();
        return toolId === 'brush' ? this.getCurrentBrushId() : toolId;
    }

    private selectTool(toolId: TMobileTool): void {
        const prevToolId = this.getMobileToolId();
        if (this.onTool(toolId)) {
            return;
        }
        // rejected -> go back to previous tool
        if (prevToolId === 'brush') {
            this.onBrush(this.getCurrentBrushId());
        } else {
            this.onTool(prevToolId);
        }
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: TMobileToolUiParams) {
        this.onBrush = p.onBrush;
        this.onTool = p.onTool;
        this.getToolId = p.getToolId;
        this.getSelectMode = p.getSelectMode;
        this.getCurrentBrushId = p.getCurrentBrushId;

        this.toolSelection = new MobileToolSelection({
            brushArr: p.brushArr,
            getLastNonEraserBrushId: p.getLastNonEraserBrushId,
            onBrush: (brushId) => this.onBrush(brushId),
            onTool: (toolId) => this.selectTool(toolId),
        });

        // sliders receive actual config and values once a brush gets selected
        this.sizeSlider = new MobileSlider({
            title: LANG('brush-size'),
            config: { min: 0, max: 1 },
            value: 0,
            onChange: (size) => {
                p.brushSettingService.setSize(size);
                p.brushSettingService.emitSize(size, onBrushSetting);
            },
        });
        this.opacitySlider = new MobileSlider({
            title: LANG('opacity'),
            config: { min: 0, max: 1 },
            value: 1,
            hasCheckerboard: true,
            onChange: (opacity) => {
                p.brushSettingService.setOpacity(opacity);
                p.brushSettingService.emitOpacity(opacity, onBrushSetting);
            },
        });
        const onBrushSetting = (event: TBrushSettingEmit): void => {
            if (event.type === 'size') {
                this.sizeSlider.setValue(event.value);
            } else if (event.type === 'opacity') {
                this.opacitySlider.setValue(event.value);
            } else if (event.type === 'sliderConfig') {
                this.sizeSlider.setConfig(event.value.sizeSlider);
                this.opacitySlider.setConfig(event.value.opacitySlider);
            }
        };
        p.brushSettingService.subscribe(onBrushSetting);

        this.rootEl = el({
            css: {
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                minHeight: 0,
                marginTop: 8, // separates it from color group above
            },
        });
        this.rootEl.append(
            this.toolSelection.getElement(),
            this.sizeSlider.getElement(),
            this.opacitySlider.getElement(),
        );
    }

    // call when tool, select mode, or brush changed
    update(): void {
        this.toolSelection.setValue(this.getToolSelectionValue());
        const sliderDisplay = this.getToolId() === 'brush' ? '' : 'none';
        this.sizeSlider.getElement().style.display = sliderDisplay;
        this.opacitySlider.getElement().style.display = sliderDisplay;
    }

    setOrientation(orientation: TUiLayout): void {
        this.toolSelection.setOrientation(orientation);
    }

    close(): void {
        this.toolSelection.close();
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }
}
