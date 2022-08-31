import {BB} from '../../../bb/bb';
// @ts-ignore
import checkmarkImg from 'url:~/src/app/img/ui/checkmark.svg';

const activeColor = '#9e9e9e';
const inactiveColor = 'rgba(0,0,0,0.1)';
const hoverColor = '#ccc';

export class TwoTabs {

    private rootEl: HTMLElement;
    private leftTab: HTMLElement;
    private rightTab: HTMLElement;
    private value: number;

    private update(): void {
        if (this.value === 0) {
            BB.css(this.leftTab, {
                background: "url(" + checkmarkImg + ") no-repeat 12px 16px",
                backgroundColor: activeColor,
                backgroundSize: '8%',
                boxShadow: 'inset 0px 5px 10px rgba(0,0,0,0.5)',
                cursor: 'default',
            });
            BB.css(this.rightTab, {
                background: '',
                backgroundColor: inactiveColor,
                backgroundSize: '8%',
                boxShadow: '',
                cursor: 'pointer',
            });
        } else {
            BB.css(this.rightTab, {
                background: "url(" + checkmarkImg + ") no-repeat 12px 16px",
                backgroundColor: activeColor,
                backgroundSize: '8%',
                boxShadow: 'inset 0px 5px 10px rgba(0,0,0,0.5)',
                cursor: 'default',
            });
            BB.css(this.leftTab, {
                background: '',
                backgroundColor: inactiveColor,
                backgroundSize: '8%',
                boxShadow: '',
                cursor: 'pointer',
            });
        }
    }


    // ---- public ----
    constructor(params: {
        left: string;
        right: string;
        init: number; //0, 1
        onChange: (val: number) => void;
    }) {
        this.value = params.init;

        this.rootEl = BB.el({
            css: {
                display: 'flex',
                justifyContent: 'center',
            }
        });

        this.leftTab = BB.el({
            parent: this.rootEl,
            content: params.left,
            css: {
                width: '150px',
                height: '30px',
                paddingTop: '10px',
                textAlign: 'center',
                paddingBottom: '0',
                borderTopLeftRadius: '10px',
                backgroundSize: '8%',
            }
        });
        BB.setEventListener(this.leftTab, 'onpointerdown', function () {
            return false;
        });

        this.rightTab = BB.el({
            parent: this.rootEl,
            content: params.right,
            css: {
                width: '150px',
                height: '30px',
                paddingTop: '10px',
                textAlign: 'center',
                paddingBottom: '0',
                borderTopRightRadius: '10px',
                backgroundSize: '8%',
            }
        });
        BB.setEventListener(this.rightTab, 'onpointerdown', () => {
            return false;
        });

        this.update();

        BB.setEventListener(this.leftTab, 'onpointerover', () => {
            if (this.value !== 0) {
                this.leftTab.style.backgroundColor = hoverColor;
            }
        });
        BB.setEventListener(this.leftTab, 'onpointerout', () => {
            if (this.value !== 0) {
                this.leftTab.style.backgroundColor = inactiveColor;
            }
        });
        BB.setEventListener(this.rightTab, 'onpointerover', () => {
            if (this.value !== 1) {
                this.rightTab.style.backgroundColor = hoverColor;
            }
        });
        BB.setEventListener(this.rightTab, 'onpointerout', () => {
            if (this.value !== 1) {
                this.rightTab.style.backgroundColor = inactiveColor;
            }
        });

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