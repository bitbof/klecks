import { c } from '../../../bb/base/c';
import { el } from '../../../bb/base/ui';

export type TDropdownMenuParams<IdType extends string> = {
    button: string | HTMLElement;
    buttonTitle?: string;
    items: ([IdType, string] | [IdType, string, string])[]; // id, label, shortcut
    onItemClick: (id: IdType) => void;
};

export class DropdownMenu<IdType extends string> {
    private readonly rootElement: HTMLElement;
    private isExpanded: boolean = false;
    private readonly onSetEnabled: (id: IdType, enabled: boolean) => void = () => 0;

    // ----------------------------------- public -----------------------------------
    constructor(p: TDropdownMenuParams<IdType>) {
        const button = c('button.kl-button,w-full,h-full', [p.button]) as HTMLButtonElement;
        button.tabIndex = -1;
        button.onclick = () => {
            toggle(!this.isExpanded);
        };
        if (p.buttonTitle) {
            button.title = p.buttonTitle;
        }

        const items: HTMLButtonElement[] = [];
        const itemMap: Record<IdType, HTMLButtonElement> = {} as Record<IdType, HTMLButtonElement>;
        p.items.forEach((item) => {
            const itemButton = el({
                tagName: 'button',
                className: 'kl-button',
                css: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 10,
                },
            });
            itemButton.tabIndex = -1;
            itemButton.append(el({ content: item[1] }));
            if (item[2]) {
                itemButton.append(
                    el({ content: item[2], css: { fontSize: '0.8em', opacity: '0.8' } }),
                );
            }
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
            menu.style.display = this.isExpanded ? '' : 'none';
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

    setEnabled(id: IdType, enabled: boolean): void {
        this.onSetEnabled(id, enabled);
    }
}
