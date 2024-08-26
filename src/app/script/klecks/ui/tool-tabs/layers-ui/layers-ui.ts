import { BB } from '../../../../bb/bb';
import { KlHistory } from '../../../history/kl-history';
import { Select } from '../../components/select';
import { PointSlider } from '../../components/point-slider';
import { KlCanvas, MAX_LAYERS } from '../../../canvas/kl-canvas';
import { TMixMode, TUiLayout } from '../../../kl-types';
import { LANG } from '../../../../language/language';
import { translateBlending } from '../../../canvas/translate-blending';
import { PointerListener } from '../../../../bb/input/pointer-listener';
import { IPointerEvent } from '../../../../bb/input/event.types';
import { renameLayerDialog } from './rename-layer-dialog';
import { mergeLayerDialog } from './merge-layer-dialog';
import { theme } from '../../../../theme/theme';
import { throwIfNull } from '../../../../bb/base/base';
import { hasPointerEvents } from '../../../../bb/base/browser';
import { c } from '../../../../bb/base/c';
import { DropdownMenu } from '../../components/dropdown-menu';
import addLayerImg from '/src/app/img/ui/add-layer.svg';
import duplicateLayerImg from '/src/app/img/ui/duplicate-layer.svg';
import mergeLayerImg from '/src/app/img/ui/merge-layers.svg';
import removeLayerImg from '/src/app/img/ui/remove-layer.svg';
import renameLayerImg from '/src/app/img/ui/rename-layer.svg';
import caretDownImg from '/src/app/img/ui/caret-down.svg';

const paddingLeft = 25;

type TLayerEl = HTMLElement & {
    label: HTMLElement;
    opacityLabel: HTMLElement;
    thumb: HTMLCanvasElement;

    spot: number;
    posY: number;
    layerName: string;
    opacity: number;
    pointerListener: PointerListener;
    opacitySlider: PointSlider;
    isSelected: boolean;
};

export type TLayersUiParams = {
    klCanvas: KlCanvas;
    onSelect: (layerIndex: number) => void;
    parentEl: HTMLElement;
    uiState: TUiLayout;
    applyUncommitted: () => void;
    history: KlHistory;
    onUpdateProject: () => void; // triggers update of easel
};

export class LayersUi {
    // from params
    private klCanvas: KlCanvas;
    private onSelect: (layerIndex: number) => void;
    private parentEl: HTMLElement;
    private uiState: TUiLayout;
    private applyUncommitted: () => void;
    private history: KlHistory;
    private onUpdateProject: () => void;

    private readonly rootEl: HTMLElement;
    private klCanvasLayerArr: {
        context: CanvasRenderingContext2D;
        opacity: number;
        name: string;
        mixModeStr: TMixMode;
    }[];
    private readonly layerListEl: HTMLElement;
    private layerElArr: TLayerEl[];
    private selectedSpotIndex: number;
    private readonly removeBtn: HTMLButtonElement;
    private readonly addBtn: HTMLButtonElement;
    private readonly duplicateBtn: HTMLButtonElement;
    private readonly mergeBtn: HTMLButtonElement;
    private readonly moreDropdown: DropdownMenu;
    private readonly modeSelect: Select<TMixMode>;
    private readonly largeThumbDiv: HTMLElement;
    private oldHistoryState: number | undefined;

    private readonly largeThumbCanvas: HTMLCanvasElement;
    private largeThumbInDocument: boolean;
    private largeThumbInTimeout: undefined | ReturnType<typeof setTimeout>;
    private largeThumbTimeout: undefined | ReturnType<typeof setTimeout>;
    private lastpos: number = 0;

    private readonly layerHeight: number = 35;
    private readonly layerSpacing: number = 0;

    private move(oldSpotIndex: number, newSpotIndex: number): void {
        if (isNaN(oldSpotIndex) || isNaN(newSpotIndex)) {
            throw 'layers-ui - invalid move';
        }
        for (let i = 0; i < this.klCanvasLayerArr.length; i++) {
            ((i) => {
                let posy = this.layerElArr[i].spot; // <- here
                if (this.layerElArr[i].spot === oldSpotIndex) {
                    posy = newSpotIndex;
                } else {
                    if (this.layerElArr[i].spot > oldSpotIndex) {
                        posy--;
                    }
                    if (posy >= newSpotIndex) {
                        posy++;
                    }
                }
                this.layerElArr[i].spot = posy;
                this.layerElArr[i].posY =
                    (this.layerHeight + this.layerSpacing) *
                    (this.klCanvasLayerArr.length - posy - 1);
                this.layerElArr[i].style.top = this.layerElArr[i].posY + 'px';
            })(i);
        }
        if (oldSpotIndex === newSpotIndex) {
            return;
        }
        this.klCanvas.moveLayer(this.selectedSpotIndex, newSpotIndex - oldSpotIndex);
        this.klCanvasLayerArr = this.klCanvas.getLayers();
        this.selectedSpotIndex = newSpotIndex;
        this.mergeBtn.disabled = this.selectedSpotIndex === 0;
    }

