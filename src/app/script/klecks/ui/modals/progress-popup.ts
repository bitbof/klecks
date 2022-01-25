import {BB} from '../../../bb/bb';
// @ts-ignore
import checkImg from 'url:~/src/app/img/ui/check.svg';
// @ts-ignore
import loadingImg from 'url:~/src/app/img/ui/loading.gif';

export function ProgressPopup(p) {
    let div = document.createElement("div");

    let bg = document.createElement("div");
    let box = document.createElement("div");
    let label = document.createElement("div");
    label.innerHTML = '<img src="' + loadingImg + '"> Uploading...<b>' + 0 + "%</b>";
    let button = document.createElement("button");
    button.innerHTML = '<img height="17" src="' + checkImg + '"> Cancel';
    div.appendChild(bg);
    div.appendChild(box);
    box.appendChild(label);
    box.appendChild(button);
    BB.css(button, {
        width: "100px",
        position: "absolute",
        right: "20px",
        bottom: "20px"
    });

    BB.css(div, {
        position: "absolute",
        left: '0',
        top: '0',
        width: "100%",
        height: "100%"
    });
    BB.css(bg, {
        position: "absolute",
        left: '0',
        top: '0',
        width: "100%",
        height: "100%",
        background: "rgba(111,111,111,0.4)"
    });
    BB.css(box, {
        position: "absolute",
        left: "50%",
        top: "45%",
        padding: "20px",
        boxSizing: "border-box",
        width: "300px",
        height: "100px",
        marginLeft: "-150px",
        marginTop: "-50px",
        background: "#fff",
        boxShadow: "2px 2px 2px rgba(0,0,0,0.5)",
        borderRadius: "10px"
    });

    button.onclick = function () {
        p.callback();
    };

    this.update = function (v, done) {
        if (v > -1 && !done) {
            label.innerHTML = '<img src="' + loadingImg + '"> Uploading...<b>' + v + "%</b>";
        }
        if (v === 100 && done === true) {
            label.innerHTML = "<b>Successful Upload</b>";
            button.innerHTML = '<img height="17" src="' + checkImg + '"> Ok';
            button.focus();
            box.style.background = "rgb(223, 255, 194)";
        }
        if (v === -1) {
            label.innerHTML = "<b>Error: Upload Failed</b>";
            button.innerHTML = '<img height="17" src="' + checkImg + '"> Ok';
            box.style.background = "rgb(255, 194, 194)";
        }
    };
    this.getDiv = function () {
        return div;
    };
}