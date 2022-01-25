import {BB} from '../../../bb/bb';
import {popup} from './popup';

export function exportDialog(parent, image) {
    let boxSize, aboutCloseFunc, aboutDiv, closed, aniToggle, imageContainer, coverImage, coverSize,
        text, holding, aniTimeout, halfBoxSize;
    boxSize = 22 * 2;
    halfBoxSize = 22;
    aboutCloseFunc = function () {
    };
    closed = false;
    aniToggle = false;
    aboutDiv = document.createElement("div");
    BB.css(aboutDiv, {
        width: (7 * boxSize) + "px"
    });

    imageContainer = document.createElement("div");
    coverImage = new Image();
    coverImage.src = image.src;

    imageContainer.appendChild(coverImage);
    imageContainer.appendChild(image);

    BB.css(imageContainer, {
        width: (6 * boxSize) + "px",
        height: (4 * boxSize) + "px",
        marginTop: (boxSize / 2 - 1) + "px",
        marginLeft: (boxSize / 2 - 1) + "px",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 0 10px 4px rgba(255,255,255, 0)",
        border: "1px solid rgba(255, 255, 255, 1)",
        transition: "box-shadow 0.7s linear"
    });
    BB.css(image, {
        position: "absolute",
        left: '0',
        top: '0',
        width: (6 * boxSize) + "px",
        height: (4 * boxSize) + "px",
        opacity: '0'
    });
    coverSize = {
        width: (6 * boxSize),
        height: (6 * boxSize / image.width) * image.height
    };
    if (coverSize.height < (4 * boxSize)) {
        coverSize.height = (4 * boxSize);
        coverSize.width = (coverSize.height / image.height) * image.width;
    }
    BB.css(coverImage, {
        position: "absolute",
        top: (2 * boxSize) + "px",
        left: (3 * boxSize) + "px",
        width: coverSize.width + "px",
        height: coverSize.height + "px",
        marginLeft: (-coverSize.width / 2) + "px",
        marginTop: (-coverSize.height / 2) + "px"
    });

    function animation() {
        if (closed) {
            return;
        }
        aniToggle = !aniToggle;
        if (aniToggle) {
            BB.css(imageContainer, {
                border: "1px solid rgba(0, 0, 0, 1)"
            });
        } else {
            BB.css(imageContainer, {
                border: "1px solid rgba(200, 200, 200, 1)"
            });
        }
        setTimeout(animation, 510);
    }

    animation();

    text = document.createElement("div");
    text.innerHTML = "Right-Click or Press-Hold on the image, then save.";
    text.ontouchstart = function () {
        return false;
    };
    BB.css(text, {
        fontSize: (boxSize / 2.5) + "px",
        color: "#666",
        padding: "10px",
        textAlign: "center"
    });

    aboutDiv.appendChild(imageContainer);
    aboutDiv.appendChild(text);

    holding = false;
    image.ontouchstart = function () {
        BB.css(imageContainer, {
            boxShadow: "0 0 10px 8px rgba(0,255,255, 1)"
        });
        holding = true;
        aniTimeout = setTimeout(function () {
            holding = false;
            BB.css(imageContainer, {
                boxShadow: "0 0 10px 4px rgba(0,255,255, 0)"
            });
        }, 1500);
    };
    image.ontouchmove = function () {
        BB.css(imageContainer, {
            boxShadow: "0 0 10px 4px rgba(0,255,255, 0)"
        });
        holding = false;
        clearTimeout(aniTimeout);
    };
    image.ontouchend = function () {
        BB.css(imageContainer, {
            boxShadow: "0 0 10px 4px rgba(0,255,255, 0)"
        });
        holding = false;
        clearTimeout(aniTimeout);
    };

    popup({
        target: parent,
        message: "<b>Save Image</b>",
        div: aboutDiv,
        buttons: ["Close"],
        callback: function (result) {
            closed = true;
        }
    });
}