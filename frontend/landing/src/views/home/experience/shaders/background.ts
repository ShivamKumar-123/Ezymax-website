/**
 * Aurora background shader — ported verbatim from the orthographic fullscreen
 * quad in the source script.js. fBm noise paints two organic orange/blue blurs
 * that are masked away from the centre and intensify with scroll.
 */

export const backgroundVertexShader = /* glsl */ `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
    }
`;

export const backgroundFragmentShader = /* glsl */ `
    uniform float uTime;
    uniform float uScroll;
    uniform vec2 uResolution;
    uniform vec3 color1;
    uniform vec3 color2;
    varying vec2 vUv;

    // Morgan McGuire noise
    float hash(float n) { return fract(sin(n) * 1e4); }
    float hash(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }
    float noise(vec2 x) {
        vec2 i = floor(x);
        vec2 f = fract(x);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }
    #define OCTAVES 4
    float fbm(vec2 x) {
        float v = 0.0;
        float a = 0.5;
        vec2 shift = vec2(100);
        mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
        for (int i = 0; i < OCTAVES; ++i) {
            v += a * noise(x);
            x = rot * x * 2.0 + shift;
            a *= 0.5;
        }
        return v;
    }

    void main() {
        vec2 st = vUv;
        st.x *= uResolution.x / uResolution.y;

        // Faster animation + massive boost on scroll
        float t = uTime * 6.0 + uScroll * 150.0;

        // Scale coordinates for large, organic blurs
        vec2 st1 = st * 1.2;
        vec2 st2 = st * 1.6;

        // Shape 1: Deep Blue blurs (color2)
        float f1 = fbm(st1 + vec2(t * 0.15, t * 0.1));
        float mask1 = pow(fbm(st1 + f1 * 2.5 - vec2(t * 0.25, 0.0)), 2.0) * 3.5;

        // Shape 2: Blazing Orange blurs (color1)
        float f2 = fbm(st2 - vec2(t * 0.1, t * 0.2));
        float mask2 = pow(fbm(st2 + f2 * 2.0 + vec2(0.0, t * 0.2)), 2.5) * 4.0;

        // Additive blending for extreme saturation without muddy grays
        vec3 finalColor = color2 * mask1 + color1 * mask2;

        // Corner mask: hide the aurora in the center to keep focus on the 3D sphere
        // Using vUv ensures it stays perfectly centered regardless of devicePixelRatio!
        vec2 aspectUv = vUv - 0.5;
        aspectUv.x *= uResolution.x / uResolution.y;
        float centerDist = length(aspectUv);

        // Make the mask dynamic and organic!
        // Adding uScroll makes the "amoeba" actively spin and morph as you scroll
        float angle = atan(aspectUv.y, aspectUv.x) + uScroll * 15.0;
        // Combine a couple of slow sine waves to create an "amoeba" like breathing edge
        float maskOffset = sin(angle * 3.0 + t * 0.4) * 0.05
                         + sin(angle * 5.0 - t * 0.6) * 0.03;
        float dynamicDist = centerDist + maskOffset;

        // Push visibility entirely to the extreme corners
        float cornerFade = smoothstep(0.7, 1.15, dynamicDist);
        cornerFade = pow(cornerFade, 1.6);

        // Apply fade and reduce overall intensity to keep it subtle
        finalColor *= cornerFade * 0.9;

        // Deep dark background base
        vec3 baseBg = vec3(0.012, 0.012, 0.02);

        gl_FragColor = vec4(baseBg + finalColor, 1.0);
    }
`;
