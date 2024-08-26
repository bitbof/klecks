import { BB } from '../../../bb/bb';

type TDropOption = 'default' | 'layer' | 'image';

/**
 * Not really generalized. UI when you drag/drop an image into window.
 * The moment you create it, it will listen.
 * */
export class KlImageDropper {
    private readonly rootEl: HTMLElement;

    // ----------------------------------- public -----------------------------------
    constructor(p: {
        onDrop: (files: FileList, optionStr: TDropOption) => void;
        target: HTMLElement;
        enabledTest: () => boolean;
    }) {
        //set up DOM
        this.rootEl = BB.el({
            content: 'Drop to import',
            css: {
                paddingTop: '100px',
                position: 'fixed',
                left: '0',
                top: '0',
                width: '100%',
                height: '100%',
                background: 'rgba(50, 50, 50, 0.7)',
                color: '#fff',
                textShadow: '2px 2px #000',
                textAlign: 'center',
                fontSize: '25px',
            },
        });
        const wrapperEl = BB.el({
            css: {
                marginTop: '50px',
                display: 'flex',
                justifyContent: 'center',
            },
        });
        const optionStyle = {
            width: '200px',
            padding: '50px',
            margin: '10px',
            //opacity: 0.5,
            borderRadius: '20px',
            border: '1px dashed #fff',
            background: '#00aefe',
            fontWeight: 'bold',
        };
        const optionLayerEl = BB.el({
            content: 'As Layer',
            css: optionStyle,
        });
        const optionImageEl = BB.el({
            content: 'As New Image',
            css: optionStyle,
        });

        this.rootEl.append(wrapperEl);
        wrapperEl.append(optionLayerEl, optionImageEl);

        let rootCounter = 0;
        let optionLayerCounter = 0;
        let optionImageCounter = 0;

        const destroy = () => {
            rootCounter = 0;
            optionLayerCounter = 0;
            optionImageCounter = 0;
            this.rootEl.remove();
        };

        /**
         * check, can drop content be imported
         */
        const testAcceptType = (event: DragEvent): boolean => {
            return !!event.dataTransfer && !event.dataTransfer.types.includes('text/plain');
        };

        const updateOptions = () => {
            const boxShadow = '0 0 20px 4px #fff';
            if (optionLayerCounter > 0) {
                optionLayerEl.style.boxShadow = boxShadow;
                optionImageEl.style.boxShadow = '';
            } else if (optionImageCounter > 0) {
                optionLayerEl.style.boxShadow = '';
                optionImageEl.style.boxShadow = boxShadow;
            } else {
                optionLayerEl.style.boxShadow = '';
                optionImageEl.style.boxShadow = '';
            }
        };

        optionLayerEl.addEventListener(
            'dragenter',
            () => {
                optionLayerCounter++;
                updateOptions();
            },
            { passive: false },
        );
        optionLayerEl.addEventListener(
            'dragleave',
            () => {
                optionLayerCounter--;
                updateOptions();
            },
            { passive: false },
        );
        optionImageEl.addEventListener(
            'dragenter',
            () => {
                optionImageCounter++;
                updateOptions();
            },
            { passive: false },
        );
        optionImageEl.addEventListener(
            'dragleave',
            () => {
                optionImageCounter--;
                updateOptions();
            },
            { passive: false },
        );

        const rootDragOver = (event: DragEvent): void => {
            if (!testAcceptType(event)) {
                return;
            }
            event.stopPropagation();
            event.preventDefault();
        };

        const rootDragEnter = (event: DragEvent): void => {
            if (!p.enabledTest() || !testAcceptType(event)) {
                return;
            }
            if (rootCounter === 0) {
                p.target.append(this.rootEl);
            }
            rootCounter++;
        };

        const rootDragLeave = (event: DragEvent): void => {
            if (!testAcceptType(event) || rootCounter === 0) {
                return;
            }
            rootCounter = Math.max(0, rootCounter - 1);
            if (rootCounter === 0) {
                this.rootEl.remove();
            }
        };

        const rootDrop = (event: DragEvent): void => {
            if (
                !testAcceptType(event) ||
                !event.dataTransfer ||
                event.dataTransfer.files.length === 0
            ) {
                destroy();
                return;
            }
            event.stopPropagation();
            event.preventDefault();

            let optionStr: TDropOption = 'default';
            if (optionLayerCounter > 0) {
                optionStr = 'layer';
            } else if (optionImageCounter > 0) {
                optionStr = 'image';
            }

            p.onDrop(event.dataTransfer.files, optionStr);

            if (rootCounter > 0) {
                this.rootEl.remove();
            }
            rootCounter = 0;
            optionLayerCounter = 0;
            optionImageCounter = 0;
            updateOptions();
        };

        window.addEventListener('dragover', rootDragOver, { passive: false });
        window.addEventListener('dragenter', rootDragEnter, { passive: false });
        window.addEventListener('dragleave', rootDragLeave, { passive: false });
        window.addEventListener('drop', rootDrop, { passive: false });

        // if something goes wrong and you're stuck with overlay
        this.rootEl.addEventListener(
            'pointerdown',
            () => {
                destroy();
            },
            { passive: false },
        );
        const keyListener = new BB.KeyListener({
            onDown: (keyStr) => {
                if (rootCounter > 0 && keyStr === 'esc') {
                    destroy();
                }
            },
        });
    }

    // ---- interface ----
}
