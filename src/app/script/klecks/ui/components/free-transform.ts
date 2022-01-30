import {BB} from '../../../bb/bb';
// @ts-ignore
import rotateImg from 'url:~/src/app/img/ui/cursor-rotate.png';

/*
	FREETRANSFORM
	params = {
		elem: div,
		x: 100,
		y: 100,
		width: 100,
		height: 100,
		angle: 45, //deg
		constrained: false //constrained porportions
		range: {x:0,y:0,width:200,height:200} ...within what allow pos
		allowRotate: false
		//center
	}

aufbau:
div {
	transdiv [
		elem{}
		outline{}
		edges[]{}
		grips[]{}
		rot{}
		snapX [] //snapping on x axis
		snapY []
		constrained bool
		appendElem bool //put elem into the freetransform div
		callback function(){} //gets called when something was transformed
	}
}

*/
export function FreeTransform(params) {
    let elem = params.elem;
    let x = params.x;
    let y = params.y;
    let width = params.width;
    let height = params.height;
    let angle = params.angle;
    let constrained = params.constrained;
    let appendElem = params.appendElem;
    let snapX = params.snapX;
    let snapY = params.snapY;
    let callback = params.callback;
    let scale = params.scale;
    let snappingEnabled = true;
    let gripCursors = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    let gripCursorsInverted = ['ne', 'n', 'nw', 'w', 'sw', 's', 'se', 'e'];
    let ratio = width / height;
    let mindist = 7; //minimal snapping distance

    let maindiv = document.createElement("div");
    let transdiv = document.createElement("div");
    maindiv.appendChild(transdiv);
    let div = transdiv;
    div.style.position = "absolute";

    if (elem && appendElem) {
        BB.css(elem, {
            width: "1px",
            height: "1px",
            transformOrigin: "0 0",
            position: "absolute"
        });
    }
    BB.css(maindiv, {
        userSelect: 'none'
    });

    let outline = document.createElement("div");
    BB.css(outline, {
        position: "absolute",
        cursor: "move",
        boxShadow: 'rgba(255, 255, 255, 0.5) 0 0 0 1px inset, rgba(0, 0, 0, 0.5) 0 0 0 1px'
    });

    let keyListener = new BB.KeyListener({});

    let outlinePointerListener = new BB.PointerListener({
        target: outline,
        fixScribble: true,
        onPointer: function(event) {
            event.eventPreventDefault();
            if (event.type === 'pointerdown') {
                (outline as any).startPos = {x: x, y: y};
            }
            if (event.type === 'pointermove' && event.button === 'left') {
                x = (outline as any).startPos.x + event.pageX - event.downPageX;
                y = (outline as any).startPos.y + event.pageY - event.downPageY;
                let dist;
                let snap: any = {};
                if (snappingEnabled) {
                    let i;
                    for (i = 0; i < snapX.length; i++) {
                        dist = Math.abs(x - snapX[i]);
                        if (dist < mindist) {
                            if (!snap.x || dist < snap.distX) {
                                snap.x = snapX[i];
                                snap.distX = dist;
                            }
                        }
                    }
                    for (i = 0; i < snapY.length; i++) {
                        dist = Math.abs(y - snapY[i]);
                        if (dist < mindist) {
                            if (!snap.y || dist < snap.distY) {
                                snap.y = snapY[i];
                                snap.distY = dist;
                            }
                        }
                    }

                    let outer;
                    for (i = 0; i < 4; i++) {
                        outer = getOuter(grips[i].x, grips[i].y);
                        let j;
                        for (j = 0; j < snapX.length; j++) {
                            dist = Math.abs(outer.x - snapX[j]);
                            if (dist < mindist) {
                                if (!snap.x || dist < snap.distX) {
                                    snap.x = snapX[j] - (outer.x - x);
                                    snap.distX = dist;
                                }
                            }
                        }
                        for (j = 0; j < snapY.length; j++) {
                            dist = Math.abs(outer.y - snapY[j]);
                            if (dist < mindist) {
                                if (!snap.y || dist < snap.distY) {
                                    snap.y = snapY[j] - (outer.y - y);
                                    snap.distY = dist;
                                }
                            }
                        }
                    }
                }
                if (keyListener.getComboStr() === 'shift') {
                    let projected = BB.projectPointOnLine(
                        {x: 0, y: (outline as any).startPos.y},
                        {x: 10, y: (outline as any).startPos.y},
                        {x: x, y: y});
                    let dist = BB.dist(projected.x, projected.y, x, y);
                    snap = {};
                    snap.x = projected.x;
                    snap.y = projected.y;
                    snap.distX = dist;
                    snap.distY = dist;

                    projected = BB.projectPointOnLine(
                        {x: (outline as any).startPos.x, y: 0},
                        {x: (outline as any).startPos.x, y: 10},
                        {x: x, y: y});
                    dist = BB.dist(projected.x, projected.y, x, y);
                    if (dist < snap.distX) {
                        snap.x = projected.x;
                        snap.y = projected.y;
                        snap.distX = dist;
                        snap.distY = dist;
                    }

                    projected = BB.projectPointOnLine(
                        {x: (outline as any).startPos.x, y: (outline as any).startPos.y},
                        {x: (outline as any).startPos.x + 1, y: (outline as any).startPos.y + 1},
                        {x: x, y: y});
                    dist = BB.dist(projected.x, projected.y, x, y);
                    if (dist < snap.distX) {
                        snap.x = projected.x;
                        snap.y = projected.y;
                        snap.distX = dist;
                        snap.distY = dist;
                    }

                    projected = BB.projectPointOnLine(
                        {x: (outline as any).startPos.x, y: (outline as any).startPos.y},
                        {x: (outline as any).startPos.x + 1, y: (outline as any).startPos.y - 1},
                        {x: x, y: y});
                    dist = BB.dist(projected.x, projected.y, x, y);
                    if (dist < snap.distX) {
                        snap.x = projected.x;
                        snap.y = projected.y;
                        snap.distX = dist;
                        snap.distY = dist;
                    }
                }
                if (snap.x != undefined) {
                    x = snap.x;
                }
                if (snap.y != undefined) {
                    y = snap.y;
                }
                update();
            }
        }
    })

    function checkSnapping(px, py) {
        if (!snappingEnabled) {
            return {x: px, y: py};
        }
        let dist, outer = getOuter(px, py), snap: any = {};
        for (let e = 0; e < snapX.length; e++) {
            dist = Math.abs(outer.x - snapX[e]);
            if (dist < mindist) {
                if (!snap.x || dist < snap.distX) {
                    snap.x = snapX[e];
                    snap.distX = dist;
                }
            }
        }
        for (let e = 0; e < snapY.length; e++) {
            dist = Math.abs(outer.y - snapY[e]);
            if (dist < mindist) {
                if (!snap.y || dist < snap.distY) {
                    snap.y = snapY[e];
                    snap.distY = dist;
                }
            }
        }
        if (snap.x != undefined) {
            outer.x = snap.x;
        }
        if (snap.y != undefined) {
            outer.y = snap.y;
        }
        return getInner(outer.x, outer.y);
    }

    function constrainedGripPos(i, nx, ny) {
        if (!constrained) {
            return {
                x: nx,
                y: ny
            };
        }
        let pa = grips[3], pb = grips[1];
        if (i === 0 || i === 2) {
            pa = grips[2];
            pb = grips[0];
        }
        let projected = BB.projectPointOnLine(pa, pb, {x: nx, y: ny});

        return {
            x: projected.x,
            y: projected.y
        };
    }

    let gripSize = 14;
    let grips = [];
    for (let i = 0; i < 4; i++) {
        (function (i) {
            grips[i] = document.createElement("div");
            let g = grips[i];
            BB.css(g, {
                width: gripSize + "px",
                height: gripSize + "px",
                background: "#fff",
                borderRadius: gripSize + "px",
                position: "absolute",
                boxShadow: "inset 0 0 0 2px #000"
            });

            g.update = function () {
                let angleOffset = Math.round(angle / 45);
                while (angleOffset < 0)
                    angleOffset += 8;
                angleOffset = (i * 2 + angleOffset) % gripCursors.length;
                BB.css(g, {
                    left: (g.x - gripSize / 2) + "px",
                    top: (g.y - gripSize / 2) + "px"
                });
                if ((width < 0 && height >= 0) || (width >= 0 && height < 0)) {
                    BB.css(g, {
                        cursor: gripCursorsInverted[angleOffset] + "-resize"
                    });
                } else {
                    BB.css(g, {
                        cursor: gripCursors[angleOffset] + "-resize"
                    });
                }
            };
        })(i);
    }
    grips[0].x = (-width / 2); // top left
    grips[0].y = (-height / 2);

    grips[1].x = (width / 2); // top right
    grips[1].y = (-height / 2);

    grips[2].x = (width / 2); // bottom right
    grips[2].y = (height / 2);

    grips[3].x = (-width / 2); // bottom left
    grips[3].y = (height / 2);

    let grip0PointerListener = new BB.PointerListener({
        target: grips[0],
        fixScribble: true,
        onPointer: function(event) {
            event.eventPreventDefault();
            if (event.type === 'pointerdown' && event.button === 'left') {
                grips[0].virtualPos = {
                    x: grips[0].x,
                    y: grips[0].y
                };
            } else if (event.type === 'pointermove' && event.button === 'left') {
                let inner = BB.rotateAround({x: 0, y: 0},
                    {x: event.dX, y: event.dY},
                    -angle);

                grips[0].virtualPos.x += inner.x;
                grips[0].virtualPos.y += inner.y;
                let newPos = constrainedGripPos(0, grips[0].x + inner.x, grips[0].y + inner.y);
                if (!constrained) {
                    newPos = checkSnapping(grips[0].virtualPos.x, grips[0].virtualPos.y);
                }
                let dX = newPos.x - grips[0].x;
                let dY = newPos.y - grips[0].y;
                grips[0].x = newPos.x;
                grips[0].y = newPos.y;
                grips[3].x = grips[0].x;
                grips[1].y = grips[0].y;

                if(keyListener.isPressed('shift')) {
                    grips[2].x -= dX;
                    grips[2].y -= dY;
                    grips[1].x = grips[2].x;
                    grips[3].y = grips[2].y;
                }

                grips[0].virtualPos.x -= grips[0].x * 0.5 + grips[1].x * 0.5;
                grips[0].virtualPos.y -= grips[0].y * 0.5 + grips[3].y * 0.5;
                commitTransform();

            }
        }
    });
    let grip1PointerListener = new BB.PointerListener({
        target: grips[1],
        fixScribble: true,
        onPointer: function(event) {
            event.eventPreventDefault();
            if (event.type === 'pointerdown' && event.button === 'left') {
                grips[1].virtualPos = {
                    x: grips[1].x,
                    y: grips[1].y
                };
            } else if (event.type === 'pointermove' && event.button === 'left') {
                let inner = BB.rotateAround({x: 0, y: 0},
                    {x: event.dX, y: event.dY},
                    -angle);

                grips[1].virtualPos.x += inner.x;
                grips[1].virtualPos.y += inner.y;
                let newPos = constrainedGripPos(1, grips[1].x + inner.x, grips[1].y + inner.y);
                if (!constrained) {
                    newPos = checkSnapping(grips[1].virtualPos.x, grips[1].virtualPos.y);
                }
                let dX = newPos.x - grips[1].x;
                let dY = newPos.y - grips[1].y;
                grips[1].x = newPos.x;
                grips[1].y = newPos.y;
                grips[2].x = grips[1].x;
                grips[0].y = grips[1].y;

                if(keyListener.isPressed('shift')) {
                    grips[3].x -= dX;
                    grips[3].y -= dY;
                    grips[0].x = grips[3].x;
                    grips[2].y = grips[3].y;
                }

                grips[1].virtualPos.x -= grips[0].x * 0.5 + grips[1].x * 0.5;
                grips[1].virtualPos.y -= grips[0].y * 0.5 + grips[3].y * 0.5;
                commitTransform();
            }
        }
    });
    let grip2PointerListener = new BB.PointerListener({
        target: grips[2],
        fixScribble: true,
        onPointer: function(event) {
            event.eventPreventDefault();
            if (event.type === 'pointerdown' && event.button === 'left') {
                grips[2].virtualPos = {
                    x: grips[2].x,
                    y: grips[2].y
                };
            } else if (event.type === 'pointermove' && event.button === 'left') {
                let inner = BB.rotateAround({x: 0, y: 0},
                    {x: event.dX, y: event.dY},
                    -angle);

                grips[2].virtualPos.x += inner.x;
                grips[2].virtualPos.y += inner.y;
                let newPos = constrainedGripPos(2, grips[2].x + inner.x, grips[2].y + inner.y);
                if (!constrained) {
                    newPos = checkSnapping(grips[2].virtualPos.x, grips[2].virtualPos.y);
                }
                let dX = newPos.x - grips[2].x;
                let dY = newPos.y - grips[2].y;
                grips[2].x = newPos.x;
                grips[2].y = newPos.y;
                grips[1].x = grips[2].x;
                grips[3].y = grips[2].y;

                if(keyListener.isPressed('shift')) {
                    grips[0].x -= dX;
                    grips[0].y -= dY;
                    grips[3].x = grips[0].x;
                    grips[1].y = grips[0].y;
                }

                grips[2].virtualPos.x -= grips[0].x * 0.5 + grips[1].x * 0.5;
                grips[2].virtualPos.y -= grips[0].y * 0.5 + grips[3].y * 0.5;
                commitTransform();
            }
        }
    });
    let grip3PointerListener = new BB.PointerListener({
        target: grips[3],
        fixScribble: true,
        onPointer: function (event) {
            event.eventPreventDefault();
            if (event.type === 'pointerdown' && event.button === 'left') {
                grips[3].virtualPos = {
                    x: grips[3].x,
                    y: grips[3].y
                };
            } else if (event.type === 'pointermove' && event.button === 'left') {
                let inner = BB.rotateAround({x: 0, y: 0},
                    {x: event.dX, y: event.dY},
                    -angle);

                grips[3].virtualPos.x += inner.x;
                grips[3].virtualPos.y += inner.y;
                let newPos = constrainedGripPos(3, grips[3].x + inner.x, grips[3].y + inner.y);
                if (!constrained) {
                    newPos = checkSnapping(grips[3].virtualPos.x, grips[3].virtualPos.y);
                }
                let dX = newPos.x - grips[3].x;
                let dY = newPos.y - grips[3].y;
                grips[3].x = newPos.x;
                grips[3].y = newPos.y;
                grips[0].x = grips[3].x;
                grips[2].y = grips[3].y;

                if(keyListener.isPressed('shift')) {
                    grips[1].x -= dX;
                    grips[1].y -= dY;
                    grips[2].x = grips[1].x;
                    grips[0].y = grips[1].y;
                }

                grips[3].virtualPos.x -= grips[0].x * 0.5 + grips[1].x * 0.5;
                grips[3].virtualPos.y -= grips[0].y * 0.5 + grips[3].y * 0.5;
                commitTransform();
            }
        }
    });

    let edgeSize = 10;
    let edges = [];
    for (let i = 0; i < 4; i++) {
        (function (i) {
            edges[i] = document.createElement("div");
            let g = edges[i];
            g.style.width = edgeSize + 'px';
            g.style.height = edgeSize + 'px';
            //g.style.background = "rgba(0,255,0,0.5)";
            g.style.position = "absolute";
            g.update = function () {
                if (i === 0) {
                    g.style.left = Math.min(grips[0].x, grips[1].x) + "px";
                    g.style.top = (Math.min(grips[0].y, grips[3].y) - edgeSize) + "px";
                    g.style.width = Math.abs(width) + "px";
                    g.style.height = edgeSize + 'px';
                    //g.style.background = "#f00";
                } else if (i === 1) {
                    g.style.left = Math.max(grips[0].x, grips[1].x) + "px";
                    g.style.top = Math.min(grips[1].y, grips[2].y) + "px";
                    g.style.width = edgeSize + 'px';
                    g.style.height = Math.abs(height) + "px";
                    //g.style.background = "#0f0";
                } else if (i === 2) {
                    g.style.left = Math.min(grips[3].x, grips[2].x) + "px";
                    g.style.top = Math.max(grips[0].y, grips[3].y) + "px";
                    g.style.width = Math.abs(width) + "px";
                    g.style.height = edgeSize + 'px';
                    //g.style.background = "#00f";
                } else if (i === 3) {
                    g.style.left = (Math.min(grips[0].x, grips[1].x) - edgeSize) + "px";
                    g.style.top = Math.min(grips[0].y, grips[3].y) + "px";
                    g.style.width = edgeSize + 'px';
                    g.style.height = Math.abs(height) + "px";
                    //g.style.background = "#a0a";
                }
                let angleOffset = Math.round(angle / 45);
                while (angleOffset < 0)
                    angleOffset += 8;
                angleOffset = (i * 2 + 1 + angleOffset) % gripCursors.length;
                g.style.cursor = gripCursors[angleOffset] + "-resize";

            };
        })(i);
    }

    function balanceRatio(boolW, boolH) {
        if (!constrained)
            return;
        if (boolH && !boolW) {
            let newHeight = Math.abs(grips[3].y - grips[0].y);
            let newWidth = ratio * newHeight;
            if (grips[1].x - grips[0].x < 0)
                newWidth *= -1;
            grips[0].x = -newWidth / 2;
            grips[3].x = -newWidth / 2;
            grips[1].x = newWidth / 2;
            grips[2].x = newWidth / 2;
        }
        if (!boolH && boolW) {
            let newWidth = Math.abs(grips[0].x - grips[1].x);
            let newHeight = newWidth / ratio;
            if (grips[3].y - grips[0].y < 0)
                newHeight *= -1;
            grips[0].y = -newHeight / 2;
            grips[1].y = -newHeight / 2;
            grips[2].y = newHeight / 2;
            grips[3].y = newHeight / 2;
        }
    }

    let edge0PointerListener = new BB.PointerListener({
        target: edges[0],
        fixScribble: true,
        onPointer: function(event) {
            event.eventPreventDefault();
            let inverted = false;
            if (event.type === 'pointerdown' && event.button === 'left') {
                if (grips[0].y < grips[3].y) {
                    inverted = false;
                } else {
                    inverted = true;
                }
            }
            if (event.type === 'pointermove' && event.button === 'left') {
                let inner = BB.rotateAround({x: 0, y: 0},
                    {x: event.dX, y: event.dY},
                    -angle);
                if (inverted === false) {
                    grips[0].y += inner.y;
                    grips[1].y += inner.y;
                } else {
                    grips[3].y += inner.y;
                    grips[2].y += inner.y;
                }
                if (keyListener.isPressed('shift')) {
                    if (inverted === false) {
                        grips[3].y -= inner.y;
                        grips[2].y -= inner.y;
                    } else {
                        grips[0].y -= inner.y;
                        grips[1].y -= inner.y;
                    }
                }
                balanceRatio(false, true);
                commitTransform();
            }
        }
    });
    let edge1PointerListener = new BB.PointerListener({
        target: edges[1],
        fixScribble: true,
        onPointer: function (event) {
            event.eventPreventDefault();
            let inverted = false;
            if (event.type === 'pointerdown' && event.button === 'left') {
                if (grips[0].x < grips[1].x) {
                    inverted = false;
                } else {
                    inverted = true;
                }
            }
            if (event.type === 'pointermove' && event.button === 'left') {
                let inner = BB.rotateAround({x: 0, y: 0},
                    {x: event.dX, y: event.dY},
                    -angle);
                if (inverted === false) {
                    grips[1].x += inner.x;
                    grips[2].x += inner.x;
                } else {
                    grips[0].x += inner.x;
                    grips[3].x += inner.x;
                }
                if (keyListener.isPressed('shift')) {
                    if (inverted === false) {
                        grips[0].x -= inner.x;
                        grips[3].x -= inner.x;
                    } else {
                        grips[1].x -= inner.x;
                        grips[2].x -= inner.x;
                    }
                }
                balanceRatio(true, false);
                commitTransform();
            }
        }
    });
    let edge2PointerListener = new BB.PointerListener({
        target: edges[2],
        fixScribble: true,
        onPointer: function (event) {
            event.eventPreventDefault();
            let inverted = false;
            if (event.type === 'pointerdown' && event.button === 'left') {
                if (grips[0].y < grips[3].y) {
                    inverted = false;
                } else {
                    inverted = true;
                }
            }
            if (event.type === 'pointermove' && event.button === 'left') {
                let inner = BB.rotateAround({x: 0, y: 0},
                    {x: event.dX, y: event.dY},
                    -angle);
                if (inverted === false) {
                    grips[2].y += inner.y;
                    grips[3].y += inner.y;
                } else {
                    grips[0].y += inner.y;
                    grips[1].y += inner.y;
                }
                if (keyListener.isPressed('shift')) {
                    if (inverted === false) {
                        grips[0].y -= inner.y;
                        grips[1].y -= inner.y;
                    } else {
                        grips[2].y -= inner.y;
                        grips[3].y -= inner.y;
                    }
                }
                balanceRatio(false, true);
                commitTransform();
            }
        }
    });
    let edge3PointerListener = new BB.PointerListener({
        target: edges[3],
        fixScribble: true,
        onPointer: function (event) {
            event.eventPreventDefault();
            let inverted = false;
            if (event.type === 'pointerdown' && event.button === 'left') {
                if (grips[0].x < grips[1].x) {
                    inverted = false;
                } else {
                    inverted = true;
                }
            }
            if (event.type === 'pointermove' && event.button === 'left') {
                let inner = BB.rotateAround({x: 0, y: 0},
                    {x: event.dX, y: event.dY},
                    -angle);
                if (inverted === false) {
                    grips[0].x += inner.x;
                    grips[3].x += inner.x;
                } else {
                    grips[1].x += inner.x;
                    grips[2].x += inner.x;
                }
                if (keyListener.isPressed('shift')) {
                    if (inverted === false) {
                        grips[1].x -= inner.x;
                        grips[2].x -= inner.x;
                    } else {
                        grips[0].x -= inner.x;
                        grips[3].x -= inner.x;
                    }
                }
                balanceRatio(true, false);
                commitTransform();
            }
        }
    });

    let rot = document.createElement("div");
    let rotPointerListener;
    (function () {
        let g = rot;
        (g as any).snap = false;
        BB.css(g, {
            cursor: "url(" + rotateImg + ") 10 10, move",
            width: gripSize + "px",
            height: gripSize + "px",
            background: "#0ff",
            borderRadius: gripSize + "px",
            position: "absolute",
            boxShadow: "inset 0 0 0 2px #000"
        });

        let line = document.createElement("div");
        BB.css(line, {
            width: "2px",
            height: "13px",
            left: (gripSize / 2 - 1) + "px",
            top: gripSize + "px",
            background: "#0ff",
            position: "absolute"
        });
        g.appendChild(line);

        (g as any).update = function () {
            BB.css(g, {
                left: ((g as any).x - gripSize / 2) + "px",
                top: ((g as any).y - gripSize / 2) + "px"
            });
        };
        rotPointerListener = new BB.PointerListener({
            target: g,
            fixScribble: true,
            onPointer: function (event) {
                event.eventPreventDefault();
                if (event.type === 'pointermove' && event.button === 'left') {

                    let offset = BB.getPageOffset(maindiv);
                    let o = {x: event.pageX - offset.x, y: event.pageY - offset.y};

                    let a = BB.angleDeg({x: x, y: y}, o);
                    angle = a;
                    if (keyListener.getComboStr() === 'shift') {
                        angle = Math.round(a / 360 * 8) * 45;
                    }
                    update();

                }
            }
        });
    })();

    function commitTransform() {
        centerAround(grips[0].x * 0.5 + grips[1].x * 0.5,
            grips[0].y * 0.5 + grips[3].y * 0.5);

        width = grips[1].x - grips[0].x;
        height = grips[3].y - grips[0].y;

        grips[0].x = (-width / 2);
        grips[0].y = (-height / 2);
        grips[1].x = (width / 2);
        grips[1].y = (-height / 2);
        grips[2].x = (width / 2);
        grips[2].y = (height / 2);
        grips[3].x = (-width / 2);
        grips[3].y = (height / 2);

        update();
    }

    function getInner(ox, oy) {
        let px, py;
        px = ox - x;
        py = oy - y;

        let rot = BB.rotateAround({x: 0, y: 0},
            {x: px, y: py},
            -angle);
        px = rot.x;
        py = rot.y;

        return {
            x: px,
            y: py
        };
    }

    function getOuter(ix, iy) {
        let rot = BB.rotateAround({x: 0, y: 0},
            {x: ix, y: iy},
            angle);
        return {
            x: rot.x + x,
            y: rot.y + y
        };
    }

    function centerAround(cx, cy) {
        let rot = BB.rotateAround({x: 0, y: 0},
            {x: cx, y: cy},
            angle);
        x = rot.x + x;
        y = rot.y + y;

        update();
    }

    /**
     * update grips according to width height
     */
    function updateGripPositions() {
        grips[0].x = (-width / 2);
        grips[0].y = (-height / 2);
        grips[1].x = (width / 2);
        grips[1].y = (-height / 2);
        grips[2].x = (width / 2);
        grips[2].y = (height / 2);
        grips[3].x = (-width / 2);
        grips[3].y = (height / 2);
    }

    /**
     * updates according to grips and angle
     * @param skipcallback
     */
    function update(skipcallback?) {
        BB.css(div, {
            left: x + "px",
            top: y + "px",
            WebkitTransformOrigin: "0 0",
            WebkitTransform: "rotate(" + angle + "deg)",
            MozTransformOrigin: "0 0",
            MozTransform: "rotate(" + angle + "deg)"
        });

        if(elem) {
            if (appendElem) {
                BB.css(elem, {
                    WebkitTransform: "scale(" + width + ", " + height + ")",
                    MozTransform: "scale(" + width + ", " + height + ")",
                    left: (grips[0].x) + "px",
                    top: (grips[0].y) + "px"
                });
            } else {
                BB.css(elem, {
                    width: "1px",
                    height: "1px",
                    position: "absolute",
                    transformOrigin: "50% 50%",
                    transform: "rotate(" + angle + "deg) scale(" + width + ", " + height + ")",
                    left: (x) + "px",
                    top: (y) + "px"
                });
            }
        }

        BB.css(outline, {
            width: Math.abs(width) + "px",
            height: Math.abs(height) + "px",
            left: Math.min(grips[0].x, grips[1].x) + "px",
            top: Math.min(grips[0].y, grips[3].y) + "px"
        });

        grips[0].update();
        grips[1].update();
        grips[2].update();
        grips[3].update();

        edges[0].update();
        edges[1].update();
        edges[2].update();
        edges[3].update();


        (rot as any).x = 0;
        (rot as any).y = (-Math.abs(height) / 2) - 20;
        (rot as any).update();
        if (!skipcallback) {
            if (callback) {
                callback(getTransform());
            }
        }
    }

    update();
    if (elem && appendElem) {
        div.appendChild(elem);
    }
    div.appendChild(outline);
    div.appendChild(edges[0]);
    div.appendChild(edges[1]);
    div.appendChild(edges[2]);
    div.appendChild(edges[3]);
    div.appendChild(grips[0]);
    div.appendChild(grips[1]);
    div.appendChild(grips[2]);
    div.appendChild(grips[3]);
    div.appendChild(rot);

    function getTransform() {
        return {
            x: x,
            y: y,
            width: width,
            height: height,
            angle: angle
        };
    }

    // --- interface ---

    this.getTransform = getTransform;
    this.setConstrained = function (b) {
        if (b) {
            constrained = true;
            ratio = Math.abs(width / height);
        } else {
            constrained = false;
        }
    };
    this.setSnapping = function (s) {
        snappingEnabled = (s) ? true : false;
    };
    this.setPos = function (p) {
        x = p.x + 0;
        y = p.y + 0;
        update(true);
    };
    this.move = function(dX, dY) {
        x += dX;
        y += dY;
        update(false);
    };
    this.setSize = function(w, h) {
        width = w;
        height = h;
        updateGripPositions();
        update(false);
    };
    this.setAngle = function (a) {
        angle = a;
        update(true);
    };
    this.destroy = function() {
        keyListener.destroy();
        outlinePointerListener.destroy();
        grip0PointerListener.destroy();
        grip1PointerListener.destroy();
        grip2PointerListener.destroy();
        grip3PointerListener.destroy();
        edge0PointerListener.destroy();
        edge1PointerListener.destroy();
        edge2PointerListener.destroy();
        edge3PointerListener.destroy();
        rotPointerListener.destroy();
    };
    this.getElement = function() {
        return maindiv;
    };
}
