import { BB } from '../../../bb/bb';
import { getIconSvg } from '../../../icon/icon';
import { Destroyer } from '../../../bb/base/base';

export function createHelpButton(p: {
    title: string;
    onClick: () => void;
    isFocusable?: boolean;
    destroyer?: Destroyer;
}): HTMLButtonElement {
    const result = BB.el({
        tagName: 'button',
        className: 'kl-help-btn',
        content: getIconSvg('help', {
            width: 19,
            height: 19,
        }),
        title: p.title,
        destroyer: p.destroyer,
        props: { type: 'button', ariaLabel: p.title },
        onClick: p.onClick,
    });
    if (p.isFocusable === false) {
        result.tabIndex = -1;
    }

    return result;
}
