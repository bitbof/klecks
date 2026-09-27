import { fxGl, gl } from './gl';
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
export type TTextureSampling = 'linear' | 'nearest';

export class FxTexture {
    // ---- static ----
    static fromElement(element: TFxSupportedElements): FxTexture {
        const texture = new FxTexture(0, 0, gl.RGBA, gl.UNSIGNED_BYTE);
        texture.loadContentsOf(element);
        return texture;
    }

    // ---- private ----
    private type: TTextureType;

    // ----------------------------------- public -----------------------------------
    constructor(width: number, height: number, format: TTextureFormat, type: TTextureType) {
        this.fxGl = fxGl;
        this.id = BB.throwIfNull(gl.createTexture());
        this.width = width;
        this.height = height;
        this.format = format;
        this.type = type;

        gl.bindTexture(gl.TEXTURE_2D, this.id);
        this.setSampling('linear');
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

    fxGl: TFxGl;
    width: number;
    height: number;
    id: WebGLTexture | null; // null -> destroyed
    format: TTextureFormat;

    setSampling(minification: TTextureSampling, magnification = minification): void {
        gl.bindTexture(gl.TEXTURE_2D, this.id);
        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_MIN_FILTER,
            minification === 'nearest' ? gl.NEAREST : gl.LINEAR,
        );
        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_MAG_FILTER,
            magnification === 'nearest' ? gl.NEAREST : gl.LINEAR,
        );
    }

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
            width !== this.width ||
            height !== this.height ||
            format !== this.format ||
            type !== this.type
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
        fxGl.framebuffer ??= BB.throwIfNull(gl.createFramebuffer());
        const framebuffer = fxGl.framebuffer;
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.id, 0);
        const fbStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (fbStatus !== gl.FRAMEBUFFER_COMPLETE) {
            if (this.id === null) {
                throw new Error('incomplete framebuffer: texture already destroyed');
            }
            if (gl.isContextLost()) {
                throw new Error('incomplete framebuffer: context lost');
            }
            if (this.width === 0 || this.height === 0) {
                throw new Error(
                    `incomplete framebuffer: texture has zero dimension (${this.width}x${this.height})`,
                );
            }
            if (fbStatus === gl.FRAMEBUFFER_UNSUPPORTED) {
                throw new Error(
                    `incomplete framebuffer: unsupported format/type combination (format=0x${this.format.toString(16)}, type=0x${this.type.toString(16)})`,
                );
            }
            throw new Error(`incomplete framebuffer: status 0x${fbStatus.toString(16)}`);
        }
        gl.viewport(0, 0, this.width, this.height);

        // do the drawing
        callback();

        // stop rendering to this texture
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

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
