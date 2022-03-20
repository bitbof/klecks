/**
 * Topmost row of buttons in toolspace
 *
 * p = { // button click callbacks
 *     onSubmit: function(),
 *     onLeftRight: function(),
 *     onHelp: function()
 * }
 *
 * @param p
 * @constructor
 */
import {BB} from "../bb/bb";
// @ts-ignore
import uiSwapImg from 'url:~/src/app/img/ui/ui-swap-lr.svg';
// @ts-ignore
import helpImg from 'url:~/src/app/img/ui/help.svg';
import {LANG} from '../language/language';

export class ToolspaceTopRow {
    el: HTMLDivElement;

    constructor(p: {onSubmit: () => void, onLeftRight: () => void, onHelp: () => void}) {
        let div = document.createElement('div');
        this.el = div;
        BB.css(div, {
            height: '36px',
            //background: '#f00',
            display: 'flex',
            backgroundImage: 'linear-gradient(to top, rgba(255, 255, 255, 0) 20%, rgba(255, 255, 255, 0.6) 100%)'
        });

        function createButton(p) {
            let padding = 6 + (p.extraPadding ? p.extraPadding : 0);
            let result = BB.el({
                className: 'toolspace-row-button nohighlight',
                title: p.title,
                onClick: p.onClick,
                css: {
                    padding: p.content ? '' : (p.contain ? padding + 'px 0' : ''),
                }
            });
            if (p.content) {
                result.appendChild(p.content);
            } else {
                let im = BB.el({
                    css: {
                        backgroundImage: 'url(\'' + p.image + '\')',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'center',
                        backgroundSize: p.contain ? 'contain' : '',
                        //filter: 'grayscale(1)',
                        height: '100%'
                    }
                });
                im.style.pointerEvents = 'none';
                result.appendChild(im);
            }
            (result as any).pointerListener = new BB.PointerListener({ // because :hover causes problems w touch
                target: result,
                onEnterLeave: function(isOver) {
                    if (isOver) {
                        BB.addClassName(result, 'toolspace-row-button-hover');
                    } else {
                        BB.removeClassName(result, 'toolspace-row-button-hover');
                    }
                }
            });
            return result;
        }

        let submitButton = createButton({
            onClick: p.onSubmit,
            title: LANG('submit-title'),
            content: BB.el({
                content: LANG('submit'),
                className: 'toolspace-row-button__submit',
                css: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '100%'
                }
            }),
            contain: true
        });
        submitButton.style.width = '45px';

        let helpButton = createButton({
            onClick: p.onHelp,
            title: LANG('help'),
            image: helpImg,
            contain: true
        });

        let leftRightButton = createButton({
            onClick: p.onLeftRight,
            title: LANG('switch-ui-left-right'),
            image: uiSwapImg,
            contain: true
        });

        div.appendChild(submitButton);
        div.appendChild(leftRightButton);
        div.appendChild(helpButton);
    }

    getElement() {
        return this.el;
    }
}
