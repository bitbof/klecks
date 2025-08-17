import { FILTER_LIB, FILTER_LIB_STATUS } from './filters';
import { filterBrightnessContrast } from './filter-brightness-contrast';
import { filterCropExtend } from './filter-crop-extend';
import { filterCurves } from './filter-curves';
import { filterFlip } from './filter-flip';
import { filterHueSaturation } from './filter-hue-saturation';
import { filterInvert } from './filter-invert';
import { filterPerspective } from './filter-perspective';
import { filterResize } from './filter-resize';
import { filterRotate } from './filter-rotate';
import { filterTiltShift } from './filter-tilt-shift';
import { filterTransform } from './filter-transform';
import { filterBlur } from './filter-blur';
import { filterUnsharpMask } from './filter-unsharp-mask';
import { filterToAlpha } from './filter-to-alpha';
import { filterGrid } from './filter-grid';
import { filterNoise } from './filter-noise';
import { filterPattern } from './filter-pattern';
import { filterDistort } from './filter-distort';
import { filterVanishPoint } from './filter-vanish-point';
import { TFilter } from '../kl-types';

type TModuleFilter = Pick<TFilter, 'getDialog' | 'apply'>;

function importFilter(libObj: TFilter, moduleObj: TModuleFilter): void {
    if (moduleObj.getDialog) {
        libObj.getDialog = moduleObj.getDialog;
    }
    libObj.apply = moduleObj.apply;
}

export function importFilters(): void {
    if (FILTER_LIB_STATUS.isLoaded) {
        return;
    }
    importFilter(FILTER_LIB.brightnessContrast, filterBrightnessContrast as TModuleFilter);
    importFilter(FILTER_LIB.cropExtend, filterCropExtend as TModuleFilter);
    importFilter(FILTER_LIB.curves, filterCurves as TModuleFilter);
    importFilter(FILTER_LIB.flip, filterFlip as TModuleFilter);
    importFilter(FILTER_LIB.hueSaturation, filterHueSaturation as TModuleFilter);
    importFilter(FILTER_LIB.invert, filterInvert as TModuleFilter);
    importFilter(FILTER_LIB.perspective, filterPerspective as TModuleFilter);
    importFilter(FILTER_LIB.resize, filterResize as TModuleFilter);
    importFilter(FILTER_LIB.rotate, filterRotate as TModuleFilter);
    importFilter(FILTER_LIB.tiltShift, filterTiltShift as TModuleFilter);
    importFilter(FILTER_LIB.transform, filterTransform as TModuleFilter);
    importFilter(FILTER_LIB.blur, filterBlur as TModuleFilter);
    importFilter(FILTER_LIB.unsharpMask, filterUnsharpMask as TModuleFilter);
    importFilter(FILTER_LIB.toAlpha, filterToAlpha as TModuleFilter);
    importFilter(FILTER_LIB.grid, filterGrid as TModuleFilter);
    importFilter(FILTER_LIB.noise, filterNoise as TModuleFilter);
    importFilter(FILTER_LIB.pattern, filterPattern as TModuleFilter);
    importFilter(FILTER_LIB.distort, filterDistort as TModuleFilter);
    importFilter(FILTER_LIB.vanishPoint, filterVanishPoint as TModuleFilter);

    FILTER_LIB_STATUS.isLoaded = true;
}
