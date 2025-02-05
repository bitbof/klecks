import { BB } from '../../../bb/bb';

export type TIconParams = {
    imageUrl: string;
    width: number;
    height: number;
    darkInvert?: boolean;
    css?: Partial<CSSStyleDeclaration>;
};

export class Icon {
    private readonly rootEl: HTMLElement;

    // ----------------------------------- public -----------------------------------
    constructor(p: TIconParams) {
        this.rootEl = BB.el({
            className: p.darkInvert ? 'dark-invert' : '',
            css: {
                backgroundImage: `url("${p.imageUrl}")`,
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                width: p.width + 'px',
                height: p.height + 'px',
                ...p.css,
            },
        });
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }
}
