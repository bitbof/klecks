import { BB } from '../../../bb/bb';
import { KL } from '../../kl';
import { KlHistory } from '../../history/kl-history';
import { IKeyString } from '../../../bb/bb-types';
import { StatusOverlay } from '../components/status-overlay';
import { KlCanvas } from '../../canvas/kl-canvas';
import { LANG } from '../../../language/language';
import { IFilterApply, IFilterGetDialogParam, TFilterGetDialogResult } from '../../kl-types';
import { KlColorSlider } from '../components/kl-color-slider';
import { LayersUi } from './layers-ui/layers-ui';
import { RGB } from '../../../bb/color/color';
import { getSharedFx } from '../../../fx-canvas/shared-fx';
import { c } from '../../../bb/base/c';

export type TFilterUiParams = {
    klRootEl: HTMLElement;
    klColorSlider: KlColorSlider;
    layersUi: LayersUi;
    getCurrentColor: () => RGB;
    getKlMaxCanvasSize: () => number;
    klCanvas: KlCanvas;
    getCurrentLayerCtx: () => CanvasRenderingContext2D | null;
    isEmbed: boolean;
    statusOverlay: StatusOverlay;
    onCanvasChanged: () => void; // dimensions/orientation changed
    applyUncommitted: () => void;
    history: KlHistory;
};

export class FilterUi {
    // from params
    private readonly klRootEl: HTMLElement;
    private readonly klColorSlider: KlColorSlider;
    private readonly layersUi: LayersUi;
    private readonly getCurrentColor: () => RGB;
    private readonly getKlMaxCanvasSize: () => number;
    private readonly klCanvas: KlCanvas;
    private readonly getCurrentLayerCtx: () => CanvasRenderingContext2D | null;
    private readonly isEmbed: boolean;
    private readonly statusOverlay: StatusOverlay;
    private readonly onCanvasChanged: () => void; // dimensions/orientation changed
    private readonly applyUncommitted: () => void;
    private readonly history: KlHistory;

    private readonly rootEl: HTMLDivElement;
    private isInit = false;

    private testHasWebGL(): boolean {
        return !!getSharedFx();
    }

    constructor(p: TFilterUiParams) {
        this.klRootEl = p.klRootEl;
        this.klColorSlider = p.klColorSlider;
        this.layersUi = p.layersUi;
        this.getCurrentColor = p.getCurrentColor;
        this.getKlMaxCanvasSize = p.getKlMaxCanvasSize;
        this.klCanvas = p.klCanvas;
        this.getCurrentLayerCtx = p.getCurrentLayerCtx;
        this.isEmbed = p.isEmbed;
        this.statusOverlay = p.statusOverlay;
        this.onCanvasChanged = p.onCanvasChanged;
        this.applyUncommitted = p.applyUncommitted;
        this.history = p.history;

        this.rootEl = document.createElement('div');
    }

