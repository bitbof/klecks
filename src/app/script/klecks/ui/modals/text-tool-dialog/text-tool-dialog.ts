import { BB } from '../../../../bb/bb';
import { TRenderTextParam } from '../../../image-operations/render-text';
import { showModal } from '../base/showModal';
import { TRgb } from '../../../kl-types';
import { KlCanvas } from '../../../canvas/kl-canvas';
import { LANG } from '../../../../language/language';
import { TextToolFillUI } from './text-tool-fill-ui';
import { TextToolFontUI } from './text-tool-font-ui';
import { TextToolStrokeUI } from './text-tool-stroke-ui';
import { TextToolTextUI } from './text-tool-text-ui';
import { TextToolViewportUI } from './text-tool-viewport-ui';
import * as classes from './text-tool-dialog.module.scss';
import { c } from '../../../../bb/base/c';
import { TabRow } from '../../components/tab-row';

export function textToolDialog(p: {
    klCanvas: KlCanvas;
    layerIndex: number;
    primaryColor: TRgb;
    secondaryColor: TRgb;

    text: TRenderTextParam;
    onConfirm: (confirmP: TRenderTextParam) => void;
}): void {
    const rootEl = BB.el({});
    let text = BB.copyObj(p.text);

    const viewportWrapper = BB.el({
        className: classes.viewportWrapper,
    });

    const viewportUI = new TextToolViewportUI({
        text: text,
        klCanvas: p.klCanvas,
        layerIndex: p.layerIndex,
        onDragEnd: () => (tabs.getOpenedTabId() === 'text' ? textUI.focus() : 0),
    });
    viewportUI.render();

    function onUpdate(p: Partial<TRenderTextParam>) {
        text = {
            ...text,
            ...p,
        };
        viewportUI.setText(text);
    }

    const fontUI = new TextToolFontUI({
        ...text,
        onUpdate: (p) => {
            onUpdate(p);
        },
    });

    const colorWrapper = BB.el({
        css: {
            display: 'flex',
            gap: '10px',
            flexDirection: 'column',
        },
    });
    const fillUI = new TextToolFillUI({
        fill: text.fill,
        primaryColor: p.primaryColor,
        secondaryColor: p.secondaryColor,
        onUpdate: (p) => {
            onUpdate(p);
        },
    });
    const strokeUI = new TextToolStrokeUI({
        stroke: text.stroke,
        primaryColor: p.primaryColor,
        secondaryColor: p.secondaryColor,
        onUpdate: (p) => {
            onUpdate(p);
        },
    });
    const textUI = new TextToolTextUI({
        text: text.text,
        onUpdate: (p) => {
            p.text !== undefined && modal.setIgnoreBackground(p.text.length > 0);
            onUpdate(p);
        },
    });

    const tabs = new TabRow({
        initialId: 'text',
        height: 40,
        tabArr: [
            {
                id: 'text',
                label: LANG('text-text'),
                onOpen: () => {
                    textUI.getElement().style.display = '';
                    textUI.focus();
                },
                onClose: () => {
                    textUI.getElement().style.display = 'none';
                },
            },
            {
                id: 'font',
                label: LANG('text-font'),
                onOpen: () => {
                    fontUI.getElement().style.display = 'flex';
                },
                onClose: () => {
                    fontUI.getElement().style.display = 'none';
                },
            },
            {
                id: 'color',
                label: LANG('text-color'),
                onOpen: () => {
                    colorWrapper.style.display = 'flex';
                },
                onClose: () => {
                    colorWrapper.style.display = 'none';
                },
            },
        ],
    });
    tabs.getElement().classList.add(classes.tab);
    rootEl.append(
        c('', [
            c(viewportWrapper, [viewportUI.getElement()]),
            c('.' + classes.viewportInputs, [viewportUI.getInputsElement()]),
            c('.tabrow.' + classes.tabWrapper, [c(',w-240,h-40'), tabs.getElement()]),

            c('.' + classes.inputs, [
                c(colorWrapper, [fillUI.getElement(), strokeUI.getElement()]),
                fontUI.getElement(),
                textUI.getElement(),
            ]),
        ]),
    );

    const onResize = () => {
        const b = viewportWrapper.getBoundingClientRect();
        const w = Math.ceil(b.width);
        const h = Math.ceil(b.height);
        viewportUI.setSize(w, h);
    };
    window.addEventListener('resize', onResize);
    setTimeout(() => {
        onResize();
    });
    setTimeout(() => {
        textUI.focus();
    }, 100);

    // prevent mobile keyboards scrolling page
    function onScroll(): void {
        window.scrollTo(0, 0);
    }
    window.addEventListener('scroll', onScroll, { passive: false });

    const onModalExit = (val: string) => {
        window.removeEventListener('resize', onResize);
        window.removeEventListener('scroll', onScroll);
        viewportUI.destroy();
        fontUI.destroy();
        fillUI.destroy();
        strokeUI.destroy();
        textUI.destroy();
        tabs.destroy();

        if (val === 'Ok') {
            p.onConfirm({
                ...viewportUI.getValues(),
                ...fontUI.getValues(),
                ...fillUI.getValues(),
                ...strokeUI.getValues(),
                ...textUI.getValues(),
            });
        }
    };

    const modal = showModal({
        target: document.body,
        message: `<b>${LANG('text-title')}</b>`,
        div: rootEl,
        buttons: ['Ok', 'Cancel'],
        ignoreBackground: p.text.text.length > 0,
        callback: onModalExit,
        style: {
            width: 'calc(100% - 50px)',
            maxWidth: '1000px',
            minWidth: '300px',
            boxSizing: 'border-box',
        },
        clickOnEnter: 'Ok',
    });
}
