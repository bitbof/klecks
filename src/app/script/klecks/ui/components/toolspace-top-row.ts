import {BB} from '../../../bb/bb';
// @ts-ignore
import klecksLogoImg from 'url:~/src/app/img/klecks-logo.png';
// @ts-ignore
import newImageImg from 'url:~/src/app/img/ui/new-image.svg';
// @ts-ignore
import importImg from 'url:~/src/app/img/ui/import.svg';
// @ts-ignore
import exportImg from 'url:~/src/app/img/ui/export.svg';
// @ts-ignore
import shareImg from 'url:~/src/app/img/ui/share.svg';
// @ts-ignore
import helpImg from 'url:~/src/app/img/ui/help.svg';
import {LANG} from '../../../language/language';


/**
 * Topmost row of buttons in toolspace (with the app logo)
 *
 * p = { // button click callbacks
 *      logoImg: img,
 *     onLogo: function(),
 *     onNew: function(),
 *     onImport: function(),
 *     onSave: function(),
 *     onShare: function(),
 *     onHelp: function()
 * }
 *
 * @param p
 * @constructor
 */
export function ToolspaceTopRow(p) {
    let div = document.createElement('div');
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
                padding: p.contain ? padding + 'px 0' : ''
            }
        });
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

    let logoButton = createButton({
        onClick: p.onLogo,
        title: LANG('home'),
        image: p.logoImg ? p.logoImg : klecksLogoImg,
        contain: true
    });
    logoButton.style.width = '45px';
    logoButton.style.borderRight = '1px solid rgb(212, 212, 212)';
    let newButton = createButton({
        onClick: p.onNew,
        title: LANG('file-new'),
        image: newImageImg,
        extraPadding: 1,
        contain: true
    });
    let importButton = createButton({
        onClick: p.onImport,
        title: LANG('file-import'),
        image: importImg,
        extraPadding: 1,
        contain: true
    });
    let saveButton = createButton({
        onClick: p.onSave,
        title: LANG('file-save'),
        image: exportImg,
        extraPadding: 1,
        contain: true
    });

    let shareButton = null;
    if (BB.canShareFiles()) {
        shareButton = createButton({
            onClick: p.onShare,
            title: LANG('file-share'),
            image: shareImg,
            contain: true
        });
    }
    let helpButton = createButton({
        onClick: p.onHelp,
        title: LANG('help'),
        image: helpImg,
        contain: true
    });

    div.appendChild(logoButton);
    div.appendChild(newButton);
    div.appendChild(importButton);
    div.appendChild(saveButton);
    if (shareButton) {
        div.appendChild(shareButton);
    }
    div.appendChild(helpButton);


    // --- interface ---
    this.getElement = function() {
        return div;
    }
}