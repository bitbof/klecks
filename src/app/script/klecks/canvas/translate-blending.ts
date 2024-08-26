import { TMixMode } from '../kl-types';
import { LANG } from '../../language/language';
import { TTranslationCode } from '../../../languages/languages';

export function translateBlending(blendMode?: TMixMode): string {
    if (!blendMode) {
        return LANG('layers-blend-normal');
    }

    const codes: {
        [key: string]: TTranslationCode;
    } = {
        'source-over': 'layers-blend-normal',
        darken: 'layers-blend-darken',
        multiply: 'layers-blend-multiply',
        'color-burn': 'layers-blend-color-burn',
        lighten: 'layers-blend-lighten',
        screen: 'layers-blend-screen',
        'color-dodge': 'layers-blend-color-dodge',
        overlay: 'layers-blend-overlay',
        'soft-light': 'layers-blend-soft-light',
        'hard-light': 'layers-blend-hard-light',
        difference: 'layers-blend-difference',
        exclusion: 'layers-blend-exclusion',
        hue: 'layers-blend-hue',
        saturation: 'layers-blend-saturation',
        color: 'layers-blend-color',
        luminosity: 'layers-blend-luminosity',
    };

    if (!(blendMode in codes)) {
        throw new Error('unknown blend mode');
    }
    return LANG(codes[blendMode]);
}
