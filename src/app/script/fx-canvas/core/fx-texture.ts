import { gl } from './gl';
import { BB } from '../../bb/bb';
import { TFxGl, TFxSupportedElements } from '../fx-canvas-types';

/**
 * Format           Type                    Channels    Bytes per pixel
 * RGBA             UNSIGNED_BYTE           4           4
 * RGB              UNSIGNED_BYTE           3           3
 * RGBA             UNSIGNED_SHORT_4_4_4_4  4           2
 * RGBA             UNSIGNED_SHORT_5_5_5_1  4           2
 * RGB              UNSIGNED_SHORT_5_6_5    3           2
 * LUMINANCE_ALPHA  UNSIGNED_BYTE           2           2
 * LUMINANCE        UNSIGNED_BYTE           1           1
 * ALPHA            UNSIGNED_BYTE           1           1
 *
 * https://webglfundamentals.org/webgl/lessons/webgl-data-textures.html
 */
export type TTextureFormat = GLenum;
export type TTextureType = GLenum;

export class FxTexture {
    // ---- static ----
    static fromElement(element: TFxSupportedElements): FxTexture {
        const texture = new FxTexture(0, 0, gl.RGBA, gl.UNSIGNED_BYTE);
        texture.loadContentsOf(element);
        return texture;
    }

    // ---- private ----
    private canvas: HTMLCanvasElement | null;
    private type: TTextureType;

    /*
    // never seen this being used
    private getCanvas(texture: Texture): CanvasRenderingContext2D {
        if (this.canvas == null) {
            this.canvas = BB.canvas(texture.width, texture.height);
        }
        this.canvas.width = texture.width;
        this.canvas.height = texture.height;
        const c = BB.ctx(this.canvas);
        c.clearRect(0, 0, this.canvas.width, this.canvas.height);
        return c;
    }*/

    // ----------------------------------- public -----------------------------------
    constructor(width: number, height: number, format: TTextureFormat, type: TTextureType) {
        this.gl = gl;
        this.id = BB.throwIfNull(gl.createTexture());
        this.width = width;
        this.height = height;
        this.format = format;
        this.type = type;
        this.canvas = null;

        gl.bindTexture(gl.TEXTURE_2D, this.id);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        if (width && height) {
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                this.format,
                width,
                height,
                0,
                this.format,
                this.type,
                null,
            );
        }
    }

    // ---- interface ----

    gl: TFxGl;
    width: number;
    height: number;
    id: WebGLTexture | null; // null -> destroyed
    format: TTextureFormat;

    loadContentsOf(element: TFxSupportedElements): void {
        this.width = element.width || (element as HTMLVideoElement).videoWidth;
        this.height = element.height || (element as HTMLVideoElement).videoHeight!;
        gl.bindTexture(gl.TEXTURE_2D, this.id);
        gl.texImage2D(gl.TEXTURE_2D, 0, this.format, this.format, this.type, element);
    }

    initFromBytes(width: number, height: number, data: number[]): void {
        this.width = width;
        this.height = height;
        this.format = gl.RGBA;
        this.type = gl.UNSIGNED_BYTE;
        gl.bindTexture(gl.TEXTURE_2D, this.id);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            width,
            height,
            0,
            gl.RGBA,
            this.type,
            new Uint8Array(data),
        );
    }

    destroy(): void {
        gl.deleteTexture(this.id);
        this.id = null;
    }

    use(unit?: number): void {
        gl.activeTexture(gl.TEXTURE0 + (unit || 0));
        gl.bindTexture(gl.TEXTURE_2D, this.id);
    }

    unuse(unit: number): void {
        gl.activeTexture(gl.TEXTURE0 + (unit || 0));
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    ensureFormat(width: number, height: number, format: TTextureFormat, type: TTextureType): void {
        // change the format only if required
        if (
            width != this.width ||
            height != this.height ||
            format != this.format ||
            type != this.type
        ) {
            this.width = width;
            this.height = height;
            this.format = format;
            this.type = type;
            gl.bindTexture(gl.TEXTURE_2D, this.id);
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                this.format,
                width,
                height,
                0,
                this.format,
                this.type,
                null,
            );
        }
    }

    ensureFormatViaTexture(texture: FxTexture): void {
        this.ensureFormat(texture.width, texture.height, texture.format, texture.type);
    }

    drawTo(callback: () => void): void {
        // start rendering to this texture
        gl.framebuffer = gl.framebuffer || gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, gl.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.id, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error('incomplete framebuffer');
        }
        gl.viewport(0, 0, this.width, this.height);

        // do the drawing
        callback();

        // stop rendering to this texture
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    /*
    // never seen this being used
    fillUsingCanvas (callback: (canvas: CanvasRenderingContext2D) => void): Texture {
        callback(this.getCanvas(this));
        this.format = gl.RGBA;
        this.type = gl.UNSIGNED_BYTE;
        gl.bindTexture(gl.TEXTURE_2D, this.id);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
        return this;
    }

    // never seen this being used
    toImage (image: HTMLImageElement): void {
        this.use();
        Shader.getDefaultShader().drawRect();
        const size = this.width * this.height * 4;
        const pixels = new Uint8Array(size);
        const c = this.getCanvas(this);
        const data = c.createImageData(this.width, this.height);
        gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        for (let i = 0; i < size; i++) {
            data.data[i] = pixels[i];
        }
        c.putImageData(data, 0, 0);
        image.src = this.canvas.toDataURL();
    }
     */

    swapWith(other: FxTexture): void {
        let temp;

        temp = other.id;
        other.id = this.id;
        this.id = temp;

        temp = other.width;
        other.width = this.width;
        this.width = temp;

        temp = other.height;
        other.height = this.height;
        this.height = temp;

        temp = other.format;
        other.format = this.format;
        this.format = temp;

        // type?
    }
}
