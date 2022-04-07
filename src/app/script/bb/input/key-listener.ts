import {addEventListener, removeEventListener} from './event-listener';


const globalKey = (() => {

    const keyStrToKeyObj = { // keyStr not to contain a '+', because that's used for the comboStr
        'space': [' ', 'Spacebar'], // Spacebar in IE
        'alt': ['Alt', 'AltGraph'],
        'shift': 'Shift',
        'ctrl': 'Control',
        'cmd': ['Meta', 'MetaLeft', 'MetaRight'],
        'enter': 'Enter',
        'esc': 'Escape',
        'backspace': 'Backspace',
        'delete': 'Delete',
        'sqbr_open': '[',
        'sqbr_close': ']',
        'a': ['a', 'A'],
        'b': ['b', 'B'],
        'c': ['c', 'C'],
        'e': ['e', 'E'],
        'f': ['f', 'F'],
        'g': ['g', 'G'],
        'r': ['r', 'R'], // when holding shift
        's': ['s', 'S'],
        't': ['t', 'T'],
        'u': ['u', 'U'],
        'x': ['x', 'X'],
        'y': ['y', 'Y'],
        'z': ['z', 'Z'],
        'plus': '+',
        'minus': '-',
        'left': 'ArrowLeft',
        'right': 'ArrowRight',
        'up': 'ArrowUp',
        'down': 'ArrowDown',
        'home': 'Home',
        'end': 'End'
    };
    const keyToKeyStrArr = Object.keys(keyStrToKeyObj);
    const isDownObj = {};
    const keyToKeyStrObj = {}; // event.key to keyStr { ArrowLeft: 'left', ... }
    let comboArr = [];
    //a physical key's "key" can change as other keys get pressed. to keep track, need to also track the code
    let codeIsDownObj = {}; // { KeyE: 'e', KeyF: null } - null not down, string, the associated keyStr
    const listenerArr = [];

    for (let i = 0; i < keyToKeyStrArr.length; i++) {
        isDownObj[keyToKeyStrArr[i]] = false;

        const code = keyStrToKeyObj[keyToKeyStrArr[i]];
        if (typeof code === 'string') {
            keyToKeyStrObj[keyStrToKeyObj[keyToKeyStrArr[i]]] = keyToKeyStrArr[i];
        } else {
            for (let e = 0; e < code.length; e++) {
                keyToKeyStrObj[code[e]] = keyToKeyStrArr[i];
            }
        }
    }

    function emitDown(a, b, c, d?) {
        listenerArr.forEach(item => {
            if (!item[0]) {
                return;
            }
            item[0](a, b, c, d);
        });
    }

    function emitUp(a, b, c) {
        listenerArr.forEach(item => {
            if (!item[1]) {
                return;
            }
            item[1](a, b, c);
        });
    }

    function emitBlur() {
        listenerArr.forEach(item => {
            if (!item[2]) {
                return;
            }
            item[2]();
        });
    }

    function keyDown(e) {
        const key = e.key;
        const code = 'code' in e ? e.code : e.keyCode; // ie doesn't have code

        if (key in keyToKeyStrObj) {
            const keyStr = keyToKeyStrObj[key];
            if (isDownObj[keyStr]) {
                emitDown(keyStr, e, comboArr.join('+'), true);
                return;
            }
            isDownObj[keyStr] = true;
            codeIsDownObj[code] = keyStr;

            //add to combo
            comboArr.push(keyStr);

            emitDown(keyStr, e, comboArr.join('+'));
        }
    }


    function keyUp(e) {
        const key = e.key;
        const code = 'code' in e ? e.code : e.keyCode; // ie doesn't have code
        const oldComboStr = comboArr.join('+');

        // because of a macOS bug: when meta key is down, keyup of other keys does not fire.
        // https://stackoverflow.com/questions/25438608/javascript-keyup-isnt-called-when-command-and-another-is-pressed
        if ([
            'Meta', 'MetaLeft', 'MetaRight',
            'OSLeft', 'OSRight', // Firefox
        ].includes(code)) {
            blur(null);
            return;
        }

        if (code in codeIsDownObj && codeIsDownObj[code] !== null) {
            const keyStr = codeIsDownObj[code];
            isDownObj[keyStr] = false;
            codeIsDownObj[code] = null;

            //remove from combo
            for (let i = 0; i < comboArr.length; i++) {
                if (comboArr[i] == keyStr) {
                    comboArr.splice(i, 1);
                    i--;
                }
            }

            emitUp(keyStr, e, oldComboStr);
        }
    }

    function blur(event) {
        const oldComboStr = comboArr.join('+');
        comboArr = [];
        codeIsDownObj = {};

        const eventArr = [];
        for (let i = 0; i < keyToKeyStrArr.length; i++) {
            if (isDownObj[keyToKeyStrArr[i]]) {
                isDownObj[keyToKeyStrArr[i]] = false;
                eventArr.push(keyToKeyStrArr[i]);
            }
        }
        for (let i = 0; i < eventArr.length; i++) {
            emitUp(
                eventArr[i],
                {
                    preventDefault: function () {},
                    stopPropagation: function () {},
                },
                oldComboStr,
            );
        }
        emitBlur();
    }



    return {
        add: (keyListener) => {
            if (listenerArr.includes(keyListener)) {
                return;
            }
            const first = listenerArr.length === 0;
            listenerArr.push(keyListener);

            if (first) {
                addEventListener(document, 'keydown', keyDown);
                addEventListener(document, 'keyup', keyUp);
                addEventListener(window, 'blur', blur);
            }
        },
        remove: (keyListener) => {
            if (!listenerArr.includes(keyListener)) {
                return;
            }
            const last = listenerArr.length === 1;
            for (let i = 0; i < listenerArr.length; i++) {
                if (listenerArr[i] === keyListener) {
                    listenerArr.splice(i, 1);
                    break;
                }
            }
            if (last) {
                removeEventListener(document, 'keydown', keyDown);
                removeEventListener(document, 'keyup', keyUp);
                removeEventListener(window, 'blur', blur);
            }
        },
        getIsDown: () => {
            return isDownObj;
        },
        getCombo: () => {
            return comboArr;
        },
    };
})();



