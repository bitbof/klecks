import { BB } from '../../../../bb/bb';
import { TRenderTextParam, TTextFormat } from '../../../image-operations/render-text';
import { Input } from '../../components/input';
import { LANG } from '../../../../language/language';
import { ImageRadioList } from '../../components/image-radio-list';
import alignLeftImg from '/src/app/img/ui/align-left.svg';
import alignCenterImg from '/src/app/img/ui/align-center.svg';
import alignRightImg from '/src/app/img/ui/align-right.svg';
import typoItalicImg from '/src/app/img/ui/typo-italic.svg';
import typoBoldImg from '/src/app/img/ui/typo-bold.svg';
import { ImageToggle } from '../../components/image-toggle';
import { Select } from '../../components/select';
import { c } from '../../../../bb/base/c';
import { PointerListener } from '../../../../bb/input/pointer-listener';
import { fonts } from '../../../../../fonts/fonts';

type TFontParams = Pick<
    TRenderTextParam,
    'font' | 'size' | 'letterSpacing' | 'lineHeight' | 'align' | 'isItalic' | 'isBold'
>;

export type TFontUIParams = TFontParams & {
    onUpdate: (v: Partial<TFontParams>) => void;
};

const importedFonts: {
    fontFamily: string;
    fontName: string; // visible to user
}[] = [
    { fontFamily: 'sans-serif', fontName: 'Sans-serif' },
    { fontFamily: 'serif', fontName: 'Serif' },
    { fontFamily: 'monospace', fontName: 'Monospace' },
    { fontFamily: 'cursive', fontName: 'Cursive' },
    { fontFamily: 'fantasy', fontName: 'Fantasy' },
    ...fonts.map((item) => {
        return {
            fontFamily: item.name,
            fontName: item.name,
        };
    }),
];

let didLoadBundledFonts = false;
async function loadBundledFonts(): Promise<void> {
    if (didLoadBundledFonts) {
        return;
    }
    didLoadBundledFonts = true;
    const promises: Promise<void>[] = [];
    for (let i = 0; i < fonts.length; i++) {
        promises.push(
            (async () => {
                const item = fonts[i];
                const response = await fetch(item.url);
                const buffer = await response.arrayBuffer();
                const font = new FontFace(item.name, buffer);
                document.fonts.add(font);
            })(),
        );
    }
    await Promise.all(promises);
}

export class TextToolFontUI {
    private readonly rootEl: HTMLElement;

    private readonly fontSelect: Select<string>;
    private readonly fontPointerListener: PointerListener;

    private readonly importButton: HTMLButtonElement;

    private readonly sizeInput: Input;
    private readonly lineHeightInput: Input;
    private readonly letterSpacingInput: Input;

    private readonly alignRadioList: ImageRadioList<TTextFormat>;
    private readonly italicToggle: ImageToggle;
    private readonly boldToggle: ImageToggle;

    private readonly onUpdate: (v: Partial<TFontParams>) => void;
    private readonly onFocus: () => void;

    // only load fonts when interacting with the font input
    private loadBundledFonts(): void {
        !didLoadBundledFonts &&
            loadBundledFonts().then(() => {
                this.onUpdate({
                    font: this.fontSelect.getValue(),
                });
            });
    }

