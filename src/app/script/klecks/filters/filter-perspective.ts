import {BB} from '../../bb/bb';
import {KlCanvasPreview} from '../canvas-ui/canvas-preview';
import {getSharedFx} from './shared-gl-fx';
import {IFilterApply, IFilterGetDialogParam, IKlBasicLayer} from '../kl.types';
import {LANG} from '../../language/language';
import {TwoTabs} from '../ui/components/two-tabs';

export const filterPerspective = {

    getDialog(params: IFilterGetDialogParam) {
        let context = params.context;
        let klCanvas = params.klCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        let isSmall = window.innerWidth < 550;
        let layers = klCanvas.getLayers();
        let selectedLayerIndex = klCanvas.getLayerIndex(context.canvas);

        let fit = BB.fitInto(context.canvas.width, context.canvas.height, isSmall ? 280 : 490, isSmall ? 200 : 240, 1);
        let displayW = parseInt('' + fit.width), displayH = parseInt('' + fit.height);
        let w = Math.min(displayW, context.canvas.width);
        let h = Math.min(displayH, context.canvas.height);

        let tempCanvas = BB.canvas(w, h);
        {
            const ctx = tempCanvas.getContext("2d");
            ctx.save();
            if (w > context.canvas.width) {
                ctx.imageSmoothingEnabled = false;
            }
            ctx.drawImage(context.canvas, 0, 0, w, h);
            ctx.restore();
        }
        let displayPreviewFactor = displayW / context.canvas.width;

        let div = document.createElement("div");
        let result: any = {
            element: div
        };
        if (!isSmall) {
            result.width = 500;
        }

        let pointerListenerArr = [];

        function finishInit() {
            div.innerHTML = LANG('filter-perspective-description') + "<br/><br/>";

            let glCanvas = getSharedFx();
            if (!glCanvas) {
                return; // todo throw?
            }
            let texture = glCanvas.texture(tempCanvas);
            glCanvas.draw(texture).update(); // update glCanvas size
            let ba, bb, bc, bd; //before
            let aa, ab, ac, ad; //after
            function update() {
                try {
                    glCanvas.draw(texture).perspective(
                        [ba.x, ba.y, bb.x, bb.y, bc.x, bc.y, bd.x, bd.y].map((item, i) => {
                            if (i % 2 === 0) {
                                return item / displayW * w;
                            } else {
                                return item / displayH * h;
                            }
                        }),
                        [aa.x, aa.y, ab.x, ab.y, ac.x, ac.y, ad.x, ad.y].map((item, i) => {
                            if (i % 2 === 0) {
                                return item / displayW * w;
                            } else {
                                return item / displayH * h;
                            }
                        })
                    ).update();
                    klCanvasPreview.render();
                } catch(e) {
                    (div as any).errorCallback(e);
                }
            }

            function nob(x, y, callback?) {
                let nobSize = 14;
                let div = document.createElement("div");
                (div as any).x = x;
                (div as any).y = y;
                BB.css(div, {
                    width: nobSize + "px",
                    height: nobSize + "px",
                    backgroundColor: "#fff",
                    boxShadow: "inset 0 0 0 2px #000",
                    borderRadius: nobSize + "px",
                    position: "absolute",
                    cursor: "move",
                    left: ((div as any).x - nobSize / 2) + "px",
                    top: ((div as any).y - nobSize / 2) + "px",
                    userSelect: 'none',
                    touchAction: 'none',
                });

                let pointerListener = new BB.PointerListener({
                    target: div,
                    maxPointers: 1,
                    onPointer: function(event) {
                        event.eventPreventDefault();
                        if (event.button === 'left' && event.type === 'pointermove') {
                            (div as any).x += event.dX;
                            (div as any).y += event.dY;
                            div.style.left = ((div as any).x - nobSize / 2) + "px";
                            div.style.top = ((div as any).y - nobSize / 2) + "px";
                            if (callback) {
                                callback();
                            }
                            update();
                        }
                    }
                });
                (div as any).copy = function (p) {
                    (div as any).x = p.x;
                    (div as any).y = p.y;
                    div.style.left = ((div as any).x - nobSize / 2) + "px";
                    div.style.top = ((div as any).y - nobSize / 2) + "px";
                };
                pointerListenerArr.push(pointerListener);
                return div;
            }

            function updateAfter() {
                aa.copy(ba);
                ab.copy(bb);
                ac.copy(bc);
                ad.copy(bd);
            }

            ba = nob(0, 0, updateAfter);
            bb = nob(displayW, 0, updateAfter);
            bc = nob(displayW, displayH, updateAfter);
            bd = nob(0, displayH, updateAfter);
            aa = nob(0, 0);
            ab = nob(displayW, 0);
            ac = nob(displayW, displayH);
            ad = nob(0, displayH);

            let before = false;

            const beforeAfterTabs = new TwoTabs({
                left: LANG('compare-before'),
                right: LANG('compare-after'),
                init: 1,
                onChange: (val: number) => {
                    before = val === 0;
                    if (before) {
                        aa.style.display = "none";
                        ab.style.display = "none";
                        ac.style.display = "none";
                        ad.style.display = "none";

                        ba.style.display = "block";
                        bb.style.display = "block";
                        bc.style.display = "block";
                        bd.style.display = "block";
                        ba.copy(aa);
                        bb.copy(ab);
                        bc.copy(ac);
                        bd.copy(ad);
                    } else {
                        ba.style.display = "none";
                        bb.style.display = "none";
                        bc.style.display = "none";
                        bd.style.display = "none";

                        aa.style.display = "block";
                        ab.style.display = "block";
                        ac.style.display = "block";
                        ad.style.display = "block";
                        aa.copy(ba);
                        ab.copy(bb);
                        ac.copy(bc);
                        ad.copy(bd);
                    }
                    update();
                },
            });
            div.append(beforeAfterTabs.getElement());

            let previewWrapper = document.createElement("div");
            previewWrapper.oncontextmenu = function () {
                return false;
            };
            BB.css(previewWrapper, {
                width: isSmall ? '340px' : '540px',
                marginLeft: "-20px",
                height: isSmall ? '260px' : '300px',
                backgroundColor: "#9e9e9e",
                boxShadow: "rgba(0, 0, 0, 0.2) 0px 1px inset, rgba(0, 0, 0, 0.2) 0px -1px inset",
                overflow: "hidden",
                position: "relative",
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                colorScheme: 'only light',
            });

            let previewLayerArr: IKlBasicLayer[] = [];
            {
                for (let i = 0; i < layers.length; i++) {
                    let canvas = i === selectedLayerIndex ? glCanvas : layers[i].context.canvas;
                    previewLayerArr.push({
                        image: canvas,
                        opacity: layers[i].opacity,
                        mixModeStr: layers[i].mixModeStr
                    });
                }
            }
            let klCanvasPreview = new KlCanvasPreview({
                width: parseInt('' + displayW),
                height: parseInt('' + displayH),
                layers: previewLayerArr
            });

            let previewInnerWrapper = BB.el({
                css: {
                    position: 'relative',
                    boxShadow: '0 0 5px rgba(0,0,0,0.5)',
                    width: parseInt('' + displayW) + 'px',
                    height: parseInt('' + displayH) + 'px'
                }
            });
            previewInnerWrapper.appendChild(klCanvasPreview.getElement());
            previewWrapper.appendChild(previewInnerWrapper);

            previewInnerWrapper.appendChild(aa);
            previewInnerWrapper.appendChild(ab);
            previewInnerWrapper.appendChild(ac);
            previewInnerWrapper.appendChild(ad);

            ba.style.display = "none";
            bb.style.display = "none";
            bc.style.display = "none";
            bd.style.display = "none";
            previewInnerWrapper.appendChild(ba);
            previewInnerWrapper.appendChild(bb);
            previewInnerWrapper.appendChild(bc);
            previewInnerWrapper.appendChild(bd);


            div.appendChild(previewWrapper);
            update();
            result.destroy = () => {
                for (let i = 0; i < pointerListenerArr.length; i++) {
                    pointerListenerArr[i].destroy();
                }
                texture.destroy();
            };
            result.getInput = function () {
                result.destroy();
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
                    ]
                };
            };
        }

        setTimeout(finishInit, 1);

        return result;
    },

    apply(params: IFilterApply) {
        let context = params.context;
        let history = params.history;
        let before = params.input.before;
        let after = params.input.after;
        if (!context || !before || !after || !history)
            return false;
        history.pause(true);
        let glCanvas = getSharedFx();
        if (!glCanvas) {
            return false; // todo more specific error?
        }
        let texture = glCanvas.texture(context.canvas);
        let w = context.canvas.width;
        let h = context.canvas.height;
        glCanvas.draw(texture).perspective(before, after).update();
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        context.drawImage(glCanvas, 0, 0);
        texture.destroy();
        history.pause(false);
        history.push({
            tool: ["filter", "perspective"],
            action: "apply",
            params: [{
                input: params.input
            }]
        });
        return true;
    }

};