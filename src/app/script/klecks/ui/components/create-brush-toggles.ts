import { getIconSvg } from '../../../icon/icon';
import { IconName } from '../../../../icons/icons';
import { LANG } from '../../../language/language';
import { BB } from '../../../bb/bb';
import { BoxToggle } from './box-toggle';
import * as classes from './create-brush-toggles.module.scss';

// same size as an option (35). iconSize compensates for padding within the icon's viewBox.
// with on/off icons, the icon reflects the toggle's state
function createIconToggle(
    icon: IconName | { on: IconName; off: IconName },
    iconSize: number,
    title: string,
    isChecked: boolean,
    changeCallback: (b: boolean) => void,
): BoxToggle {
    const margin = (35 - iconSize) / 2;
    // full contrast, like image based icon toggles. Otherwise inactive dimming is applied on top
    // of the toggle's already reduced text color.
    const color = 'var(--ui-on-bg-full-contrast)';
    let label: HTMLElement | SVGSVGElement;
    if (typeof icon === 'string') {
        label = getIconSvg(icon, { width: iconSize, height: iconSize, margin, color });
    } else {
        // display is controlled via classes
        const onIcon = getIconSvg(icon.on, { width: iconSize, height: iconSize, display: '' });
        onIcon.classList.add(classes.iconOn);
        const offIcon = getIconSvg(icon.off, { width: iconSize, height: iconSize, display: '' });
        offIcon.classList.add(classes.iconOff);
        label = BB.el({
            content: [onIcon, offIcon],
            css: { margin, color },
        });
    }
    const result = new BoxToggle({
        label,
        title,
        init: isChecked,
        onChange: changeCallback,
    });
    // inactive dimming like Options, which they're usually next to
    result.getElement().classList.add(classes.toggle);
    return result;
}

/**
 * icon toggle for a brush's lock alpha setting
 */
export function createLockAlphaToggle(
    isChecked: boolean,
    changeCallback: (b: boolean) => void,
): BoxToggle {
    return createIconToggle(
        { on: 'lock-alpha', off: 'lock-alpha-off' },
        25,
        LANG('lock-alpha') + ': ' + LANG('lock-alpha-title'),
        isChecked,
        changeCallback,
    );
}

/**
 * icon toggle for a brush's eraser setting
 */
export function createEraserToggle(
    isChecked: boolean,
    changeCallback: (b: boolean) => void,
): BoxToggle {
    return createIconToggle('brush-eraser', 31, LANG('eraser'), isChecked, changeCallback);
}
