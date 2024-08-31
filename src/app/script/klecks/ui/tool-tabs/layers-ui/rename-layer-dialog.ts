import { BB } from '../../../../bb/bb';
import { LANG } from '../../../../language/language';
import { showModal } from '../../modals/base/showModal';
import removeLayerImg from '/src/app/img/ui/remove-layer.svg';

export function renameLayerDialog(
    parentEl: HTMLElement,
    currentName: string,
    callback: (newName: string | undefined) => void,
): void {
    const div = BB.el();

    const label = BB.el({
        content: LANG('layers-rename-name') + ':',
        css: {
            marginRight: '5px',
        },
    });

    const row = BB.el({
        css: {
            display: 'flex',
        },
    });
    const input = BB.el({ tagName: 'input' });
    input.value = currentName;
    input.setAttribute('data-ignore-focus', 'true');
    const clearBtn = BB.el({
        tagName: 'button',
        content: '<img src="' + removeLayerImg + '" height="20"/>',
        title: LANG('layers-rename-clear'),
        css: {
            marginLeft: '10px',
        },
        onClick: () => {
            input.value = '';
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
            marginTop: '5px',
            marginLeft: '-5px',
        },
    });
    suggestions.forEach((item) => {
        const btn = BB.el({
            parent: row2,
            tagName: 'button',
            content: item,
            onClick: () => {
                input.value = '' + btn.textContent;
            },
            css: {
                margin: '5px 0 0 5px',
            },
        });
        suggestionBtns.push(btn);
    });

    div.append(label);
    label.append(row, row2);
    row.append(input, clearBtn);

    setTimeout(() => {
        input.focus();
        input.select();
    }, 10);

    showModal({
        target: parentEl,
        message: `<b>${LANG('layers-rename-title')}</b>`,
        div: div,
        buttons: [LANG('layers-rename'), 'Cancel'],
        primaries: [LANG('layers-rename')],
        callback: (val) => {
            BB.destroyEl(clearBtn);
            suggestionBtns.forEach((item) => {
                BB.destroyEl(item);
            });
            suggestionBtns.splice(0, suggestionBtns.length);
            if (val === LANG('layers-rename')) {
                callback(input.value);
            } else {
                callback(undefined);
            }
        },
        clickOnEnter: LANG('layers-rename'),
    });
}
