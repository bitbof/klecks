import {BB} from '../../../bb/bb';
// @ts-ignore
import invertedBorderImg from 'url:~/src/app/img/ui/inverted-border.svg';

/**
 * row of tabs. uses css class .tabrow-tab
 *
 * p = {
 *     initialId: string, // e.g. 'draw'
 *     useAccent: boolean,
 *     tabArr: [
 *         {
 *             id: string, // e.g. 'draw',
 *             label: string, // optional
 *             image: string, // optional background image
 *             title: string, // optional
 *             isVisible: boolean, // optional - default is true
 *             onOpen: function(),
 *             onClose: function(),
 *             css: {...},
 *         }
 *     ]
 * }
 *
 * @param p
 * @constructor
 */
export function TabRow(p) {
    let _this = this;
    let height = 35;
    let div = BB.el({
        className: 'tabrow',
        css: {
            height: height + 'px'
        }
    });

    let tabArr = []; //creates its own internal arr
    let openedTabObj = null;

    const roundSize = 10;
    const roundRight = BB.el({
        css: {
            width: roundSize + 'px',
            height: roundSize + 'px',
            backgroundImage: `url('${invertedBorderImg}')`,
            backgroundSize: 'cover',
            position: 'absolute',
            right: -roundSize + 'px',
            bottom: '0',
            pointerEvents: 'none',
        }
    });
    const roundLeft = BB.el({
        css: {
            width: roundSize + 'px',
            height: roundSize + 'px',
            backgroundImage: `url('${invertedBorderImg}')`,
            backgroundSize: 'cover',
            position: 'absolute',
            left: -roundSize + 'px',
            bottom: '0',
            transform: 'scale(-1,1)',
            pointerEvents: 'none',
        }
    });

    function createTab(pTabObj, initialId, useAccent) {
        let result: any = {
            id: pTabObj.id,
            isVisible: 'isVisible' in pTabObj ? pTabObj.isVisible : true,
            onOpen: pTabObj.onOpen,
            onClose: pTabObj.onClose,
            update: function(openedTabObj) {
                tabDiv.className = openedTabObj === result ? (useAccent ? 'tabrow-tab tabrow-tab-opened-accented' : 'tabrow-tab tabrow-tab-opened') : 'tabrow-tab';
                tabDiv.style.display = result.isVisible ? 'block' : 'none';
            }
        };
        let tabDiv = BB.el({
            content: 'label' in pTabObj ? pTabObj.label : '',
            title: 'title' in pTabObj ? pTabObj.title : undefined,
            className: initialId === result.id ? (useAccent ? 'tabrow-tab tabrow-tab-opened-accented' : 'tabrow-tab tabrow-tab-opened') : 'tabrow-tab',
            css: {
                lineHeight: height + 'px',
                display: result.isVisible ? 'block' : 'none',
                zIndex: '0',
            },
            onClick: function() {
                if (openedTabObj === result) {
                    return;
                }
                _this.open(result.id);
            }
        });
        result.div = tabDiv;
        if ('image' in pTabObj) {
            BB.css(tabDiv, {
                backgroundImage: 'url(\'' + pTabObj.image + '\')',
                backgroundSize: (height - 7) + 'px'
            });
        }
        if ('css' in pTabObj) {
            BB.css(tabDiv, pTabObj.css);
        }
        div.appendChild(tabDiv);

        let pointerListener = new BB.PointerListener({ // because :hover causes problems w touch
            target: tabDiv,
            onEnterLeave: function(isOver) {
                if (isOver) {
                    BB.addClassName(tabDiv, 'tabrow-tab-hover');
                } else {
                    BB.removeClassName(tabDiv, 'tabrow-tab-hover');
                }
            }
        });

        if (initialId === result.id) {
            result.onOpen();
            result.div.appendChild(roundRight);
            result.div.appendChild(roundLeft);
        } else {
            result.onClose();
        }

        return result;
    }

    for (let i = 0; i < p.tabArr.length; i++) {
        tabArr.push(createTab(p.tabArr[i], p.initialId, p.useAccent));
    }

    for (let i = 0; i < tabArr.length; i++) {
        if (tabArr[i].id === p.initialId) {
            openedTabObj = tabArr[i];
        }
    }
    if (openedTabObj === null) {
        throw 'invalid initialId';
    }

    function update() {
        for (let i = 0; i < tabArr.length; i++) {
            tabArr[i].update(openedTabObj);
        }
    }

    // --- interface ---
    this.getElement = function() {
        return div;
    };

    this.open = function(tabId) {
        for (let i = 0; i < tabArr.length; i++) {
            if (tabArr[i].id === tabId) {
                if (openedTabObj === tabArr[i]) { // already open
                    return;
                }
                openedTabObj.onClose();
                openedTabObj = tabArr[i];
                openedTabObj.onOpen();
                openedTabObj.div.appendChild(roundRight);
                openedTabObj.div.appendChild(roundLeft);
                update();
                return;
            }
        }
        throw 'TabRow.open - invalid tabId';
    };

    this.getOpenedTabId = function() {
        return '' + openedTabObj.id;
    };

    this.setIsVisible = function(tabId, isVisible) {
        for (let i = 0; i < tabArr.length; i++) {
            if (tabArr[i].id === tabId) {
                tabArr[i].isVisible = !!isVisible;
                update();
                return;
            }
        }
        throw 'TabRow.setIsVisible - invalid tabId';
    };
}