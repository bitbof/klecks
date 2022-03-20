import {BB} from '../../../bb/bb';
import {IKeyString} from '../../../bb/bb.types';

export const input = function (params: {
    type?: 'button' | 'checkbox' | 'number' | 'text'; // default text
    min?: number;
    max?: number;
    callback: (val: string) => void;
    init: string | number;
    css?: IKeyString;
}) {
    const result = document.createElement('input');
    if (params.type) {
        try {
            result.type = params.type;
        } catch(e) {} // ie can't deal with number
    } else {
        result.type = 'text';
    }
    if (params.min !== undefined) {
        result.min = '' + params.min;
    }
    if (params.max !== undefined) {
        result.max = '' + params.max;
    }
    result.value = '' + params.init;
    if (params.callback) {
        result.onchange = function() {
            params.callback(result.value);
        };
    }
    if (params.css) {
        BB.css(result, params.css);
    }

    return result;
};