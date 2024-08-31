import { filterLib, filterLibStatus } from './filters';
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
import { IFilter } from '../kl-types';

type TModuleFilter = Pick<IFilter, 'getDialog' | 'apply'>;

function importFilter(libObj: IFilter, moduleObj: TModuleFilter): void {
    if (moduleObj.getDialog) {
        libObj.getDialog = moduleObj.getDialog;
    }
    libObj.apply = moduleObj.apply;
}

export function importFilters(): void {
    if (filterLibStatus.isLoaded) {
        return;
    }
    importFilter(filterLib.brightnessContrast, filterBrightnessContrast as TModuleFilter);
    importFilter(filterLib.cropExtend, filterCropExtend as TModuleFilter);
    importFilter(filterLib.curves, filterCurves as TModuleFilter);
    importFilter(filterLib.flip, filterFlip as TModuleFilter);
    importFilter(filterLib.hueSaturation, filterHueSaturation as TModuleFilter);
    importFilter(filterLib.invert, filterInvert as TModuleFilter);
    importFilter(filterLib.perspective, filterPerspective as TModuleFilter);
    importFilter(filterLib.resize, filterResize as TModuleFilter);
    importFilter(filterLib.rotate, filterRotate as TModuleFilter);
    importFilter(filterLib.tiltShift, filterTiltShift as TModuleFilter);
    importFilter(filterLib.transform, filterTransform as TModuleFilter);
    importFilter(filterLib.blur, filterBlur as TModuleFilter);
    importFilter(filterLib.unsharpMask, filterUnsharpMask as TModuleFilter);
    importFilter(filterLib.toAlpha, filterToAlpha as TModuleFilter);
    importFilter(filterLib.grid, filterGrid as TModuleFilter);
    importFilter(filterLib.noise, filterNoise as TModuleFilter);
    importFilter(filterLib.pattern, filterPattern as TModuleFilter);
    importFilter(filterLib.distort, filterDistort as TModuleFilter);
    importFilter(filterLib.vanishPoint, filterVanishPoint as TModuleFilter);

    filterLibStatus.isLoaded = true;
}
