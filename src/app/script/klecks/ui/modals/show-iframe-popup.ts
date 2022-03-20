import {BB} from '../../../bb/bb';
import {Popup} from './popup';
import {LANG} from '../../../language/language';

export function showIframePopup(url, isEmbed) {
    if (!isEmbed && (window.innerHeight < 500 || window.innerWidth < 700)) {
        window.open(url);
        return;
    }

    let iframe = BB.el({
        tagName: 'iframe',
        custom: {
            src: url,
        },
        css: {
            width: '100%',
            height: '100%'
        }
    }) as HTMLIFrameElement;
    let titleEl = BB.el({});

    let linkEl;
    if (!isEmbed) {
        linkEl = BB.el({
            tagName: 'a',
            parent: titleEl,
            content: LANG('modal-new-tab'),
            custom: {
                href: 'help',
                target: '_blank',
            },
            onClick: function() {
                popup.close();
            }
        }) as HTMLAnchorElement;
        iframe.onload = function() {
            BB.setAttributes(linkEl, {
                href: '' + iframe.contentWindow.location,
            });
        };
    }


    let popup = new Popup({
        title: titleEl,
        content: iframe,
        width: 880,
        isMaxHeight: true,
        onClose: () => {
            if (linkEl) {
                BB.destroyEl(linkEl);
            }
        }
    });

}