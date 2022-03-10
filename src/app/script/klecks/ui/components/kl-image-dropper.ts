import {BB} from '../../../bb/bb';

/**
 * Not really generalized. UI when you drag/drop an image into window.
 * The moment you create it, it will listen.
 *
 * @param p object {onDrop: func(files, optionStr), target: DOM Element, enabledTest: func -> bool} - optionStr: 'default'|'layer'|'image'
 * @constructor
 */
export function KlImageDropper(p) {

    //set up DOM
    let rootEl = BB.el({
        content: 'Drop to import',
        css: {
            paddingTop: '100px',
            position: 'fixed',
            left: '0',
            top: '0',
            width: '100%',
            height: '100%',
            background: 'rgba(50, 50, 50, 0.7)',
            color: '#fff',
            textShadow: '2px 2px #000',
            textAlign: 'center',
            fontSize: '25px'
        }
    });
    let wrapperEl = BB.el({
        css: {
            'marginTop': '50px',
            'display': 'flex',
            'justifyContent': 'center'
        }
    });
    let optionStyle = {
        width: '200px',
        padding: '50px',
        margin: '10px',
        //opacity: 0.5,
        borderRadius: '20px',
        border: '1px dashed #fff',
        background: '#00aefe',
        fontWeight: 'bold'
    };
    let optionLayerEl = BB.el({
        content: 'As Layer',
        css: optionStyle
    });
    let optionImageEl = BB.el({
        content: 'As New Image',
        css: optionStyle
    });

    rootEl.appendChild(wrapperEl);
    wrapperEl.appendChild(optionLayerEl);
    wrapperEl.appendChild(optionImageEl);


    let rootCounter = 0;
    let optionLayerCounter = 0;
    let optionImageCounter = 0;

    function destroy() {
        rootCounter = 0;
        optionLayerCounter = 0;
        optionImageCounter = 0;
        try {
            p.target.removeChild(rootEl);
        } catch (e) { }
    }

    function testAcceptType(event) {
        try {
            return !event.dataTransfer.types.includes('text/plain');
        } catch(e) {

        }
        return false;
    }

    function updateOptions() {
        let boxShadow = '0 0 20px 4px #fff';
        if (optionLayerCounter > 0) {
            optionLayerEl.style.boxShadow = boxShadow;
            optionImageEl.style.boxShadow = '';
        } else if (optionImageCounter > 0) {
            optionLayerEl.style.boxShadow = '';
            optionImageEl.style.boxShadow = boxShadow;
        } else {
            optionLayerEl.style.boxShadow = '';
            optionImageEl.style.boxShadow = '';
        }
    }

    BB.addEventListener(optionLayerEl,'dragenter', function() {
        optionLayerCounter++;
        updateOptions();
    });
    BB.addEventListener(optionLayerEl,'dragleave', function() {
        optionLayerCounter--;
        updateOptions();
    });
    BB.addEventListener(optionImageEl,'dragenter', function() {
        optionImageCounter++;
        updateOptions();
    });
    BB.addEventListener(optionImageEl,'dragleave', function() {
        optionImageCounter--;
        updateOptions();
    });


    function rootDragOver(event) {
        if (!testAcceptType(event)) {
            return;
        }
        event.stopPropagation();
        event.preventDefault();
    }
    function rootDragEnter(event) {
        if (!p.enabledTest() || !testAcceptType(event)) {
            return;
        }
        if (rootCounter === 0) {
            p.target.appendChild(rootEl);
        }
        rootCounter++;

    }
    function rootDragLeave(event) {
        if (!testAcceptType(event) || rootCounter === 0) {
            return;
        }
        rootCounter = Math.max(0, rootCounter - 1);
        if (rootCounter === 0) {
            p.target.removeChild(rootEl);
        }

    }
    function rootDrop(event) {
        if (!testAcceptType(event) || event.dataTransfer.files.length === 0) {
            destroy();
            return;
        }
        event.stopPropagation();
        event.preventDefault();

        let optionStr = 'default';
        if (optionLayerCounter > 0) {
            optionStr = 'layer';
        } else if (optionImageCounter > 0) {
            optionStr = 'image';
        }

        p.onDrop(event.dataTransfer.files, optionStr);


        if (rootCounter > 0) {
            p.target.removeChild(rootEl);
        }
        rootCounter = 0;
        optionLayerCounter = 0;
        optionImageCounter = 0;
        updateOptions();
    }

    BB.addEventListener(window,'dragover', rootDragOver, false);
    BB.addEventListener(window,'dragenter', rootDragEnter, false);
    BB.addEventListener(window,'dragleave', rootDragLeave, false);
    BB.addEventListener(window,'drop', rootDrop, false);

    // if something goes wrong and you're stuck with overlay
    BB.addEventListener(rootEl, 'pointerdown', function() {
        destroy();
    });
    let keyListener = new BB.KeyListener({
        onDown: function(keyStr) {
            if (rootCounter > 0 && keyStr === 'esc') {
                destroy();
            }
        }
    });

}