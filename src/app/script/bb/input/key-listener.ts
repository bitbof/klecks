import { TKeyString } from '../bb-types';

type TGlobalKey = {
    add: (keyListenerRef: TKeyListenerRef) => void;
    remove: (keyListenerRef: TKeyListenerRef) => void;
    getIsDown: () => TIsDown;
    getCombo: () => string[];
    blur: () => void;
};

type TIsDown = {
    [key: string]: boolean;
};

export type TOnKeyDown = (
    keyStr: string,
    e: KeyboardEvent,
    comboStr: string,
    isRepeat?: boolean,
) => void;
export type TOnKeyUp = (keyStr: string, e: KeyboardEvent, oldComboStr: string) => void;
export type TOnBlur = () => void;
type TKeyListenerRef = [TOnKeyDown | undefined, TOnKeyUp | undefined, TOnBlur | undefined];

const globalKey = ((): TGlobalKey => {
    // keyStr - our key naming system
    // key - KeyboardEvent.key
    // code - KeyboardEvent.code

    const keyStrToKeyObj = {
        // keyStr not to contain a '+', because that's used for the comboStr
        space: [' '],
        alt: ['Alt', 'AltGraph'],
        shift: 'Shift',
        ctrl: 'Control',
        cmd: ['Meta', 'MetaLeft', 'MetaRight'],
        enter: 'Enter',
        esc: 'Escape',
        backspace: 'Backspace',
        delete: 'Delete',
        sqbr_open: '[',
        sqbr_close: ']',
        a: ['a', 'A'],
        b: ['b', 'B'],
        c: ['c', 'C'],
        e: ['e', 'E'],
        f: ['f', 'F'],
        g: ['g', 'G'],
        l: ['l', 'L'],
        m: ['m', 'M'],
        r: ['r', 'R'], // when holding shift
        s: ['s', 'S'],
        t: ['t', 'T'],
        u: ['u', 'U'],
        x: ['x', 'X'],
        y: ['y', 'Y'],
        z: ['z', 'Z'],
        plus: '+',
        minus: '-',
        left: 'ArrowLeft',
        right: 'ArrowRight',
        up: 'ArrowUp',
        down: 'ArrowDown',
        home: 'Home',
        end: 'End',
    };

    // ['space', 'alt', ... ]
    const keyStrArr = Object.keys(keyStrToKeyObj);
    // { space: false, ... }
    const isDownObj: TIsDown = {};
    // { ArrowLeft: 'left', ... }
    const keyToKeyStrObj: TKeyString = {};
    for (const [keyStr, keys] of Object.entries(keyStrToKeyObj)) {
        isDownObj[keyStr] = false;
        for (const key of typeof keys === 'string' ? [keys] : keys) {
            keyToKeyStrObj[key] = keyStr;
        }
    }

    let comboArr: string[] = [];

    // a physical key's "key" can change as other keys get pressed. to keep track, need to also track the code
    // { KeyE: 'e', KeyF: undefined } - undefined - not down, string - the associated keyStr
    let codeIsDownObj: {
        [key: string]: string | undefined;
    } = {};
    const listenerArr: TKeyListenerRef[] = [];

    /**
     * Windows bug in all browsers: Pressing the Windows key leads to keyboard events not firing.
     * It breaks key state tracking.
     * Workaround: If after a timeout, only the meta key is pressed, fire a keyup for the meta key.
     */
    let metaClearTimeout: ReturnType<typeof setTimeout> | undefined;
    const setupMetaClear = (keyStr: string, code: string) => {
        metaClearTimeout = setTimeout(() => {
            if (comboArr.length !== 1 || comboArr[0] === 'cmd') {
                return;
            }
            const oldComboStr = comboArr.join('+');
            isDownObj[keyStr] = false;
            codeIsDownObj[code] = undefined;
            // remove from combo
            for (let i = 0; i < comboArr.length; i++) {
                if (comboArr[i] === keyStr) {
                    comboArr.splice(i, 1);
                    i--;
                }
            }
            emitUp(
                keyStr,
                {
                    preventDefault: function () {},
                    stopPropagation: function () {},
                } as KeyboardEvent,
                oldComboStr,
            );
            metaClearTimeout = undefined;
        }, 1000);
    };

    const emitDown: TOnKeyDown = function (a, b, c, d?): void {
        listenerArr.forEach((item) => {
            item[0]?.(a, b, c, d);
        });
    };

    const emitUp: TOnKeyUp = function (a, b, c): void {
        listenerArr.forEach((item) => {
            item[1]?.(a, b, c);
        });
    };

    const emitBlur: TOnBlur = function (): void {
        listenerArr.forEach((item) => {
            item[2]?.();
        });
    };

    function keyDown(e: KeyboardEvent): void {
        const key = e.key;
        const code = e.code;

        if (key in keyToKeyStrObj) {
            const keyStr = keyToKeyStrObj[key];
            if (isDownObj[keyStr]) {
                emitDown(keyStr, e, comboArr.join('+'), true);
                return;
            } else {
                if (keyStr === 'cmd') {
                    setupMetaClear(keyStr, code);
                } else {
                    clearTimeout(metaClearTimeout);
                }
                if (keyStr === 'esc') {
                    // Workaround for a macOS behavior
                    // When in fullscreen, pressing escape exits the fullscreen mode.
                    // When that happens, no keyup for escape is fired.
                    setTimeout(() => blur());
                }
            }
            isDownObj[keyStr] = true;
            codeIsDownObj[code] = keyStr;

            //add to combo
            comboArr.push(keyStr);

            emitDown(keyStr, e, comboArr.join('+'));
        }
    }

    function keyUp(e: KeyboardEvent): void {
        const code = e.code;
        const oldComboStr = comboArr.join('+');

        // because of a macOS bug: when meta key is down, keyup of other keys does not fire.
        // https://stackoverflow.com/questions/25438608/javascript-keyup-isnt-called-when-command-and-another-is-pressed
        if (
            [
                'Meta',
                'MetaLeft',
                'MetaRight',
                'OSLeft',
                'OSRight', // Firefox
            ].includes(code)
        ) {
            blur();
            return;
        } else if (isDownObj['cmd']) {
            // Workaround for Windows bug. Windows doesn't fire keyup for Meta key when pressing Windows Key + Space,
            // neither does it fire blur
            blur();
            return;
        }

        const keyStr = codeIsDownObj[code];
        if (keyStr !== undefined) {
            isDownObj[keyStr] = false;
            codeIsDownObj[code] = undefined;

            // remove from combo
            for (let i = 0; i < comboArr.length; i++) {
                if (comboArr[i] === keyStr) {
                    comboArr.splice(i, 1);
                    i--;
                }
            }

            emitUp(keyStr, e, oldComboStr);
        }
    }

    function blur(): void {
        const oldComboStr = comboArr.join('+');
        comboArr = [];
        codeIsDownObj = {};

        const eventArr: string[] = [];
        keyStrArr.forEach((keyStr) => {
            if (isDownObj[keyStr]) {
                isDownObj[keyStr] = false;
                eventArr.push(keyStr);
            }
        });
        for (let i = 0; i < eventArr.length; i++) {
            emitUp(
                eventArr[i],
                {
                    preventDefault: function () {},
                    stopPropagation: function () {},
                } as KeyboardEvent,
                oldComboStr,
            );
        }
        emitBlur();
    }

    return {
        add: (keyListenerRef: TKeyListenerRef): void => {
            if (listenerArr.includes(keyListenerRef)) {
                return;
            }
            const first = listenerArr.length === 0;
            listenerArr.push(keyListenerRef);

            if (first) {
                document.addEventListener('keydown', keyDown);
                document.addEventListener('keyup', keyUp);
                window.addEventListener('blur', blur);
            }
        },
        remove: (keyListenerRef: TKeyListenerRef): void => {
            const index = listenerArr.indexOf(keyListenerRef);
            if (index === -1) {
                return;
            }
            listenerArr.splice(index, 1);
            if (listenerArr.length === 0) {
                document.removeEventListener('keydown', keyDown);
                document.removeEventListener('keyup', keyUp);
                window.removeEventListener('blur', blur);

                // cleanup
                clearTimeout(metaClearTimeout);
                metaClearTimeout = undefined;
                comboArr = [];
                codeIsDownObj = {};
                keyStrArr.forEach((keyStr) => {
                    if (isDownObj[keyStr]) {
                        isDownObj[keyStr] = false;
                    }
                });
            }
        },
        getIsDown: (): TIsDown => isDownObj,
        getCombo: (): string[] => comboArr,
        blur,
    };
})();

