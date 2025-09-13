import { BB } from '../../../bb/bb';
import { Options } from '../components/options';
import modeSelectImg from 'url:/src/app/img/ui/select-mode-select.svg';
import modeMoveImg from 'url:/src/app/img/ui/select-mode-move.svg';
import { c } from '../../../bb/base/c';
import { TBooleanOperation, TSelectShape } from '../../select-tool/select-tool';
import defaultImSvg from 'url:/src/app/img/ui/select-default.svg';
import unionImSvg from 'url:/src/app/img/ui/select-union.svg';
import subtractImSvg from 'url:/src/app/img/ui/select-subtract.svg';
import rectSvg from 'url:/src/app/img/ui/select-shape-rect.svg';
import ellipseSvg from 'url:/src/app/img/ui/select-shape-ellipse.svg';
import lassoSvg from 'url:/src/app/img/ui/select-shape-lasso.svg';
import polySvg from 'url:/src/app/img/ui/select-shape-poly.svg';
import removeLayerImg from 'url:/src/app/img/ui/remove-layer.svg';
import { Select } from '../components/select';
import { LANG } from '../../../language/language';
import { Checkbox } from '../components/checkbox';
import { createImage } from '../../../bb/base/ui';

export type TSelectUiParams = {
    onChangeMode: (mode: TSelectToolMode) => void;
    onChangeBooleanOperation: (operation: TBooleanOperation) => void;
    canTransform: () => boolean; // return: can the current selected area be transformed
    select: {
        shape: TSelectShape; // initial value
        onChangeShape: (shape: TSelectShape) => void;
        onReset: () => void;
        onAll: () => void;
        onInvert: () => void;
    };
    transform: {
        onFlipX: () => void;
        onFlipY: () => void;
        onRotateDeg: (deg: number) => void;
        onClone: () => void;
        onMoveToLayer: (index: number) => void;
        onChangeTransparentBackground: (b: boolean) => void;
    };
    onErase: () => void;
    onFill: () => void;
};

export type TSelectToolMode = 'select' | 'transform';

/**
 * Select tool - tool tab
 */
export class SelectUi {
    private readonly onChangeMode: TSelectUiParams['onChangeMode'];
    private readonly rootEl: HTMLElement;
    private isVisible: boolean = true;
    private readonly modeOptions: Options<TSelectToolMode>;
    private hasSelection: boolean = false;
    private selectResetBtn: HTMLButtonElement;
    private transformDuplicateBtn: HTMLButtonElement;
    private moveToLayerSelect: Select<string>;
    private transparentBackgroundToggle: Checkbox;
    private operationOptions: Options<TBooleanOperation>;

    private update(): void {
        this.selectResetBtn.style.display = this.hasSelection ? 'block' : 'none';
    }

    // ----------------------------------- public -----------------------------------

