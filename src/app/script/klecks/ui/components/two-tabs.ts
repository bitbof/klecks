import { BB } from '../../../bb/bb';

/**
 * Two buttons next to each other, each representing a tab. one at a time can be active.
 */
export class TwoTabs {
    private readonly rootEl: HTMLElement;
    private readonly leftTab: HTMLElement;
    private readonly rightTab: HTMLElement;
    private value: number;

    private update(): void {
        this.leftTab.classList.toggle('kl-2-tabs--active', this.value === 0);
        this.rightTab.classList.toggle('kl-2-tabs--active', this.value === 1);
    }

    // ----------------------------------- public -----------------------------------
    constructor(params: {
        left: string;
        right: string;
        init: number; //0, 1
        onChange: (val: number) => void;
    }) {
        this.value = params.init;

        this.rootEl = BB.el({
            className: 'kl-2-tabs',
        });

        this.leftTab = BB.el({
            parent: this.rootEl,
            content: params.left,
            className: 'kl-2-tabs__left',
        });
        this.leftTab.onpointerdown = () => false;

        this.rightTab = BB.el({
            parent: this.rootEl,
            content: params.right,
            className: 'kl-2-tabs__right',
        });
        this.rightTab.onpointerdown = () => false;

        this.update();

        this.leftTab.onclick = () => {
            if (this.value === 0) {
                return;
            }
            this.value = 0;
            this.update();
            params.onChange(this.value);
        };

        this.rightTab.onclick = () => {
            if (this.value === 1) {
                return;
            }
            this.value = 1;
            this.update();
            params.onChange(this.value);
        };
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }
}
