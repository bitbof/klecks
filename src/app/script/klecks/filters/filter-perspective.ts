import {BB} from '../../bb/bb';
import {KlCanvasPreview} from '../canvas-ui/canvas-preview';
import {getSharedFx} from '../../fx-canvas/shared-fx';
import {IFilterApply, IFilterGetDialogParam, IFilterGetDialogResult, IKlBasicLayer} from '../kl-types';
import {LANG} from '../../language/language';
import {TwoTabs} from '../ui/components/two-tabs';
import {TRectanglePoints} from '../../fx-canvas/filters/perspective';
import {TFilterHistoryEntry} from './filters';
import {PointerListener} from '../../bb/input/pointer-listener';
import {IVector2D} from '../../bb/bb-types';
import {throwIfNull} from '../../bb/base/base';

export type TFilterPerspectiveInput = {
    before: TRectanglePoints;
    after: TRectanglePoints;
};

export type TFilterPerspectiveHistoryEntry = TFilterHistoryEntry<
    'perspective',
    TFilterPerspectiveInput>;

type TDraggable = HTMLDivElement & {
    x: number;
    y: number;
    copy: (p: IVector2D) => void;
};

export const filterPerspective = {

    getDialog (params: IFilterGetDialogParam) {
        const context = params.context;
        const klCanvas = params.klCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        const isSmall = window.innerWidth < 550;
        const layers = klCanvas.getLayers();
        const selectedLayerIndex = klCanvas.getLayerIndex(context.canvas);

        const fit = BB.fitInto(context.canvas.width, context.canvas.height, isSmall ? 280 : 490, isSmall ? 200 : 240, 1);
        const displayW = parseInt('' + fit.width), displayH = parseInt('' + fit.height);
        const w = Math.min(displayW, context.canvas.width);
        const h = Math.min(displayH, context.canvas.height);

        const tempCanvas = BB.canvas(w, h);
        {
            const ctx = BB.ctx(tempCanvas);
            ctx.save();
            if (w > context.canvas.width) {
                ctx.imageSmoothingEnabled = false;
            }
            ctx.drawImage(context.canvas, 0, 0, w, h);
            ctx.restore();
        }
        const displayPreviewFactor = displayW / context.canvas.width;

        const div = document.createElement('div');
        const result: IFilterGetDialogResult<TFilterPerspectiveInput> = {
            element: div,
        };
        if (!isSmall) {
            result.width = 540;
        }

        const pointerListenerArr: PointerListener[] = [];

        function finishInit (): void {
            div.innerHTML = LANG('filter-perspective-description') + '<br/><br/>';

            const fxCanvas = throwIfNull(getSharedFx());
            const texture = fxCanvas.texture(tempCanvas);
            fxCanvas.draw(texture).update(); // update fxCanvas size
            function update (): void {
                try {
                    fxCanvas.draw(texture).multiplyAlpha().perspective(
                        [ba.x, ba.y, bb.x, bb.y, bc.x, bc.y, bd.x, bd.y].map((item, i) => {
                            if (i % 2 === 0) {
                                return item / displayW * w;
                            } else {
                                return item / displayH * h;
                            }
                        }) as TRectanglePoints,
                        [aa.x, aa.y, ab.x, ab.y, ac.x, ac.y, ad.x, ad.y].map((item, i) => {
                            if (i % 2 === 0) {
                                return item / displayW * w;
                            } else {
                                return item / displayH * h;
                            }
                        }) as TRectanglePoints
                    ).unmultiplyAlpha().update();
                    klCanvasPreview.render();
                } catch(e) {
                    (div as any).errorCallback(e);
                }
            }

            function createDraggable (x: number, y: number, callback?: () => void): TDraggable {
                const size = 14;
                const div = document.createElement('div') as TDraggable;
                div.x = x;
                div.y = y;
                BB.css(div, {
                    width: size + 'px',
                    height: size + 'px',
                    backgroundColor: '#fff',
                    boxShadow: 'inset 0 0 0 2px #000',
                    borderRadius: size + 'px',
                    position: 'absolute',
                    cursor: 'move',
                    left: (div.x - size / 2) + 'px',
                    top: (div.y - size / 2) + 'px',
                    userSelect: 'none',
                    touchAction: 'none',
                });

                const pointerListener = new BB.PointerListener({
                    target: div,
                    onPointer: function (event) {
                        event.eventPreventDefault();
                        if (event.button === 'left' && event.type === 'pointermove') {
                            div.x += event.dX;
                            div.y += event.dY;
                            div.style.left = (div.x - size / 2) + 'px';
                            div.style.top = (div.y - size / 2) + 'px';
                            if (callback) {
                                callback();
                            }
                            update();
                        }
                    },
                });
                div.copy = function (p) {
                    div.x = p.x;
                    div.y = p.y;
                    div.style.left = (div.x - size / 2) + 'px';
                    div.style.top = (div.y - size / 2) + 'px';
                };
                pointerListenerArr.push(pointerListener);
                return div;
            }

            function updateAfter () {
                aa.copy(ba);
                ab.copy(bb);
                ac.copy(bc);
                ad.copy(bd);
            }

            // b - before
            const ba = createDraggable(0, 0, updateAfter);
            const bb = createDraggable(displayW, 0, updateAfter);
            const bc = createDraggable(displayW, displayH, updateAfter);
            const bd = createDraggable(0, displayH, updateAfter);
            // a - after
            const aa = createDraggable(0, 0);
            const ab = createDraggable(displayW, 0);
            const ac = createDraggable(displayW, displayH);
            const ad = createDraggable(0, displayH);

            let before = false;

            const beforeAfterTabs = new TwoTabs({
                left: LANG('compare-before'),
                right: LANG('compare-after'),
                init: 1,
                onChange: (val: number) => {
                    before = val === 0;
                    if (before) {
                        aa.style.display = 'none';
                        ab.style.display = 'none';
                        ac.style.display = 'none';
                        ad.style.display = 'none';

                        ba.style.display = 'block';
                        bb.style.display = 'block';
                        bc.style.display = 'block';
                        bd.style.display = 'block';
                        ba.copy(aa);
                        bb.copy(ab);
                        bc.copy(ac);
                        bd.copy(ad);
                    } else {
                        ba.style.display = 'none';
                        bb.style.display = 'none';
                        bc.style.display = 'none';
                        bd.style.display = 'none';

                        aa.style.display = 'block';
                        ab.style.display = 'block';
                        ac.style.display = 'block';
                        ad.style.display = 'block';
                        aa.copy(ba);
                        ab.copy(bb);
                        ac.copy(bc);
                        ad.copy(bd);
                    }
                    update();
                },
            });
            div.append(beforeAfterTabs.getElement());

            const previewWrapper = BB.el({
                className: 'kl-preview-wrapper',
                css: {
                    width: isSmall ? '340px' : '540px',
                    height: isSmall ? '260px' : '300px',
                    marginTop: '0',
                },
            });
            previewWrapper.oncontextmenu = function () {
                return false;
            };

            const previewLayerArr: IKlBasicLayer[] = [];
            {
                for (let i = 0; i < layers.length; i++) {
                    const canvas = i === selectedLayerIndex ? fxCanvas : layers[i].context.canvas;
                    previewLayerArr.push({
                        image: canvas,
                        isVisible: layers[i].isVisible,
                        opacity: layers[i].opacity,
                        mixModeStr: layers[i].mixModeStr,
                    });
                }
            }
            const klCanvasPreview = new KlCanvasPreview({
                width: parseInt('' + displayW),
                height: parseInt('' + displayH),
                layers: previewLayerArr,
            });

            const previewInnerWrapper = BB.el({
                className: 'kl-preview-wrapper__canvas',
                css: {
                    width: parseInt('' + displayW) + 'px',
                    height: parseInt('' + displayH) + 'px',
                },
            });
            previewInnerWrapper.append(klCanvasPreview.getElement());
            previewWrapper.append(previewInnerWrapper);

            previewInnerWrapper.append(aa, ab, ac, ad);

            ba.style.display = 'none';
            bb.style.display = 'none';
            bc.style.display = 'none';
            bd.style.display = 'none';
            previewInnerWrapper.append(ba, bb, bc, bd);


            div.append(previewWrapper);
            update();
            result.destroy = (): void => {
                for (let i = 0; i < pointerListenerArr.length; i++) {
                    pointerListenerArr[i].destroy();
                }
                texture.destroy();
                klCanvasPreview.destroy();
            };
            result.getInput = function (): TFilterPerspectiveInput {
                result.destroy!();
                return {
                    before: [
                        ba.x / displayPreviewFactor,
                        ba.y / displayPreviewFactor,

                        bb.x / displayPreviewFactor,
                        bb.y / displayPreviewFactor,

                        bc.x / displayPreviewFactor,
                        bc.y / displayPreviewFactor,

                        bd.x / displayPreviewFactor,
                        bd.y / displayPreviewFactor,
                    ],
                    after: [
                        aa.x / displayPreviewFactor,
                        aa.y / displayPreviewFactor,

                        ab.x / displayPreviewFactor,
                        ab.y / displayPreviewFactor,

                        ac.x / displayPreviewFactor,
                        ac.y / displayPreviewFactor,

                        ad.x / displayPreviewFactor,
                        ad.y / displayPreviewFactor,
                    ],
                };
            };
        }

        setTimeout(finishInit, 1);

        return result;
    },

    apply (params: IFilterApply<TFilterPerspectiveInput>): boolean {
        const context = params.context;
        const history = params.history;
        const before = params.input.before;
        const after = params.input.after;
        if (!context || !before || !after || !history) {
            return false;
        }
        history.pause(true);
        const fxCanvas = getSharedFx();
        if (!fxCanvas) {
            return false; // todo more specific error?
        }
        const texture = fxCanvas.texture(context.canvas);
        fxCanvas.draw(texture).multiplyAlpha().perspective(before, after).unmultiplyAlpha().update();
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        context.drawImage(fxCanvas, 0, 0);
        texture.destroy();
        history.pause(false);
        history.push({
            tool: ['filter', 'perspective'],
            action: 'apply',
            params: [{
                input: params.input,
            }],
        } as TFilterPerspectiveHistoryEntry);
        return true;
    },

};