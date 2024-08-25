import { c } from '../../../bb/base/c';
import { makeUnfocusable } from '../../../bb/base/ui';

export type TDropdownMenuParams = {
    button: string | HTMLElement;
    buttonTitle?: string;
    items: [string, string][]; // id, label
    onItemClick: (id: string) => void;
};

export class DropdownMenu {
    private readonly rootElement: HTMLElement;
    private isExpanded: boolean = false;
    private readonly onSetEnabled: (id: string, enabled: boolean) => void = () => 0;

    // ----------------------------------- public -----------------------------------
    constructor(p: TDropdownMenuParams) {
        const button = c('button,w-full,h-full', [p.button]) as HTMLButtonElement;
        button.onclick = () => {
            toggle(!this.isExpanded);
        };
        if (p.buttonTitle) {
            button.title = p.buttonTitle;
        }
        makeUnfocusable(button);

        const items: HTMLButtonElement[] = [];
        const itemMap: Record<string, HTMLButtonElement> = {};
        p.items.forEach((item) => {
            const itemButton = c('button', item[1]) as HTMLButtonElement;
            makeUnfocusable(itemButton);
            itemButton.onclick = () => {
                toggle(false);
                p.onItemClick(item[0]);
            };
            items.push(itemButton);
            itemMap[item[0]] = itemButton;
        });

        this.onSetEnabled = (id, enabled) => {
            itemMap[id].disabled = !enabled;
        };

        const menu = c('.kl-dropdown-menu,right-0,top-full,nowrap,hidden', items);

        this.rootElement = c(',pos-relative', [button, menu]);

        const toggle = (force: boolean) => {
            this.isExpanded = force;
            menu.style.display = this.isExpanded ? 'block' : 'none';
            if (this.isExpanded) {
                document.addEventListener('pointerdown', onPointerDown, { passive: false });
                window.addEventListener('blur', onBlur);
            } else {
                document.removeEventListener('pointerdown', onPointerDown);
                window.removeEventListener('blur', onBlur);
            }
        };

        const onPointerDown = (e: PointerEvent) => {
            const target = e.target as HTMLElement | null;
            if (button.contains(target) || menu.contains(target)) {
                return;
            }
            toggle(false);
        };

        const onBlur = () => toggle(false);
    }

    getElement(): HTMLElement {
        return this.rootElement;
    }

    setEnabled(id: string, enabled: boolean): void {
        this.onSetEnabled(id, enabled);
    }
}
