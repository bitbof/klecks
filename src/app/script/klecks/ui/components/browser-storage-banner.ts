import { getIconUrl } from '../../../icon/icon';
import { BB } from '../../../bb/bb';
import * as classes from './browser-storage-banner.module.scss';
import { LANG } from '../../../language/language';
import { ProjectStore } from '../../storage/project-store';
import { KlRecoveryManager } from '../../storage/kl-recovery-manager';
import { css, fitInto, sleep } from '../../../bb/base/base';
import { CrossTabChannel } from '../../../bb/base/cross-tab-channel';
import { KlHistory } from '../../history/kl-history';

const cancelImg = getIconUrl('cancel');
export type TBrowserStorageBannerParams = {
    projectStore?: ProjectStore;
    klRecoveryManager?: KlRecoveryManager;
    klHistory: KlHistory;
    onOpenBrowserStorage: () => void;
};

export async function runBrowserStorageBanner(p: TBrowserStorageBannerParams): Promise<void> {
    /*
    only show banner if all:
    - nothing was recovered
    - project store is not empty
    - no other tab has this project already open (prevent confusion)
     */

    if (!p.projectStore) {
        // no store -> noop
        return;
    }

    const openedProjectIds: string[] = [];
    {
        const crossTabChannel = new CrossTabChannel('kl-tab-communication');
        // This subscription stays up during run of application.
        // It's to ensure other tabs know if the browser storage project is already opened.
        crossTabChannel.subscribe((message) => {
            if (message.type === 'request-project-ids') {
                crossTabChannel.postMessage({
                    type: 'response-project-id',
                    id: p.klHistory.getComposed().projectId.value,
                });
            }
        });
        const otherIdListener = (message: any) => {
            if (message.type === 'response-project-id') {
                openedProjectIds.push(message.id);
            }
        };
        crossTabChannel.subscribe(otherIdListener);
        crossTabChannel.postMessage({ type: 'request-project-ids' });
        await sleep(100);
        crossTabChannel.unsubscribe(otherIdListener);
    }

    if (p.klRecoveryManager?.getTabId() !== undefined) {
        // something already recovered -> noop
        return;
    }
    const meta = await p.projectStore.readMeta();
    if (!meta) {
        // nothing stored -> noop
        return;
    }

    if (openedProjectIds.includes(meta.projectId)) {
        // already open in other tab -> noop
        return;
    }

    const fit = fitInto(meta.thumbnail.width, meta.thumbnail.height, 100, 100);
    css(meta.thumbnail, {
        width: fit.width,
        height: fit.height,
    });

    const closeButton = BB.el({
        tagName: 'button',
        className: classes.closeButton + ' popup-x',
        content: `<img alt="${LANG('modal-close')}" height="20" src="${cancelImg}">`,
        title: LANG('modal-close'),
        custom: {
            tabindex: '0',
        },
    });
    closeButton.onclick = close;

    const preview = BB.el({
        className: classes.preview,
        content: meta.thumbnail,
        title: LANG('file-storage-open'),
    });
    preview.onclick = () => {
        close();
        p.onOpenBrowserStorage();
    };
    const title = BB.el({
        content: LANG('file-storage'),
    });
    const buttonClass = classes.btn;
    const openBtn = BB.el({
        tagName: 'button',
        className: ['kl-button', 'kl-button-primary', buttonClass],
        content: LANG('file-storage-open'),
        custom: {
            tabIndex: '-1',
        },
    });
    openBtn.onclick = () => {
        close();
        p.onOpenBrowserStorage();
    };
    const rightCol = BB.el({
        className: classes.rightCol,
        content: [title, openBtn],
    });
    const mainContent = BB.el({
        className: classes.mainContent,
        content: [preview, rightCol],
    });
    const closeArea = BB.el({
        className: classes.closeArea,
    });
    closeArea.onclick = close;
    const banner = BB.el({
        className: classes.banner,
        content: [mainContent, closeButton],
    });
    banner.onclick = BB.handleClick;
    const rootEl = BB.el({
        content: [closeArea, banner],
        className: classes.root,
    });
    document.body.append(rootEl);

    function close() {
        clearTimeout(timeout);
        document.removeEventListener('pointerdown', onPointerDown);
        css(rootEl, {
            opacity: 0,
        });
        css(banner, {
            pointerEvents: 'none',
        });
        setTimeout(() => {
            rootEl.remove();
        }, 200);
    }

    function checkCanClose() {
        if (banner.matches(':hover')) {
            timeout = setTimeout(checkCanClose, 500);
            return;
        }
        close();
    }

    let timeout = setTimeout(checkCanClose, 4500);

    const onPointerDown = (e: PointerEvent) => {
        const target = e.target as HTMLElement | null;
        if (banner.contains(target)) {
            return;
        }
        close();
    };
    document.addEventListener('pointerdown', onPointerDown, { passive: false });
}