export type TKeyListenerParams = {
    onDown?: TOnKeyDown;
    onUp?: TOnKeyUp;
    onBlur?: TOnBlur; // on window blur
};

/**
 * Listens to key events in window. Makes combos easier - e.g. ctrl + z
 *
 * keyStr - see in implementation - my representation of a key. e.g. 'r' can be 'r' and 'R'
 * comboStr - string joins currently pressed keyStr with a +
 *              e.g. 'ctrl+z'
 *
 */
export class KeyListener {
    private readonly ref: TKeyListenerRef;

    // ----------------------------------- public -----------------------------------
    constructor(p: TKeyListenerParams) {
        this.ref = [p.onDown, p.onUp, p.onBlur];
        globalKey.add(this.ref);
    }

    isPressed(keyStr: string): boolean {
        if (!(keyStr in globalKey.getIsDown())) {
            throw 'key "' + keyStr + '" not found';
        }
        return globalKey.getIsDown()[keyStr];
    }

    getComboStr(): string {
        return globalKey.getCombo().join('+');
    }

    comboOnlyContains(keyStrArr: string[]): boolean {
        return globalKey.getCombo().every((keyStr) => keyStrArr.includes(keyStr));
    }

    destroy(): void {
        globalKey.remove(this.ref);
    }
}

/**
 * Test, are the same keys pressed. Order does not matter.
 */
export function sameKeys(comboAStr: string, comboBStr: string): boolean {
    return comboAStr.split('+').sort().join('+') === comboBStr.split('+').sort().join('+');
}
