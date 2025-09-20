import { BB } from '../../../bb/bb';
import { KL } from '../../kl';
import { TKeyString } from '../../../bb/bb-types';
import { StatusOverlay } from '../components/status-overlay';
import { KlCanvas, TKlCanvasLayer } from '../../canvas/kl-canvas';
import { LANG } from '../../../language/language';
import { TFilterApply, TFilterGetDialogParam, TFilterGetDialogResult } from '../../kl-types';
import { KlColorSlider } from '../components/kl-color-slider';
import { LayersUi } from './layers-ui/layers-ui';
import { RGB } from '../../../bb/color/color';
import { getSharedFx } from '../../../fx-canvas/shared-fx';
import { c } from '../../../bb/base/c';
import { KlHistory } from '../../history/kl-history';
import copyImg from 'url:/src/app/img/ui/copy.svg';
import { createImage } from '../../../bb/base/ui';

export type TEditUiParams = {
    klRootEl: HTMLElement;
    klColorSlider: KlColorSlider;
    layersUi: LayersUi;
    getCurrentColor: () => RGB;
    maxCanvasSize: number;
    klCanvas: KlCanvas;
    getCurrentLayer: () => TKlCanvasLayer;
    isEmbed: boolean;
    statusOverlay: StatusOverlay;
    onCanvasChanged: () => void; // dimensions/orientation changed
    applyUncommitted: () => void;
    klHistory: KlHistory;
    onCopyToClipboard: () => void;
    onPaste: () => void;
};

export class EditUi {
    // from params
    private readonly klRootEl: HTMLElement;
    private readonly klColorSlider: KlColorSlider;
    private readonly layersUi: LayersUi;
    private readonly getCurrentColor: () => RGB;
    private readonly maxCanvasSize: number;
    private readonly klCanvas: KlCanvas;
    private readonly getCurrentLayer: () => TKlCanvasLayer;
    private readonly isEmbed: boolean;
    private readonly statusOverlay: StatusOverlay;
    private readonly onCanvasChanged: () => void; // dimensions/orientation changed
    private readonly applyUncommitted: () => void;
    private readonly klHistory: KlHistory;
    private readonly onCopyToClipboard: () => void;
    private readonly onPaste: () => void;

    private readonly rootEl: HTMLDivElement;
    private isInit = false;

    private testHasWebGL(): boolean {
        return !!getSharedFx();
    }

    private init(): void {
        const filters = KL.FILTER_LIB;
        const buttons = [];

        if (!KL.FILTER_LIB_STATUS.isLoaded) {
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

            const button = BB.el({
                tagName: 'button',
                className: 'grid-button grid-button--filter',
                content: [
                    createImage({
                        alt: 'icon',
                        src: filter.icon,
                        width: 18,
                        height: 20,
                        className: filter.darkNoInvert ? 'dark-no-invert' : '',
                        css: {
                            marginRight: '3px',
                        },
                    }),
                    LANG(filter.lang.button),
                ],
                css: {
                    lineHeight: '20px',
                    fontSize: '12px',
                },
                custom: {
                    tabIndex: '-1',
                },
            });

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
                            layer: this.getCurrentLayer(),
                            klCanvas: this.klCanvas,
                            klHistory: this.klHistory,
                            input: input,
                        } as TFilterApply);
                        if (!filterResult) {
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
                                context: this.getCurrentLayer().context,
                                klCanvas: this.klCanvas,
                                maxWidth: this.maxCanvasSize,
                                maxHeight: this.maxCanvasSize,
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
                                composed: this.klHistory.getComposed(),
                            } as TFilterGetDialogParam) as TFilterGetDialogResult;
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

                        const style: TKeyString = {};
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

        if (!this.isEmbed) {
            const copyBtn = BB.el({
                tagName: 'button',
                className: 'grid-button grid-button--filter',
                content: [
                    createImage({
                        alt: 'icon',
                        src: copyImg,
                        width: 18,
                        height: 20,
                        css: {
                            marginRight: '3px',
                        },
                    }),
                    LANG('file-copy'),
                ],
                onClick: () => this.onCopyToClipboard(),
                title: LANG('file-copy-title'),
                custom: {
                    tabIndex: '-1',
                },
                css: {
                    lineHeight: '20px',
                },
            });

            const pasteBtn = BB.el({
                tagName: 'button',
                className: 'grid-button grid-button--filter',
                content: [
                    BB.el({
                        css: {
                            height: '20px',
                            cssFloat: 'left',
                        },
                    }),
                    LANG('file-paste'),
                ],
                custom: {
                    tabIndex: '-1',
                },
                css: {
                    lineHeight: '20px',
                },
                onClick: () => this.onPaste(),
            });

            this.rootEl.append(copyBtn, pasteBtn, BB.el({ className: 'grid-hr' }));
        }
        addGroup(groupA);
        this.rootEl.append(BB.el({ className: 'grid-hr' }));
        addGroup(groupB);
        this.rootEl.append(BB.el({ className: 'grid-hr' }));
        addGroup(groupC);

        this.isInit = true;
    }

    // ----------------------------------- public -----------------------------------

    constructor(p: TEditUiParams) {
        this.klRootEl = p.klRootEl;
        this.klColorSlider = p.klColorSlider;
        this.layersUi = p.layersUi;
        this.getCurrentColor = p.getCurrentColor;
        this.maxCanvasSize = p.maxCanvasSize;
        this.klCanvas = p.klCanvas;
        this.getCurrentLayer = p.getCurrentLayer;
        this.isEmbed = p.isEmbed;
        this.statusOverlay = p.statusOverlay;
        this.onCanvasChanged = p.onCanvasChanged;
        this.applyUncommitted = p.applyUncommitted;
        this.klHistory = p.klHistory;
        this.onCopyToClipboard = p.onCopyToClipboard;
        this.onPaste = p.onPaste;

        this.rootEl = BB.el();
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