    private posToSpot(p: number): number {
        let result = parseInt('' + (p / (this.layerHeight + this.layerSpacing) + 0.5));
        result = Math.min(this.klCanvasLayerArr.length - 1, Math.max(0, result));
        result = this.klCanvasLayerArr.length - result - 1;
        return result;
    }

    /**
     * update css position of all layers that are not being dragged, while dragging
     */
    private updateLayersVerticalPosition(id: number, newspot: number): void {
        newspot = Math.min(this.klCanvasLayerArr.length - 1, Math.max(0, newspot));
        if (newspot === this.lastpos) {
            return;
        }
        for (let i = 0; i < this.klCanvasLayerArr.length; i++) {
            if (this.layerElArr[i].spot === id) {
                // <- here
                continue;
            }
            let posy = this.layerElArr[i].spot;
            if (this.layerElArr[i].spot > id) {
                posy--;
            }
            if (posy >= newspot) {
                posy++;
            }
            this.layerElArr[i].posY =
                (this.layerHeight + this.layerSpacing) * (this.klCanvasLayerArr.length - posy - 1);
            this.layerElArr[i].style.top = this.layerElArr[i].posY + 'px';
        }
        this.lastpos = newspot;
    }

    private renameLayer(layerSpot: number): void {
        renameLayerDialog(this.parentEl, this.klCanvas.getLayer(layerSpot)!.name, (newName) => {
            if (newName === undefined || newName === this.klCanvas.getLayer(layerSpot)!.name) {
                return;
            }
            this.klCanvas.renameLayer(layerSpot, newName);
            this.createLayerList();
            this.history.pause(true);
            this.onSelect(layerSpot);
            this.history.pause(false);
        });
    }

    private updateHeight(): void {
        this.layerListEl.style.height = this.layerElArr.length * 35 + 'px';
    }

