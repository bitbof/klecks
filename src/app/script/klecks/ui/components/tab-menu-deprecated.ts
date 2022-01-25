import {BB} from '../../../bb/bb';

/**
 * TabMenu deprecated - soon removed
 * @param params
 * @returns {HTMLDivElement}
 * @constructor
 */
export function TabMenu(params) {
    let div = document.createElement("div");
    let width = params.width;
    div.className = params.cssContainer;
    BB.css(div, {
        width: width + "px",
        webkitTapHighlightColor:  'rgba(255, 255, 255, 0)'
    });
    let currentTabId = 0;
    if (params.init) {
        currentTabId = params.init;
    }

    let entries = [];

    function updateEntries() {
        for (let i = 0; i < entries.length; i++) {
            if (params.entries[i].custom) {
                continue;
            }
            if (i === currentTabId) {
                entries[i].className = params.cssSelected;
                BB.css(entries[i], {
                    cursor: "default"
                });
            } else {
                entries[i].className = params.css;
                BB.css(entries[i], {
                    cursor: "pointer"
                });
            }
        }
    }
    //init entries
    let widthSum = 0;
    for (let i = 0; i < params.entries.length; i++) {
        (function (i) {
            if (params.entries[i].custom) {
                entries[i] = params.entries[i].content;
                entries[i].style.cssFloat = "left";
                div.appendChild(entries[i]);
            } else {
                entries[i] = document.createElement("div");
                BB.setEventListener(entries[i], 'onpointerdown', function (e) {
                    return false;
                });
                BB.css(entries[i], {
                    width: (parseInt('' + (width / params.entries.length))) + "px",
                    textAlign: "center",
                    cssFloat: "left",
                    overflow: "hidden",
                    borderTopLeftRadius: '4px',
                    borderTopRightRadius: '4px'
                });
                if(i === params.entries.length - 1) {
                    entries[i].style.width = width - widthSum + 'px';
                } else {
                    widthSum += parseInt('' + (width / params.entries.length));
                }
                if (params.entries[i].tooltip) {
                    entries[i].title = params.entries[i].tooltip;
                }
                if (params.custom) {
                    entries[i].style.width = params.entries[i].width + "px";
                }
                if (params.height) {
                    entries[i].style.height = params.height + "px";
                }
                entries[i].innerHTML = params.entries[i].content;
                if (params.entries[i].name) {
                    div.title = params.entries[i].name;
                }
                entries[i].onclick = function () {
                    (div as any).show(i);
                };
                if (i === currentTabId) {
                    params.entries[i].show();
                } else {
                    params.entries[i].hide();
                }
                div.appendChild(entries[i]);
            }
        })(i);
    }

    (div as any).show = function (i) {
        if (i === currentTabId) {
            return;
        }
        if (params.entries[i].keepState) {
            params.entries[i].show();
        } else {
            params.entries[currentTabId].hide();
            params.entries[i].show();
            currentTabId = i;
            updateEntries();
        }
    };

    let clearDiv = document.createElement("div");
    clearDiv.style.clear = "both";
    updateEntries();
    div.appendChild(clearDiv);

    return div;
}
