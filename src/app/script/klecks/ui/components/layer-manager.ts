import {BB} from '../../../bb/bb';
import {popup} from '../modals/popup';
import {klHistory} from '../../history/kl-history';
import {Options} from '../base-components/options';
import {Select} from '../base-components/select';
import {PointSlider} from '../base-components/point-slider';
// @ts-ignore
import addLayerImg from 'url:~/src/app/img/ui/add-layer.svg';
// @ts-ignore
import duplicateLayerImg from 'url:~/src/app/img/ui/duplicate-layer.svg';
// @ts-ignore
import mergeLayerImg from 'url:~/src/app/img/ui/merge-layers.svg';
// @ts-ignore
import removeLayerImg from 'url:~/src/app/img/ui/remove-layer.svg';


export function pcLayerManager(p_canvas, p_func, p_rootDiv) {
    let klCanvas = p_canvas;
    let layerElArr = [];
    let layerHeight = 35;
    let layerSpacing = 0;
    let width = 250;
    let oldHistoryState;
    let updatefunc = p_func;
    let uiState = 'right'; // 'left | 'right'


    let largeThumbDiv = BB.el({
        onClick: BB.handleClick,
        css: {
            position: "absolute",
            right: "280px",
            top: "500px",
            background: "#aaa",
            boxShadow: "1px 1px 3px rgba(0,0,0,0.3)",
            pointerEvents: "none",
            padding: '0',
            border: "1px solid #aaa",
            transition: "opacity 0.3s ease-out",
            userSelect: 'none',
        }
    });
    BB.createCheckerDataUrl(4, function(url) {
        largeThumbDiv.style.backgroundImage = "url(" + url + ")";
    });
    let largeThumbCanvas = document.createElement("canvas");
    largeThumbCanvas.style.display = "block";
    largeThumbCanvas.width = 200;
    largeThumbCanvas.height = 200;
    largeThumbDiv.appendChild(largeThumbCanvas);
    let largeThumbTimeout, largeThumbInTimeout;
    let largeThumbInDocument = false;


    let klCanvasLayerArr = klCanvas.getLayers();
    let selectedSpotIndex = klCanvasLayerArr.length - 1;
    let div = document.createElement("div");
    div.style.marginRight = "10px";
    div.style.marginBottom = "10px";
    div.style.marginLeft = "10px";
    div.style.marginTop = "10px";
    div.style.cursor = "default";

    let listdiv = document.createElement("div");
    BB.css(listdiv, {
        width: width + "px",
        height: "500px",
        position: "relative"

    });


    function renameLayer(layer) {
        let div = document.createElement('div');

        let label = BB.el({
            content: 'Name:',
            css: {
                marginRight: '5px'
            }
        });

        const row = BB.el({
            css: {
                display: 'flex',
            }
        });
        let input = document.createElement('input');
        input.value = klCanvas.getLayer(layer).name;
        const clearBtn = BB.el({
            tagName: 'Button',
            content: '<img src="' + removeLayerImg + '" height="20"/>',
            title: 'Clear Name',
            css: {
                marginLeft: '10px',
            },
            onClick: () => {
                input.value = '';
                input.focus();
            }
        });
        const suggestions = ['Sketch', 'Colors', 'Lines', 'Background', 'Foreground'];
        const suggestionBtns = [];
        const row2 = BB.el({
            css: {
                display: 'flex',
                flexWrap: 'wrap',
                marginTop: '5px',
                marginLeft: '-5px',
            }
        }) as HTMLDivElement;
        suggestions.forEach(item => {
            const btn = BB.el({
                parent: row2,
                tagName: 'Button',
                content: item,
                onClick: () => {
                    input.value = btn.textContent;
                },
                css: {
                    margin: '5px 0 0 5px',
                }
            });
            suggestionBtns.push(btn);
        });

        div.appendChild(label);
        label.append(row, row2);
        row.append(input, clearBtn);

        setTimeout(function() {
            input.focus();
            input.select();
        }, 10);

        popup({
            target: p_rootDiv,
            message: "<b>Rename Layer</b>",
            div: div,
            buttons: ['Rename', 'Cancel'],
            primaries: ['Rename'],
            callback: function (val) {
                BB.destroyEl(clearBtn);
                suggestionBtns.forEach(item => {
                    BB.destroyEl(item);
                });
                suggestionBtns.splice(0, suggestionBtns.length);
                if (val === "Rename") {
                    if(input.value === klCanvas.getLayer(layer).name) {
                        return;
                    }
                    klCanvas.renameLayer(layer, input.value.replace(/[^\w\s]/gi, ''));
                    createLayerList();
                    klHistory.pause();
                    updatefunc(layer);
                    klHistory.pause(false);
                }
            },
            clickOnEnter: 'Rename'
        });
    }


    let regularContainer = document.createElement("div");

    (div as any).disableButtons = function(){}; //probably remove
    (div as any).enableButtons = function(){}; //probably remove
    let addnewBtn = document.createElement("button");
    let duplicateBtn = document.createElement("button");
    let mergeBtn = document.createElement("button");
    let removeBtn = document.createElement("button");
    let renameBtn = document.createElement("button");

    function createButtons() {
        let div = document.createElement("div");
        function async() {
            BB.makeUnfocusable(addnewBtn);
            BB.makeUnfocusable(duplicateBtn);
            BB.makeUnfocusable(mergeBtn);
            BB.makeUnfocusable(removeBtn);
            BB.makeUnfocusable(renameBtn);

            addnewBtn.style.cssFloat = 'left';
            duplicateBtn.style.cssFloat = 'left';
            mergeBtn.style.cssFloat = 'left';
            removeBtn.style.cssFloat = 'left';
            renameBtn.style.cssFloat = 'left';

            addnewBtn.title = "New Layer";
            duplicateBtn.title = "Duplicate Layer";
            removeBtn.title = "Remove Layer";
            mergeBtn.title = "Merge with layer below";
            renameBtn.title = "Rename layer";

            addnewBtn.style.paddingLeft = "5px";
            addnewBtn.style.paddingRight = "3px";

            removeBtn.style.paddingLeft = "5px";
            removeBtn.style.paddingRight = "3px";

            duplicateBtn.style.paddingLeft = "5px";
            duplicateBtn.style.paddingRight = "3px";

            mergeBtn.style.paddingLeft = "5px";
            mergeBtn.style.paddingRight = "3px";

            renameBtn.style.height = "30px";
            renameBtn.style.lineHeight = "20px";

            addnewBtn.innerHTML = "<img src='" + addLayerImg + "' height='20'/> ";
            duplicateBtn.innerHTML = "<img src='" + duplicateLayerImg + "' height='20'/> ";
            mergeBtn.innerHTML = "<img src='" + mergeLayerImg + "' height='20'/>";
            removeBtn.innerHTML = "<img src='" + removeLayerImg + "' height='20'/> ";
            renameBtn.textContent = "Rename";
            addnewBtn.style.marginRight = "5px";
            removeBtn.style.marginRight = "5px";
            duplicateBtn.style.marginRight = "5px";
            mergeBtn.style.marginRight = "5px";
            div.appendChild(addnewBtn);
            div.appendChild(removeBtn);
            div.appendChild(duplicateBtn);
            div.appendChild(mergeBtn);
            div.appendChild(renameBtn);
            div.appendChild(BB.el({
                css: {
                    clear: 'both'
                }
            }));

            let clearboth = document.createElement("div");
            clearboth.style.clear = "both";
            clearboth.style.height = "10px";
            div.appendChild(clearboth);


            addnewBtn.onclick = function () {
                if (klCanvas.addLayer(selectedSpotIndex) === false) {
                    return;
                }
                klCanvasLayerArr = klCanvas.getLayers();

                if (klCanvasLayerArr.length === 8) {
                    addnewBtn.disabled = true;
                    duplicateBtn.disabled = true;
                }
                removeBtn.disabled = false;
                selectedSpotIndex = selectedSpotIndex + 1;
                createLayerList();
                klHistory.pause();
                updatefunc(selectedSpotIndex);
                klHistory.pause(false);
            };
            duplicateBtn.onclick = function () {
                if (klCanvas.duplicateLayer(selectedSpotIndex) === false) {
                    return;
                }
                klCanvasLayerArr = klCanvas.getLayers();
                if (klCanvasLayerArr.length === 8) {
                    addnewBtn.disabled = true;
                    duplicateBtn.disabled = true;
                }
                removeBtn.disabled = false;
                selectedSpotIndex++;
                createLayerList();
                klHistory.pause();
                updatefunc(selectedSpotIndex);
                klHistory.pause(false);
            };
            removeBtn.onclick = function () {
                if (layerElArr.length <= 1) {
                    return;
                }

                klCanvas.removeLayer(selectedSpotIndex);
                if (selectedSpotIndex > 0) {
                    selectedSpotIndex--;
                }
                klCanvasLayerArr = klCanvas.getLayers();
                createLayerList();
                klHistory.pause();
                updatefunc(selectedSpotIndex);
                klHistory.pause(false);
                if (klCanvasLayerArr.length === 1) {
                    removeBtn.disabled = true;
                }
                if (klCanvasLayerArr.length < 8) {
                    addnewBtn.disabled = false;
                    duplicateBtn.disabled = false;
                }
            };
            mergeBtn.onclick = function () {
                if (selectedSpotIndex <= 0) {
                    return;
                }

                function mergeDialog(p) {
                    let div = document.createElement("div");
                    div.innerHTML = "Merges the selected layer with the one underneath. Select the mix mode:";

                    let options = new Options({
                        optionArr: [
                            {id: p.mixModeStr, label: p.mixModeStr === 'source-over' ? 'normal' : p.mixModeStr},
                            {id: 'source-in', label: 'source-in'},
                            {id: 'source-out', label: 'source-out'},
                            {id: 'source-atop', label: 'source-atop'},
                            {id: 'destination-in', label: 'destination-in'},
                            {id: 'destination-out', label: 'destination-out'},
                            {id: 'destination-atop', label: 'destination-atop'},
                            {id: 'xor', label: 'xor'}
                        ],
                        initId: p.mixModeStr,
                        onChange: function(id) {
                            update();
                        },
                        isSmall: true
                    });
                    options.getElement().style.marginTop = '5px';
                    div.appendChild(options.getElement());

                    let preview = document.createElement("canvas");
                    let spacer = document.createElement("div");
                    spacer.innerHTML = "<br/>";
                    spacer.style.clear = "both";
                    div.appendChild(spacer);
                    div.appendChild(preview);
                    let thumbDimensions = BB.fitInto(p.topCanvas.width, p.topCanvas.height, 200, 200, 1);
                    preview.width = thumbDimensions.width;
                    preview.height = thumbDimensions.height;
                    BB.css(preview, {
                        display: "block",
                        marginLeft: "auto",
                        marginRight: "auto"
                    });
                    preview.style.boxShadow = "0 0 3px rgba(0,0,0,0.5)";
                    BB.createCheckerDataUrl(4, function(url) {
                        preview.style.backgroundImage = "url(" + url + ")";
                    });

                    let alphaCanvas = BB.copyCanvas(preview);
                    alphaCanvas.getContext("2d").drawImage(p.topCanvas, 0, 0, alphaCanvas.width, alphaCanvas.height);
                    BB.convertToAlphaChannelCanvas(alphaCanvas);

                    function update() {
                        let ctx = preview.getContext("2d");
                        ctx.save();
                        ctx.clearRect(0, 0, preview.width, preview.height);
                        if (preview.width > p.topCanvas.width) {
                            ctx.imageSmoothingEnabled = false;
                        }
                        ctx.drawImage(p.bottomCanvas, 0, 0, preview.width, preview.height);

                        if(options.getValue() === 'as-alpha') {
                            ctx.globalCompositeOperation = 'destination-in';
                            ctx.globalAlpha = p.topOpacity;
                            ctx.drawImage(alphaCanvas, 0, 0, preview.width, preview.height);
                        } else {
                            ctx.globalCompositeOperation = options.getValue();
                            ctx.globalAlpha = p.topOpacity;
                            ctx.drawImage(p.topCanvas, 0, 0, preview.width, preview.height);
                        }
                        ctx.restore();
                    }

                    update();


                    let keyListener = new BB.KeyListener({
                        onDown: function(keyStr) {
                            if (keyStr === 'right') {
                                options.next();
                            }
                            if (keyStr === 'left') {
                                options.previous();
                            }
                        }
                    });

                    popup({
                        target: p_rootDiv,
                        message: "<b>Merge/Mix Layers</b>",
                        div: div,
                        buttons: ["Ok", "Cancel"],
                        callback: function (val) {
                            keyListener.destroy();
                            options.destroy();
                            if (val === "Ok") {
                                p.callback(options.getValue());
                            }
                        }
                    });
                }
                mergeDialog({
                    topCanvas: klCanvasLayerArr[selectedSpotIndex].context.canvas,
                    bottomCanvas: klCanvasLayerArr[selectedSpotIndex - 1].context.canvas,
                    topOpacity: parseFloat(klCanvas.getLayer(selectedSpotIndex).opacity),
                    mixModeStr: klCanvasLayerArr[selectedSpotIndex].mixModeStr,
                    callback: function (mode) {
                        klCanvas.mergeLayers(selectedSpotIndex, selectedSpotIndex - 1, mode);
                        klCanvasLayerArr = klCanvas.getLayers();
                        selectedSpotIndex--;
                        if (klCanvasLayerArr.length === 1) {
                            removeBtn.disabled = true;
                        }
                        if (klCanvasLayerArr.length < 8) {
                            addnewBtn.disabled = false;
                            duplicateBtn.disabled = false;
                        }
                        createLayerList();
                        klHistory.pause();
                        updatefunc(selectedSpotIndex);
                        klHistory.pause(false);
                    }
                });
            };

            renameBtn.onclick = function () {
                renameLayer(selectedSpotIndex);
            };
        }
        setTimeout(async, 1);
        return div;
    }
    div.appendChild(createButtons());

    let modeWrapper;
    let modeSelect;
    {
        modeWrapper = BB.el({
            content: 'Blending&nbsp;',
            css: {
                fontSize: '15px'
            }
        });

        modeSelect = new Select({
            optionArr: [
                ['source-over', 'normal'],
                null,
                ['darken', 'darken'],
                ['multiply', 'multiply'],
                ['color-burn', 'color burn'],
                null,
                ['lighten', 'lighten'],
                ['screen', 'screen'],
                ['color-dodge', 'color dodge'],
                null,
                ['overlay', 'overlay'],
                ['soft-light', 'soft light'],
                ['hard-light', 'hard light'],
                null,
                ['difference', 'difference'],
                ['exclusion', 'exclusion'],
                null,
                ['hue', 'hue'],
                ['saturation', 'saturation'],
                ['color', 'color'],
                ['luminosity', 'luminosity']
            ],
            onChange: function(val) {
                klCanvas.setMixMode(selectedSpotIndex, val);
                (div as any).update(selectedSpotIndex);
            },
            css: {
                marginBottom: '10px'
            }
        });

        modeWrapper.appendChild(modeSelect.getElement());
        div.appendChild(modeWrapper);

    }


    function createLayerList() {
        oldHistoryState = klHistory.getState();
        function createLayerEntry(index) {
            let layerName = klCanvas.getLayer(index).name;
            let opacity = klCanvasLayerArr[index].opacity;
            let layercanvas = klCanvasLayerArr[index].context.canvas;

            let layer = document.createElement("div");
            layer.className = "layerBox";
            layerElArr[index] = layer;
            (layer as any).posY = ((klCanvasLayerArr.length - 1) * 35 - index * 35);
            BB.css(layer, {
                width: "250px",
                height: "34px",
                backgroundColor: "rgb( 220, 220, 220)",
                border: "1px solid #aaa",
                position: "absolute",
                left: "0 px",
                top: (layer as any).posY + "px",
                transition: "all 0.1s linear",
                borderRadius: "5px",
                boxSizing: 'border-box'
            });
            let innerLayer = document.createElement("div");
            BB.css(innerLayer, {
                position: "relative"
            });

            let container1 = document.createElement("div");
            BB.css(container1, {
                width: "250px",
                height: "34px"
            });
            let container2 = document.createElement("div");
            layer.appendChild(innerLayer);
            innerLayer.appendChild(container1);
            innerLayer.appendChild(container2);

            (layer as any).spot = index;

            //thumb
            {
                let thumbDimensions = BB.fitInto(layercanvas.width, layercanvas.height, 30, 30, 1);
                let thumb = (layer as any).thumb = BB.canvas(thumbDimensions.width, thumbDimensions.height);

                let thc = thumb.getContext("2d");
                thc.save();
                if (thumb.width > layercanvas.width) {
                    thc.imageSmoothingEnabled = false;
                }
                thc.drawImage(layercanvas, 0, 0, thumb.width, thumb.height);
                thc.restore();
                BB.css((layer as any).thumb, {
                    position: "absolute",
                    left: ((32 - (layer as any).thumb.width) / 2) + "px",
                    top: ((32 - (layer as any).thumb.height) / 2) + "px"
                });
                BB.createCheckerDataUrl(4, function(url) {
                    thumb.style.backgroundImage = "url(" + url + ")";
                });
            }

            //layerlabel
            {
                (layer as any).label = document.createElement("div");
                (layer as any).lname = layerName;
                (layer as any).label.append((layer as any).lname);

                BB.css((layer as any).label, {
                    position: "absolute",
                    left: (1 + 32 + 5) + "px",
                    top: 1 + "px",
                    fontSize: "13px",
                    width: "170px",
                    height: "20px",
                    overflow: "hidden",
                    color: "#666",
                    whiteSpace: 'nowrap'
                });

                (layer as any).label.ondblclick = function() {
                    renameLayer(index);
                };
            }
            //layerlabel
            {
                (layer as any).opacityLabel = document.createElement("div");
                (layer as any).opacity = opacity;
                (layer as any).opacityLabel.append(parseInt('' + ((layer as any).opacity * 100)) + "%");

                BB.css((layer as any).opacityLabel, {
                    position: "absolute",
                    left: (250 - 1 - 5 - 50) + "px",
                    top: 1 + "px",
                    fontSize: "13px",
                    textAlign: "right",
                    width: "50px",
                    color: "#666",
                    transition: "color 0.2s ease-in-out"
                });
            }

            let oldOpacity;
            let opacitySlider = new PointSlider({
                init: (layer as any).opacity,
                width: 204,
                pointSize: 14,
                callback: function(sliderValue, isFirst, isLast) {
                    if(isFirst) {
                        oldOpacity = klCanvas.getLayer((layer as any).spot).opacity;
                        klHistory.pause();
                        return;
                    }
                    if(isLast) {
                        klHistory.pause(false);
                        if (oldOpacity !== sliderValue) {
                            klCanvas.layerOpacity((layer as any).spot, sliderValue);
                        }
                        return;
                    }
                    (layer as any).opacityLabel.innerHTML = Math.round(sliderValue * 100) + "%";
                    klCanvas.layerOpacity((layer as any).spot, sliderValue);
                }
            });
            BB.css(opacitySlider.getEl(), {
                position: 'absolute',
                left: '39px',
                top: '17px'
            });
            (layer as any).opacitySlider = opacitySlider;

            //larger layer preview - hover
            BB.setEventListener((layer as any).thumb, 'onpointerover', function (e) {
                if(e.buttons !== 0 && (!e.pointerType || e.pointerType !== 'touch')) { //shouldn't show while dragging
                    return;
                }

                let thumbDimensions = BB.fitInto(layercanvas.width, layercanvas.height, 250, 250, 1);

                if(largeThumbCanvas.width !== thumbDimensions.width || largeThumbCanvas.height !== thumbDimensions.height) {
                    largeThumbCanvas.width = thumbDimensions.width;
                    largeThumbCanvas.height = thumbDimensions.height;
                }
                let ctx = largeThumbCanvas.getContext("2d");
                ctx.save();
                if (largeThumbCanvas.width > layercanvas.width) {
                    ctx.imageSmoothingEnabled = false;
                }
                ctx.imageSmoothingQuality = 'high';
                ctx.clearRect(0, 0, largeThumbCanvas.width, largeThumbCanvas.height);
                ctx.drawImage(layercanvas, 0, 0, largeThumbCanvas.width, largeThumbCanvas.height);
                ctx.restore();
                BB.css(largeThumbDiv, {
                    top: (e.clientY - largeThumbCanvas.height / 2) + "px",
                    opacity: '0'
                });
                if (largeThumbInDocument === false) {
                    document.body.appendChild(largeThumbDiv);
                    largeThumbInDocument = true;
                }
                clearTimeout(largeThumbInTimeout);
                largeThumbInTimeout = setTimeout(function () {
                    BB.css(largeThumbDiv, {
                        opacity: '1'
                    });
                }, 20);
                clearTimeout(largeThumbTimeout);
            });
            BB.setEventListener((layer as any).thumb, 'onpointerout', function () {
                clearTimeout(largeThumbInTimeout);
                BB.css(largeThumbDiv, {
                    opacity: '0'
                });
                clearTimeout(largeThumbTimeout);
                largeThumbTimeout = setTimeout(function () {
                    if (!largeThumbInDocument) {
                        return;
                    }
                    document.body.removeChild(largeThumbDiv);
                    largeThumbInDocument = false;
                }, 300);
            });

            container1.appendChild((layer as any).thumb);
            container1.appendChild((layer as any).label);
            container1.appendChild((layer as any).opacityLabel);
            container1.appendChild(opacitySlider.getEl());
            let dragstart = false;
            let freshSelection = false;

            //events for moving layers up and down
            function dragEventHandler(event) {
                if (event.type === 'pointerdown' && event.button === 'left') {
                    BB.css(layer, {
                        transition: "box-shadow 0.3s ease-in-out"
                    });
                    //dragContainer.appendChild(layer);
                    layer.style.zIndex = '1';
                    lastpos = (layer as any).spot;
                    freshSelection = false;
                    if (!(layer as any).isSelected) {
                        freshSelection = true;
                        (div as any).activateLayer((layer as any).spot);
                    }
                    dragstart = true;

                } else if (event.type === 'pointermove' && event.button === 'left') {

                    if (dragstart) {
                        dragstart = false;
                        BB.css(layer, {
                            boxShadow: "1px 3px 5px rgba(0,0,0,0.4)"
                        });
                    }
                    (layer as any).posY += event.dY;
                    let corrected = Math.max(0, Math.min((klCanvasLayerArr.length - 1) * (35), (layer as any).posY));
                    layer.style.top = corrected + "px";
                    updateLayersVerticalPosition((layer as any).spot, posToSpot((layer as any).posY));

                }
                if (event.type === 'pointerup') {
                    BB.css(layer, {
                        transition: "all 0.1s linear"
                    });
                    setTimeout(function () {
                        BB.css(layer, {
                            boxShadow: ""
                        });
                    }, 20);
                    (layer as any).posY = Math.max(0, Math.min((klCanvasLayerArr.length - 1) * (35), (layer as any).posY));
                    //regularContainer.appendChild(layer);
                    layer.style.zIndex = "";
                    let newSpot = posToSpot((layer as any).posY);
                    let oldSpot = (layer as any).spot;
                    move((layer as any).spot, newSpot);
                    if (oldSpot != newSpot) {
                        klHistory.pause();
                        updatefunc(selectedSpotIndex);
                        klHistory.pause(false);
                    }
                    if (oldSpot === newSpot && freshSelection) {
                        updatefunc(selectedSpotIndex);
                    }
                    freshSelection = false;
                }
            }

            (layer as any).pointerListener = new BB.PointerListener({
                target: container1,
                maxPointers: 1,
                onPointer: dragEventHandler
            });

            regularContainer.appendChild(layer);
        }
        layerElArr = [];
        while (regularContainer.firstChild) {
            let child = regularContainer.firstChild;
            (child as any).pointerListener.destroy();
            (child as any).opacitySlider.destroy();
            regularContainer.removeChild(child);
        }
        for (let i = 0; i < klCanvasLayerArr.length; i++) {
            createLayerEntry(i);
        }
        (div as any).activateLayer(selectedSpotIndex);
    }


    listdiv.appendChild(regularContainer);
    div.appendChild(listdiv);


    function posToSpot(p) {
        let result = parseInt('' + ((p) / (layerHeight + layerSpacing) + 0.5));
        result = Math.min(klCanvasLayerArr.length - 1, Math.max(0, result));
        result = klCanvasLayerArr.length - result - 1;
        return result;
    }

    let lastpos = 0;

    //update css position of all layers that are not being dragged, while dragging
    function updateLayersVerticalPosition(id, newspot) {
        newspot = Math.min(klCanvasLayerArr.length - 1, Math.max(0, newspot));
        if(newspot === lastpos) {
            return;
        }
        for (let i = 0; i < klCanvasLayerArr.length; i++) {
            if (layerElArr[i].spot === id) { // <- here
                continue;
            }
            let posy = layerElArr[i].spot;
            if (layerElArr[i].spot > id) {
                posy--;
            }
            if (posy >= newspot) {
                posy++;
            }
            layerElArr[i].posY = (layerHeight + layerSpacing) * (klCanvasLayerArr.length - posy - 1);
            layerElArr[i].style.top = layerElArr[i].posY + "px";
        }
        lastpos = newspot;
    }

    function move(oldSpotIndex, newSpotIndex) {
        if(isNaN(oldSpotIndex) || isNaN(newSpotIndex)) {
            throw 'layermanager - invalid move';
        }
        for (let i = 0; i < klCanvasLayerArr.length; i++) {
            (function (i) {
                let posy = layerElArr[i].spot; // <- here
                if (layerElArr[i].spot === oldSpotIndex) {
                    posy = newSpotIndex;
                } else {
                    if (layerElArr[i].spot > oldSpotIndex)
                        posy--;
                    if (posy >= newSpotIndex)
                        posy++;
                }
                layerElArr[i].spot = posy;
                layerElArr[i].posY = (layerHeight + layerSpacing) * (klCanvasLayerArr.length - posy - 1);
                layerElArr[i].style.top = layerElArr[i].posY + "px";
            }(i));
        }
        if (oldSpotIndex === newSpotIndex) {
            return;
        }
        klCanvas.moveLayer(selectedSpotIndex, newSpotIndex - oldSpotIndex);
        klCanvasLayerArr = klCanvas.getLayers();
        selectedSpotIndex = newSpotIndex;
        mergeBtn.disabled = selectedSpotIndex === 0;
    }


    //updating the thumbs in interval
    //don't update when: manager not visible || layer didn't change || is drawing
    let updateThumbsInterval = setInterval(function() {
        if(div.style.display !== "block") {
            return;
        }

        let historyState = klHistory.getState();
        if (historyState === oldHistoryState) {
            return;
        }
        oldHistoryState = historyState;

        for(let i = 0; i < layerElArr.length; i++) {
            if (selectedSpotIndex === layerElArr[i].spot && klCanvasLayerArr[layerElArr[i].spot]) { // second check, because might be out of date
                let ctx = layerElArr[i].thumb.getContext("2d");
                ctx.save();
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                if (klCanvasLayerArr[layerElArr[i].spot].context.canvas.width < layerElArr[i].thumb.width) {
                    ctx.imageSmoothingEnabled = false;
                }
                ctx.drawImage(klCanvasLayerArr[layerElArr[i].spot].context.canvas, 0, 0, layerElArr[i].thumb.width, layerElArr[i].thumb.height);
                ctx.restore();
            }
        }

    }, 1);



    (div as any).update = function (activeLayerSpotIndex) {
        klCanvasLayerArr = klCanvas.getLayers();
        if(activeLayerSpotIndex || activeLayerSpotIndex === 0) {
            selectedSpotIndex = activeLayerSpotIndex;
        }
        removeBtn.disabled = klCanvasLayerArr.length === 1;
        if (klCanvasLayerArr.length === 8) {
            addnewBtn.disabled = true;
            duplicateBtn.disabled = true;
        } else {
            addnewBtn.disabled = false;
            duplicateBtn.disabled = false;
        }
        setTimeout(function() {
            createLayerList();
        }, 1);
    };
    (div as any).getSelected = function () {
        return selectedSpotIndex;
    };
    (div as any).activateLayer = function (spotIndex) {
        if(spotIndex < 0 || spotIndex > layerElArr.length - 1) {
            throw 'invalid spotIndex ' + spotIndex + ', layerElArr.length ' + layerElArr.length;
        }
        selectedSpotIndex = spotIndex;
        modeSelect.setValue(klCanvasLayerArr[selectedSpotIndex].mixModeStr);
        for (let i = 0; i < layerElArr.length; i++) {
            if (selectedSpotIndex === layerElArr[i].spot) {
                layerElArr[i].style.backgroundColor = "rgb( 250, 250, 250)";
                layerElArr[i].label.style.color = "#000";
                layerElArr[i].style.boxShadow = "";
                layerElArr[i].style.border = "1px solid var(--active-highlight-color)";
                layerElArr[i].opacitySlider.setActive(true);
                layerElArr[i].isSelected = true;
            } else {
                layerElArr[i].style.backgroundColor = "rgb( 220, 220, 220)";
                layerElArr[i].label.style.color = "#666";
                layerElArr[i].style.boxShadow = "";
                layerElArr[i].style.border = "1px solid rgb(158, 158, 158)";
                layerElArr[i].opacitySlider.setActive(false);
                layerElArr[i].isSelected = false;
            }
        }
        mergeBtn.disabled = selectedSpotIndex === 0;
    };
    (div as any).setUiState = function(stateStr) {
        uiState = '' + stateStr;

        if (uiState === 'left') {
            BB.css(largeThumbDiv, {
                left: '280px',
                right: ''
            });
        } else {
            BB.css(largeThumbDiv, {
                left: '',
                right: '280px'
            });
        }
    };

    createLayerList();

    return div;
}
