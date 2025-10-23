import { BB } from '../bb/bb';
import { ERASE_COLOR } from '../klecks/brushes/erase-color';
import { TKlProject } from '../klecks/kl-types';
import { LANG } from '../language/language';

export const getDefaultProjectOptions = (projectId: string, width?: number, height?: number) => {
    return {
        projectId: projectId,
        width: width ?? 100,
        height: height ?? 100,
        layers: [
            {
                name: LANG('layers-layer') + ' 1', // not ideal
                opacity: 1,
                isVisible: true,
                mixModeStr: 'source-over',
                image: {
                    fill: BB.ColorConverter.toRgbStr({
                        r: ERASE_COLOR,
                        g: ERASE_COLOR,
                        b: ERASE_COLOR,
                    }),
                },
            },
        ]
    } as TKlProject;
};