    private createLayerList(): void {
        this.oldHistoryState = this.history.getChangeCount();
        this.klCanvasLayerArr = this.klCanvas.getLayers();
        const checkerImUrl = BB.createCheckerDataUrl(4, undefined, theme.isDark());

        const createLayerEntry = (index: number): void => {
            const klLayer = throwIfNull(this.klCanvas.getLayer(index));
            const layerName = klLayer.name;
            const opacity = this.klCanvasLayerArr[index].opacity;
            const isVisible = klLayer.isVisible;
            const layercanvas = this.klCanvasLayerArr[index].context.canvas;

            const layer: TLayerEl = BB.el({
                className: 'kl-layer',
            }) as HTMLElement as TLayerEl;
            this.layerElArr[index] = layer;
            layer.posY = (this.klCanvasLayerArr.length - 1) * 35 - index * 35;
            BB.css(layer, {
                top: layer.posY + 'px',
            });
            const innerLayer = BB.el();
            BB.css(innerLayer, {
                position: 'relative',
            });

            const container1 = BB.el();
            BB.css(container1, {
                width: '270px',
                height: '34px',
            });
            const container2 = BB.el();
            layer.append(innerLayer);
            innerLayer.append(container1, container2);

            layer.spot = index;

            //checkbox - visibility
            {
                const checkWrapper = BB.el({
                    tagName: 'label',
                    parent: container1,
                    title: LANG('layers-visibility-toggle'),
                    css: {
                        display: 'flex',
                        width: '25px',
                        height: '100%',
                        justifyContent: 'right',
                        alignItems: 'center',
                        cursor: 'pointer',
                    },
                });
                const check = BB.el({
                    tagName: 'input',
                    parent: checkWrapper,
                    custom: {
                        type: 'checkbox',
                        tabindex: '-1',
                    },
                    css: {
                        display: 'block',
                        cursor: 'pointer',
                        margin: '0',
                        marginRight: '5px',
                    },
                });
                check.checked = isVisible;
                check.onchange = () => {
                    this.klCanvas.setLayerIsVisible(layer.spot, check.checked);
                    this.createLayerList();
                    if (layer.spot === this.selectedSpotIndex) {
                        this.history.pause(true);
                        this.onSelect(this.selectedSpotIndex);
                        this.history.pause(false);
                    }
                };
                // prevent layer getting dragged
                const preventFunc = (e: PointerEvent | MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                };
                if (hasPointerEvents) {
                    checkWrapper.onpointerdown = preventFunc;
                } else {
                    checkWrapper.onmousedown = preventFunc;
                }
            }

            //thumb
            {
                const thumbDimensions = BB.fitInto(
                    layercanvas.width,
                    layercanvas.height,
                    30,
                    30,
                    1,
                );
                layer.thumb = BB.canvas(thumbDimensions.width, thumbDimensions.height);

                const thc = BB.ctx(layer.thumb);
                thc.save();
                if (layer.thumb.width > layercanvas.width) {
                    thc.imageSmoothingEnabled = false;
                }
                thc.drawImage(layercanvas, 0, 0, layer.thumb.width, layer.thumb.height);
                thc.restore();
                BB.css(layer.thumb, {
                    position: 'absolute',
                    left: (32 - layer.thumb.width) / 2 + paddingLeft + 'px',
                    top: (32 - layer.thumb.height) / 2 + 1 + 'px',
                });
                layer.thumb.style.backgroundImage = 'url(' + checkerImUrl + ')';
            }

            //layerlabel
            {
                layer.label = BB.el({
                    className: 'kl-layer__label',
                });
                layer.layerName = layerName;
                layer.label.append(layer.layerName);

                BB.css(layer.label, {
                    position: 'absolute',
                    left: 1 + 32 + 5 + paddingLeft + 'px',
                    top: 1 + 'px',
                    fontSize: '13px',
                    width: '170px',
                    height: '20px',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                });

                layer.label.ondblclick = () => {
                    this.applyUncommitted();
                    this.renameLayer(layer.spot);
                };
            }
            //layer label opacity
            {
                layer.opacityLabel = BB.el({
                    className: 'kl-layer__opacity-label',
                });
                layer.opacity = opacity;
                layer.opacityLabel.append(parseInt('' + layer.opacity * 100) + '%');

                BB.css(layer.opacityLabel, {
                    position: 'absolute',
                    left: 250 - 1 - 5 - 50 - 5 + paddingLeft + 'px',
                    top: 1 + 'px',
                    fontSize: '13px',
                    textAlign: 'right',
                    width: '50px',
                    transition: 'color 0.2s ease-in-out',
                    textDecoration: isVisible ? undefined : 'line-through',
                });
            }

            let oldOpacity: number;
            const opacitySlider = new PointSlider({
                init: layer.opacity,
                width: 200,
                pointSize: 14,
                callback: (sliderValue, isFirst, isLast) => {
                    if (isFirst) {
                        oldOpacity = this.klCanvas.getLayer(layer.spot)!.opacity;
                        this.history.pause(true);
                        return;
                    }
                    if (isLast) {
                        this.history.pause(false);
                        if (oldOpacity !== sliderValue) {
                            this.klCanvas.layerOpacity(layer.spot, sliderValue);
                        }
                        return;
                    }
                    layer.opacityLabel.innerHTML = Math.round(sliderValue * 100) + '%';
                    this.klCanvas.layerOpacity(layer.spot, sliderValue);
                    this.onUpdateProject();
                },
            });
            BB.css(opacitySlider.getEl(), {
                position: 'absolute',
                left: 39 + paddingLeft + 'px',
                top: '17px',
            });
            layer.opacitySlider = opacitySlider;

            //larger layer preview - hover
            layer.thumb.onpointerover = (e) => {
                if (e.buttons !== 0 && (!e.pointerType || e.pointerType !== 'touch')) {
                    //shouldn't show while dragging
                    return;
                }

                const thumbDimensions = BB.fitInto(
                    layercanvas.width,
                    layercanvas.height,
                    250,
                    250,
                    1,
                );

                if (
                    this.largeThumbCanvas.width !== thumbDimensions.width ||
                    this.largeThumbCanvas.height !== thumbDimensions.height
                ) {
                    this.largeThumbCanvas.width = thumbDimensions.width;
                    this.largeThumbCanvas.height = thumbDimensions.height;
                }
                const ctx = BB.ctx(this.largeThumbCanvas);
                ctx.save();
                if (this.largeThumbCanvas.width > layercanvas.width) {
                    ctx.imageSmoothingEnabled = false;
                }
                ctx.imageSmoothingQuality = 'high';
                ctx.clearRect(0, 0, this.largeThumbCanvas.width, this.largeThumbCanvas.height);
                ctx.drawImage(
                    layercanvas,
                    0,
                    0,
                    this.largeThumbCanvas.width,
                    this.largeThumbCanvas.height,
                );
                ctx.restore();
                BB.css(this.largeThumbDiv, {
                    top: e.clientY - this.largeThumbCanvas.height / 2 + 'px',
                    opacity: '0',
                });
                if (!this.largeThumbInDocument) {
                    document.body.append(this.largeThumbDiv);
                    this.largeThumbInDocument = true;
                }
                clearTimeout(this.largeThumbInTimeout);
                this.largeThumbInTimeout = setTimeout(() => {
                    BB.css(this.largeThumbDiv, {
                        opacity: '1',
                    });
                }, 20);
                clearTimeout(this.largeThumbTimeout);
            };
            layer.thumb.onpointerout = () => {
                clearTimeout(this.largeThumbInTimeout);
                BB.css(this.largeThumbDiv, {
                    opacity: '0',
                });
                clearTimeout(this.largeThumbTimeout);
                this.largeThumbTimeout = setTimeout(() => {
                    if (!this.largeThumbInDocument) {
                        return;
                    }
                    this.largeThumbDiv.remove();
                    this.largeThumbInDocument = false;
                }, 300);
            };

            container1.append(layer.thumb, layer.label, layer.opacityLabel, opacitySlider.getEl());
            let dragstart = false;
            let freshSelection = false;

            //events for moving layers up and down
            const dragEventHandler = (event: IPointerEvent) => {
                if (event.type === 'pointerdown' && event.button === 'left') {
                    this.applyUncommitted();
                    BB.css(layer, {
                        transition: 'box-shadow 0.3s ease-in-out',
                    });
                    layer.style.zIndex = '1';
                    this.lastpos = layer.spot;
                    freshSelection = false;
                    if (!layer.isSelected) {
                        freshSelection = true;
                        this.activateLayer(layer.spot);
                    }
                    dragstart = true;
                } else if (event.type === 'pointermove' && event.button === 'left') {
                    if (dragstart) {
                        dragstart = false;
                        BB.css(layer, {
                            boxShadow: '1px 3px 5px rgba(0,0,0,0.4)',
                        });
                    }
                    layer.posY += event.dY;
                    const corrected = Math.max(
                        0,
                        Math.min((this.klCanvasLayerArr.length - 1) * 35, layer.posY),
                    );
                    layer.style.top = corrected + 'px';
                    this.updateLayersVerticalPosition(layer.spot, this.posToSpot(layer.posY));
                }
                if (event.type === 'pointerup') {
                    BB.css(layer, {
                        transition: 'all 0.1s linear',
                    });
                    setTimeout(() => {
                        BB.css(layer, {
                            boxShadow: '',
                        });
                    }, 20);
                    layer.posY = Math.max(
                        0,
                        Math.min((this.klCanvasLayerArr.length - 1) * 35, layer.posY),
                    );
                    layer.style.zIndex = '';
                    const newSpot = this.posToSpot(layer.posY);
                    const oldSpot = layer.spot;
                    this.move(layer.spot, newSpot);
                    if (oldSpot != newSpot) {
                        this.history.pause(true);
                        this.onSelect(this.selectedSpotIndex);
                        this.history.pause(false);
                    }
                    if (oldSpot === newSpot && freshSelection) {
                        this.onSelect(this.selectedSpotIndex);
                    }
                    freshSelection = false;
                }
            };

            layer.pointerListener = new BB.PointerListener({
                target: container1,
                onPointer: dragEventHandler,
            });

            this.layerListEl.append(layer);
        };
        this.layerElArr = [];
        while (this.layerListEl.firstChild) {
            const child = this.layerListEl.firstChild as TLayerEl;
            child.pointerListener.destroy();
            child.opacitySlider.destroy();
            child.remove();
        }
        for (let i = 0; i < this.klCanvasLayerArr.length; i++) {
            createLayerEntry(i);
        }
        this.activateLayer(this.selectedSpotIndex);
        this.updateHeight();
    }

