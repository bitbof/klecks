import { getIconSvg, getIconUrl } from '../../../icon/icon';
import { BB } from '../../../bb/bb';
import klecksLogoImg from 'url:/src/app/img/klecks-logo.png';
import { LANG } from '../../../language/language';
import { PointerListener } from '../../../bb/input/pointer-listener';
import { css } from '../../../bb/base/base';

const newImageImg = getIconUrl('new-image');
const importImg = getIconUrl('import');
const exportImg = getIconUrl('export');
const shareImg = getIconUrl('share');
/**
 * Topmost row of buttons in toolspace (with the app logo)
 */
export class ToolspaceTopRow {
    private readonly rootEl: HTMLElement;

    // ----------------------------------- public -----------------------------------
    constructor(p: {
        logoImg?: string;
        onLogo: () => void;
        onNew: () => void;
        onImport: () => void;
        onSave: () => void;
        onShare: () => void;
        onHelp: () => void;
    }) {
        this.rootEl = BB.el({
            className: 'kl-toolspace-row',
            css: {
                height: 36,
                display: 'flex',
            },
        });

        function createButton(p: {
            onClick: () => void;
            title: string;
            image?: string;
            content?: HTMLElement | SVGSVGElement;
            contain: boolean;
            extraPadding?: number;
            darkInvert?: boolean;
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
                    padding: p.contain ? padding + 'px 0' : '',
                },
            });
            if (p.content) {
                el.append(p.content);
            } else {
                const im = BB.el({
                    className: p.darkInvert ? 'dark-invert' : undefined,
                    id: 'kl-logo-button-im',
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
                onEnterLeave: function (isOver) {
                    el.classList.toggle('toolspace-row-button-hover', isOver);
                },
            });
            return {
                el,
                pointerListener,
            };
        }

        const logoButton = createButton({
            onClick: p.onLogo,
            title: LANG('home'),
            image: p.logoImg ?? klecksLogoImg,
            contain: true,
            darkInvert: true,
        });
        logoButton.el.classList.add('kl-tool-row-border-right');
        css(logoButton.el, {
            width: 46,
        });
        const newButton = createButton({
            onClick: p.onNew,
            title: LANG('file-new'),
            image: newImageImg,
            extraPadding: 1,
            contain: true,
        });
        const importButton = createButton({
            onClick: p.onImport,
            title: LANG('file-import'),
            image: importImg,
            extraPadding: 1,
            contain: true,
        });
        const saveButton = createButton({
            onClick: p.onSave,
            title: LANG('file-save'),
            image: exportImg,
            extraPadding: 1,
            contain: true,
        });

        let shareButton = null;
        if (BB.canShareFiles()) {
            shareButton = createButton({
                onClick: p.onShare,
                title: LANG('file-share'),
                image: shareImg,
                contain: true,
                darkInvert: true,
            });
        }
        const helpButton = createButton({
            onClick: p.onHelp,
            title: LANG('help'),
            content: getIconSvg('help', {
                width: 24,
                height: 24,
                margin: '0 auto',
            }),
            contain: true,
        });
        helpButton.el.style.flexBasis = '0';

        BB.append(this.rootEl, [
            logoButton.el,
            newButton.el,
            importButton.el,
            saveButton.el,
            shareButton ? shareButton.el : undefined,
            helpButton.el,
        ]);
    }

    setLogo(logoImg: string, isPixelated?: boolean, keepOriginalColors?: boolean): void {
        const el = document.getElementById('kl-logo-button-im');
        if (el) {
            el.style.backgroundImage = "url('" + logoImg + "')";
            el.style.imageRendering = isPixelated ? 'pixelated' : '';
            el.classList.toggle('dark-invert', !keepOriginalColors);
        }
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }
}
