import loadingImg from 'url:/src/app/img/ui/loading.gif';
import { BB } from '../bb/bb';
import { TDeserializedKlStorageProject } from '../klecks/kl-types';
import { KlRecoveryManager } from '../klecks/storage/kl-recovery-manager';
import { LANG } from '../language/language';
import * as classes from './recovery-loader.module.scss';

const showCancelAfterMs = 3000;

export async function loadRecovery(
    recoveryManager: KlRecoveryManager | undefined,
    loadingScreenEl: HTMLElement | null,
): Promise<TDeserializedKlStorageProject | undefined> {
    if (!recoveryManager) {
        return undefined;
    }

    const abortController =
        typeof AbortController === 'undefined' ? undefined : new AbortController();
    let recoveryLoadingEl: HTMLElement | undefined;
    const showCancelRecoveryTimeout =
        abortController && loadingScreenEl
            ? setTimeout(() => {
                  loadingScreenEl.classList.add(classes.loadingScreen);

                  const cancelButton = BB.el({
                      tagName: 'button',
                      textContent: LANG('modal-cancel'),
                      onClick: () => {
                          cancelButton.disabled = true;
                          abortController.abort();
                      },
                      noRef: true,
                  });

                  recoveryLoadingEl = BB.el({
                      parent: loadingScreenEl,
                      css: {
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 10,
                      },
                      content: [
                          BB.el({
                              css: {
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  fontSize: 16,
                              },
                              content: [
                                  BB.el({
                                      tagName: 'img',
                                      custom: {
                                          src: loadingImg,
                                          alt: '',
                                      },
                                  }),
                                  BB.el({
                                      tagName: 'span',
                                      textContent: LANG('tab-recovery-restoring-session'),
                                  }),
                              ],
                          }),
                          cancelButton,
                      ],
                  });
              }, showCancelAfterMs)
            : undefined;

    try {
        return await recoveryManager.getRecovery(abortController?.signal);
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            return undefined;
        }
        throw error;
    } finally {
        clearTimeout(showCancelRecoveryTimeout);
        recoveryLoadingEl?.remove();
        loadingScreenEl?.classList.remove(classes.loadingScreen);
    }
}
