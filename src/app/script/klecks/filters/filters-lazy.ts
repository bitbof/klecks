import {filterLib, filterLibStatus} from './filters';
import {glBrightnessContrast} from './gl-brightness-contrast';
import {cropExtend} from './crop-extend';
import {glCurves} from './gl-curves';
import {flip} from './flip';
import {glHueSaturation} from './gl-hue-saturation';
import {invert} from './invert';
import {glPerspective} from './gl-perspective';
import {resize} from './resize';
import {rotate} from './rotate';
import {glTiltShift} from './gl-tilt-shift';
import {transform} from './transform';
import {glBlur} from './gl-blur';
import {glUnsharpMask} from './gl-unsharp-mask';
import {toAlpha} from './to-alpha';

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

    importFilter(filterLib.glBrightnessContrast, glBrightnessContrast);
    importFilter(filterLib.cropExtend, cropExtend);
    importFilter(filterLib.glCurves, glCurves);
    importFilter(filterLib.flip, flip);
    importFilter(filterLib.glHueSaturation, glHueSaturation);
    importFilter(filterLib.invert, invert);
    importFilter(filterLib.glPerspective, glPerspective);
    importFilter(filterLib.resize, resize);
    importFilter(filterLib.rotate, rotate);
    importFilter(filterLib.glTiltShift, glTiltShift);
    importFilter(filterLib.transform, transform);
    importFilter(filterLib.glBlur, glBlur);
    importFilter(filterLib.glUnsharpMask, glUnsharpMask);
    importFilter(filterLib.toAlpha, toAlpha);

    filterLibStatus.isLoaded = true;
}