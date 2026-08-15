import { showModal } from '../base/showModal';
import { BB } from '../../../../bb/bb';
import { RecoveryManagerPanel } from './recovery-manager-panel';
import { KlRecoveryManager } from '../../../storage/kl-recovery-manager';
import { KL_INDEXED_DB } from '../../../storage/kl-indexed-db';
import { KL } from '../../../kl';
import { LANG } from '../../../../language/language';

export function showRecoveryManagerPanel(klRecoveryManager?: KlRecoveryManager) {
    if (!klRecoveryManager || !KL_INDEXED_DB.getIsAvailable()) {
        KL.popup({
            type: 'error',
            message: LANG('file-storage-cant-access'),
            buttons: ['Ok'],
        });
        return;
    }

    const recoveryManager = new RecoveryManagerPanel({ klRecoveryManager });

    const rootEl = BB.el({ content: [recoveryManager.getElement()] });

    const onModalExit = (val: string) => {
        recoveryManager.destroy();
    };
    const modal = showModal({
        message: `<b>${LANG('tab-recovery-recover-tabs')}</b>`,
        div: rootEl,
        buttons: [LANG('modal-close')],
        callback: onModalExit,
        style: {
            width: 'calc(100% - 50px)',
            maxWidth: 1000,
            minWidth: 300,
            boxSizing: 'border-box',
        },
        clickOnEnter: 'Ok',
    });
}
