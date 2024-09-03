import { BB } from '../../../bb/bb';
import { IKeyStringOptional } from '../../../bb/bb-types';
import { PointerListener } from '../../../bb/input/pointer-listener';

// type all functions

type TTabInit = {
    id: string; // e.g. 'draw',
    label?: string;
    image?: string; // background image
    title?: string;
    isVisible?: boolean; // default is true
    onOpen: () => void;
    onClose: () => void;
    css?: IKeyStringOptional;
};

type TTab = {
    id: string;
    isVisible: boolean;
    onOpen: () => void;
    onClose: () => void;
    update: (activeTab: TTab) => void;
    el: HTMLElement;
    pointerListener: PointerListener;
};

/**
 * row of tabs. uses css class .tabrow__tab
 */
export class TabRow {
    private readonly rootEl: HTMLElement;
    private readonly tabArr: TTab[];
    private activeTab: TTab;
    private readonly roundRight: HTMLElement;
    private readonly roundLeft: HTMLElement;

    // update
    update(): void {
        for (let i = 0; i < this.tabArr.length; i++) {
            this.tabArr[i].update(this.activeTab);
        }
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: {
        initialId: string; // e.g. 'draw'
        useAccent?: boolean;
        tabArr: TTabInit[];
        height?: number;
    }) {
        const height = p.height ?? 35;
        this.rootEl = BB.el({
            className: 'tabrow',
            css: {
                height: height + 1 + 'px',
            },
        });

        this.tabArr = []; //creates its own internal arr

        const roundSize = 10;
        this.roundRight = BB.el({
            className: 'tabrow__tab__rounding-left',
        });
        this.roundLeft = BB.el({
            className: 'tabrow__tab__rounding-right',
        });

        const createTab = (pTabObj: TTabInit, initialId: string, useAccent: boolean): TTab => {
            const isVisible =
                'isVisible' in pTabObj && pTabObj.isVisible !== undefined
                    ? pTabObj.isVisible
                    : true;
            const result: TTab = {
                id: pTabObj.id,
                isVisible: isVisible,
                onOpen: pTabObj.onOpen,
                onClose: pTabObj.onClose,
                update: (openedTabObj: TTab) => {
                    result.el.className =
                        openedTabObj === result
                            ? useAccent
                                ? 'tabrow__tab tabrow__tab--opened-accented'
                                : 'tabrow__tab tabrow__tab--opened'
                            : 'tabrow__tab';
                    result.el.style.display = result.isVisible ? 'block' : 'none';
                },
                el: BB.el({
                    parent: this.rootEl,
                    content: 'label' in pTabObj ? pTabObj.label : '',
                    title: 'title' in pTabObj ? pTabObj.title : undefined,
                    className:
                        initialId === pTabObj.id
                            ? useAccent
                                ? 'tabrow__tab tabrow__tab--opened-accented'
                                : 'tabrow__tab tabrow__tab--opened'
                            : 'tabrow__tab',
                    css: {
                        lineHeight: height + 'px',
                        display: isVisible ? 'block' : 'none',
                    },
                    onClick: () => {
                        if (this.activeTab === result) {
                            return;
                        }
                        this.open(result.id);
                    },
                }),
                pointerListener: {} as PointerListener,
            };
            if ('image' in pTabObj) {
                BB.el({
                    tagName: 'span',
                    parent: result.el,
                    className: 'dark-invert',
                    css: {
                        backgroundImage: `url("${pTabObj.image}")`,
                        backgroundSize: 'contain',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        display: 'flex',
                        height: height - 7 + 'px',
                        justifyContent: 'center',
                        margin: '4px auto',
                    },
                });
            }
            if ('css' in pTabObj && pTabObj.css !== undefined) {
                BB.css(result.el, pTabObj.css);
            }

            result.pointerListener = new BB.PointerListener({
                // because :hover causes problems w touch
                target: result.el,
                onEnterLeave: (isOver) => {
                    result.el.classList.toggle('tabrow__tab-hover', isOver);
                },
            });

            if (initialId === result.id) {
                result.onOpen();
                result.el.append(this.roundRight, this.roundLeft);
            } else {
                result.onClose();
            }

            return result;
        };

        let initTabObj = null;
        for (let i = 0; i < p.tabArr.length; i++) {
            const tab = createTab(p.tabArr[i], p.initialId, p.useAccent || false);
            if (tab.id === p.initialId) {
                initTabObj = tab;
            }
            this.tabArr.push(tab);
        }
        if (!initTabObj) {
            throw 'invalid initialId';
        }
        this.activeTab = initTabObj;
    }

    // ---- interface ----

    getElement(): HTMLElement {
        return this.rootEl;
    }

    open(tabId: string): void {
        for (let i = 0; i < this.tabArr.length; i++) {
            if (this.tabArr[i].id === tabId) {
                if (this.activeTab === this.tabArr[i]) {
                    // already open
                    return;
                }
                this.activeTab.onClose();
                this.activeTab = this.tabArr[i];
                this.activeTab.onOpen();
                this.activeTab.el.append(this.roundRight, this.roundLeft);
                this.update();
                return;
            }
        }
        throw 'TabRow.open - invalid tabId';
    }

    getOpenedTabId(): string {
        return '' + this.activeTab.id;
    }

    setIsVisible(tabId: string, isVisible: boolean): void {
        for (let i = 0; i < this.tabArr.length; i++) {
            if (this.tabArr[i].id === tabId) {
                this.tabArr[i].isVisible = isVisible;
                this.update();
                return;
            }
        }
        throw 'TabRow.setIsVisible - invalid tabId';
    }

    destroy(): void {
        this.tabArr.forEach((item) => {
            BB.destroyEl(item.el);
            item.pointerListener.destroy();
        });
    }
}