    private init(): void {
        const filters = KL.filterLib;
        const buttons = [];

        if (!KL.filterLibStatus.isLoaded) {
            throw new Error('filters not loaded');
        }

        const hasWebGL: boolean = this.testHasWebGL();

        if (!hasWebGL) {
            const note = BB.el({
                parent: this.rootEl,
                className: 'kl-toolspace-note',
                content: 'Features disabled because WebGL is failing.',
                css: {
                    margin: '10px',
                    marginBottom: '0',
                },
            });
            const noteButton = BB.el({
                parent: note,
                tagName: 'button',
                textContent: 'Learn More',
                css: {
                    marginLeft: '5px',
                },
            });
            noteButton.onclick = () => {
                KL.popup({
                    target: this.klRootEl,
                    message: '<b>WebGL is not working</b>',
                    div: BB.el({
                        content: `
See if your browser supports WebGL and has it enabled: <a href="https://get.webgl.org" target="_blank" rel="noopener noreferrer">get.webgl.org</a><br>
<br>
Recently (2023-05) a number of Chrome users on Chrome OS reported that WebGL fails, although it is enabled & supported.
This has been reported to Google.
`,
                    }),
                    buttons: ['Ok'],
                    clickOnEnter: 'Ok',
                });
            };
        }

        const createButton = (filterKey: string): HTMLElement => {
            const filter = filters[filterKey];

            const button = document.createElement('button');
            const buttonLabel = LANG(filter.lang.button);
            const imClass = filter.darkNoInvert ? 'class="dark-no-invert"' : '';
            const im =
                '<img ' +
                imClass +
                ' height="20" width="18" src="' +
                filter.icon +
                '" style="margin-right: 3px" alt="icon" />';
            button.innerHTML = im + buttonLabel;
            button.className = 'grid-button grid-button--filter';
            BB.css(button, {
                lineHeight: '20px',
                fontSize: '12px',
            });
            button.tabIndex = -1;

            const filterName = LANG(filter.lang.name);

            let isEnabled = true;
            if (filter.webGL && !hasWebGL) {
                isEnabled = false;
            }

            if (isEnabled) {
                button.onclick = () => {
                    this.applyUncommitted();
                    type TOptions = 'Ok' | 'Cancel';
                    const dialogButtons: TOptions[] = ['Ok', 'Cancel'];

                    const finishedDialog = (
                        result: TOptions,
                        filterDialog: TFilterGetDialogResult<any>,
                    ): void => {
                        if ('error' in filterDialog) {
                            return;
                        }
                        if (result == 'Cancel') {
                            if (filterDialog.destroy) {
                                filterDialog.destroy();
                            }
                            return;
                        }
                        let input;
                        try {
                            input = filterDialog.getInput!(); // also destroys
                        } catch (e) {
                            if (
                                (e as Error).message.indexOf('.getInput is not a function') !== -1
                            ) {
                                throw (
                                    'filterDialog.getInput is not a function, filter: ' + filterName
                                );
                            } else {
                                throw e;
                            }
                        }
                        applyFilter(input);
                    };

                    if (!('apply' in filters[filterKey])) {
                        KL.popup({
                            target: this.klRootEl,
                            message: 'Application not fully loaded',
                            type: 'error',
                        });
                        return;
                    }

                    const applyFilter = (input: any) => {
                        const filterResult = filters[filterKey].apply!({
                            context: this.getCurrentLayerCtx(),
                            klCanvas: this.klCanvas,
                            history: this.history,
                            input: input,
                        } as IFilterApply);
                        if (filterResult === false) {
                            KL.popup({
                                target: this.klRootEl,
                                message: "Couldn't apply the edit action",
                                type: 'error',
                            });
                        }
                        filters[filterKey].updatePos && this.onCanvasChanged();
                        this.layersUi.update();
                    };

                    if (filters[filterKey].isInstant) {
                        button.blur();
                        applyFilter(null);
                        this.statusOverlay.out(
                            '"' + filterName + '" ' + LANG('filter-applied'),
                            true,
                        );
                    } else {
                        const secondaryColorRGB = this.klColorSlider.getSecondaryRGB();
                        let filterDialog: TFilterGetDialogResult<any> | undefined = undefined;

                        try {
                            filterDialog = filters[filterKey].getDialog!({
                                context: this.getCurrentLayerCtx(),
                                klCanvas: this.klCanvas,
                                maxWidth: this.getKlMaxCanvasSize(),
                                maxHeight: this.getKlMaxCanvasSize(),
                                currentColorRgb: {
                                    r: this.getCurrentColor().r,
                                    g: this.getCurrentColor().g,
                                    b: this.getCurrentColor().b,
                                },
                                secondaryColorRgb: {
                                    r: secondaryColorRGB.r,
                                    g: secondaryColorRGB.g,
                                    b: secondaryColorRGB.b,
                                },
                            } as IFilterGetDialogParam) as TFilterGetDialogResult;
                        } catch (e) {
                            setTimeout(() => {
                                throw e;
                            });
                        }

                        if (!filterDialog || 'error' in filterDialog) {
                            KL.popup({
                                target: this.klRootEl,
                                message: filterDialog
                                    ? filterDialog.error
                                    : 'Error: Could not perform action.',
                                type: 'error',
                            });
                            return;
                        }

                        let closeFunc: () => void;
                        // Todo should move into getDialogParams
                        filterDialog.errorCallback = (e) => {
                            KL.popup({
                                target: this.klRootEl,
                                message: 'Error: Could not perform action.',
                                type: 'error',
                            });
                            setTimeout(() => {
                                throw e;
                            }, 0);
                            closeFunc();
                        };

                        const style: IKeyString = {};
                        if ('width' in filterDialog) {
                            style.width = filterDialog.width + 'px';
                        }

                        let title: HTMLElement;
                        {
                            const els: HTMLElement[] = [c('b', filterName)];
                            if (filter.lang.description !== undefined) {
                                els.push(
                                    c(
                                        {
                                            className: 'kl-info-btn',
                                            onClick: () => {
                                                KL.popup({
                                                    target: this.klRootEl,
                                                    message: LANG(filter.lang.description!),
                                                });
                                            },
                                            title: LANG(filter.lang.description!),
                                            noRef: true,
                                        },
                                        '?',
                                    ),
                                );
                            }
                            title = c(',flex,gap-5', els);
                        }

                        KL.popup({
                            target: this.klRootEl,
                            message: title,
                            div: filterDialog.element,
                            style: style,
                            buttons: dialogButtons,
                            clickOnEnter: 'Ok',
                            callback: (result) => {
                                finishedDialog(result as TOptions, filterDialog!);
                            },
                            closeFunc: (func) => {
                                closeFunc = func;
                            },
                        });
                    }
                };
            } else {
                button.disabled = true;
            }

            buttons.push(button);
            return button;
        };

        const addGroup = (groupArr: string[]): void => {
            Object.entries(filters).forEach(([filterKey, filter]) => {
                if (!groupArr.includes(filterKey)) {
                    return;
                }
                if (this.isEmbed && !filter.inEmbed) {
                    return;
                }
                this.rootEl.append(createButton(filterKey));
            });
        };

        const groupA = ['cropExtend', 'flip', 'perspective', 'resize', 'rotate', 'transform'];
        const groupB = [
            'brightnessContrast',
            'curves',
            'distort',
            'hueSaturation',
            'invert',
            'tiltShift',
            'toAlpha',
            'blur',
            'unsharpMask',
        ];
        const groupC = ['grid', 'noise', 'pattern', 'vanishPoint'];

        addGroup(groupA);
        this.rootEl.append(BB.el({ className: 'grid-hr' }));
        addGroup(groupB);
        this.rootEl.append(BB.el({ className: 'grid-hr' }));
        addGroup(groupC);

        this.isInit = true;
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    show(): void {
        if (!this.isInit) {
            this.init();
        }
        this.rootEl.style.display = 'block';
    }

    hide(): void {
        this.rootEl.style.display = 'none';
    }
}
