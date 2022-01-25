import {getSharedFx} from './shared-gl-fx';

export const invert = {

    apply(params) {
        let context = params.context;
        let history = params.history;
        if (!context || !history) {
            return false;
        }
        history.pause();

        let glCanvas = getSharedFx();
        if (!glCanvas) {
            return false;
        }
        let texture = glCanvas.texture(context.canvas);
        glCanvas.draw(texture).invert().update();
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        context.drawImage(glCanvas, 0, 0);
        texture.destroy();

        history.pause(false);
        history.add({
            tool: ["filter", "invert"],
            action: "apply",
            params: [{
                input: params.input
            }]
        });
        return true;
    }

};