    constructor(p: TSelectUiParams) {
        this.onChangeMode = p.onChangeMode;
        this.modeOptions = new Options<TSelectToolMode>({
            optionArr: [
                {
                    id: 'select',
                    label: c('', [
                        c({
                            content:
                                "<img class='dark-invert' src='" +
                                modeSelectImg +
                                "' height='20'/>" +
                                '<span>' +
                                LANG('select-select') +
                                '</span>',
                            css: {
                                display: 'flex',
                                gap: '5px',
                                alignItems: 'center',
                                height: '100%',
                                margin: '10px 4px',
                                justifyContent: 'center',
                            },
                        }),
                    ]),
                },
                {
                    id: 'transform',
                    label: c('', [
                        c({
                            content:
                                "<img class='dark-invert' src='" +
                                modeMoveImg +
                                "' height='20'/>" +
                                '<span>' +
                                LANG('select-transform') +
                                '</span>',
                            css: {
                                display: 'flex',
                                gap: '5px',
                                alignItems: 'center',
                                height: '100%',
                                margin: '10px 4px',
                                justifyContent: 'center',
                            },
                        }),
                    ]),
                },
            ],
            initId: 'select',
            onChange: (val) => {
                if (val === 'select') {
                    this.operationOptions.setValue('new');
                }
                this.onChangeMode(val);
                updateMode();
            },
            onBeforeChange: (val: TSelectToolMode) => {
                if (val === 'transform') {
                    return p.canTransform();
                }
                return true;
            },
            optionCss: {
                flexGrow: '1',
                flexBasis: '0',
            },
        });
        this.modeOptions.getElement().style.marginBottom = '10px';

        // --- select ---
        const selectModeEl = BB.el();

        const defaultIm = new Image();
        defaultIm.src = defaultImSvg;
        defaultIm.classList.add('dark-invert');
        const unionIm = new Image();
        unionIm.src = unionImSvg;
        unionIm.classList.add('dark-invert');
        const subtractIm = new Image();
        subtractIm.src = subtractImSvg;
        subtractIm.classList.add('dark-invert');

        this.operationOptions = new Options<TBooleanOperation>({
            optionArr: [
                {
                    id: 'new',
                    label: defaultIm,
                    title: LANG('select-boolean-replace'),
                },
                {
                    id: 'union',
                    label: unionIm,
                    title: LANG('select-boolean-add'),
                },
                {
                    id: 'difference',
                    label: subtractIm,
                    title: LANG('select-boolean-subtract'),
                },
            ],
            initId: 'new',
            onChange: (v) => {
                p.onChangeBooleanOperation(v);
            },
        });
        this.operationOptions.getElement().style.marginBottom = '10px';

        const imStyle = {
            width: '32px',
            height: '32px',
        };
        const rectIm = new Image();
        rectIm.src = rectSvg;
        rectIm.classList.add('dark-invert');
        BB.css(rectIm, imStyle);
        const ellipseIm = new Image();
        ellipseIm.src = ellipseSvg;
        ellipseIm.classList.add('dark-invert');
        BB.css(ellipseIm, imStyle);
        const lassoIm = new Image();
        lassoIm.src = lassoSvg;
        lassoIm.classList.add('dark-invert');
        BB.css(lassoIm, imStyle);
        const polyIm = new Image();
        polyIm.src = polySvg;
        polyIm.classList.add('dark-invert');
        BB.css(polyIm, imStyle);

        const shapeOptions = new Options<TSelectShape>({
            optionArr: [
                {
                    id: 'rect',
                    label: rectIm,
                    title: LANG('shape-rect'),
                },
                {
                    id: 'ellipse',
                    label: ellipseIm,
                    title: LANG('shape-ellipse'),
                },
                {
                    id: 'lasso',
                    label: lassoIm,
                    title: LANG('select-lasso'),
                },
                {
                    id: 'poly',
                    label: polyIm,
                    title: LANG('select-polygon'),
                },
            ],
            initId: p.select.shape,
            onChange: (val) => {
                p.select.onChangeShape(val);
            },
        });
        shapeOptions.getElement().style.marginBottom = '10px';
        selectModeEl.append(shapeOptions.getElement(), this.operationOptions.getElement());

        const actionRow = BB.el({
            parent: selectModeEl,
            css: {
                display: 'flex',
                gap: '5px',
                flexWrap: 'wrap',
            },
        });

        const selectAllBtn = BB.el({
            parent: actionRow,
            tagName: 'button',
            content: LANG('select-all'),
            onClick: () => {
                p.select.onAll();
            },
            custom: {
                tabindex: '-1',
            },
            css: {
                minHeight: '30px',
            },
        });
        const selectInvertBtn = BB.el({
            parent: actionRow,
            tagName: 'button',
            content: LANG('select-invert'),
            onClick: () => {
                p.select.onInvert();
            },
            custom: {
                tabindex: '-1',
            },
            css: {
                minHeight: '30px',
            },
        });
        this.selectResetBtn = BB.el({
            parent: actionRow,
            tagName: 'button',
            content: [
                createImage({
                    src: removeLayerImg,
                    alt: 'icon',
                    height: 20,
                    css: {
                        marginRight: '3px',
                        filter: 'invert(1)',
                    },
                }),
                LANG('select-reset'),
            ],
            className: 'kl-button kl-button-primary',
            css: {
                paddingRight: '8px',
                display: 'none',
            },
            onClick: () => {
                p.select.onReset();
            },
            custom: {
                tabindex: '-1',
            },
        });

        BB.el({
            className: 'grid-hr',
            parent: selectModeEl,
            css: { margin: '10px 0' },
        });

        const actionsWrapper = BB.el({
            parent: selectModeEl,
            css: {
                display: 'flex',
                gap: '5px',
            },
        });
        const eraseBtn = BB.el({
            parent: actionsWrapper,
            tagName: 'button',
            content: LANG('select-erase'),
            onClick: () => {
                p.onErase();
            },
            custom: {
                tabindex: '-1',
            },
        });

        const fillBtn = BB.el({
            parent: actionsWrapper,
            tagName: 'button',
            content: LANG('select-fill'),
            onClick: () => {
                p.onFill();
            },
            custom: {
                tabindex: '-1',
            },
        });

        // --- transform ---
        const transformModeEl = BB.el();
        const transformFlipXBtn = BB.el({
            tagName: 'button',
            content: LANG('filter-transform-flip') + ' X',
            className: 'kl-button',
            onClick: () => {
                p.transform.onFlipX();
            },
            custom: {
                tabindex: '-1',
            },
        });
        const transformFlipYBtn = BB.el({
            tagName: 'button',
            content: LANG('filter-transform-flip') + ' Y',
            onClick: () => {
                p.transform.onFlipY();
            },
            custom: {
                tabindex: '-1',
            },
        });
        const rotateNegativeBtn = BB.el({
            tagName: 'button',
            content: '-90°',
            onClick: () => {
                p.transform.onRotateDeg(-90);
            },
            custom: {
                tabindex: '-1',
            },
        });
        const rotatePositiveBtn = BB.el({
            tagName: 'button',
            content: '+90°',
            onClick: () => {
                p.transform.onRotateDeg(90);
            },
            custom: {
                tabindex: '-1',
            },
        });

        this.transformDuplicateBtn = BB.el({
            tagName: 'button',
            content: LANG('select-transform-clone'),
            onClick: () => {
                p.transform.onClone();
            },
            custom: {
                tabindex: '-1',
            },
        });

        const actionsRow = BB.el({
            parent: transformModeEl,
            content: [
                transformFlipXBtn,
                transformFlipYBtn,
                rotateNegativeBtn,
                rotatePositiveBtn,
                this.transformDuplicateBtn,
            ],
            css: {
                display: 'flex',
                flexWrap: 'wrap',
                gap: '5px',
            },
        });

        this.moveToLayerSelect = new Select({
            optionArr: [
                ['1', 'Layer 2'],
                ['0', 'Layer 1'],
            ],
            onChange: (val) => {
                p.transform.onMoveToLayer(+val);
            },
            name: 'move-to-layer',
            css: {
                width: '100%',
            },
        });

        transformModeEl.append(
            c(',flex,items-center,gap-5,mt-10,flexWrap', [
                LANG('select-transform-move-to-layer'),
                this.moveToLayerSelect.getElement(),
            ]),
        );

        this.transparentBackgroundToggle = new Checkbox({
            label: LANG('brush-eraser-transparent-bg'),
            callback: (b) => {
                p.transform.onChangeTransparentBackground(b);
            },
            name: 'enable-transparent-background',
        });
        BB.css(this.transparentBackgroundToggle.getElement(), {
            marginTop: '10px',
            display: 'inline-block',
        });

        transformModeEl.append(this.transparentBackgroundToggle.getElement());

        const updateMode = () => {
            if (this.modeOptions.getValue() === 'select') {
                this.rootEl.append(selectModeEl);
                transformModeEl.remove();
            } else {
                selectModeEl.remove();
                this.rootEl.append(transformModeEl);
            }
        };

        this.rootEl = BB.el({
            content: [this.modeOptions.getElement()],
            css: {
                margin: '10px',
            },
        });
        updateMode();
    }

    setIsVisible(isVisible: boolean): void {
        this.isVisible = isVisible;
        this.rootEl.style.display = this.isVisible ? 'block' : 'none';
        if (this.isVisible) {
            this.operationOptions.setValue('new');
        }
    }

    setMode(mode: TSelectToolMode): void {
        this.modeOptions.setValue(mode);
    }

    setLayers(layers: string[]): void {
        this.moveToLayerSelect.setOptionArr(
            layers
                .map((layer, index) => {
                    return ['' + index, layer] as [string, string];
                })
                .reverse(),
        );
    }

    setMoveToLayer(targetIndex: number | undefined): void {
        this.moveToLayerSelect.setValue(targetIndex === undefined ? undefined : '' + targetIndex);
    }

    setHasSelection(b: boolean): void {
        this.hasSelection = b;
        this.update();
    }

    setBackgroundIsTransparent(b: boolean): void {
        this.transparentBackgroundToggle.setValue(b);
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    destroy(): void {
        // ...
    }
}
