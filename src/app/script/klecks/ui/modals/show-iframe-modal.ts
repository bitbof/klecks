import { BB } from '../../../bb/bb';
import { DynamicModal } from './base/dynamic-modal';
import { LANG } from '../../../language/language';

export function showIframeModal(url: string, isEmbed: boolean) {
    // window very small, modal might look bad
    if (!isEmbed && (window.innerHeight < 500 || window.innerWidth < 700)) {
        window.open(url);
        return;
    }

    const iframe = BB.el({
        tagName: 'iframe',
        custom: {
            src: url,
        },
        css: {
            width: '100%',
            height: '100%',
            opacity: '0',
        },
    });
    setTimeout(() => {
        iframe.style.opacity = ''; // fallback
    }, 500);

    const titleEl = BB.el();

    let linkEl: HTMLElement | undefined;
    if (!isEmbed) {
        linkEl = BB.el({
            tagName: 'a',
            parent: titleEl,
            content: LANG('modal-new-tab'),
            custom: {
                href: 'help',
                target: '_blank',
            },
            onClick: function () {
                popup.close();
            },
        });
        iframe.onload = () => {
            if (linkEl && iframe.contentWindow) {
                BB.setAttributes(linkEl, {
                    href: '' + iframe.contentWindow.location,
                });
            }
            iframe.style.opacity = '';
        };
    }

    const popup = new DynamicModal({
        title: titleEl,
        content: iframe,
        width: 880,
        isMaxHeight: true,
        onClose: () => {
            if (linkEl) {
                iframe.src = 'about:blank';
                BB.destroyEl(linkEl);
                linkEl = undefined;
            }
        },
    });
}