    private updateButtons(): void {
        const maxReached = this.klCanvasLayerArr.length === MAX_LAYERS;
        const oneLayer = this.klCanvasLayerArr.length === 1;

        this.addBtn.disabled = maxReached;
        this.removeBtn.disabled = oneLayer;
        this.duplicateBtn.disabled = maxReached;
        this.mergeBtn.disabled = this.selectedSpotIndex === 0;
        this.moreDropdown.setEnabled('merge-all', !oneLayer);
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: TLayersUiParams) {
        this.klCanvas = p.klCanvas;
        this.onSelect = p.onSelect;
        this.parentEl = p.parentEl;
        this.uiState = p.uiState;
        this.applyUncommitted = p.applyUncommitted;
        this.history = p.history;
        this.onUpdateProject = p.onUpdateProject;

        this.layerElArr = [];
        this.layerHeight = 35;
        this.layerSpacing = 0;
        const width = 270;

        this.largeThumbDiv = BB.el({
            onClick: BB.handleClick,
            css: {
                position: 'absolute',
                top: '500px',
                background: '#aaa',
                boxShadow: '1px 1px 3px rgba(0,0,0,0.3)',
                pointerEvents: 'none',
                padding: '0',
                border: '1px solid #aaa',
                transition: 'opacity 0.3s ease-out',
                userSelect: 'none',
            },
        });
        this.setUiState(this.uiState);
        BB.createCheckerDataUrl(
            4,
            (url) => {
                this.largeThumbDiv.style.backgroundImage = 'url(' + url + ')';
            },
            theme.isDark(),
        );
        this.largeThumbCanvas = BB.canvas(200, 200);
        this.largeThumbCanvas.style.display = 'block';
        this.largeThumbDiv.append(this.largeThumbCanvas);
        this.largeThumbInDocument = false;

        this.klCanvasLayerArr = this.klCanvas.getLayers();
        this.selectedSpotIndex = this.klCanvasLayerArr.length - 1;
        this.rootEl = BB.el({
            css: {
                marginRight: '10px',
                marginBottom: '10px',
                marginLeft: '10px',
                marginTop: '10px',
                cursor: 'default',
            },
        });

        const listDiv = BB.el({
            css: {
                width: width + 'px',
                position: 'relative',
                margin: '0 -10px',
                zIndex: '0',
            },
        });

        this.layerListEl = BB.el({
            parent: listDiv,
        });

        this.addBtn = BB.el({ tagName: 'button' });
        this.duplicateBtn = BB.el({ tagName: 'button' });
        this.mergeBtn = BB.el({ tagName: 'button' });
        this.removeBtn = BB.el({ tagName: 'button' });
        const renameBtn = BB.el({ tagName: 'button' });
        this.moreDropdown = new DropdownMenu({
            button: BB.el({
                content: `<img src="${caretDownImg}" width="13"/>`,
                css: {
                    display: 'flex',
                    justifyContent: 'center',
                    opacity: '0.9',
                },
            }),
            buttonTitle: LANG('more'),
            items: [['merge-all', LANG('layers-merge-all')]],
            onItemClick: (id) => {
                if (id === 'merge-all') {
                    this.applyUncommitted();
                    const newIndex = this.klCanvas.mergeAll();
                    if (newIndex === false) {
                        return;
                    }
                    this.klCanvasLayerArr = this.klCanvas.getLayers();
                    this.selectedSpotIndex = newIndex;

                    this.createLayerList();
                    this.history.pause(true);
                    this.onSelect(this.selectedSpotIndex);
                    this.history.pause(false);

                    this.updateButtons();
                }
            },
        });

        this.updateButtons();

        const createButtons = () => {
            const div = BB.el();
            const async = () => {
                BB.makeUnfocusable(this.addBtn);
                BB.makeUnfocusable(this.duplicateBtn);
                BB.makeUnfocusable(this.mergeBtn);
                BB.makeUnfocusable(this.removeBtn);
                BB.makeUnfocusable(renameBtn);

                this.addBtn.style.cssFloat = 'left';
                this.duplicateBtn.style.cssFloat = 'left';
                this.mergeBtn.style.cssFloat = 'left';
                this.removeBtn.style.cssFloat = 'left';
                renameBtn.style.cssFloat = 'left';

                this.addBtn.title = LANG('layers-new');
                this.duplicateBtn.title = LANG('layers-duplicate');
                this.removeBtn.title = LANG('layers-remove');
                this.mergeBtn.title = LANG('layers-merge');
                renameBtn.title = LANG('layers-rename-title');

                this.addBtn.style.paddingLeft = '5px';
                this.addBtn.style.paddingRight = '3px';

                this.removeBtn.style.paddingLeft = '5px';
                this.removeBtn.style.paddingRight = '3px';

                this.duplicateBtn.style.paddingLeft = '5px';
                this.duplicateBtn.style.paddingRight = '3px';

                this.mergeBtn.style.paddingLeft = '5px';
                this.mergeBtn.style.paddingRight = '3px';

                renameBtn.style.height = '30px';
                renameBtn.style.lineHeight = '20px';

                this.addBtn.innerHTML = "<img src='" + addLayerImg + "' height='20'/>";
                this.duplicateBtn.innerHTML = "<img src='" + duplicateLayerImg + "' height='20'/>";
                this.mergeBtn.innerHTML = "<img src='" + mergeLayerImg + "' height='20'/>";
                this.removeBtn.innerHTML = "<img src='" + removeLayerImg + "' height='20'/>";
                renameBtn.innerHTML = "<img src='" + renameLayerImg + "' height='20'/>";
                div.append(
                    c(',flex,gap-5,mb-10', [
                        this.addBtn,
                        this.removeBtn,
                        this.duplicateBtn,
                        this.mergeBtn,
                        renameBtn,
                        c(',grow-1'),
                        this.moreDropdown.getElement(),
                    ]),
                );

                this.addBtn.onclick = () => {
                    this.applyUncommitted();
                    if (this.klCanvas.addLayer(this.selectedSpotIndex) === false) {
                        return;
                    }
                    this.klCanvasLayerArr = this.klCanvas.getLayers();

                    this.selectedSpotIndex = this.selectedSpotIndex + 1;
                    this.createLayerList();
                    this.history.pause(true);
                    this.onSelect(this.selectedSpotIndex);
                    this.history.pause(false);

                    this.updateButtons();
                };
                this.duplicateBtn.onclick = () => {
                    this.applyUncommitted();
                    if (this.klCanvas.duplicateLayer(this.selectedSpotIndex) === false) {
                        return;
                    }
                    this.klCanvasLayerArr = this.klCanvas.getLayers();

                    this.selectedSpotIndex++;
                    this.createLayerList();
                    this.history.pause(true);
                    this.onSelect(this.selectedSpotIndex);
                    this.history.pause(false);

                    this.updateButtons();
                };
                this.removeBtn.onclick = () => {
                    this.applyUncommitted();
                    if (this.layerElArr.length <= 1) {
                        return;
                    }

                    this.klCanvas.removeLayer(this.selectedSpotIndex);
                    if (this.selectedSpotIndex > 0) {
                        this.selectedSpotIndex--;
                    }
                    this.klCanvasLayerArr = this.klCanvas.getLayers();
                    this.createLayerList();
                    this.history.pause(true);
                    this.onSelect(this.selectedSpotIndex);
                    this.history.pause(false);

                    this.updateButtons();
                };
                this.mergeBtn.onclick = () => {
                    this.applyUncommitted();
                    if (this.selectedSpotIndex <= 0) {
                        return;
                    }
                    mergeLayerDialog(this.parentEl, {
                        topCanvas: this.klCanvasLayerArr[this.selectedSpotIndex].context.canvas,
                        bottomCanvas:
                            this.klCanvasLayerArr[this.selectedSpotIndex - 1].context.canvas,
                        topOpacity: this.klCanvas.getLayer(this.selectedSpotIndex)!.opacity,
                        mixModeStr: this.klCanvasLayerArr[this.selectedSpotIndex].mixModeStr,
                        callback: (mode) => {
                            this.klCanvas.mergeLayers(
                                this.selectedSpotIndex,
                                this.selectedSpotIndex - 1,
                                mode as TMixMode | 'as-alpha',
                            );
                            this.klCanvasLayerArr = this.klCanvas.getLayers();
                            this.selectedSpotIndex--;

                            this.createLayerList();
                            this.history.pause(true);
                            this.onSelect(this.selectedSpotIndex);
                            this.history.pause(false);

                            this.updateButtons();
                        },
                    });
                };

                renameBtn.onclick = () => {
                    this.applyUncommitted();
                    this.renameLayer(this.selectedSpotIndex);
                };
            };
            setTimeout(async, 1);
            return div;
        };
        this.rootEl.append(createButtons());

        let modeWrapper;
        {
            modeWrapper = BB.el({
                content: LANG('layers-blending') + '&nbsp;',
                css: {
                    fontSize: '15px',
                },
            });

            this.modeSelect = new Select<TMixMode>({
                optionArr: [
                    'source-over',
                    undefined,
                    'darken',
                    'multiply',
                    'color-burn',
                    undefined,
                    'lighten',
                    'screen',
                    'color-dodge',
                    undefined,
                    'overlay',
                    'soft-light',
                    'hard-light',
                    undefined,
                    'difference',
                    'exclusion',
                    undefined,
                    'hue',
                    'saturation',
                    'color',
                    'luminosity',
                ].map((item: any) => {
                    return item ? [item, translateBlending(item)] : undefined;
                }),
                onChange: (val) => {
                    this.klCanvas.setMixMode(this.selectedSpotIndex, val as TMixMode);
                    this.update(this.selectedSpotIndex);
                },
                css: {
                    marginBottom: '10px',
                },
            });

            modeWrapper.append(this.modeSelect.getElement());
            this.rootEl.append(modeWrapper);
        }

        this.rootEl.append(listDiv);

        //updating the thumbs in interval
        //don't update when: manager not visible || layer didn't change || is drawing
        setInterval(() => {
            if (this.rootEl.style.display !== 'block') {
                return;
            }

            const historyState = this.history.getChangeCount();
            if (historyState === this.oldHistoryState) {
                return;
            }
            this.oldHistoryState = historyState;

            for (let i = 0; i < this.layerElArr.length; i++) {
                if (
                    this.selectedSpotIndex === this.layerElArr[i].spot &&
                    this.klCanvasLayerArr[this.layerElArr[i].spot]
                ) {
                    // second check, because might be out of date
                    const ctx = BB.ctx(this.layerElArr[i].thumb);
                    ctx.save();
                    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                    if (
                        this.klCanvasLayerArr[this.layerElArr[i].spot].context.canvas.width <
                        this.layerElArr[i].thumb.width
                    ) {
                        ctx.imageSmoothingEnabled = false;
                    }
                    ctx.drawImage(
                        this.klCanvasLayerArr[this.layerElArr[i].spot].context.canvas,
                        0,
                        0,
                        this.layerElArr[i].thumb.width,
                        this.layerElArr[i].thumb.height,
                    );
                    ctx.restore();
                }
            }
        }, 1);

        theme.addIsDarkListener(() => {
            this.createLayerList();
        });

        this.createLayerList();
    }

