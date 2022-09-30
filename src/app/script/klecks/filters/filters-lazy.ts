import {filterLib, filterLibStatus} from './filters';
import {filterBrightnessContrast} from './filter-brightness-contrast';
import {filterCropExtend} from './filter-crop-extend';
import {filterCurves} from './filter-curves';
import {filterFlip} from './filter-flip';
import {filterHueSaturation} from './filter-hue-saturation';
import {filterInvert} from './filter-invert';
import {filterPerspective} from './filter-perspective';
import {filterResize} from './filter-resize';
import {filterRotate} from './filter-rotate';
import {filterTiltShift} from './filter-tilt-shift';
import {filterTransform} from './filter-transform';
import {filterBlur} from './filter-blur';
import {filterUnsharpMask} from './filter-unsharp-mask';
import {filterToAlpha} from './filter-to-alpha';
import {filterGrid} from './filter-grid';
import {filterNoise} from './filter-noise';
import {filterPattern} from './filter-pattern';
import {filterDistort} from './filter-distort';
import {filterVanishPoint} from "./filter-vanish-point";

let embed: boolean;
function importFilter(libObj, moduleObj): void {
    if (moduleObj.getDialog) {
        libObj.getDialog = moduleObj.getDialog;
    }
    libObj.apply = moduleObj.apply;
}


export function importFilters(isEmbed?: boolean) {
    if (filterLibStatus.isLoaded) {
        return;
    }
    embed = isEmbed

    importFilter(filterLib.brightnessContrast, filterBrightnessContrast);
    importFilter(filterLib.cropExtend, filterCropExtend);
    importFilter(filterLib.curves, filterCurves);
    importFilter(filterLib.flip, filterFlip);
    importFilter(filterLib.hueSaturation, filterHueSaturation);
    importFilter(filterLib.invert, filterInvert);
    importFilter(filterLib.perspective, filterPerspective);
    importFilter(filterLib.resize, filterResize);
    importFilter(filterLib.rotate, filterRotate);
    importFilter(filterLib.tiltShift, filterTiltShift);
    importFilter(filterLib.transform, filterTransform);
    importFilter(filterLib.blur, filterBlur);
    importFilter(filterLib.unsharpMask, filterUnsharpMask);
    importFilter(filterLib.toAlpha, filterToAlpha);
    importFilter(filterLib.grid, filterGrid);
    importFilter(filterLib.noise, filterNoise);
    importFilter(filterLib.pattern, filterPattern);
    importFilter(filterLib.distort, filterDistort);
    importFilter(filterLib.vanishPoint, filterVanishPoint);

    filterLibStatus.isLoaded = true;
}