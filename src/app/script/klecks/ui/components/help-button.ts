import { BB } from '../../../bb/bb';
import { makeUnfocusable } from '../../../bb/base/ui';
import { getIconSvg } from '../../../icon/icon';

export function createHelpButton(p: {
    title: string;
    onClick: () => void;
    isFocusable?: boolean;
}): HTMLButtonElement {
    const result = BB.el({
        tagName: 'button',
        className: 'kl-help-btn',
        content: getIconSvg('help', {
            width: 19,
            height: 19,
        }),
        title: p.title,
        custom: {
            type: 'button',
            'aria-label': p.title,
        },
        onClick: p.onClick,
        noRef: true,
    });

    if (p.isFocusable === false) {
        makeUnfocusable(result);
    }

    return result;
}
