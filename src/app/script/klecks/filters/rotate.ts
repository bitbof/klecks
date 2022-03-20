import {BB} from '../../bb/bb';
import {IFilterApply, IFilterGetDialogParam} from '../kl.types';
import {LANG} from '../../language/language';

export const rotate = {

    getDialog(params: IFilterGetDialogParam) {
        let canvas = params.canvas;
        if (!canvas)
            return false;

        let fit = BB.fitInto(canvas.getWidth(), canvas.getHeight(), 280, 200, 1);
        let w = parseInt('' + fit.width), h = parseInt('' + fit.height);

        let previewFactor = w / canvas.getWidth();
        let tempCanvas = BB.canvas(w, h);
        tempCanvas.style.display = 'block';
        tempCanvas.getContext("2d").drawImage(canvas.getCompleteCanvas(previewFactor), 0, 0, w, h);


        let div = document.createElement("div");
        let result: any = {
            element: div
        };
        let deg = 0;
        div.innerHTML = LANG('filter-rotate-description') + "<br/><br/>";

        let first = true;

        function update() {
            (canvasWrapper.style as any).WebkitTransform = "rotate(" + deg + "deg)";
            (canvasWrapper.style as any).MozTransform = "rotate(" + deg + "deg)";
            (canvasWrapper.style as any).OTransform = "rotate(" + deg + "deg)";
            (canvasWrapper.style as any).msTransform = "rotate(" + deg + "deg)";
            if (Math.abs(deg % 180) === 90) {
                //height has to fit width because of rotation
                let fit = BB.fitInto(h, w, 280, 200, 1);
                let scale = parseInt('' + fit.height) / w;
                (canvasWrapper.style as any).WebkitTransform = "rotate(" + deg + "deg) scale(" + scale + ")";
                (canvasWrapper.style as any).MozTransform = "rotate(" + deg + "deg) scale(" + scale + ")";
                (canvasWrapper.style as any).OTransform = "rotate(" + deg + "deg) scale(" + scale + ")";
                (canvasWrapper.style as any).msTransform = "rotate(" + deg + "deg) scale(" + scale + ")";
            }
        }

        let btnPlus = document.createElement("button");
        btnPlus.innerHTML = "<span style='font-size: 1.3em'>⟳</span> 90°";
        let btnMinus = document.createElement("button");
        btnMinus.innerHTML = "<span style='font-size: 1.3em'>⟲</span> 90°";
        btnMinus.style.marginRight = '5px';


        btnPlus.onclick = function () {
            deg += 90;
            update();
        };
        btnMinus.onclick = function () {
            deg -= 90;
            update();
        };

        div.appendChild(btnMinus);
        div.appendChild(btnPlus);

        let previewWrapper = document.createElement("div");
        BB.css(previewWrapper, {
            width: "340px",
            marginLeft: "-20px",
            height: "220px",
            display: "table",
            backgroundColor: "#9e9e9e",
            marginTop: "10px",
            boxShadow: "rgba(0, 0, 0, 0.2) 0px 1px inset, rgba(0, 0, 0, 0.2) 0px -1px inset",
            overflow: "hidden",
            position: "relative",
            userSelect: 'none',
            colorScheme: 'only light',
        });

        let previewcell = document.createElement("div");
        previewcell.style.display = "table-cell";
        previewcell.style.verticalAlign = "middle";
        let canvasWrapper = BB.appendTextDiv(previewcell, "");
        canvasWrapper.appendChild(tempCanvas);
        previewWrapper.appendChild(previewcell);
        canvasWrapper.style.width = w + "px";
        canvasWrapper.style.height = h + "px";
        canvasWrapper.style.marginLeft = "auto";
        canvasWrapper.style.marginRight = "auto";
        canvasWrapper.style.boxShadow = "0 0 5px rgba(0,0,0,0.8)";
        canvasWrapper.style.overflow = "hidden";
        BB.createCheckerDataUrl(4, function (url) {
            canvasWrapper.style.background = "url(" + url + ")";
        });
        canvasWrapper.style.transition = "all 0.2s ease-out";

        div.appendChild(previewWrapper);
        update();

        result.getInput = function () {
            return {
                deg: deg
            };
        };
        return result;
    },

    apply(params: IFilterApply) {
        let canvas = params.canvas;
        let history = params.history;
        let deg = params.input.deg;
        if (!canvas || !history)
            return false;
        history.pause(true);
        canvas.rotate(deg);
        history.pause(false);
        history.push({
            tool: ["filter", "rotate"],
            action: "apply",
            params: [{
                input: params.input
            }]
        });
        return true;
    }

};