    private importFont(): void {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = '.ttf, .otf, .woff, .woff2, .eot';
        input.focus();
        input.click();
        input.onchange = async () => {
            if (!input.files || input.files.length === 0) {
                return;
            }
            let toSelect: string | undefined = undefined;

            const fontFamilies = importedFonts.map((i) => i.fontFamily);
            for (let i = 0; i < input.files.length; i++) {
                const file = input.files[i];
                const fontName = 'kl-' + importedFonts.length;
                if (fontFamilies.includes(fontName)) {
                    continue;
                }
                if (!toSelect) {
                    toSelect = fontName;
                    this.importButton.disabled = true;
                    this.importButton.innerText = LANG('loading');
                }

                const split = file.name.split('.');
                split.pop();

                importedFonts.push({
                    fontFamily: fontName,
                    fontName: split.join('.'),
                });
                const font = new FontFace(fontName, await file.arrayBuffer());
                document.fonts.add(font);
            }

            // update font selection
            setTimeout(() => {
                this.fontSelect.setOptionArr(
                    importedFonts.map((i) => {
                        return [
                            i.fontFamily,
                            i.fontName,
                            {
                                css: {
                                    fontFamily: i.fontFamily,
                                    fontSize: '1.2em',
                                },
                            },
                        ];
                    }),
                );
                this.fontSelect.setValue(toSelect);
                this.onUpdate({
                    font: toSelect,
                });
                this.importButton.disabled = false;
                this.importButton.innerText = LANG('file-import');
            });
        };
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: TFontUIParams) {
        this.onUpdate = p.onUpdate;

        this.fontSelect = new Select<string>({
            initValue: p.font,
            optionArr: importedFonts.map((i) => {
                return [
                    i.fontFamily,
                    i.fontName,
                    {
                        css: {
                            fontFamily: i.fontFamily,
                            fontSize: '1.2em',
                        },
                    },
                ];
            }),
            isFocusable: true,
            css: {
                width: '180px',
            },
            onChange: (v) => {
                this.loadBundledFonts();
                p.onUpdate({
                    font: v,
                });
            },
        });
        this.onFocus = () => this.loadBundledFonts();
        this.fontSelect.getElement().addEventListener('focus', this.onFocus);
        this.fontPointerListener = new BB.PointerListener({
            target: this.fontSelect.getElement(),
            onWheel: (e) => this.fontSelect.setDeltaValue(e.deltaY),
        });

        this.importButton = BB.el({
            tagName: 'button',
            content: LANG('file-import'),
            onClick: () => {
                this.importFont();
            },
        });

        const sizeLabel = BB.el({
            content: '<div><span style="font-size: 0.6em; margin-right: -1px">A</span>A</div>',
            css: {
                width: '25px',
                height: '25px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: '1.2em',
                userSelect: 'none',
            },
        });
        this.sizeInput = new Input({
            title: LANG('text-size'),
            type: 'number',
            min: 0,
            max: 1000,
            init: p.size,
            onChange: (v) => {
                p.onUpdate({
                    size: parseFloat(v),
                });
            },
            doResetIfInvalid: true,
            doScrollWithoutFocus: true,
            css: {
                width: '70px',
            },
        });

        this.lineHeightInput = new Input({
            label: LANG('text-line-height'),
            type: 'number',
            min: 0,
            max: 10,
            step: 0.1,
            init: p.lineHeight ?? 1,
            onChange: (v) => {
                p.onUpdate({
                    lineHeight: parseFloat(v),
                });
            },
            doResetIfInvalid: true,
            doScrollWithoutFocus: true,
            css: {
                width: '60px',
            },
        });

        this.letterSpacingInput = new Input({
            label: LANG('text-letter-spacing'),
            type: 'number',
            min: -100,
            max: 100,
            init: p.letterSpacing ?? 0,
            onChange: (v) => {
                p.onUpdate({
                    letterSpacing: parseFloat(v),
                });
            },
            doResetIfInvalid: true,
            doScrollWithoutFocus: true,
            css: {
                width: '60px',
            },
        });

        this.alignRadioList = new ImageRadioList<TTextFormat>({
            optionArr: [
                {
                    id: 'left',
                    title: LANG('text-left'),
                    image: alignLeftImg,
                    darkInvert: true,
                },
                {
                    id: 'center',
                    title: LANG('text-center'),
                    image: alignCenterImg,
                    darkInvert: true,
                },
                {
                    id: 'right',
                    title: LANG('text-right'),
                    image: alignRightImg,
                    darkInvert: true,
                },
            ],
            initId: p.align,
            onChange: (v) =>
                p.onUpdate({
                    align: v,
                }),
        });

        this.italicToggle = new ImageToggle({
            image: typoItalicImg,
            title: LANG('text-italic'),
            initValue: p.isItalic,
            onChange: (v) =>
                p.onUpdate({
                    isItalic: v,
                }),
            darkInvert: true,
        });

        this.boldToggle = new ImageToggle({
            image: typoBoldImg,
            title: LANG('text-bold'),
            initValue: p.isBold,
            onChange: (v) =>
                p.onUpdate({
                    isBold: v,
                }),
            darkInvert: true,
        });

        this.rootEl = c(',flex,flexWrap,gap-10-15,items-center', [
            c(',flex,gap-5,items-center', [sizeLabel, this.sizeInput.getElement()]),
            c(',flex,gap-5', [this.fontSelect.getElement(), this.importButton]),
            c(',flex,gap-7', [
                this.alignRadioList.getElement(),
                this.italicToggle.getElement(),
                this.boldToggle.getElement(),
            ]),
            this.letterSpacingInput.getElement(),
            this.lineHeightInput.getElement(),
        ]);
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    getValues(): TFontParams {
        return {
            font: this.fontSelect.getValue(),
            size: +this.sizeInput.getValue(),
            letterSpacing: +this.letterSpacingInput.getValue(),
            lineHeight: +this.lineHeightInput.getValue(),
            align: this.alignRadioList.getValue(),
            isItalic: this.italicToggle.getValue(),
            isBold: this.boldToggle.getValue(),
        };
    }

    destroy(): void {
        this.fontPointerListener.destroy();
        this.fontSelect.getElement().removeEventListener('focus', this.onFocus);
        this.fontSelect.destroy();
        BB.destroyEl(this.importButton);
        this.sizeInput.destroy();
        this.lineHeightInput.destroy();
        this.letterSpacingInput.destroy();
        this.alignRadioList.destroy();
        this.italicToggle.destroy();
        this.boldToggle.destroy();
    }
}
