import {BB} from '../../../bb/bb';
import {KL} from '../../kl';
import {klHistory} from '../../history/kl-history';
import {IKeyString} from '../../../bb/bb.types';
import {StatusOverlay} from '../components/status-overlay';
import {KlCanvasWorkspace} from '../../canvas-ui/kl-canvas-workspace';
import {KlCanvas} from '../../canvas/kl-canvas';
import {LANG} from '../../../language/language';
import {IFilterApply, IFilterGetDialogParam, IFilterGetDialogResult} from '../../kl.types';


export class FilterTab {

    private readonly div: HTMLDivElement;
    private isInit = false;

    constructor (
        private klRootEl,
        private klColorSlider,
        private layerManager,
        // private setCurrentLayer,
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
            let buttonLabel = LANG(filterArr[filterKey].lang.button);
            let im = '<img height="20" width="18" src="' + filterArr[filterKey].icon + '" alt="icon" />';
            button.innerHTML = im + buttonLabel;
            button.className = "gridButton";
            BB.css(button, {
                lineHeight: '20px',
                fontSize: '12px',
            });
            button.tabIndex = -1;

            const filterName = LANG(filterArr[filterKey].lang.name);

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
                            throw 'filterDialog.getInput is not a function, filter: ' + filterName;
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
                        klCanvas: _this.getKlCanvas(),
                        history: klHistory,
                        input: input
                    } as IFilterApply);
                    if (filterResult === false) {
                        alert("Couldn't apply the edit action");
                    }
                    /*
                     _this.setCurrentLayer(_this.getKlCanvas().getLayer(_this.layerManager.getSelected()));
                    */
                    if (filterArr[filterKey].updatePos === true) {
                        _this.klCanvasWorkspace.resetView();
                        _this.handUi.update(_this.klCanvasWorkspace.getScale(), _this.klCanvasWorkspace.getAngleDeg());
                    }
                    _this.layerManager.update();
                }

                if (filterArr[filterKey].isInstant){
                    button.blur();
                    applyFilter(null);
                    _this.statusOverlay.out('"' + filterName + '" ' + LANG('filter-applied'), true);
                } else {
                    let secondaryColorRGB = _this.klColorSlider.getSecondaryRGB();
                    let filterDialog = filterArr[filterKey].getDialog({
                        context: _this.getCurrentLayerCtx(),
                        klCanvas: _this.getKlCanvas(),
                        maxWidth: _this.getKlMaxCanvasSize(),
                        maxHeight: _this.getKlMaxCanvasSize(),
                        currentColorRgb: {r: _this.getCurrentColor().r, g: _this.getCurrentColor().g, b: _this.getCurrentColor().b},
                        secondaryColorRgb: {r: secondaryColorRGB.r, g: secondaryColorRGB.g, b: secondaryColorRGB.b}
                    } as IFilterGetDialogParam) as IFilterGetDialogResult;

                    if (!filterDialog) {
                        return;
                        //alert('Error: could not perform action');
                        //throw('filter['+filterKey+'].getDialog returned '+filterDialog+'. ctx:' + currentLayerCtx + ' klCanvas:' + klCanvas);
                    }

                    let closefunc;
                    // Todo should move into getDialogParams
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
                        message: "<b>" + filterName + "</b>",
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

        function addGroup(groupArr, filterArr, targetEl) {
            for (let filterKey in filterArr) {
                if (filterArr.hasOwnProperty[filterKey] || !groupArr.includes(filterKey)) {
                    continue;
                }
                if (_this.isEmbed && !filterArr[filterKey].inEmbed) {
                    continue;
                }
                targetEl.appendChild(createButton(filterKey, filterArr));
            }
        }

        const groupA = [
            'cropExtend',
            'flip',
            'perspective',
            'resize',
            'rotate',
            'transform',
        ];
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
        const groupC = [
            'grid',
            'noise',
            'pattern',
        ];

        addGroup(groupA, filters, _this.div);

        _this.div.appendChild(BB.el({className: 'gridHr'}));
        addGroup(groupB, filters, _this.div);
        _this.div.appendChild(BB.el({className: 'gridHr'}));
        addGroup(groupC, filters, _this.div);

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