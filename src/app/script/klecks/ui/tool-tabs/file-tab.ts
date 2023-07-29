import {BB} from '../../../bb/bb';
import {KL} from '../../kl';
import {BrowserStorageUi} from '../components/browser-storage-ui';
import {IKlProject, TDropOption, TExportType} from '../../kl-types';
import {SaveReminder} from '../components/save-reminder';
import {ProjectStore} from '../../storage/project-store';
import {LANG} from '../../../language/language';
import newImageImg from '/src/app/img/ui/new-image.svg';
import exportImg from '/src/app/img/ui/export.svg';
import shareImg from '/src/app/img/ui/share.svg';
import uploadImg from '/src/app/img/ui/upload.svg';
import importImg from '/src/app/img/ui/import.svg';
import copyImg from '/src/app/img/ui/copy.svg';

export class FileTab {

    private readonly rootEl: HTMLDivElement;
    private importButton: undefined | HTMLInputElement;
    private fileBrowserStorage: undefined | BrowserStorageUi;

    constructor (
        klRootEl: HTMLElement,
        projectStore: ProjectStore,
        getProject: () => IKlProject,
        private exportType: TExportType,
        onExportTypeChange: (type: TExportType) => void,
        onFileSelect: (fileList: FileList, optionStr: TDropOption) => void,
        onSaveImageToComputer: () => void,
        onNewImage: () => void,
        onShareImage: (callback: () => void) => void,
        onUpload: () => void,
        onCopyToClipboard: () => void,
        saveReminder: SaveReminder,
    ) {
        this.rootEl = document.createElement('div');

        const asyncCreation = (): void => {
            const fileMenu = document.createElement('div');
            const newButton = document.createElement('button');
            const saveButton = document.createElement('button');
            const shareButton = document.createElement('button');
            const uploadImgurButton = document.createElement('button');
            const clipboardButton = document.createElement('button');

            newButton.style.cssFloat = 'left';
            BB.css(saveButton, {
                cssFloat: 'left',
                clear: 'both',
                flexGrow: '1',
            });
            BB.css(clipboardButton, {
                cssFloat: 'left',
                clear: 'both',
            });

            newButton.tabIndex = -1;
            saveButton.tabIndex = -1;
            shareButton.tabIndex = -1;
            uploadImgurButton.tabIndex = -1;
            clipboardButton.tabIndex = -1;

            newButton.innerHTML = `<img class="dark-no-invert" src='${newImageImg}' alt='icon' height='20'/>${LANG('file-new')}`;
            saveButton.innerHTML = `<img src='${exportImg}' alt='icon' height='20'/>${LANG('file-save')}`;
            shareButton.innerHTML = `<img src='${shareImg}' alt='icon' height='20'/>${LANG('file-share')}`;
            uploadImgurButton.innerHTML = `<img style='float:left' src='${uploadImg}' height='20' alt='icon'/>${LANG('file-upload')}`;
            clipboardButton.innerHTML = `<img src='${copyImg}' alt='icon' height='20'/>${LANG('file-copy')}`;
            clipboardButton.title = LANG('file-copy-title');
            newButton.className = 'grid-button';
            saveButton.className = 'grid-button';
            shareButton.className = 'grid-button';
            uploadImgurButton.className = 'grid-button';
            clipboardButton.className = 'grid-button';

            const importWrapper = BB.el({
                className: 'grid-button',
                css: {
                    position: 'relative',
                    cursor: 'pointer',
                    cssFloat: 'left',
                },
            });
            const innerMask = BB.el({
                parent: importWrapper,
                css: {
                    width: '120px',
                    height: '28px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    position: 'relative',
                },
            });
            this.importButton = BB.el({
                tagName: 'input',
                parent: innerMask,
                css: {
                    display: 'none',
                },
            });
            this.importButton.tabIndex = -1;
            this.importButton.type = 'file';
            this.importButton.multiple = true;
            this.importButton.accept = 'image';
            this.importButton.size = 71;
            this.importButton.onchange = () => {
                if (!this.importButton) {
                    return;
                }
                this.importButton.files && onFileSelect(this.importButton.files, 'default');
                this.importButton.value = '';
            };

            const importFakeButton = BB.el({
                tagName: 'button',
                parent: importWrapper,
                content: "<img class=\"dark-no-invert\" style='float:left' height='20' src='" + importImg + "' alt='icon'/>" + LANG('file-import'),
                css: {
                    width: '120px',
                    display: 'box',
                    position: 'absolute',
                    left: '0',
                    top: '0',
                    cursor: 'pointer',
                },
            });
            importFakeButton.tabIndex = -1;
            importFakeButton.onclick = () => this.importButton && this.importButton.click();

            // --- export filetype dropdown ---
            const exportTypeSelect = new KL.Select({
                optionArr: [
                    ['png', 'PNG'],
                    ['psd', 'PSD'],
                    ['layers', LANG('layers') + ' (PNG)'],
                ],
                initValue: this.exportType,
                onChange: (val) => {
                    this.exportType = val as TExportType;
                    onExportTypeChange(this.exportType);
                    onSaveImageToComputer();
                },
                title: LANG('file-format'),
            });
            BB.css(exportTypeSelect.getElement(), {
                width: '50%',
                height: '30px',
                marginTop: '10px',
                marginLeft: '10px',
            });



            newButton.onclick = onNewImage;
            saveButton.onclick = () => {
                onSaveImageToComputer();
            };
            shareButton.onclick = () => {
                shareButton.disabled = true;
                onShareImage(() => {
                    shareButton.disabled = false;
                });
            };
            uploadImgurButton.onclick = () => onUpload();

            clipboardButton.onclick = () => {
                clipboardButton.blur();
                onCopyToClipboard();
            };

            const saveNote = BB.el({
                className: 'kl-toolspace-note',
                textContent: LANG('file-no-autosave'),
                css: {
                    margin: '10px 10px 0 10px',
                },
            });

            const createSpacer = () => {
                const el = document.createElement('div');
                const clearer = document.createElement('div');
                const line = BB.el({
                    className: 'grid-hr',
                });
                el.append(clearer, line);
                BB.css(clearer, {
                    clear: 'both',
                });
                return el;
            };

            this.fileBrowserStorage = new BrowserStorageUi(projectStore, getProject, saveReminder, klRootEl);
            BB.css(this.fileBrowserStorage.getElement(), {
                //background: 'red',
                margin: '10px',
            });

            const saveRow = BB.el({
                content: [saveButton, exportTypeSelect.getElement()],
                className: 'kl-file-save-row',
            });

            //actual structure
            BB.append(fileMenu, [
                saveNote,
                newButton,
                importWrapper,
                BB.el({css: {clear: 'both'}}),

                saveRow,

                clipboardButton,
                BB.canShareFiles() ? shareButton : undefined,
                BB.el({css: {clear: 'both'}}),

                createSpacer(),
                this.fileBrowserStorage.getElement(),
                createSpacer(),
                uploadImgurButton,
            ]);

            this.rootEl.append(fileMenu);
        };

        setTimeout(asyncCreation, 1);
    }

    refresh (): void {
    }

    getElement (): HTMLElement {
        return this.rootEl;
    }

    setIsVisible (isVisible: boolean): void {
        if (isVisible) {
            this.refresh();
        }
    }

    triggerImport (): void {
        this.importButton && this.importButton.click();
    }
}
