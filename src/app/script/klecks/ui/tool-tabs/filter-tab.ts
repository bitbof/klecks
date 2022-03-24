import {BB} from '../../../bb/bb';
import {KL} from '../../kl';
import {klHistory} from '../../history/kl-history';
import {IKeyString} from '../../../bb/bb.types';
import {StatusOverlay} from '../components/status-overlay';
import {KlCanvasWorkspace} from '../../canvas-ui/kl-canvas-workspace';
import {KlCanvas} from '../../canvas/kl-canvas';
import {LANG} from '../../../language/language';


export class FilterTab {

    private readonly div: HTMLDivElement;
    private isInit = false;

    constructor (
        private klRootEl,
        private klColorSlider,
        private layerManager,
        private setCurrentLayer,
        private klCanvasWorkspace: KlCanvasWorkspace,
        private handUi,
        private getCurrentColor,
        private getKlMaxCanvasSize,
        private getKlCanvas: () => KlCanvas,
        private getCurrentLayerCtx,
        private isEmbed: boolean,
        private statusOverlay: StatusOverlay,
    ) {
        this.div = document.createElement("div");
    }

    private init() {
        const _this = this;
        let hasWebGl = BB.hasWebGl();
        let filters = KL.filterLib;
        let buttons = [];

        BB.BbLog.emit({
            type: 'init-filters',
        });

        if (!KL.filterLibStatus.isLoaded) {
            throw new Error('filters not loaded');
        }

        function createButton(filterKey, filterArr) {
            let button = document.createElement("button");
            let buttonLabel = filterArr[filterKey].buttonLabel ? filterArr[filterKey].buttonLabel : filterArr[filterKey].name;
            let im = '<img height="20" width="18" src="' + filterArr[filterKey].icon + '" alt="icon" />';
            button.innerHTML = im + buttonLabel;
            button.className = "gridButton";
            BB.css(button, {
                lineHeight: '20px',
                fontSize: '12px',
            });
            button.tabIndex = -1;
            button.onclick = function () {

                function finishedDialog(result, filterDialog) {
                    if (result == "Cancel") {
                        if (filterDialog.destroy) {
                            filterDialog.destroy();
                        }
                        return;
                    }
                    let input;
                    try {
                        input = filterDialog.getInput(); // also destroys
                    } catch (e) {
                        if (e.message.indexOf('.getInput is not a function') !== -1) {
                            throw 'filterDialog.getInput is not a function, filter: ' + filterArr[filterKey].name;
                        } else {
                            throw e;
                        }
                    }
                    applyFilter(input);
                }

                if (!('apply' in filterArr[filterKey])) {
                    alert('Application not fully loaded');
                    return;
                }

                function applyFilter(input) {
                    let filterResult = filterArr[filterKey].apply({
                        context: _this.getCurrentLayerCtx(),
                        canvas: _this.getKlCanvas(),
                        history: klHistory,
                        input: input
                    });
                    if (filterResult === false) {
                        alert("Couldn't apply the edit action");
                    }
                    if (filterArr[filterKey].updateContext === true) {
                        _this.setCurrentLayer(_this.getKlCanvas().getLayer(_this.layerManager.getSelected()));
                    }
                    if (filterArr[filterKey].updatePos === true) {
                        _this.klCanvasWorkspace.resetView();
                        _this.handUi.update(_this.klCanvasWorkspace.getScale(), _this.klCanvasWorkspace.getAngleDeg());
                    }
                    _this.layerManager.update();
                }

                if (filterArr[filterKey].isInstant){
                    button.blur();
                    applyFilter(null);
                    _this.statusOverlay.out('"' + filterArr[filterKey].name + '" ' + LANG('filter-applied'), true);
                } else {
                    let secondaryColorRGB = _this.klColorSlider.getSecondaryRGB();
                    let filterDialog = filterArr[filterKey].getDialog({
                        context: _this.getCurrentLayerCtx(),
                        canvas: _this.getKlCanvas(),
                        maxWidth: _this.getKlMaxCanvasSize(),
                        maxHeight: _this.getKlMaxCanvasSize(),
                        currentColorRgb: {r: _this.getCurrentColor().r, g: _this.getCurrentColor().g, b: _this.getCurrentColor().b},
                        secondaryColorRgb: {r: secondaryColorRGB.r, g: secondaryColorRGB.g, b: secondaryColorRGB.b}
                    });

                    if (!filterDialog) {
                        return;
                        //alert('Error: could not perform action');
                        //throw('filter['+filterKey+'].getDialog returned '+filterDialog+'. ctx:' + currentLayerCtx + ' klCanvas:' + klCanvas);
                    }

                    let closefunc;
                    filterDialog.errorCallback = function(e) {
                        setTimeout(function() {
                            alert('Error: could not perform action');
                            throw e;
                        }, 0);
                        closefunc();
                    };


                    let style: IKeyString = {};
                    if ('width' in filterDialog) {
                        style.width = filterDialog.width + 'px'
                    }

                    KL.popup({
                        target: _this.klRootEl,
                        message: "<b>" + filterArr[filterKey].name + "</b>",
                        div: filterDialog.element,
                        style: style,
                        buttons: ["Ok", "Cancel"],
                        clickOnEnter: 'Ok',
                        callback: function(result) {
                            finishedDialog(result, filterDialog);
                        },
                        closefunc: function (func) {
                            closefunc = func;
                        }
                    });
                }
            }
            buttons[buttons.length] = button;
            return button;
        }

        function createDisabledButton(filterKey, filterArr) {
            if (!filterArr[filterKey].webgl && !filterArr[filterKey].ieFails) {
                return;
            }
            if (filterArr[filterKey].ieFails && navigator.appName !== 'Microsoft Internet Explorer') {
                return;
            }
            let buttonLabel = filterArr[filterKey].buttonLabel ? filterArr[filterKey].buttonLabel : filterArr[filterKey].name;
            let button = document.createElement("button");
            let im = '<img style="opacity: 0.5" src="img/' + filterArr[filterKey].icon + '" />';
            let name = filterArr[filterKey].name;
            if (name.length > 11) {
                name = "<span style='font-size: 12px'>" + buttonLabel + "</span>";
            }
            button.innerHTML = im + name;
            button.className = "gridButton";
            button.disabled = true;
            return button;
        }

        function addGroup(groupArr, filterArr, targetEl) {
            for (let filterKey in filterArr) {
                if (filterArr.hasOwnProperty[filterKey] || !groupArr.includes(filterKey)) {
                    continue;
                }
                if (_this.isEmbed && !filterArr[filterKey].inEmbed) {
                    continue;
                }
                if ((filterArr[filterKey].webgl && hasWebGl)
                    || (filterArr[filterKey].neededWithWebGL)
                    || (!filterArr[filterKey].webgl && !hasWebGl)
                    && !(filterArr[filterKey].ieFails && navigator.appName == 'Microsoft Internet Explorer')) {

                    targetEl.appendChild(createButton(filterKey, filterArr));

                } else {
                    targetEl.appendChild(createDisabledButton(filterKey, filterArr));
                    filterArr[filterKey] = undefined;
                }
            }
        }

        let groupA = [
            'cropExtend',
            'flip',
            'glPerspective',
            'resize',
            'rotate',
            'transform'
        ];
        let groupB = [];
        for (let filterKey in filters) {
            if (filters.hasOwnProperty[filterKey] || groupA.includes(filterKey)) {
                continue;
            }
            groupB.push(filterKey);
        }

        addGroup(groupA, filters, _this.div);
        let hrEl = document.createElement("div");
        hrEl.className = "gridHr";
        _this.div.appendChild(hrEl);
        addGroup(groupB, filters, _this.div);


        if (!hasWebGl) {
            let webglnote = BB.appendTextDiv(_this.div, "Some actions are disabled because WebGL isn't working.");
            webglnote.style.margin = "10px";
            BB.css(webglnote, {
                fontSize: "11px",
                color: "#555",
                background: "#ffe",
                padding: "10px",
                borderRadius: "10px",
                textAlign: "center"
            });
        }

        this.isInit = true;
    }

    getElement() {
        return this.div;
    }

    show() {
        if (!this.isInit) {
            this.init();
        }
        this.div.style.display = 'block';
    }

    hide() {
        this.div.style.display = 'none';
    }

}