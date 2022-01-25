import {BB} from '../../../bb/bb';

export const input = function (params) {
    const result = document.createElement('input');
    if(params.type) {
        try {
            result.type = params.type;
        } catch(e) {} // ie can't deal with number
    }
    if(params.min !== undefined) {
        result.min = params.min;
    }
    if(params.max !== undefined) {
        result.max = params.max;
    }
    result.value = params.init;
    if(params.callback) {
        result.onchange = function() {
            params.callback(result.value);
        };
    }
    if(params.css) {
        BB.css(result, params.css);
    }

    return result;
};