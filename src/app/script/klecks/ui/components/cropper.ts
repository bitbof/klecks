import {BB} from '../../../bb/bb';

/*
	Cropper params
	{
		x: int, //pos in relation zum bild
		y: int,
		w: int,
		h: int,
		scale: float, //zoom
		callback: function //wenn sich was ändert
	}
	the div that you append this to must be relative
*/
export function Cropper (params) {
    let x = params.x,
        y = params.y,
        width = params.width,
        height = params.height,
        scale = params.scale,
        callback = params.callback,
        maxW = params.maxW,
        maxH = params.maxH;
    let div = document.createElement("div");
    let gripCursors = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

    let keyListener = new BB.KeyListener({});

    BB.css(div, {
        position: "absolute",
        left: (x * scale) + "px",
        top: (y * scale) + "px"
    });

    let outline = document.createElement("div");
    BB.css(outline, {
        position: "absolute",
        border: "1px dashed #fff",
        cursor: "move"
    });
    (outline as any).update = function () {
        BB.css(outline, {
            left: (grips[0].x * scale - 1) + "px",
            top: (grips[0].y * scale - 1) + "px",
            width: ((grips[2].x - grips[0].x) * scale) + "px",
            height: ((grips[2].y - grips[0].y) * scale) + "px"
        });
    };
    let pointerRemainder = { // needs to be reset after dragging complete
        x: 0,
        y: 0,
    };
    let outlinePointerListener = new BB.PointerListener({
        target: outline,
        onPointer: function(event) {
            event.eventPreventDefault();
            if (event.type === 'pointermove' && event.button === 'left') {

                const {dX, dY} = BB.intDxy(pointerRemainder, event.dX / scale, event.dY / scale);

                grips[0].x += dX;
                grips[0].y += dY;
                grips[1].x += dX;
                grips[1].y += dY;
                grips[2].x += dX;
                grips[2].y += dY;
                grips[3].x += dX;
                grips[3].y += dY;

                update();
            }
            if (event.type === 'pointerup') {
                commit();
            }
        }
    });

    let thirdsHorizontal = document.createElement("div");
    BB.css(thirdsHorizontal, {
        position: "absolute",
        borderTop: "1px solid #0ff",
        borderBottom: "1px solid #0ff"
    });
    (thirdsHorizontal as any).update = function () {
        BB.css(thirdsHorizontal, {
            left: (grips[0].x * scale) + "px",
            top: ((grips[0].y + (grips[2].y - grips[0].y) / 3) * scale) + "px",
            width: ((grips[2].x - grips[0].x) * scale) + "px",
            height: ((grips[2].y - grips[0].y) / 3 * scale) + "px"

        });
    };
    let thirdsVertical = document.createElement("div");
    BB.css(thirdsVertical, {
        position: "absolute",
        borderLeft: "1px solid #0ff",
        borderRight: "1px solid #0ff"
    });
    (thirdsVertical as any).update = function () {
        BB.css(thirdsVertical, {
            left: ((grips[0].x + (grips[2].x - grips[0].x) / 3) * scale) + "px",
            top: (grips[0].y * scale) + "px",
            width: ((grips[2].x - grips[0].x) / 3 * scale) + "px",
            height: ((grips[2].y - grips[0].y) * scale) + "px"

        });
    };

    const gripSize = 40;
    const gripOverlay = 10;

    let grips: {
        x: number; // int
        y: number;
    }[] = [ // aka corner coordinates
        {x: 0, y: 0}, // top left
        {x: width, y: 0}, // top right
        {x: width, y: height}, // bottom right
        {x: 0, y: height}, //bottom left
    ];

    function transformTop(dY) {
        grips[0].y += dY;
        grips[0].y = Math.max(grips[3].y - maxH, Math.min(grips[3].y - 1, grips[0].y));
        grips[1].y = grips[0].y;
    }
    function transformRight(dX) {
        grips[1].x += dX;
        grips[1].x = Math.min(grips[0].x + maxW, Math.max(grips[0].x + 1, grips[1].x));
        grips[2].x = grips[1].x;
    }
    function transformBottom(dY) {
        grips[2].y += dY;
        grips[2].y = Math.min(grips[1].y + maxH, Math.max(grips[1].y + 1, grips[2].y));
        grips[3].y = grips[2].y;
    }
    function transformLeft(dX) {
        grips[0].x += dX;
        grips[0].x = Math.max(grips[1].x - maxW, Math.min(grips[1].x - 1, grips[0].x));
        grips[3].x = grips[0].x;
    }

    function commit() {
        pointerRemainder.x = 0;
        pointerRemainder.y = 0;
        callback(getTransform());
    }




    let edges = [];
    for (let i = 0; i < 4; i++) {
        (function (i) {
            edges[i] = document.createElement("div");
            let g = edges[i];
            g.style.width = gripSize + "px";
            g.style.height = gripSize + "px";
            //g.style.background = "#0f0";
            g.style.position = "absolute";
            g.update = function () {
                if (i === 0) { //top
                    g.style.left = (grips[0].x * scale + gripOverlay) + "px";
                    g.style.top = (grips[0].y * scale - gripSize * 2 + gripOverlay) + "px";
                    g.style.width = ((grips[1].x - grips[0].x) * scale - gripOverlay * 2) + "px";
                    g.style.height = (gripSize * 2) + "px";
                } else if (i === 1) { //right
                    g.style.left = (grips[1].x * scale - gripOverlay) + "px";
                    g.style.top = (grips[1].y * scale + gripOverlay) + "px";
                    g.style.width = (gripSize * 2) + "px";
                    g.style.height = ((grips[2].y - grips[1].y) * scale - gripOverlay * 2) + "px";
                } else if (i === 2) { //bottom
                    g.style.left = (grips[3].x * scale + gripOverlay) + "px";
                    g.style.top = (grips[3].y * scale - gripOverlay) + "px";
                    g.style.width = ((grips[2].x - grips[3].x) * scale - gripOverlay * 2) + "px";
                    g.style.height = (gripSize * 2) + "px";
                } else if (i === 3) { //left
                    g.style.left = (grips[0].x * scale - gripSize * 2 + gripOverlay) + "px";
                    g.style.top = (grips[0].y * scale + gripOverlay) + "px";
                    g.style.width = (gripSize * 2) + "px";
                    g.style.height = ((grips[3].y - grips[0].y) * scale - gripOverlay * 2) + "px";
                }
                let angleOffset = i * 2 + 1;
                g.style.cursor = gripCursors[angleOffset] + "-resize";

            };
        })(i);
    }

    let darken = [];
    for (let i = 0; i < 4; i++) {
        (function (i) {
            darken[i] = document.createElement("div");
            let g = darken[i];
            g.style.position = "absolute";
            g.style.background = "#000";
            g.style.opacity = "0.5";
            g.update = function () {
                if (i === 0) {
                    g.style.left = (grips[0].x * scale) + "px";
                    g.style.top = (grips[0].y * scale - 8000) + "px";
                    g.style.width = ((grips[1].x - grips[0].x) * scale) + "px";
                    g.style.height = "8000px";
                } else if (i === 1) {
                    g.style.left = (grips[1].x * scale) + "px";
                    g.style.top = (grips[1].y * scale - 8000) + "px";
                    g.style.width = "8000px";
                    g.style.height = 16000 + "px";
                } else if (i === 2) {
                    g.style.left = (grips[3].x * scale) + "px";
                    g.style.top = (grips[3].y * scale) + "px";
                    g.style.width = ((grips[2].x - grips[3].x) * scale) + "px";
                    g.style.height = "8000px";
                } else if (i === 3) {
                    g.style.left = (grips[0].x * scale - 8000) + "px";
                    g.style.top = (grips[0].y * scale - 8000) + "px";
                    g.style.width = "8000px";
                    g.style.height = 16000 + "px";
                }

            };
        })(i);
    }

    let edge0PointerListener = new BB.PointerListener({
        target: edges[0],
        fixScribble: true,
        onPointer: function (event) {
            event.eventPreventDefault();
            if (event.type === 'pointermove' && event.button === 'left') {
                const {dX, dY} = BB.intDxy(pointerRemainder, event.dX / scale, event.dY / scale);
                transformTop(dY);
                if (keyListener.isPressed('shift')) {
                    transformBottom(-dY);
                }
                update();
            }
            if (event.type === 'pointerup') {
                commit();
            }
        }
    });
    let edge1PointerListener = new BB.PointerListener({
        target: edges[1],
        fixScribble: true,
        onPointer: function (event) {
            event.eventPreventDefault();
            if (event.type === 'pointermove' && event.button === 'left') {
                const {dX, dY} = BB.intDxy(pointerRemainder, event.dX / scale, event.dY / scale);
                transformRight(dX);
                if (keyListener.isPressed('shift')) {
                    transformLeft(-dX);
                }
                update();
            }
            if (event.type === 'pointerup') {
                commit();
            }
        }
    });
    let edge2PointerListener = new BB.PointerListener({
        target: edges[2],
        fixScribble: true,
        onPointer: function (event) {
            event.eventPreventDefault();
            if (event.type === 'pointermove' && event.button === 'left') {
                const {dX, dY} = BB.intDxy(pointerRemainder, event.dX / scale, event.dY / scale);
                transformBottom(dY);
                if (keyListener.isPressed('shift')) {
                    transformTop(-dY);
                }
                update();
            }
            if (event.type === 'pointerup') {
                commit();
            }
        }
    });
    let edge3PointerListener = new BB.PointerListener({
        target: edges[3],
        fixScribble: true,
        onPointer: function (event) {
            event.eventPreventDefault();
            if (event.type === 'pointermove' && event.button === 'left') {
                const {dX, dY} = BB.intDxy(pointerRemainder, event.dX / scale, event.dY / scale);
                transformLeft(dX);
                if (keyListener.isPressed('shift')) {
                    transformRight(-dX);
                }
                update();
            }
            if (event.type === 'pointerup') {
                commit();
            }
        }
    });


    let cornerElArr = [];
    (function() {
        for (let i = 0; i < 4; i++) {
            (function (i) {
                cornerElArr[i] = document.createElement("div");
                let g = cornerElArr[i];
                BB.css(g, {
                    //background: '#f00',
                    width: (gripSize * 2) + 'px',
                    height: (gripSize * 2) + 'px',
                    position: 'absolute'
                });
                g.style.cursor = ['nwse-resize', 'nesw-resize'][i % 2];
                g.update = function () {
                    if (i === 0) { //top left
                        BB.css(g, {
                            left: (grips[0].x * scale - gripSize * 2 + gripOverlay) + "px",
                            top: (grips[0].y * scale - gripSize * 2 + gripOverlay) + "px"
                        });
                    } else if (i === 1) { //top right
                        BB.css(g, {
                            left: (grips[1].x * scale - gripOverlay) + "px",
                            top: (grips[1].y * scale - gripSize * 2 + gripOverlay) + "px"
                        });
                    } else if (i === 2) { //bottom right
                        BB.css(g, {
                            left: (grips[1].x * scale - gripOverlay) + "px",
                            top: (grips[2].y * scale - gripOverlay) + "px"
                        });
                    } else if (i === 3) { //bottom left
                        BB.css(g, {
                            left: (grips[0].x * scale - gripSize * 2 + gripOverlay) + "px",
                            top: (grips[2].y * scale - gripOverlay) + "px"
                        });
                    }
                };
            })(i);
        }
    })();
    //top left
    let corner0PointerListener = new BB.PointerListener({
        target: cornerElArr[0],
        fixScribble: true,
        onPointer: function (event) {
            event.eventPreventDefault();
            if (event.type === 'pointermove' && event.button === 'left') {
                const {dX, dY} = BB.intDxy(pointerRemainder, event.dX / scale, event.dY / scale);
                transformLeft(dX);
                transformTop(dY);
                if (keyListener.isPressed('shift')) {
                    transformRight(-dX);
                    transformBottom(-dY);
                }
                update();
            }
            if (event.type === 'pointerup') {
                commit();
            }
        }
    });
    //top right
    let corner1PointerListener = new BB.PointerListener({
        target: cornerElArr[1],
        fixScribble: true,
        onPointer: function (event) {
            event.eventPreventDefault();
            if (event.type === 'pointermove' && event.button === 'left') {
                const {dX, dY} = BB.intDxy(pointerRemainder, event.dX / scale, event.dY / scale);
                transformRight(dX);
                transformTop(dY);
                if (keyListener.isPressed('shift')) {
                    transformLeft(-dX);
                    transformBottom(-dY);
                }
                update();
            }
            if (event.type === 'pointerup') {
                commit();
            }
        }
    });
    //bottom right
    let corner2PointerListener = new BB.PointerListener({
        target: cornerElArr[2],
        fixScribble: true,
        onPointer: function (event) {
            event.eventPreventDefault();
            if (event.type === 'pointermove' && event.button === 'left') {
                const {dX, dY} = BB.intDxy(pointerRemainder, event.dX / scale, event.dY / scale);
                transformRight(dX);
                transformBottom(dY);
                if (keyListener.isPressed('shift')) {
                    transformLeft(-dX);
                    transformTop(-dY);
                }
                update();
            }
            if (event.type === 'pointerup') {
                commit();
            }
        }
    });
    //bottom left
    let corner3PointerListener = new BB.PointerListener({
        target: cornerElArr[3],
        fixScribble: true,
        onPointer: function (event) {
            event.eventPreventDefault();
            if (event.type === 'pointermove' && event.button === 'left') {
                const {dX, dY} = BB.intDxy(pointerRemainder, event.dX / scale, event.dY / scale);
                transformLeft(dX);
                transformBottom(dY);
                if (keyListener.isPressed('shift')) {
                    transformRight(-dX);
                    transformTop(-dY);
                }
                update();
            }
            if (event.type === 'pointerup') {
                commit();
            }
        }
    });




    function getTransform() {
        grips[1].x -= grips[0].x;
        grips[1].y -= grips[0].y;
        grips[2].x -= grips[0].x;
        grips[2].y -= grips[0].y;
        grips[3].x -= grips[0].x;
        grips[3].y -= grips[0].y;
        x += grips[0].x;
        y += grips[0].y;
        grips[0].x = 0;
        grips[0].y = 0;
        return {
            x: x,
            y: y,
            width: grips[1].x,
            height: grips[2].y
        };
    }


    div.append(
        darken[1],
        darken[0],
        darken[2],
        darken[3],
        thirdsHorizontal,
        thirdsVertical,
        outline,

        edges[1],
        edges[0],
        edges[2],
        edges[3],

        cornerElArr[0],
        cornerElArr[1],
        cornerElArr[2],
        cornerElArr[3],
    );


    function update() {

        edges[0].update();
        edges[1].update();
        edges[2].update();
        edges[3].update();
        cornerElArr[0].update();
        cornerElArr[1].update();
        cornerElArr[2].update();
        cornerElArr[3].update();
        darken[0].update();
        darken[1].update();
        darken[2].update();
        darken[3].update();
        (outline as any).update();
        (thirdsHorizontal as any).update();
        (thirdsVertical as any).update();
    }

    update();


    // --- interface ---

    this.getTransform = getTransform;

    this.setTransform = function (p) {
        x = p.x;
        y = p.y;
        width = p.width;
        height = p.height;

        BB.css(div, {
            left: (x * scale) + "px",
            top: (y * scale) + "px"
        });

        grips[0].x = 0;
        grips[0].y = 0;
        grips[1].x = width;
        grips[1].y = 0;
        grips[2].x = width;
        grips[2].y = height;
        grips[3].x = 0;
        grips[3].y = height;

        update();
        commit();
    };

    this.setScale = function (s) {
        scale = s;
        BB.css(div, {
            left: (x * scale) + "px",
            top: (y * scale) + "px"
        });
        update();
    };

    this.showThirds = function (b) {
        if (b) {
            thirdsHorizontal.style.display = "block";
            thirdsVertical.style.display = "block";
        } else {
            thirdsHorizontal.style.display = "none";
            thirdsVertical.style.display = "none";
        }
    };

    this.getElement = function() {
        return div;
    };

    this.destroy = function() {
        keyListener.destroy();
        outlinePointerListener.destroy();
        corner0PointerListener.destroy();
        corner1PointerListener.destroy();
        corner2PointerListener.destroy();
        corner3PointerListener.destroy();
        edge0PointerListener.destroy();
        edge1PointerListener.destroy();
        edge2PointerListener.destroy();
        edge3PointerListener.destroy();
    };

}