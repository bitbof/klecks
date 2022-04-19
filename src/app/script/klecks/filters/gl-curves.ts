import {BB} from '../../bb/bb';
import {Options} from '../ui/base-components/options';
import {KlCanvasPreview} from '../canvas-ui/canvas-preview';
import {getSharedFx} from './shared-gl-fx';
import {IFilterApply, IFilterGetDialogParam, IKlBasicLayer} from '../kl.types';
import {LANG} from '../../language/language';

export const glCurves = {

    getDialog(params: IFilterGetDialogParam) {

        let context = params.context;
        let canvas = params.canvas;
        if (!context || !canvas) {
            return false;
        }

        let layers = canvas.getLayers();
        let selectedLayerIndex = canvas.getLayerIndex(context.canvas);

        let fit = BB.fitInto(context.canvas.width, context.canvas.height, 280, 200, 1);
        let w = parseInt('' + fit.width), h = parseInt('' + fit.height);

        let tempCanvas = BB.canvas(w, h);
        {
            const ctx = tempCanvas.getContext("2d");
            ctx.save();
            if (tempCanvas.width > context.canvas.width) {
                ctx.imageSmoothingEnabled = false;
            }
            ctx.drawImage(context.canvas, 0, 0, w, h);
            ctx.restore();
        }

        let div = document.createElement("div");
        let result: any = {
            element: div,
        };
        let klCanvasPreview;

        function finishInit() {

            let previewFactor = w / context.canvas.width;
            let brightness = 0, contrast = 0;

            div.innerHTML = LANG('filter-curves-description') + "<br/><br/>";

            let curves = {
                r: [[0, 0], [1 / 3, 1 / 3], [2 / 3, 2 / 3], [1, 1]],
                g: [[0, 0], [1 / 3, 1 / 3], [2 / 3, 2 / 3], [1, 1]],
                b: [[0, 0], [1 / 3, 1 / 3], [2 / 3, 2 / 3], [1, 1]],
            };

            let glCanvas = getSharedFx();
            if (!glCanvas) {
                return; // todo throw?
            }
            let texture = glCanvas.texture(tempCanvas);
            glCanvas.draw(texture).update(); // update glCanvas size

            function update() {
                try {
                    glCanvas.draw(texture).curves(curves.r, curves.g, curves.b).update();
                    if (klCanvasPreview) {
                        klCanvasPreview.render();
                    }
                } catch(e) {
                    (div as any).errorCallback(e);
                }
            }

            let modeButtons;

            function CurvesInput(p) {
                let div = document.createElement("div");
                div.oncontextmenu = function () {
                    return false;
                };
                div.style.position = "relative";
                div.style.marginBottom = "10px";
                let mode = "All";
                let curves = p.curves;
                modeButtons = new Options( {
                    optionArr: [
                        {
                            id: 'All',
                            label: LANG('filter-curves-all')
                        },
                        {
                            id: 'Red',
                            label: LANG('red')
                        },
                        {
                            id: 'Green',
                            label: LANG('green')
                        },
                        {
                            id: 'Blue',
                            label: LANG('blue')
                        },
                    ],
                    initialId: 'All',
                    onChange: function(id) {
                        mode = id;
                        if (mode === "All") {
                            curves = {
                                r: [[0, 0], [1 / 3, 1 / 3], [2 / 3, 2 / 3], [1, 1]],
                                g: [[0, 0], [1 / 3, 1 / 3], [2 / 3, 2 / 3], [1, 1]],
                                b: [[0, 0], [1 / 3, 1 / 3], [2 / 3, 2 / 3], [1, 1]],
                            };
                        }
                        let curve = curves.r;
                        if (mode === "Green") {
                            curve = curves.g;
                        }
                        if (mode === "Blue") {
                            curve = curves.b;
                        }
                        (p0 as any).setPos(0, areah - curve[0][1] * areah);
                        (p1 as any).setPos(curve[1][0] * areaw, areah - curve[1][1] * areah);
                        (p2 as any).setPos(curve[2][0] * areaw, areah - curve[2][1] * areah);
                        (p3 as any).setPos(areaw, areah - curve[3][1] * areah);

                        update();
                    }
                });
                div.appendChild(modeButtons.getElement());

                let curveArea = document.createElement("div");
                BB.css(curveArea, {
                    position: 'relative',
                    marginTop: '10px',
                    colorScheme: 'only light',
                })
                div.appendChild(curveArea);

                let areaw = 300, areah = 100;
                let canvas = BB.canvas(areaw, areah);
                BB.css(canvas, {
                    background: "#c6c6c6",
                    boxShadow: "0 0 0 1px rgba(0,0,0,0.3)"
                });
                let ctx = canvas.getContext("2d");
                curveArea.appendChild(canvas);

                let points = {
                    r: [],
                    g: [],
                    b: []
                };

                function fit(v) {
                    return Math.max(0, Math.min(1, v));
                }

                function createPoint(x, y, callback, lock?) {
                    let gripSize = 14;
                    let internalY = y, internalX = x;
                    let point = document.createElement("div");
                    BB.css(point, {
                        position: "absolute",
                        left: (x - gripSize / 2) + "px",
                        top: (y - gripSize / 2) + "px",
                        width: gripSize + "px",
                        height: gripSize + "px",
                        background: "#fff",
                        cursor: "move",
                        borderRadius: gripSize + "px",
                        boxShadow: "inset 0 0 0 2px #000",
                        userSelect: 'none',
                        touchAction: 'none',
                    });

                    function update() {
                        BB.css(point, {
                            left: (x - gripSize / 2) + "px",
                            top: (y - gripSize / 2) + "px"
                        });
                    }

                    (point as any).pointerListener = new BB.PointerListener({
                        target: point,
                        maxPointers: 1,
                        onPointer: function(event) {
                            event.eventPreventDefault();
                            if (event.type === 'pointerdown') {
                                internalX = x;
                                internalY = y;
                            }
                            if (event.button === 'left' && event.type === 'pointermove') {
                                if (!lock) {
                                    internalX += event.dX;
                                }
                                x = Math.max(0, Math.min(areaw, internalX));
                                internalY += event.dY;
                                y = Math.max(0, Math.min(areah, internalY));
                                update();
                                callback({
                                    x: x,
                                    y: y
                                });
                            }
                        }
                    });

                    curveArea.appendChild(point);

                    (point as any).setPos = function (newX, newY) {
                        x = newX;
                        y = newY;
                        internalY = y;
                        internalX = x;
                        BB.css(point, {
                            left: (x - gripSize / 2) + "px",
                            top: (y - gripSize / 2) + "px"
                        });
                    };

                    return point;
                }

                function updateControl(i, x, y) {
                    if (mode === "All") {
                        curves.r[i] = [fit(x / areaw), fit(1 - y / areah)];
                        curves.g[i] = [fit(x / areaw), fit(1 - y / areah)];
                        curves.b[i] = [fit(x / areaw), fit(1 - y / areah)];
                    }
                    if (mode === "Red") {
                        curves.r[i] = [fit(x / areaw), fit(1 - y / areah)];
                    }
                    if (mode === "Green") {
                        curves.g[i] = [fit(x / areaw), fit(1 - y / areah)];
                    }
                    if (mode === "Blue") {
                        curves.b[i] = [fit(x / areaw), fit(1 - y / areah)];
                    }
                }

                let p0 = createPoint(0, areah, function (val) {
                    updateControl(0, val.x, val.y);
                    update();
                }, true);
                let p1 = createPoint(areaw / 3, areah / 3 * 2, function (val) {
                    updateControl(1, val.x, val.y);
                    update();
                });
                let p2 = createPoint(areaw / 3 * 2, areah / 3, function (val) {
                    updateControl(2, val.x, val.y);
                    update();
                });
                let p3 = createPoint(areaw, 0, function (val) {
                    updateControl(3, val.x, val.y);
                    update();
                }, true);


                function update() {
                    canvas.width = canvas.width;
                    ctx = canvas.getContext("2d");

                    let outCurves = {
                        r: [],
                        g: [],
                        b: []
                    };
                    for (let i = 0; i < curves.r.length; i++) {
                        outCurves.r.push(curves.r[i]);
                        outCurves.g.push(curves.g[i]);
                        outCurves.b.push(curves.b[i]);
                    }

                    function drawCurve(curve) {
                        ctx.beginPath();
                        let spline = new BB.SplineInterpolator(curve);
                        for (let i = 0; i < 100; i++) {
                            let y = spline.interpolate(i / 100);
                            y = Math.max(0, Math.min(1, y));

                            if (i === 0) {
                                ctx.moveTo(i / 100 * areaw, areah - y * areah);
                            } else {
                                ctx.lineTo(i / 100 * areaw, areah - y * areah);
                            }
                        }
                        ctx.stroke();
                    }

                    ctx.save();
                    if (mode === "All") {
                        ctx.strokeStyle = "black";
                        drawCurve(outCurves.r);
                    } else {
                        ctx.globalAlpha = 0.5;
                        ctx.strokeStyle = "red";
                        drawCurve(outCurves.r);
                        ctx.strokeStyle = "green";
                        drawCurve(outCurves.g);
                        ctx.strokeStyle = "blue";
                        drawCurve(outCurves.b);
                    }
                    ctx.restore();
                    p.callback(outCurves);
                }

                update();


                this.getDiv = function () {
                    return div;
                };
                this.destroy = function() {
                    (p0 as any).pointerListener.destroy();
                    (p1 as any).pointerListener.destroy();
                    (p2 as any).pointerListener.destroy();
                    (p3 as any).pointerListener.destroy();
                };
            }

            let input = new CurvesInput({
                curves: curves,
                callback: function (val) {
                    curves = val;
                    update();
                }
            });


            div.appendChild(input.getDiv());



            let previewWrapper = document.createElement("div");
            BB.css(previewWrapper, {
                width: "340px",
                marginLeft: "-20px",
                height: "220px",
                backgroundColor: "#9e9e9e",
                marginTop: "10px",
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
                    previewLayerArr.push({
                        image: i === selectedLayerIndex ? glCanvas : layers[i].context.canvas,
                        opacity: layers[i].opacity,
                        mixModeStr: layers[i].mixModeStr
                    });
                }
            }
            klCanvasPreview = new KlCanvasPreview({
                width: parseInt('' + w),
                height: parseInt('' + h),
                layers: previewLayerArr
            });

            let previewInnerWrapper = BB.el({
                css: {
                    position: 'relative',
                    boxShadow: '0 0 5px rgba(0,0,0,0.5)',
                    width: parseInt('' + w) + 'px',
                    height: parseInt('' + h) + 'px'
                }
            });
            previewInnerWrapper.appendChild(klCanvasPreview.getElement());
            previewWrapper.appendChild(previewInnerWrapper);


            div.appendChild(previewWrapper);

            result.destroy = () => {
                input.destroy();
                texture.destroy();
                modeButtons.destroy();
            };
            result.getInput = function () {
                result.destroy();
                return {
                    curves: curves
                };
            };
        }

        setTimeout(finishInit, 1);

        return result;
    },

    apply(params: IFilterApply) {
        let context = params.context;
        let curves = params.input.curves;
        let history = params.history;
        if (!context || curves === null || !history)
            return false;
        history.pause(true);
        let glCanvas = getSharedFx();
        if (!glCanvas) {
            return false; // todo more specific error?
        }
        let texture = glCanvas.texture(context.canvas);
        glCanvas.draw(texture).curves(curves.r, curves.g, curves.b).update();
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        context.drawImage(glCanvas, 0, 0);
        texture.destroy();
        history.pause(false);
        history.push({
            tool: ["filter", "glCurves"],
            action: "apply",
            params: [{
                input: params.input
            }]
        });

        return true;
    }


};