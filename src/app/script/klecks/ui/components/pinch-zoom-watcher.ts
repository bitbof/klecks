import { BB } from '../../../bb/bb';

export class PinchZoomWatcher {
    // -------------------- public ----------------------
    constructor() {
        if (!('visualViewport' in window) || visualViewport === null) {
            return;
        }
        const viewport = visualViewport;

        let isHidden = false;
        const rootEl = BB.el({
            content: 'Double-tap or pinch-out to reset browser zoom.',
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
            },
        });
        BB.el({
            parent: rootEl,
            tagName: 'button',
            content: 'Ignore',
            onClick: () => {
                isHidden = true;
                iframe.remove();
                rootEl.remove();
            },
            css: {
                pointerEvents: 'initial',
            },
        });

        const iframe = BB.el({
            tagName: 'iframe',
            css: {
                position: 'fixed',
                width: '100vw',
                height: '100vh',
                zIndex: '99',
                opacity: '0',
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

            /*console.log('---check---');
            console.log(testEl);*/
            const rect = testEl.getBoundingClientRect();
            //console.log(rect);
            testEl.remove();

            const isZoomed =
                (viewport.width !== Math.round(rect.width) ||
                    viewport.height !== Math.round(rect.height)) &&
                viewport.scale > 1;
            //console.log('rect', BB.copyObj(rect));
            //console.log('viewport', { width: viewport.width, height: viewport.height });

            if (isZoomed) {
                BB.css(rootEl, {
                    left: viewport.offsetLeft + 'px',
                    top: viewport.offsetTop + 'px',
                    width: viewport.width + 'px',
                    height: viewport.height + 'px',
                    //fontSize: 1 / viewport.scale + 'rem',
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