    // ---- interface ----
    update(activeLayerSpotIndex?: number): void {
        this.klCanvasLayerArr = this.klCanvas.getLayers();
        if (activeLayerSpotIndex || activeLayerSpotIndex === 0) {
            this.selectedSpotIndex = activeLayerSpotIndex;
        }
        this.updateButtons();
        setTimeout(() => this.createLayerList(), 1);
    }

    getSelected(): number {
        return this.selectedSpotIndex;
    }

    activateLayer(spotIndex: number): void {
        if (spotIndex < 0 || spotIndex > this.layerElArr.length - 1) {
            throw (
                'invalid spotIndex ' + spotIndex + ', layerElArr.length ' + this.layerElArr.length
            );
        }
        this.selectedSpotIndex = spotIndex;
        this.modeSelect.setValue(this.klCanvasLayerArr[this.selectedSpotIndex].mixModeStr);
        for (let i = 0; i < this.layerElArr.length; i++) {
            const layer = this.layerElArr[i];
            const isSelected = this.selectedSpotIndex === layer.spot;

            BB.css(layer, {
                boxShadow: '',
            });
            layer.classList.toggle('kl-layer--selected', isSelected);
            layer.opacitySlider.setActive(isSelected);
            layer.isSelected = isSelected;
        }
        this.mergeBtn.disabled = this.selectedSpotIndex === 0;
    }

    setUiState(stateStr: TUiLayout): void {
        this.uiState = stateStr;

        if (this.uiState === 'left') {
            BB.css(this.largeThumbDiv, {
                left: '280px',
                right: '',
            });
        } else {
            BB.css(this.largeThumbDiv, {
                left: '',
                right: '280px',
            });
        }
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }
}
