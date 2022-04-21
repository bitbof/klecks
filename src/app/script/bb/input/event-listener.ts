import {hasPointerEvents} from '../base/browser';

const listenerFuncObj = {}; // for debugging

export const setEventListener = function (DomEl, type, listener) {
    if (!hasPointerEvents) {
        type = type.replace('pointer', 'mouse');
    }
    DomEl[type] = listener;
};

export const addEventListener = function (DomEl, type, listener, options?) {
    if (!hasPointerEvents) {
        type = type.replace('pointer', 'mouse');
    }
    /*if (!(type in listenerFuncObj)) {
        listenerFuncObj[type] = [];
    }
    listenerFuncObj[type].push(listener);*/
    DomEl.addEventListener(type, listener, options);
};

export const removeEventListener = function (DomEl, type, listener, options?) {
    if (!hasPointerEvents) {
        type = type.replace('pointer', 'mouse');
    }
    /*if (type in listenerFuncObj) {
        for (let i = 0; i < listenerFuncObj[type].length; i++) {
            if (listenerFuncObj[type][i] === listener) {
                listenerFuncObj[type].splice(i, 1);
                i--;
            }
        }
    }*/
    DomEl.removeEventListener(type, listener, options);
};