import {BB} from '../../../bb/bb';
import {dialogCounter} from '../modals/modal-count';
// @ts-ignore
import toolPaintImg from 'url:~/src/app/img/ui/tool-paint.svg';
// @ts-ignore
import toolFillImg from 'url:~/src/app/img/ui/tool-fill.svg';
// @ts-ignore
import toolTextImg from 'url:~/src/app/img/ui/tool-text.svg';
// @ts-ignore
import toolShapeImg from 'url:~/src/app/img/ui/tool-shape.svg';
// @ts-ignore
import caretDownImg from 'url:~/src/app/img/ui/caret-down.svg';
import {LANG} from '../../../language/language';

/**
 * Toolrow Dropdown. The button where you select: brush, fill, select, transform, etc.
 *
 * p = {
 *     onChange: func(activeStr)
 * }
 *
 * activeStr = 'draw' | 'fill' | 'text'
 *
 * @param p
 * @constructor
 */
export function ToolDropdown(p) {

    let optionArr = ['draw', 'fill', 'text', 'shape'];
    let imArr = [
        toolPaintImg,
        toolFillImg,
        toolTextImg,
        toolShapeImg
    ];
    let titleArr = [
        `${LANG('tool-brush')} [B]`,
        `${LANG('tool-paint-bucket')} [G]`,
        `${LANG('tool-text')} [T]`,
        `${LANG('tool-shape')} [U]`,
    ];
    let currentActiveIndex = 0;
    let isActive = true;
    let isOpen = false;

    //preload images
    setTimeout(function() {
        for (let i = 1; i < imArr.length; i++) {
            let im = new Image();
            im.src = imArr[i];
        }
    }, 100);

    let smallMargin = '6px 0';
    let div = BB.el({
        css: {
            position: 'relative',
            flexGrow: '1'
        }
    });

    let openTimeout;
    let isDragging = false;
    let startX, startY;
    let pointerListener;
    if (BB.hasPointerEvents) {
        pointerListener = new BB.PointerListener({
            target: div,
            maxPointers: 1,
            onPointer: function(event) {
                if (event.type === 'pointerdown') {
                    if (isOpen) {
                        return;
                    }

                    openTimeout = setTimeout(function() {
                        showDropdown();
                    }, 400);
                    isDragging = true;
                    startX = event.pageX;
                    startY = event.pageY;

                } else if (event.type === 'pointermove') {
                    if (isDragging && !isOpen && BB.dist(startX, startY, event.pageX, event.pageY) > 5) {
                        clearTimeout(openTimeout);
                        showDropdown();
                    }

                } else if (event.type === 'pointerup') {
                    clearTimeout(openTimeout);
                    if (isOpen && isDragging) {
                        let target = document.elementFromPoint(event.pageX, event.pageY);
                        for (let i = 0; i < dropdownBtnArr.length; i++) {
                            if (target === dropdownBtnArr[i].wrapper) {
                                closeDropdown();
                                isActive = true;
                                currentActiveIndex = i;
                                updateButton();
                                p.onChange(optionArr[currentActiveIndex]);
                                break;
                            }
                        }
                    }
                    isDragging = false;
                }
            }
        });
    }

    let activeButton = BB.el({
        parent: div,
        className: 'toolspace-row-button nohighlight toolspace-row-button-activated',
        title: titleArr[currentActiveIndex],
        onClick: function(e) {
            if (isActive && !isOpen) {
                e.preventDefault();
                e.stopPropagation();
                showDropdown();
                return;
            }

            isActive = true;
            p.onChange(optionArr[currentActiveIndex]);
            if (isOpen) {
                closeDropdown();
            }
        },
        css: {
            padding: '10px 0',
            pointerEvents: 'auto',
            height: '100%',
            boxSizing: 'border-box'
        }
    });

    let activeButtonIm = BB.el({
        parent: activeButton,
        css: {
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            backgroundSize: 'contain',
            width: 'calc(100% - 7px)',
            height: '100%',
            pointerEvents: 'none',
            opacity: '0.75',
        }
    });

    let arrowButton = BB.el({
        parent: activeButton,
        css: {
            position: 'absolute',
            right: '1px',
            bottom: '1px',
            width: '18px',
            height: '18px',
            //background: '#aaa',
            //borderRadius: '2px',
            cursor: 'pointer',

            backgroundImage: 'url(\'' + caretDownImg + '\')',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            backgroundSize: '60%'
        },
        title: 'More Tools',
        onClick: function(e) {
            e.preventDefault();
            e.stopPropagation();
            showDropdown();
        }
    });


    let overlay = BB.el({
        css: {
            position: 'absolute',
            //background: 'rgba(255,0,0,0.5)',
            left: '0',
            top: '0',
            right: '0',
            bottom: '0'
        }
    });
    let overlayPointerListener = new BB.PointerListener({
        target: overlay,
        pointers: 1,
        onPointer: function(e) {
            if (e.type === 'pointerdown') {
                e.eventPreventDefault();
                closeDropdown();
            }
        }
    });

    let dropdownWrapper = BB.el({
        className: 'tool-dropdown-wrapper',
        css: {
            position: 'absolute',
            width: '100%',
            height: (100 * (optionArr.length - 1)) + '%',
            top: '100%',
            left: '0',
            zIndex: '1',
            boxSizing: 'border-box',
            cursor: 'pointer',
            transition: 'height 0.1s ease-in-out, opacity 0.1s ease-in-out',
            borderBottomLeftRadius: '5px',
            borderBottomRightRadius: '5px',
            overflow: 'hidden',
        }
    });

    let dropdownBtnArr = [];

    function createDropdownButton(p) {
        let result = {};

        let wrapper = BB.el({
            parent: dropdownWrapper,
            className: 'tool-dropdown-button',
            title: p.title,
            css: {
                padding: '10px 0',
                height: (100 / (optionArr.length - 1)) + '%',
                boxSizing: 'border-box'
            },
            onClick: function(e) {
                e.preventDefault();
                e.stopPropagation();
                p.onClick(p.index, p.id);
            }
        });
        (result as any).wrapper = wrapper;
        let im = BB.el({
            parent: wrapper,
            css: {
                backgroundImage: 'url(\'' + p.image + '\')',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                backgroundSize: 'contain',
                height: '100%',
                pointerEvents: 'none',
                opacity: '0.75'
            }
        });

        // --- interface ---
        (result as any).show = function(b) {
            wrapper.style.display = b ? 'block' : 'none';
        };

        (result as any).setIsSmall = function(b) {
            wrapper.style.padding = b ? smallMargin : '10px 0';
        };

        return result;
    }

    function onClickDropdownBtn(index, id) {
        closeDropdown();

        isActive = true;
        currentActiveIndex = index;

        updateButton();

        p.onChange(optionArr[currentActiveIndex]);
    }

    for (let i = 0; i < optionArr.length; i++) {
        dropdownBtnArr.push(createDropdownButton({
            index: i,
            id: optionArr[i],
            image: imArr[i],
            title: titleArr[i],
            onClick: onClickDropdownBtn
        }));
    }

    function showDropdown() {
        dialogCounter.increase(0.5);
        isOpen = true;

        for (let i = 0; i < optionArr.length; i++) {
            dropdownBtnArr[i].show(currentActiveIndex !== i);
        }

        arrowButton.style.display = 'none';
        div.style.zIndex = '1';
        document.body.appendChild(overlay);
        div.appendChild(dropdownWrapper);
    }

    function closeDropdown() {
        dialogCounter.decrease(0.5);
        isOpen = false;
        arrowButton.style.removeProperty('display');
        div.style.removeProperty('z-index');
        document.body.removeChild(overlay);

        div.removeChild(dropdownWrapper);
    }

    function updateButton() {
        activeButton.title = titleArr[currentActiveIndex];
        activeButtonIm.style.backgroundImage = 'url(\'' + imArr[currentActiveIndex] + '\')';
    }
    updateButton();


    // --- interface ---

    this.setIsSmall = function(b) {
        activeButton.style.padding = b ? smallMargin : '10px 0';
        for (let i = 0; i < optionArr.length; i++) {
            dropdownBtnArr[i].setIsSmall(b);
        }
        if (b) {
            arrowButton.style.width = '14px';
            arrowButton.style.height = '14px';
        } else {
            arrowButton.style.width = '18px';
            arrowButton.style.height = '18px';
        }
    };

    this.setActive = function(activeStr) {
        if (optionArr.includes(activeStr)) {
            isActive = true;
            for (let i = 0; i < optionArr.length; i++) {
                if (optionArr[i] === activeStr) {
                    currentActiveIndex = i;
                    break;
                }
            }
            BB.addClassName(activeButton, 'toolspace-row-button-activated');
            updateButton();
        } else {
            isActive = false;
            BB.removeClassName(activeButton, 'toolspace-row-button-activated');
        }
    };

    this.getActive = function() {
        return optionArr[currentActiveIndex];
    };

    this.getElement = function() {
        return div;
    };
}