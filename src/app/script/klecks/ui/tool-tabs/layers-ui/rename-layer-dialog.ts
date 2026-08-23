import { getIconSvg } from '../../../../icon/icon';
import { BB } from '../../../../bb/bb';
import { LANG } from '../../../../language/language';
import { showModal } from '../../modals/base/show-modal';
import { Input } from '../../components/input';
import { css } from '../../../../bb/base/base';

export function renameLayerDialog(
    parentEl: HTMLElement,
    currentName: string,
    callback: (newName: string | undefined) => void,
): void {
    const div = BB.el();

    const label = BB.el({
        content: LANG('layers-rename-name') + ':',
        css: {
            marginRight: 5,
        },
    });

    const row = BB.el({
        css: {
            display: 'flex',
        },
    });
    const input = new Input({
        init: currentName,
        name: 'layer-name',
        isFocusIgnored: true,
        css: { width: '100%' },
    });
    css(input.getElement(), { flexGrow: 1 });
    const clearBtn = BB.el({
        tagName: 'button',
        className: 'kl-button',
        content: getIconSvg('remove-layer', {
            height: 20,
        }),
        title: LANG('layers-rename-clear'),
        css: {
            marginLeft: 10,
        },
        onClick: () => {
            input.setValue('');
            input.focus();
        },
    });
    const suggestions = [
        LANG('layers-rename-sketch'),
        LANG('layers-rename-colors'),
        LANG('layers-rename-shading'),
        LANG('layers-rename-lines'),
        LANG('layers-rename-effects'),
        LANG('background'),
        LANG('layers-rename-foreground'),
    ];
    const suggestionBtns: HTMLButtonElement[] = [];
    const row2 = BB.el({
        css: {
            display: 'flex',
            flexWrap: 'wrap',
            marginTop: 5,
            marginLeft: -5,
        },
    });
    suggestions.forEach((item) => {
        const btn = BB.el({
            parent: row2,
            tagName: 'button',
            className: 'kl-button',
            content: item,
            onClick: () => {
                input.setValue(btn.textContent ?? '');
            },
            css: {
                margin: '5px 0 0 5px',
            },
        });
        suggestionBtns.push(btn);
    });

    div.append(label);
    label.append(row, row2);
    row.append(input.getElement(), clearBtn);

    setTimeout(() => {
        input.focus();
        input.select();
    }, 10);

    showModal({
        message: `<b>${LANG('layers-rename-title')}</b>`,
        div: div,
        buttons: [{ id: 'rename', label: LANG('layers-rename') }, 'Cancel'],
        primaries: ['rename'],
        callback: (val) => {
            const newName = val === 'rename' ? input.getValue() : undefined;
            input.destroy();
            BB.destroyEl(clearBtn);
            suggestionBtns.forEach((item) => {
                BB.destroyEl(item);
            });
            suggestionBtns.splice(0, suggestionBtns.length);
            callback(newName);
        },
        clickOnEnter: 'rename',
    });
}
