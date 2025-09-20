import { BB } from '../../../bb/bb';
import { KL } from '../../kl';
import { BrowserStorageUi } from '../components/browser-storage-ui';
import { TDropOption, TExportType, TKlProject } from '../../kl-types';
import { ProjectStore } from '../../storage/project-store';
import { LANG } from '../../../language/language';
import newImageImg from 'url:/src/app/img/ui/new-image.svg';
import exportImg from 'url:/src/app/img/ui/export.svg';
import shareImg from 'url:/src/app/img/ui/share.svg';
import uploadImg from 'url:/src/app/img/ui/upload.svg';
import importImg from 'url:/src/app/img/ui/import.svg';
import { Checkbox } from '../components/checkbox';
import { LocalStorage } from '../../../bb/base/local-storage';
import { KlRecoveryManager, TKlRecoveryListener } from '../../storage/kl-recovery-manager';
import { showRecoveryManagerPanel } from '../modals/recovery-manager-panel/show-recovery-manager-panel';
import * as classes from './file-ui.module.scss';
import { BrowserStorageHeaderUi } from '../components/browser-storage-header-ui';
import { css } from '../../../bb/base/base';

const LS_SHOW_SAVE_DIALOG = 'kl-save-dialog';

const createSpacer = (): HTMLElement => {
    const el = document.createElement('div');
    const clearer = document.createElement('div');
    const line = BB.el({
        className: 'grid-hr',
    });
    el.append(clearer, line);
    css(clearer, {
        clear: 'both',
    });
    return el;
};

const createButtonContent = (text: string, icon: string, noInvert?: boolean): string => {
    return `<img ${noInvert ? 'class="dark-no-invert"' : ''} src='${icon}' alt='icon' height='20'/>${text}`;
};

export type TFileUiParams = {
    klRootEl: HTMLElement;
    projectStore?: ProjectStore;
    getProject: () => TKlProject;
    exportType: TExportType;
    onExportTypeChange: (type: TExportType) => void;
    onFileSelect: (fileList: FileList, optionStr: TDropOption) => void;
    onSaveImageToComputer: () => void;
    onNewImage: () => void;
    onShareImage: (callback: () => void) => void;
    onUpload: () => void;
    applyUncommitted: () => void;
    onChangeShowSaveDialog: (b: boolean) => void;
    klRecoveryManager?: KlRecoveryManager;
    onOpenBrowserStorage: () => void;
    onStoredToBrowserStorage: () => void;
};

export class FileUi {
    // from params
    private exportType: TExportType;
    private readonly applyUncommitted: () => void;

    private readonly rootEl: HTMLDivElement;
    private importInput: undefined | HTMLInputElement;
    private browserStorageUi: undefined | BrowserStorageUi;
    private klRecoveryManager: KlRecoveryManager | undefined;
    private recoveryCountBubble: HTMLElement | undefined;
    private recoveryListener: TKlRecoveryListener = (metas) => {
        if (!this.recoveryCountBubble) {
            return;
        }
        const count = metas.length;
        if (count === 0) {
            this.recoveryCountBubble.style.display = 'none';
        } else {
            this.recoveryCountBubble.textContent = '' + count;
            this.recoveryCountBubble.style.display = 'inline-block';
        }
    };

    // ----------------------------------- public -----------------------------------

