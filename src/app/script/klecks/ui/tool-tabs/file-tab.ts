import {BB} from '../../../bb/bb';
import {KL} from '../../kl';
// @ts-ignore
import newImageImg from 'url:~/src/app/img/ui/new-image.svg';
// @ts-ignore
import exportImg from 'url:~/src/app/img/ui/export.svg';
// @ts-ignore
import shareImg from 'url:~/src/app/img/ui/share.svg';
// @ts-ignore
import uploadImg from 'url:~/src/app/img/ui/upload.svg';
// @ts-ignore
import importImg from 'url:~/src/app/img/ui/import.svg';
// @ts-ignore
import copyImg from 'url:~/src/app/img/ui/copy.svg';
import {BrowserStorageUi} from '../components/browser-storage-ui';
import {IKlProject} from '../../kl.types';
import {SaveReminder} from '../components/save-reminder';
import {ProjectStore} from '../../storage/project-store';

export type exportType = 'png' | 'layers' | 'psd';








export class FileTab {

    private readonly div: HTMLDivElement;
    private importButton: HTMLInputElement;
    private fileBrowserStorage: BrowserStorageUi;

    constructor(
        klRootEl,
        projectStore: ProjectStore,
        getProject: () => IKlProject,
        private exportType,
        onExportTypeChange,
        onFileSelect,
        onSaveImageToComputer,
        onNewImage,
        onShareImage,
        onUpload,
        onCopyToClipboard,
        saveReminder: SaveReminder,
    ) {
        const _this = this;
        this.div = document.createElement("div");

        const asyncCreation = () => {
            let filemenu = document.createElement("div");
            let newButton = document.createElement("button");
            let saveButton = document.createElement("button");
            let shareButton = document.createElement("button");
            let uploadImgurButton = document.createElement("button");
            let clipboardButton = document.createElement("button");

            newButton.style.cssFloat = 'left';
            BB.css(saveButton, {
                cssFloat: 'left',
                clear: 'both',
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

            newButton.innerHTML = "<img src='" + newImageImg + "' alt='New Image' height='20'/>New";
            saveButton.innerHTML = "<img src='" + exportImg + "' alt='Save Image' height='20'/>Save";
            shareButton.innerHTML = "<img src='" + shareImg + "' alt='Share Image' height='20'/>Share";
            uploadImgurButton.innerHTML = "<img style='float:left' src='" + uploadImg + "' height='20' alt='Upload to Imgur'/>Upload";
            clipboardButton.innerHTML = "<img src='" + copyImg + "' alt='Share Image' height='20'/>Copy";
            clipboardButton.title = "Copy To Clipboard";
            newButton.className = "gridButton";
            saveButton.className = "gridButton";
            shareButton.className = "gridButton";
            uploadImgurButton.className = "gridButton";
            clipboardButton.className = "gridButton";


            this.importButton = document.createElement("input");
            this.importButton.tabIndex = -1;
            this.importButton.type = "file";
            this.importButton.multiple = true;
            this.importButton.accept = "image";
            (this.importButton as any).size = "71";
            this.importButton.textContent = "Import";
            let importWrapper: any = this.importButton;

            function createImportButton() {
                importWrapper = document.createElement("div");
                importWrapper.className = "gridButton";
                importWrapper.style.position = "relative";
                importWrapper.style.cursor = "pointer";
                importWrapper.style.cssFloat = "left";

                let innerMask = document.createElement("div");
                innerMask.style.width = "120px";
                innerMask.style.height = "28px";
                innerMask.style.overflow = "hidden";
                innerMask.style.cursor = "pointer";
                innerMask.style.position = "relative";

                importWrapper.appendChild(innerMask);
                innerMask.appendChild(_this.importButton);

                let importFakeButton = document.createElement("button");
                importFakeButton.innerHTML = "<img style='float:left' height='20' src='" + importImg + "' alt='Import Image'/>Import";
                importFakeButton.tabIndex = -1;

                BB.css(importFakeButton, {
                    width: "120px",
                    display: "box",
                    position: "absolute",
                    left: '0',
                    top: '0',
                    cursor: "pointer"
                });
                BB.css(_this.importButton, {
                    display: 'none'
                });
                importWrapper.appendChild(importFakeButton);

                importFakeButton.onclick = function() {
                    _this.importButton.click();
                }
            }

            createImportButton();

            this.importButton.onchange = function (e) {
                onFileSelect(_this.importButton.files, 'default');
                _this.importButton.value = "";

            };


            // --- export filetype dropdown ---
            let exportTypeWrapper;
            let exportTypeSelect;
            {
                exportTypeWrapper = BB.el({
                    css: {
                        fontSize: '15px',
                        marginLeft: '10px',
                        marginTop: '10px',
                        cssFloat: 'left',
                        width: 'calc(50% - 15px)',
                        height: '30px'
                    }
                });
                exportTypeSelect = new KL.Select({
                    optionArr: [
                        ['png', 'Save PNG'],
                        ['psd', 'Save PSD'],
                        ['layers', 'Save Layers'],
                    ],
                    initValue: exportType,
                    onChange: function(val) {
                        exportType = val;
                        onExportTypeChange(exportType);
                        onSaveImageToComputer();
                    }
                });
                BB.css(exportTypeSelect.getElement(), {
                    width: '120px',
                    height: '30px'
                });
                exportTypeWrapper.appendChild(exportTypeSelect.getElement());

            }



            newButton.onclick = onNewImage;
            saveButton.onclick = function () {
                onSaveImageToComputer();
            };
            shareButton.onclick = function() {
                shareButton.disabled = true;
                onShareImage(() => {
                    shareButton.disabled = false;
                });
            };
            uploadImgurButton.onclick = function () {
                onUpload();
            };

            clipboardButton.onclick = function() {
                clipboardButton.blur();
                onCopyToClipboard();
            };

            let saveNote = document.createElement("div");
            saveNote.textContent = "No autosave available";
            BB.css(saveNote, {
                textAlign: "center",
                marginTop: "10px",
                background: "rgb(243, 243, 161)",
                marginLeft: "10px",
                marginRight: "10px",
                borderRadius: "4px",
                padding: "5px",
                color: 'rgba(0,0,0,0.65)'
            });

            function createSpacer() {
                let el = document.createElement("div");
                let clearer = document.createElement("div");
                let line = document.createElement("div");
                el.appendChild(clearer);
                el.appendChild(line);
                BB.css(clearer, {
                    clear: 'both'
                });
                BB.css(line, {
                    marginLeft: "10px",
                    marginRight: "10px",
                    marginTop: "10px",
                    borderBottom: "1px solid rgba(0,0,0,0.2)",
                    clear: 'both'
                });
                return el;
            }

            _this.fileBrowserStorage = new BrowserStorageUi(projectStore, getProject, saveReminder, klRootEl);
            BB.css(_this.fileBrowserStorage.getElement(), {
                //background: 'red',
                margin: '10px',
            });


            let headlineUpload = document.createElement("div");
            headlineUpload.innerHTML = "Upload<br>";
            BB.css(headlineUpload, {
                marginLeft: "10px",
                marginRight: "10px",
                paddingTop: "5px",
                marginBottom: "-5px"
            });


            //actual structure
            BB.append(filemenu, [
                saveNote,
                newButton,
                importWrapper,
                saveButton,
                exportTypeWrapper,
                clipboardButton,
                BB.canShareFiles() ? shareButton : null,
                createSpacer(),
                _this.fileBrowserStorage.getElement(),
                createSpacer(),
                uploadImgurButton,
            ]);

            this.div.appendChild(filemenu);
        };

        setTimeout(asyncCreation, 1);
    }

    refresh() {
    }

    getElement() {
        return this.div;
    }

    setIsVisible(isVisible: boolean) {
        if (isVisible) {
            this.refresh();
        }
    }

    triggerImport() {
        this.importButton.click();
    }
}
