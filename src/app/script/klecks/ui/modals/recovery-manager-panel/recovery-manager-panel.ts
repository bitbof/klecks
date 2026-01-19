import { BB } from '../../../../bb/bb';
import {
    DEBUG_RETURN_ALL_RECOVERIES,
    KlRecoveryManager,
    RECOVERY_MEMORY_LIMIT_BYTES,
    RECOVERY_THUMB_HEIGHT_PX,
    TRecoveryMetaData,
} from '../../../storage/kl-recovery-manager';
import { timestampToAge } from '../../utils/timestamp-to-age';
import { showModal } from '../base/showModal';
import { copyCanvas } from '../../../../bb/base/canvas';
import * as classes from './recovery-manager-panel.module.scss';
import { LANG } from '../../../../language/language';
import removeLayerImg from 'url:/src/app/img/ui/remove-layer.svg';
import { css } from '../../../../bb/base/base';

export type TRecoveryManagerPanelParams = {
    klRecoveryManager: KlRecoveryManager;
};

export class RecoveryManagerPanel {
    private readonly rootEl: HTMLElement;
    private readonly recoveryListener = (
        metas: TRecoveryMetaData[],
        totalMemoryUsedBytes: number,
    ) => {
        this.update(metas, totalMemoryUsedBytes);
    };
    private readonly klRecoveryManager: KlRecoveryManager;

    async update(metas: TRecoveryMetaData[], totalMemoryUsedBytes: number): Promise<void> {
        const elements: HTMLElement[] = [];
        metas
            .sort((a, b) => {
                if (a.timestamp > b.timestamp) {
                    return -1;
                }
                if (a.timestamp < b.timestamp) {
                    return 1;
                }
                return 0;
            })
            .forEach((meta) => {
                const recoverBtn = BB.el({
                    tagName: 'a',
                    className: 'kl-button kl-button-link',
                    content: LANG('tab-recovery-recover'),
                    custom: {
                        href: '#' + meta.id,
                        target: '_blank',
                    },
                });
                const deleteBtn = BB.el({
                    tagName: 'button',
                    className: 'kl-button-delete',
                    content: `<img src="${removeLayerImg}" height="20"/>${LANG('tab-recovery-delete')}`,
                    onClick: () => {
                        deleteBtn.blur();
                        const thumbnail2 = copyCanvas(meta.thumbnail!);
                        css(thumbnail2, {
                            alignSelf: 'start',
                            background: 'var(--kl-checkerboard-background)',
                            maxWidth: '100%',
                        });
                        showModal({
                            target: document.body,
                            type: 'warning',
                            message: BB.el({
                                content: [LANG('tab-recovery-delete-confirmation'), thumbnail2],
                                css: {
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '10px',
                                },
                            }),
                            buttons: [LANG('tab-recovery-delete'), 'Cancel'],
                            deleteButtonName: LANG('tab-recovery-delete'),
                            callback: async (result) => {
                                if (result === 'Cancel') {
                                    return;
                                }
                                await this.klRecoveryManager.remove(+meta.id);
                            },
                        });
                    },
                    noRef: true,
                });

                const preview = meta.thumbnail!;

                const previewWrapper = BB.el({
                    tagName: 'a',
                    content: preview,
                    className: classes.preview,
                    title: LANG('tab-recovery-recover'),
                    css: {
                        minHeight: RECOVERY_THUMB_HEIGHT_PX + 'px',
                    },
                    custom: {
                        href: '#' + meta.id,
                        target: '_blank',
                    },
                });

                const infoEl = BB.el({
                    content: [
                        timestampToAge(meta.timestamp),
                        ', ' + BB.round(meta.memoryEstimateBytes / 1000000, 1) + ' MB',
                    ],
                    css: {
                        textAlign: 'center',
                    },
                });

                elements.push(
                    BB.el({
                        content: [previewWrapper, infoEl, recoverBtn, deleteBtn],
                        css: {
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '5px',
                            maxWidth: '100%',
                        },
                    }),
                );
            });

        this.rootEl.innerHTML = '';
        if (DEBUG_RETURN_ALL_RECOVERIES) {
            this.rootEl.append(
                BB.el({
                    content: 'Debug On - SHOWING ALL TABS',
                    css: { background: 'red' },
                }),
            );
        }
        this.rootEl.append(
            BB.el({
                content: LANG('tab-recovery-explanation'),
                className: 'kl-toolspace-note',
            }),
            BB.el({
                content:
                    LANG('tab-recovery-total-quota-label') +
                    ' ' +
                    BB.round(totalMemoryUsedBytes / 1000000, 1) +
                    ' MB / ' +
                    BB.round(RECOVERY_MEMORY_LIMIT_BYTES / 1000000, 1) +
                    ' MB',
                css: {
                    margin: '10px 0',
                },
            }),
            BB.el({
                content: [...elements],
                css: {
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '20px 10px',
                    justifyContent: 'space-evenly',
                },
            }),
        );
        if (elements.length === 0) {
            this.rootEl.append(LANG('tab-recovery-empty'));
        }
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: TRecoveryManagerPanelParams) {
        this.klRecoveryManager = p.klRecoveryManager;
        this.rootEl = BB.el({ content: LANG('loading') });
        this.klRecoveryManager.subscribe(this.recoveryListener);
        setTimeout(async () => {
            try {
                await this.klRecoveryManager.update();
            } catch (e) {
                setTimeout(() => {
                    throw e;
                });
                this.rootEl.innerHTML = 'error';
            }
        });
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    destroy(): void {
        this.klRecoveryManager.unsubscribe(this.recoveryListener);
    }
}
