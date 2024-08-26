import { gl } from './gl';
import { TUniforms } from '../fx-canvas-types';
import { BB } from '../../bb/bb';

// VERTEX_SHADER | FRAGMENT_SHADER
type TShaderType = GLenum;

const defaultVertexSource =
    '\
    attribute vec2 vertex;\
    attribute vec2 _texCoord;\
    varying vec2 texCoord;\
    void main() {\
        texCoord = _texCoord;\
        gl_Position = vec4(vertex * 2.0 - 1.0, 0.0, 1.0);\
    }';

const defaultFragmentSource =
    '\
    uniform sampler2D texture;\
    varying vec2 texCoord;\
    void main() {\
        gl_FragColor = texture2D(texture, texCoord);\
    }';

function isArray(obj: unknown): obj is unknown[] {
    return Object.prototype.toString.call(obj) == '[object Array]';
}

function isNumber(obj: unknown): obj is number {
    return Object.prototype.toString.call(obj) == '[object Number]';
}

let floatPrecision: 'lowp' | 'mediump' | 'highp' | undefined;

export class FxShader {
    // ---- static ----
    static getDefaultShader(): FxShader {
        gl.defaultShader = gl.defaultShader || new FxShader();
        return gl.defaultShader;
    }

    // ---- private ----

    private compileSource(type: TShaderType, source: string, nameStr: string): WebGLShader {
        const shader = BB.throwIfNull(gl.createShader(type));
        gl.shaderSource(shader, source.replace(/#define.*/, '')); // glslify adds a line add the beginning that breaks it
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw 'compile error: ' + nameStr + ' - ' + gl.getShaderInfoLog(shader);
        }
        return shader;
    }

    /**
     * HIGH_FLOAT | MEDIUM_FLOAT
     */
    private testPrecisionSupport(precisionType: GLenum): boolean {
        const format = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, precisionType);
        return format !== null && format.precision !== 0;
    }

    // ----------------------------------- public -----------------------------------
    constructor(vertexSource?: string | null, fragmentSource?: string | null, nameStr?: string) {
        this.vertexAttribute = null;
        this.texCoordAttribute = null;
        this.program = BB.throwIfNull(gl.createProgram());
        vertexSource = vertexSource || defaultVertexSource;
        fragmentSource = fragmentSource || defaultFragmentSource;
        if (!floatPrecision) {
            floatPrecision = this.testPrecisionSupport(gl.HIGH_FLOAT)
                ? 'highp'
                : this.testPrecisionSupport(gl.MEDIUM_FLOAT)
                  ? 'mediump'
                  : 'lowp';
        }
        fragmentSource = 'precision ' + floatPrecision + ' float;' + fragmentSource; // annoying requirement is annoying
        gl.attachShader(
            this.program,
            this.compileSource(gl.VERTEX_SHADER, vertexSource, nameStr + '(vertex)'),
        );
        gl.attachShader(
            this.program,
            this.compileSource(gl.FRAGMENT_SHADER, fragmentSource, nameStr + '(fragment)'),
        );
        gl.linkProgram(this.program);
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            throw 'link error: ' + gl.getProgramInfoLog(this.program);
        }
    }

    // ---- interface ----

    vertexAttribute: null | number;
    texCoordAttribute: null | number;
    program: WebGLProgram | null; // null = destroyed

    destroy(): void {
        gl.deleteProgram(this.program);
        this.program = null;
    }

    uniforms(uniforms: TUniforms<number | number[]>): FxShader {
        gl.useProgram(this.program);
        Object.entries(uniforms).forEach(([name, value]) => {
            const location = gl.getUniformLocation(this.program!, name);
            if (location === null) {
                // will be null if the uniform isn't used in the shader
                return;
            }

            if (isArray(value)) {
                switch (value.length) {
                    case 1:
                        gl.uniform1fv(location, new Float32Array(value));
                        break;
                    case 2:
                        gl.uniform2fv(location, new Float32Array(value));
                        break;
                    case 3:
                        gl.uniform3fv(location, new Float32Array(value));
                        break;
                    case 4:
                        gl.uniform4fv(location, new Float32Array(value));
                        break;
                    case 9:
                        gl.uniformMatrix3fv(location, false, new Float32Array(value));
                        break;
                    case 16:
                        gl.uniformMatrix4fv(location, false, new Float32Array(value));
                        break;
                    default:
                        throw (
                            'dont\'t know how to load uniform "' +
                            name +
                            '" of length ' +
                            value.length
                        );
                }
            } else if (isNumber(value)) {
                gl.uniform1f(location, value);
            } else {
                throw (
                    'attempted to set uniform "' +
                    name +
                    '" to invalid value ' +
                    ((value as any) || 'undefined').toString()
                );
            }
        });
        // allow chaining
        return this;
    }

    //
    /**
     * textures are uniforms too but for some reason can't be specified by gl.uniform1f,
     * even though floating point numbers represent the integers 0 through 7 exactly
     */
    textures(textures: Record<string, GLint>): FxShader {
        gl.useProgram(this.program);

        Object.entries(textures).forEach(([name, value]) => {
            gl.uniform1i(gl.getUniformLocation(this.program!, name), value);
        });

        // allow chaining
        return this;
    }

    drawRect(left?: number, top?: number, right?: number, bottom?: number): void {
        let undefined;
        const viewport = gl.getParameter(gl.VIEWPORT);
        top = top !== undefined ? (top - viewport[1]) / viewport[3] : 0;
        left = left !== undefined ? (left - viewport[0]) / viewport[2] : 0;
        right = right !== undefined ? (right - viewport[0]) / viewport[2] : 1;
        bottom = bottom !== undefined ? (bottom - viewport[1]) / viewport[3] : 1;
        if (gl.vertexBuffer === undefined || gl.vertexBuffer === null) {
            gl.vertexBuffer = BB.throwIfNull(gl.createBuffer());
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.vertexBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([left, top, left, bottom, right, top, right, bottom]),
            gl.STATIC_DRAW,
        );
        if (gl.texCoordBuffer == null) {
            gl.texCoordBuffer = BB.throwIfNull(gl.createBuffer());
            gl.bindBuffer(gl.ARRAY_BUFFER, gl.texCoordBuffer);
            gl.bufferData(
                gl.ARRAY_BUFFER,
                new Float32Array([0, 0, 0, 1, 1, 0, 1, 1]),
                gl.STATIC_DRAW,
            );
        }
        if (this.vertexAttribute == null) {
            this.vertexAttribute = gl.getAttribLocation(this.program!, 'vertex');
            gl.enableVertexAttribArray(this.vertexAttribute);
        }
        if (this.texCoordAttribute == null) {
            this.texCoordAttribute = gl.getAttribLocation(this.program!, '_texCoord');
            gl.enableVertexAttribArray(this.texCoordAttribute);
        }
        gl.useProgram(this.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.vertexBuffer);
        gl.vertexAttribPointer(this.vertexAttribute, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.texCoordBuffer);
        gl.vertexAttribPointer(this.texCoordAttribute, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}
