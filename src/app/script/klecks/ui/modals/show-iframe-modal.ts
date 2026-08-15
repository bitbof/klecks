import { BB } from '../../../bb/bb';
import { DynamicModal } from './base/dynamic-modal';
import { LANG } from '../../../language/language';

type TIframeModalOptions = {
    allowSmallScreenWindowOpen?: boolean;
    showOpenInNewTabLink?: boolean;
    closeOnMessage?: {
        action: string;
        origin: string;
    };
    modalWidth?: number;
    modalHeight?: number;
    iframeWidth?: string;
    iframeHeight?: string;
    iframeTitle?: string;
};

export function showIframeModal(url: string, isEmbed: boolean, options?: TIframeModalOptions) {
    // window very small, modal might look bad
    if (
        !isEmbed &&
        options?.allowSmallScreenWindowOpen !== false &&
        (window.innerHeight < 500 || window.innerWidth < 700)
    ) {
        window.open(url);
        return;
    }

    const iframe = BB.el({
        tagName: 'iframe',
        custom: {
            src: url,
            title: options?.iframeTitle || 'Iframe Content',
        },
        css: {
            width: options?.iframeWidth || '100%',
            height: options?.iframeHeight || '100%',
            border: 0,
            opacity: 0,
        },
    });
    setTimeout(() => {
        iframe.style.opacity = ''; // fallback
    }, 500);

    const titleEl = BB.el();

    const showOpenInNewTabLink = !isEmbed && options?.showOpenInNewTabLink !== false;

    let linkEl: HTMLElement | undefined;
    if (showOpenInNewTabLink) {
        linkEl = BB.el({
            tagName: 'a',
            parent: titleEl,
            content: LANG('modal-new-tab'),
            custom: {
                href: url,
                target: '_blank',
            },
            onClick: function () {
                popup.close();
            },
        });
        iframe.onload = () => {
            if (linkEl && iframe.contentWindow) {
                try {
                    BB.setAttributes(linkEl, {
                        href: '' + iframe.contentWindow.location,
                    });
                } catch (e) {
                    // might not have access
                }
            }
            iframe.style.opacity = '';
        };
    }

    const onMessage = options?.closeOnMessage
        ? (event: MessageEvent) => {
              if (event.origin !== options.closeOnMessage?.origin) {
                  return;
              }
              if (
                  typeof event.data !== 'object' ||
                  !event.data ||
                  event.data.action !== options.closeOnMessage?.action
              ) {
                  return;
              }
              if (event.source !== iframe.contentWindow) {
                  return;
              }
              popup.close();
          }
        : undefined;
    if (onMessage) {
        window.addEventListener('message', onMessage);
    }

    const popup = new DynamicModal({
        title: titleEl,
        content: iframe,
        width: options?.modalWidth || 880,
        height: options?.modalHeight,
        isMaxHeight: true,
        onClose: () => {
            if (onMessage) {
                window.removeEventListener('message', onMessage);
            }
            iframe.src = 'about:blank';
            if (linkEl) {
                BB.destroyEl(linkEl);
                linkEl = undefined;
            }
        },
    });
}
