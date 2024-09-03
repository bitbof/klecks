import { theme } from '../../theme/theme';
import { IRGB } from '../kl-types';

export const ERASE_COLOR = theme.isDark() ? 255 : 255;

export function getEraseColor(): IRGB {
    return { r: ERASE_COLOR, g: ERASE_COLOR, b: ERASE_COLOR };
}
