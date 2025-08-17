import { THEME } from '../../theme/theme';
import { TRgb } from '../kl-types';

export const ERASE_COLOR = THEME.isDark() ? 255 : 255;

export function getEraseColor(): TRgb {
    return { r: ERASE_COLOR, g: ERASE_COLOR, b: ERASE_COLOR };
}
