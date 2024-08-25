import { BB } from '../bb/bb';
import uiSwapImg from '/src/app/img/ui/ui-swap-lr.svg';
import helpImg from '/src/app/img/ui/help.svg';
import { LANG } from '../language/language';
import { PointerListener } from '../bb/input/pointer-listener';

/**
 * Topmost row of buttons in toolspace. (embed)
 *
 * @param p
 * @constructor
 */
export class EmbedToolspaceTopRow {
    private readonly rootEl: HTMLElement;

    // ----------------------------------- public -----------------------------------

    constructor(p: { onSubmit: () => void; onLeftRight: () => void; onHelp: () => void }) {
        this.rootEl = BB.el({
            className: 'kl-toolspace-row',
            css: {
                height: '36px',
                display: 'flex',
            },
        });

        function createButton(p: {
            title: string;
            content?: HTMLElement;
            image?: string;
            onClick: () => void;
            extraPadding?: number;
            contain: boolean;
        }): {
            el: HTMLElement;
            pointerListener: PointerListener;
        } {
            const padding = 6 + (p.extraPadding ? p.extraPadding : 0);
            const el = BB.el({
                className: 'toolspace-row-button nohighlight',
                title: p.title,
                onClick: p.onClick,
                css: {
                    padding: p.content ? '' : p.contain ? padding + 'px 0' : '',
                },
            });
            if (p.content) {
                el.append(p.content);
            } else {
                const im = BB.el({
                    className: 'dark-invert',
                    css: {
                        backgroundImage: "url('" + p.image + "')",
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'center',
                        backgroundSize: p.contain ? 'contain' : '',
                        //filter: 'grayscale(1)',
                        height: '100%',
                    },
                });
                im.style.pointerEvents = 'none';
                el.append(im);
            }
            const pointerListener = new BB.PointerListener({
                // because :hover causes problems w touch
                target: el,
                onEnterLeave: function (isOver): void {
                    el.classList.toggle('toolspace-row-button-hover', isOver);
                },
            });

            return {
                el,
                pointerListener,
            };
        }

        const submitButton = createButton({
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
                    height: '100%',
                },
            }),
            contain: true,
        });
        submitButton.el.style.width = '45px';

        const helpButton = createButton({
            onClick: p.onHelp,
            title: LANG('help'),
            image: helpImg,
            contain: true,
        });

        const leftRightButton = createButton({
            onClick: p.onLeftRight,
            title: LANG('switch-ui-left-right'),
            image: uiSwapImg,
            contain: true,
        });

        this.rootEl.append(submitButton.el, leftRightButton.el, helpButton.el);
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }
}
