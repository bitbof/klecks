uniform sampler2D texture;
varying vec2 texCoord;
uniform vec2 texSize;

uniform float seed;
uniform float type;
uniform vec2 scale;
uniform vec2 offset;
uniform float octaves;
uniform float samples;

uniform float peaks;
uniform float contrast;
uniform float brightness;
uniform float isReversed;

uniform vec3 colA;
uniform vec3 colB;

uniform float channels; // 0 - rgb, 1 - alpha

// fbm, cellular_noise based on
// https://github.com/Gonkee/Gonkees-Shaders
// MIT, Copyright © Gonkee

// hash & simplex based on
// https://www.shadertoy.com/view/Msf3WH
// MIT, Copyright © 2013 Inigo Quilez
// https://www.youtube.com/c/InigoQuilez
// https://iquilezles.org



float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

float value_noise(vec2 coord){
    return rand(floor(coord) / 100.0);
}

float cellular_noise(vec2 coord) {
    vec2 i = floor(coord);
    vec2 f = fract(coord);

    float min_dist = 99999.0;
    for (float x = -1.0; x <= 1.0; x++) {
        for (float y = -1.0; y <= 1.0; y++) {
            vec2 node = rand(i + vec2(x, y)) + vec2(x, y);
            float dist = sqrt((f - node).x * (f - node).x + (f - node).y * (f - node).y);
            min_dist = min(min_dist, dist);
        }
    }
    return min_dist;
}

// ---------- Simplex Alternative ---------------------

vec3 hash(vec3 p)
{ p=vec3(dot(p, vec3(127.1, 311.7, 74.7))
, dot(p, vec3(269.5, 183.3, 246.1))
, dot(p, vec3(113.5, 271.9, 124.6)))
;return fract(sin(p)*43758.5453123)*2.-1.; }

mat3 hash(mat3 p)
{ return mat3(hash(p[0]), hash(p[1]), hash(p[2])); }

vec3 dots(mat3 a, vec3 w, mat3 b){ return vec3
(dot(a[0], w-b[0]), dot(a[1], w-b[1]), dot(a[2], w-b[2])); }

//return noiseGra13dx as .x, and its derivatives as .yzw
// https://www.shadertoy.com/view/llByD1
vec3 noiseGra13dx(in vec3 x) {
    vec3 p=floor(x), w=fract(x)
    #if 1
    , u=w*w*w*(w*(w*6.-15.)+10.), v=30.*w*w*(w*(w-2.)+1.)//quintic hermite
    #else
    , u=w*w*(3.-2.*w), v=6.*w*(1.-w)//cubic hermite
    #endif
    //gradients
    , G=hash(p+vec3(0)), F=hash(p+vec3(1))
    ;mat3 D=hash(mat3(p, p, p)+mat3(1)), E=hash(mat3(p, p, p)+1.-mat3(1));
    //projections
    vec3 d=dots(D, w, mat3(1)), e=dots(E, w, 1.-mat3(1));
    //interpolations
    float g=dot(G, w), f=dot(F, w-vec3(1));
    vec3 h=u.yzx*(g-d.xyx-d.yzz+e.zxy)+d-g, U=u*h, a=d-e;
    mat3 S=D-mat3(G, G, G), W=D-E;
    a.x=(a.x+a.y+a.z)+f-g;
    ;float b=u.x*u.y*u.z;

    vec4 result = vec4(g+U.x+U.y+U.z+a.x*b// value
    , G*(1.-b)+b*(W[0]+W[1]+W[2]+F)//https://www.shadertoy.com/view/llByD1
    +u.x*(S[0]+u.y*(G-D[0]-D[1]+E[2]))// derivatives
    +u.y*(S[1]+u.z*(G-D[1]-D[2]+E[0]))
    +u.z*(S[2]+u.x*(G-D[0]-D[2]+E[1]))
    +v*(u.zxy*(g-d.xxy-d.zyz+e.yzx)+h+u.yzx*u.zxy*a.x));
    return 0.5 + 0.5 * result.xxx;
}

float fbm(vec2 coord) {
    float normalize_factor = 0.0;
    float value = 0.0;
    float scale = 0.5;

    for (float i = 0.0; i < 7.0; i++){
        if (i < octaves) {
            if (type == 0.0) {
                value += value_noise(coord) * scale;
            } else if (type == 1.0) {
                value += noiseGra13dx(vec3(coord.x, coord.y, 0.0)).r * scale;
            } else if (type == 2.0) {
                value += cellular_noise(coord) * scale;
            }
            normalize_factor += scale;
            coord *= 2.0;
            scale *= 0.5;
        }
    }
    return value / normalize_factor;
}

float render (vec2 pos) {
    float result = fbm(pos);
    //

    if (peaks > 0.0) {
        result = abs(mod(result * peaks - 0.5, 1.0) - 0.5) * 2.0;// triangle
        //result = mod(result * (peaks + 1.0), 1.0); // sawtooth
    }

    result += brightness;
    if (contrast > 0.0) {
        result = clamp((result - 0.5) / (1.0 - contrast) + 0.5, 0.0, 1.0);
    } else if (contrast < 0.0) {
        result = clamp((result - 0.5) * (1.0 + contrast) + 0.5, 0.0, 1.0);
    }

    if (isReversed == 1.0) {
        result = 1.0 - result;
    }
    return result;
}


void main() {
    vec4 color;

    vec2 seedOffset;
    seedOffset.x = (rand(vec2(seed, 0.0)) * 100.0 - 50.0);
    seedOffset.y = (rand(vec2(0.0, seed)) * 100.0 - 50.0);

    float val = 0.0;
    vec2 basePos = texCoord * texSize / scale - offset / scale + seedOffset;

    if (samples == 1.0) {
        val = render(basePos);

    }/* else if (samples == 4.0) {
        for (float i = 0.0; i < 2.0; i++) {
            for (float e = 0.0; e < 2.0; e++) {
                val += render(basePos + (vec2(i, e) - 0.5) * 0.5 / scale);
            }
        }
        val /= 4.0;

    }*/ else if (samples == 16.0) {
        for (float i = 0.0; i < 4.0; i++) {
            for (float e = 0.0; e < 4.0; e++) {
                val += render(basePos + (vec2(i, e) - 0.25) * 0.25 / scale);
            }
        }
        val /= 16.0;
    }

    if (channels == 0.0) {
        gl_FragColor = vec4(vec3(mix(colA, colB, val)), 1.0);
    } else {
        gl_FragColor = vec4(vec3(1.0), val);
    }
}