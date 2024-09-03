import { BB } from '../../../bb/bb';
import { LANG } from '../../../language/language';

/**
 * Users can get stuck when pinch-zooming in (via double tapping or pinching).
 * This overlay helps users zoom out again. It automatically shows up and hides
 * itself.
 */
export class PinchZoomWatcher {
    // -------------------- public ----------------------
    constructor() {
        if (!('visualViewport' in window) || visualViewport === null) {
            return;
        }
        const viewport = visualViewport;

        let isHidden = false;
        const rootEl = BB.el({
            content: LANG('browser-zoom-help'),
            className: 'kl-pinch-overlay',
            css: {
                position: 'fixed',
                pointerEvents: 'none',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: '100',
                flexDirection: 'column',
                gap: '10px',
                padding: '10px',
                backdropFilter: 'blur(3px)',
            },
        });
        BB.el({
            parent: rootEl,
            tagName: 'button',
            content: LANG('dismiss'),
            onClick: () => {
                isHidden = true;
                iframe.remove();
                rootEl.remove();
            },
            css: {
                pointerEvents: 'initial',
            },
        });

        // iframe allows pinch-zooming the page even if viewport meta tag set to user-scalable=no
        const iframe = BB.el({
            tagName: 'iframe',
            css: {
                position: 'fixed',
                width: '100vw',
                height: '100vh',
                zIndex: '99',
                opacity: '0', // can't change iframe background color in some browsers
            },
        });

        let isInDom = false;
        function check() {
            if (isHidden) {
                return;
            }
            const testEl = BB.el({
                parent: document.body,
                css: {
                    position: 'fixed',
                    inset: '0',
                    zIndex: '-1',
                },
            });

            const rect = testEl.getBoundingClientRect();
            testEl.remove();

            const isZoomed =
                (viewport.width !== Math.round(rect.width) ||
                    viewport.height !== Math.round(rect.height)) &&
                viewport.scale > 1;

            if (isZoomed) {
                BB.css(rootEl, {
                    left: viewport.offsetLeft + 'px',
                    top: viewport.offsetTop + 'px',
                    width: viewport.width + 'px',
                    height: viewport.height + 'px',
                });
                if (!isInDom) {
                    document.body.append(iframe);
                    document.body.append(rootEl);
                }
            } else {
                if (isInDom) {
                    iframe.remove();
                    rootEl.remove();
                }
            }
            isInDom = isZoomed;
        }
        viewport.addEventListener('resize', check);
        viewport.addEventListener('scroll', check);
        setTimeout(check);
    }
}
