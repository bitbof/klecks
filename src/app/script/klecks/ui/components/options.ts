import { BB } from '../../../bb/bb';
import { IKeyStringOptional } from '../../../bb/bb-types';

/**
 * selectable options
 */
export class Options<IdType> {
    private readonly rootEl: HTMLElement;
    private selectedId: IdType;
    private readonly optionArr: {
        id: IdType;
        el: HTMLElement;
    }[];
    private readonly onChange: ((id: IdType) => void) | undefined;

    private getIndex(): number {
        for (let i = 0; i < this.optionArr.length; i++) {
            if (this.optionArr[i].id === this.selectedId) {
                return i;
            }
        }
        return -1;
    }

    private update(): void {
        for (let i = 0; i < this.optionArr.length; i++) {
            this.optionArr[i].el.classList.toggle(
                'kl-option-selected',
                this.optionArr[i].id === this.selectedId,
            );
        }
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: {
        optionArr: {
            id: IdType;
            label: string | HTMLElement | SVGElement;
            title?: string;
        }[];
        initId?: IdType;
        onChange?: (id: IdType) => void;
        /** before the change happens, check if you allow it. true -> yes */
        onBeforeChange?: (id: IdType) => boolean;
        changeOnInit?: boolean; // trigger change on creation
        isSmall?: boolean;
        optionCss?: IKeyStringOptional;
    }) {
        this.rootEl = BB.el();

        const wrapperEl = BB.el({
            parent: this.rootEl,
            className: 'kl-option-wrapper',
            css: {
                display: 'flex',
            },
        });

        if (p.onChange) {
            this.onChange = p.onChange;
        }
        this.optionArr = [];
        this.selectedId = 'initialId' in p && p.initId !== undefined ? p.initId : p.optionArr[0].id;

        const createOption = (o: {
            id: IdType;
            label: string | HTMLElement | SVGElement;
            title?: string;
        }) => {
            const classArr = ['kl-option'];
            if (p.isSmall) {
                classArr.push('kl-option--small');
            }
            if (typeof o.label !== 'string') {
                classArr.push('kl-option--custom-el');
                BB.css(o.label, {
                    display: 'block',
                    pointerEvents: 'none',
                });
            }

            const optionObj = {
                id: o.id,
                el: BB.el({
                    parent: wrapperEl,
                    content: o.label,
                    className: classArr.join(' '),
                    onClick: () => {
                        if (this.selectedId !== optionObj.id) {
                            if (p.onBeforeChange && !p.onBeforeChange(optionObj.id)) {
                                return;
                            }

                            this.selectedId = optionObj.id;
                            this.update();
                            this.onChange && this.onChange(this.selectedId);
                        }
                    },
                    css: p.optionCss,
                }),
            };

            if (o.title) {
                optionObj.el.title = o.title;
            }

            this.optionArr.push(optionObj);
        };

        for (let i = 0; i < p.optionArr.length; i++) {
            createOption(p.optionArr[i]);
        }

        this.update();

        if (p.changeOnInit) {
            setTimeout(() => {
                this.onChange && this.onChange(this.selectedId);
            }, 0);
        }
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    getValue(): IdType {
        return this.selectedId;
    }

    next(): void {
        this.selectedId = this.optionArr[(this.getIndex() + 1) % this.optionArr.length].id;
        this.update();
        this.onChange && this.onChange(this.selectedId);
    }

    setValue(val: IdType): void {
        if (this.selectedId === val) {
            return;
        }
        this.selectedId = val;
        this.update();
        this.onChange && this.onChange(this.selectedId);
    }

    previous(): void {
        this.selectedId =
            this.optionArr[
                (this.optionArr.length + this.getIndex() - 1) % this.optionArr.length
            ].id;
        this.update();
        this.onChange && this.onChange(this.selectedId);
    }

    destroy(): void {
        this.rootEl.remove();
        this.optionArr.forEach((item) => {
            BB.destroyEl(item.el);
        });
        this.optionArr.splice(0, this.optionArr.length);
    }
}