    constructor(p: TFileUiParams) {
        this.exportType = p.exportType;
        this.applyUncommitted = p.applyUncommitted;

        this.rootEl = document.createElement('div');

        const asyncCreation = (): void => {
            // --- hint ---
            const saveNote = BB.el({
                className: 'kl-toolspace-note',
                textContent: LANG('file-no-autosave'),
                css: {
                    margin: '10px 10px 0 10px',
                },
            });

            // --- new, import, save ---
            const newButton = BB.el({
                tagName: 'button',
                className: 'grid-button',
                content: createButtonContent(LANG('file-new'), newImageImg, true),
                custom: {
                    tabIndex: '-1',
                },
                css: {
                    cssFloat: 'left',
                },
                onClick: () => p.onNewImage(),
            });
            const importButton = BB.el({
                tagName: 'button',
                className: 'grid-button',
                content: createButtonContent(LANG('file-import'), importImg, true),
                css: {
                    position: 'relative',
                    cursor: 'pointer',
                    cssFloat: 'left',
                },
                custom: {
                    tabIndex: '-1',
                },
                onClick: () => this.importInput!.click(),
            });
            this.importInput = BB.el({
                tagName: 'input',
                css: {
                    display: 'none',
                },
                onChange: () => {
                    this.applyUncommitted();
                    this.importInput!.files && p.onFileSelect(this.importInput!.files, 'default');
                    this.importInput!.value = '';
                },
                custom: {
                    tabIndex: '-1',
                },
            });
            this.importInput.type = 'file';
            this.importInput.multiple = true;
            this.importInput.accept = 'image/*,.psd'; // .psd needed for chrome, although it's image/vnd.adobe.photoshop
            const saveButton = BB.el({
                tagName: 'button',
                className: 'grid-button grid-button--filter',
                content: createButtonContent(LANG('file-save'), exportImg),
                custom: {
                    tabIndex: '-1',
                },
                css: {
                    cssFloat: 'left',
                    flex: '1 0 0',
                    margin: '0',
                },
                onClick: () => p.onSaveImageToComputer(),
            });
            const canShowSaveDialog = 'showSaveFilePicker' in window;
            const showSaveDialogRaw = LocalStorage.getItem(LS_SHOW_SAVE_DIALOG);
            const initialShowSaveDialog =
                showSaveDialogRaw === null ? false : showSaveDialogRaw === 'true';
            const saveDialogCheckbox = new Checkbox({
                init: initialShowSaveDialog,
                label: LANG('file-show-save-dialog'),
                callback: (value) => {
                    if (value) {
                        LocalStorage.setItem(LS_SHOW_SAVE_DIALOG, 'true');
                    } else {
                        LocalStorage.removeItem(LS_SHOW_SAVE_DIALOG); // default is false
                    }
                    p.onChangeShowSaveDialog(value);
                },
                css: {
                    maxWidth: 'fit-content',
                },
                name: 'show-save-dialog',
            });
            p.onChangeShowSaveDialog(initialShowSaveDialog);

            // export filetype dropdown
            const exportTypeSelect = new KL.Select({
                optionArr: [
                    ['png', 'PNG'],
                    ['psd', 'PSD'],
                    ['layers', LANG('layers') + ' (PNG)'],
                ],
                initValue: this.exportType,
                onChange: (val) => {
                    this.exportType = val as TExportType;
                    p.onExportTypeChange(this.exportType);
                    p.onSaveImageToComputer();
                },
                title: LANG('file-format'),
                name: 'export-type',
            });
            css(exportTypeSelect.getElement(), {
                height: '30px',
                width: 'calc(50% - 10px)',
                flex: '1 0 0',
            });

            // --- browser storage ---
            let browserStorageFallbackEl: HTMLElement | undefined;
            if (p.projectStore) {
                this.browserStorageUi = new BrowserStorageUi({
                    projectStore: p.projectStore,
                    getProject: p.getProject,
                    klRootEl: p.klRootEl,
                    applyUncommitted: this.applyUncommitted,
                    onOpen: p.onOpenBrowserStorage,
                    onStored: () => p.onStoredToBrowserStorage(),
                });
                css(this.browserStorageUi.getElement(), {
                    margin: '10px',
                });
            } else {
                const header = new BrowserStorageHeaderUi();
                browserStorageFallbackEl = BB.el({
                    content: [
                        header.getElement(),
                        BB.el({
                            content: '🔴 ' + LANG('file-storage-cant-access'),
                            css: {
                                marginTop: '10px',
                            },
                        }),
                    ],
                    css: {
                        margin: '10px 10px 0 10px',
                    },
                });
            }

            const saveRow = BB.el({
                content: [
                    BB.el({
                        content: [saveButton, exportTypeSelect.getElement()],
                        css: {
                            display: 'flex',
                            gap: '10px',
                        },
                    }),
                    ...(canShowSaveDialog ? [saveDialogCheckbox.getElement()] : []),
                ],
                css: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    margin: '10px 10px 0 10px',
                },
            });

            // --- recovery ---
            this.klRecoveryManager = p.klRecoveryManager;
            const recoveryWrapper = BB.el({});
            this.recoveryCountBubble = BB.el({
                className: classes.recoveryBubble,
            });

            const recoveryBrowserButton = BB.el({
                tagName: 'button',
                content: [LANG('tab-recovery-recover-tabs'), this.recoveryCountBubble],
                onClick: () => showRecoveryManagerPanel(this.klRecoveryManager),
                custom: {
                    tabIndex: '-1',
                },
                css: {
                    margin: '10px 0 0 10px',
                    width: 'calc(100% - 20px)',
                },
            });

            recoveryWrapper.append(recoveryBrowserButton, createSpacer());

            (async () => {
                if (!this.klRecoveryManager) {
                    return;
                }
                this.klRecoveryManager.subscribe(this.recoveryListener);
                await this.klRecoveryManager.update();
                this.klRecoveryManager.unsubscribe(this.recoveryListener);
            })();

            // --- upload, share ---
            const shareButton = BB.el({
                tagName: 'button',
                className: 'grid-button',
                content: createButtonContent(LANG('file-share'), shareImg),
                custom: {
                    tabIndex: '-1',
                },
                css: {
                    cssFloat: 'left',
                },
                onClick: () => {
                    shareButton.disabled = true;
                    p.onShareImage(() => {
                        shareButton.disabled = false;
                    });
                },
            });
            const uploadImgurButton = BB.el({
                tagName: 'button',
                className: 'grid-button',
                content: createButtonContent(LANG('file-upload'), uploadImg),
                custom: {
                    tabIndex: '-1',
                },
                css: {
                    cssFloat: 'left',
                },
                onClick: () => {
                    p.onUpload();
                },
            });

            BB.append(this.rootEl, [
                saveNote,
                newButton,
                importButton,
                BB.el({ css: { clear: 'both' } }),
                saveRow,
                createSpacer(),
                this.browserStorageUi?.getElement(),
                browserStorageFallbackEl,
                createSpacer(),
                recoveryWrapper,
                uploadImgurButton,
                BB.canShareFiles() ? shareButton : undefined,
                BB.el({ css: { clear: 'both' } }),
            ]);
        };

        setTimeout(asyncCreation, 1);
    }

    refresh(): void {}

    getElement(): HTMLElement {
        return this.rootEl;
    }

    setIsVisible(isVisible: boolean): void {
        if (isVisible) {
            this.refresh();
            this.browserStorageUi?.show();
            if (this.klRecoveryManager) {
                this.klRecoveryManager.subscribe(this.recoveryListener);
                this.klRecoveryManager.update();
            }
        } else {
            if (this.klRecoveryManager) {
                this.klRecoveryManager.unsubscribe(this.recoveryListener);
            }
        }
    }

    triggerImport(): void {
        this.importInput && this.importInput.click();
    }
}