/**
 * Listens to key events in window. Makes combos easier - e.g. ctrl + z
 *
 * keyStr - see in implementation - my representation of a key. e.g. 'r' can be 'r' and 'R'
 * comboStr - string joins currently pressed keyStr with a +
 *              e.g. 'ctrl+z'
 *
 */
export class KeyListener {

    private readonly onDown;
    private readonly onUp;
    private readonly onBlur;
    private readonly ref;

    constructor (
        p: {
            onDown?: (keyStr: string, e: KeyboardEvent, comboStr: string, isRepeat?: boolean) => void;
            onUp?: (keyStr: string, e: KeyboardEvent, oldComboStr: string) => void;
            onBlur?: () => void;
        },
    ) {
        this.onDown = p.onDown;
        this.onUp = p.onUp;
        this.onBlur = p.onBlur;
        this.ref = [this.onDown, this.onUp, this.onBlur];
        globalKey.add(this.ref);
    }

    isPressed (keyStr: string): boolean {
        if (!(keyStr in globalKey.getIsDown())) {
            throw 'key "' + keyStr + '" not found';
        }
        return globalKey.getIsDown()[keyStr];
    }

    getComboStr (): string {
        return globalKey.getCombo().join('+');
    }

    comboOnlyContains (keyStrArr: string[]): boolean {
        for (let i = 0; i < globalKey.getCombo().length; i++) {
            if (!keyStrArr.includes(globalKey.getCombo()[i])) {
                return false;
            }
        }
        return true;
    }

    destroy (): void {
        globalKey.remove(this.ref);
    }
}

export function sameKeys(comboAStr: string, comboBStr: string): boolean {
    return comboAStr.split('+').sort().join('+')=== comboBStr.split('+').sort().join('+');
}