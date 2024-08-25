import { BB } from '../../../bb/bb';
import { ImageToggle } from './image-toggle';

type TOptionItem<IdType> = {
    id: IdType;
    title: string;
    image: string;
    darkInvert?: boolean;
};

/**
 * Radio input group. each one has an image
 */
export class ImageRadioList<IdType> {
    private readonly rootEl: HTMLElement;
    private activeIndex: number;
    private readonly optionArr: {
        id: IdType;
        radioEl: ImageToggle;
    }[];

    // ----------------------------------- public -----------------------------------
    constructor(p: {
        optionArr: TOptionItem<IdType>[];
        initId: string;
        onChange: (id: IdType) => void;
    }) {
        this.rootEl = BB.el({
            className: 'image-radio-wrapper',
            css: {
                display: 'flex',
            },
        });

        this.optionArr = [];

        const select = (index: number, id: IdType): void => {
            this.activeIndex = index;
            for (let i = 0; i < this.optionArr.length; i++) {
                this.optionArr[i].radioEl.setValue(i === this.activeIndex);
            }
            p.onChange(id);
        };

        let initialIndex;
        const createOption = (
            index: number,
            o: TOptionItem<IdType>,
        ): {
            id: IdType;
            radioEl: ImageToggle;
        } => {
            if (o.id === p.initId) {
                initialIndex = index;
            }
            const radioEl = new ImageToggle({
                image: o.image,
                title: o.title,
                initValue: o.id === p.initId,
                isRadio: true,
                onChange: () => {
                    select(index, o.id);
                },
                darkInvert: o.darkInvert,
            });
            this.rootEl.append(radioEl.getElement());

            return {
                id: o.id,
                radioEl,
            };
        };

        for (let i = 0; i < p.optionArr.length; i++) {
            this.optionArr.push(createOption(i, p.optionArr[i]));
        }

        if (initialIndex === undefined) {
            throw new Error('initId not in optionArr');
        }
        this.activeIndex = initialIndex;
    }

    // --- interface ---
    getElement(): HTMLElement {
        return this.rootEl;
    }

    getValue(): IdType {
        return this.optionArr[this.activeIndex].id;
    }

    destroy(): void {
        this.optionArr.forEach((item) => {
            item.radioEl.destroy();
        });
    }
}
