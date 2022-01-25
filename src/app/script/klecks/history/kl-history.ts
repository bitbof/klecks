

export const klHistory = (function () {
    let clearCount = 0;
    let state = 0; //a number incrementing up with every clear, add, undo, redo
    const hInterface: any = {};
    let dataArr = [];
    const listeners = [];
    let pauseStack = 0;
    const max = 14; //max amount of undo steps
    let maxState = -1; //can't go backwards -> max state is the buffer image(klCanvas)

    let currentIndex = -1; // current action the user is on. untouched document = -1 because dataArr.length is 0

    hInterface.clear = function () {
        dataArr = [];
        pauseStack = 0;
        currentIndex = -1;
        maxState = -1;
        clearCount++;
        broadcast();
    };
    //you need pause because there are sometimes actions that would cause other
    // undo steps
    // for example a filter that does something crazy with two layers and then merges them
    // you want that to be one undo step, and prevent merging from causing its undo step.
    // so while that filter is doing its magic you should pause possible undo steps that
    // that are caused by a part of its code(in this example: merging layers)
    hInterface.pause = function (b) {
        if (b === false) {
            pauseStack = Math.max(0, pauseStack - 1);
        } else {
            pauseStack++;
        }
    };

    hInterface.addListener = function (l) {
        listeners.push(l);
    };

    function broadcast(p?) {
        setTimeout(function () {
            for (let i = 0; i < listeners.length; i++) {
                listeners[i](p);
            }
            state++;
        }, 1);
    }

    hInterface.add = function (e) {
        if (pauseStack > 0) {
            return;
        }
        while (currentIndex < dataArr.length - 1) {
            dataArr.pop();
        }

        //taking care of actions that shouldn't cause a new undo step
        const top = dataArr[dataArr.length - 1];
        if (e.action === 'layerOpacity' && top && top.action === 'layerOpacity' && top.params[0] === e.params[0]) {
            dataArr[dataArr.length - 1] = e;
            state++; //still needs to increment because something changed
            return;
        }
        if (e.action === 'focusLayer' && top && top.action === 'focusLayer') {
            dataArr[dataArr.length - 1] = e;
            state++;
            return;
        }


        dataArr[dataArr.length] = e;
        currentIndex = dataArr.length - 1;
        const maxBefore = maxState;
        maxState = Math.max(maxState, currentIndex - max);
        if (maxBefore < maxState) {
            broadcast({bufferUpdate: dataArr[maxState]});
        } else {
            broadcast();
        }
        dataArr[maxState] = {}; //to free some memory...imported images take a lot of space
    };
    hInterface.undo = function () {
        let result;
        if (hInterface.canUndo()) {
            result = [];
            for (let i = maxState + 1; i < currentIndex; i++) {
                result.push(dataArr[i]);
            }
            currentIndex--;
            broadcast();
        }

        return result;
    };
    hInterface.redo = function () {
        const result = [];
        if (hInterface.canRedo()) {
            currentIndex++;
            result.push(dataArr[currentIndex]);
            broadcast();
        }
        return result;
    };
    hInterface.getAll = function () {
        const result = [];
        for (let i = 0; i < dataArr.length; i++) {
            result[i] = dataArr[i];
        }
        return result;
    };
    hInterface.canRedo = function () {
        return currentIndex < dataArr.length - 1;
    };
    hInterface.canUndo = function () {
        return currentIndex > maxState;
    };
    hInterface.getState = function () {
        return parseInt('' + state, 10);
    };

    /**
     * clearCount - how often clear was called
     * actionNumber - number of undo-able actions a user has done (e.g. if drawn 5 lines total -> 5)
     * @returns [clearCount int, actionNumber int]
     */
    hInterface.getActionNumber = function() {
        return [clearCount, currentIndex + 1];
    };
    return hInterface;
})();
