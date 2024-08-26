import { TRenderTextParam } from '../../../image-operations/render-text';
import { BB } from '../../../../bb/bb';
import { LANG } from '../../../../language/language';
import { c } from '../../../../bb/base/c';

type TTextParams = Pick<TRenderTextParam, 'text'>;

export type TTextUIParams = TTextParams & {
    onUpdate: (v: Partial<TTextParams>) => void;
};

export class TextToolTextUI {
    private readonly rootEl: HTMLElement;

    private readonly textInput: HTMLTextAreaElement;
    private lastEmittedText: string;
    private readonly onUpdate: (v: Partial<TTextParams>) => void;

    private readonly onInput = (): void => {
        this.emit();
    };

    private emit(): void {
        const text = this.textInput.value;
        if (text === this.lastEmittedText) {
            return;
        }
        this.lastEmittedText = text;
        this.onUpdate({
            text,
        });
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: TTextUIParams) {
        this.lastEmittedText = p.text;
        this.onUpdate = p.onUpdate;

        this.rootEl = c('');

        this.textInput = BB.el({
            tagName: 'textarea',
            parent: this.rootEl,
            content: p.text,
            custom: {
                placeholder: LANG('text-placeholder'),
            },
            css: {
                whiteSpace: 'pre',
                overflow: 'auto',
                width: '100%',
                height: '70px',
                resize: 'vertical',
            },
            onChange: () => {
                this.emit();
            },
        });

        this.textInput.addEventListener('input', this.onInput);
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    getValues(): TTextParams {
        return {
            text: this.textInput.value,
        };
    }

    focus(): void {
        this.textInput.focus();
    }

    destroy(): void {
        BB.destroyEl(this.textInput);
        this.textInput.removeEventListener('input', this.onInput);
    }
}
