"use client";

import { useRef, useEffect, useMemo, useState, type CSSProperties } from "react";

type PatternShape = "Checks" | "Stripes" | "Edge";

const PatternShapes: Record<PatternShape, number> = {
  Checks: 0,
  Stripes: 1,
  Edge: 2,
};

interface PresetParams {
  color1: string;
  color2: string;
  color3: string;
  rotation: number;
  proportion: number;
  scale: number;
  speed: number;
  distortion: number;
  swirl: number;
  swirlIterations: number;
  softness: number;
  offset: number;
  shape: PatternShape;
  shapeSize: number;
}

type PresetName = "Artha" | "Aurora" | "Ghost";

/**
 * `Artha` is the brand preset — black through deep olive to neon lime. The
 * upstream demo presets (neon pink, toxic green) are off-palette and were
 * dropped rather than shipped as dead configuration.
 */
const presets: Record<PresetName, PresetParams> = {
  Artha: {
    color1: "#000000",
    color2: "#1d2a00",
    color3: "#ccff00",
    rotation: -30,
    proportion: 62,
    scale: 0.55,
    speed: 12,
    distortion: 30,
    swirl: 70,
    swirlIterations: 10,
    softness: 100,
    offset: 120,
    shape: "Edge",
    shapeSize: 45,
  },
  Aurora: {
    color1: "#0a001a",
    color2: "#1a0b2e",
    color3: "#f20089",
    rotation: -45,
    proportion: 60,
    scale: 0.6,
    speed: 15,
    distortion: 40,
    swirl: 80,
    swirlIterations: 10,
    softness: 100,
    offset: 200,
    shape: "Edge",
    shapeSize: 50,
  },
  Ghost: {
    color1: "#0a0a0a",
    color2: "#1c1c1c",
    color3: "#a3a3a3",
    rotation: 45,
    proportion: 50,
    scale: 0.3,
    speed: 8,
    distortion: 10,
    swirl: 30,
    swirlIterations: 5,
    softness: 100,
    offset: 0,
    shape: "Checks",
    shapeSize: 60,
  },
};

export interface CustomConfig {
  preset: "custom";
  color1: string;
  color2: string;
  color3: string;
  rotation?: number;
  proportion?: number;
  scale?: number;
  speed?: number;
  distortion?: number;
  swirl?: number;
  swirlIterations?: number;
  softness?: number;
  offset?: number;
  shape?: PatternShape;
  shapeSize?: number;
}

export interface PresetConfig {
  preset: PresetName;
  speed?: number;
}

export type GradientConfig = CustomConfig | PresetConfig;

export interface NoiseConfig {
  opacity: number;
  scale?: number;
}

export interface AnimatedGradientProps {
  config?: GradientConfig;
  noise?: NoiseConfig;
  radius?: string;
  style?: CSSProperties;
  className?: string;
}

/**
 * WebGL2 animated gradient field.
 *
 * On any WebGL failure it renders nothing — the surface behind it is already a
 * valid design, so a decorative layer must degrade to absent, never to a broken
 * box. That also removes the need for the upstream error-boundary component:
 * every failure path here is inside the effect's try/catch.
 */
export function AnimatedGradient({
  config = { preset: "Artha" },
  noise,
  radius = "0px",
  style,
  className,
}: AnimatedGradientProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const frameIdRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number>(0);

  const [isMounted, setIsMounted] = useState(false);
  const [hasWebGLError, setHasWebGLError] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const params = useMemo((): PresetParams => {
    if (config.preset === "custom") {
      return {
        color1: config.color1,
        color2: config.color2,
        color3: config.color3,
        rotation: config.rotation ?? 0,
        proportion: config.proportion ?? 35,
        scale: config.scale ?? 1,
        speed: config.speed ?? 25,
        distortion: config.distortion ?? 12,
        swirl: config.swirl ?? 80,
        swirlIterations: config.swirlIterations ?? 10,
        softness: config.softness ?? 100,
        offset: config.offset ?? 0,
        shape: config.shape ?? "Checks",
        shapeSize: config.shapeSize ?? 10,
      };
    }
    const preset = presets[config.preset] || presets.Artha;
    return { ...preset, speed: config.speed ?? preset.speed };
  }, [config]);

  useEffect(() => {
    if (hasWebGLError) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !isMounted) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    try {
      const gl = canvas.getContext("webgl2", {
        premultipliedAlpha: true,
        alpha: true,
        antialias: true,
      });
      if (!gl) {
        setHasWebGLError(true);
        return;
      }

      const vertexShaderSource = `#version 300 es
in vec4 a_position;
void main() {
  gl_Position = a_position;
}`;

      const vertexShader = gl.createShader(gl.VERTEX_SHADER);
      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
      if (!vertexShader || !fragmentShader) {
        setHasWebGLError(true);
        return;
      }

      gl.shaderSource(vertexShader, vertexShaderSource);
      gl.compileShader(vertexShader);
      if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        gl.deleteShader(vertexShader);
        setHasWebGLError(true);
        return;
      }

      gl.shaderSource(fragmentShader, FRAGMENT_SHADER);
      gl.compileShader(fragmentShader);
      if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        setHasWebGLError(true);
        return;
      }

      const program = gl.createProgram();
      if (!program) {
        setHasWebGLError(true);
        return;
      }
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.deleteProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        setHasWebGLError(true);
        return;
      }
      gl.useProgram(program);

      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
      );

      const positionLocation = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      const uniforms = {
        u_time: gl.getUniformLocation(program, "u_time"),
        u_resolution: gl.getUniformLocation(program, "u_resolution"),
        u_pixelRatio: gl.getUniformLocation(program, "u_pixelRatio"),
        u_scale: gl.getUniformLocation(program, "u_scale"),
        u_rotation: gl.getUniformLocation(program, "u_rotation"),
        u_color1: gl.getUniformLocation(program, "u_color1"),
        u_color2: gl.getUniformLocation(program, "u_color2"),
        u_color3: gl.getUniformLocation(program, "u_color3"),
        u_proportion: gl.getUniformLocation(program, "u_proportion"),
        u_softness: gl.getUniformLocation(program, "u_softness"),
        u_shape: gl.getUniformLocation(program, "u_shape"),
        u_shapeScale: gl.getUniformLocation(program, "u_shapeScale"),
        u_distortion: gl.getUniformLocation(program, "u_distortion"),
        u_swirl: gl.getUniformLocation(program, "u_swirl"),
        u_swirlIterations: gl.getUniformLocation(program, "u_swirlIterations"),
      };

      // Cap the buffer at 1.5x — a full-width decorative band at dpr 3 is a lot
      // of fragment work for something nobody looks straight at.
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);

      const resize = () => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        canvas.width = Math.max(1, Math.round(width * pixelRatio));
        canvas.height = Math.max(1, Math.round(height * pixelRatio));
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        gl.viewport(0, 0, canvas.width, canvas.height);
      };

      resize();
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);

      startTimeRef.current = performance.now();

      const animate = (time: number) => {
        const elapsed = (time - startTimeRef.current) / 1000;
        const speed = (params.speed / 100) * 5;

        gl.uniform1f(uniforms.u_time, elapsed * speed + params.offset * 0.01);
        gl.uniform2f(uniforms.u_resolution, canvas.width, canvas.height);
        gl.uniform1f(uniforms.u_pixelRatio, pixelRatio);
        gl.uniform1f(uniforms.u_scale, params.scale);
        gl.uniform1f(uniforms.u_rotation, (params.rotation * Math.PI) / 180);

        const c1 = hexToRgba(params.color1);
        const c2 = hexToRgba(params.color2);
        const c3 = hexToRgba(params.color3);
        gl.uniform4f(uniforms.u_color1, c1[0], c1[1], c1[2], c1[3]);
        gl.uniform4f(uniforms.u_color2, c2[0], c2[1], c2[2], c2[3]);
        gl.uniform4f(uniforms.u_color3, c3[0], c3[1], c3[2], c3[3]);

        gl.uniform1f(uniforms.u_proportion, params.proportion / 100);
        gl.uniform1f(uniforms.u_softness, params.softness / 100);
        gl.uniform1f(uniforms.u_shape, PatternShapes[params.shape]);
        gl.uniform1f(uniforms.u_shapeScale, params.shapeSize / 100);
        gl.uniform1f(uniforms.u_distortion, params.distortion / 50);
        gl.uniform1f(uniforms.u_swirl, params.swirl / 100);
        gl.uniform1f(
          uniforms.u_swirlIterations,
          params.swirl === 0 ? 0 : params.swirlIterations,
        );

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        frameIdRef.current = requestAnimationFrame(animate);
      };

      frameIdRef.current = requestAnimationFrame(animate);

      return () => {
        if (frameIdRef.current !== undefined) {
          cancelAnimationFrame(frameIdRef.current);
        }
        resizeObserver.disconnect();
        gl.deleteProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        gl.deleteBuffer(positionBuffer);
      };
    } catch {
      setHasWebGLError(true);
      return;
    }
  }, [hasWebGLError, isMounted, params]);

  if (hasWebGLError) return null;

  return (
    <div
      ref={containerRef}
      aria-hidden
      className={`absolute inset-0 overflow-hidden ${className ?? ""}`}
      style={{ borderRadius: radius, ...style }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
      {noise && noise.opacity > 0 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwBAMAAAClLOS0AAAAElBMVEUAAAAAAAAAAAAAAAAAAAAAAADgKxmiAAAABnRSTlMCCgkGBAVJOAVJAAAASklEQVQ4y2NgGAWjYBSMglEwCgY/YGRgZBQUYmJiZGQEkYwMjIyMgoKCjIyMIJKBgRFIMjIyAklGRkYGRkFBYEcwMDIyMjAOUQAA1I4HwVwZAkYAAAAASUVORK5CYII=")`,
            backgroundSize: (noise.scale ?? 1) * 200,
            backgroundRepeat: "repeat",
            opacity: noise.opacity / 2,
            pointerEvents: "none",
          }}
        />
      ) : null}
    </div>
  );
}

function hexToRgba(hex: string): [number, number, number, number] {
  let r = 0,
    g = 0,
    b = 0,
    a = 1;

  if (hex.startsWith("rgba(")) {
    const parts = hex.slice(5, -1).split(",");
    r = parseInt(parts[0] ?? "0") / 255;
    g = parseInt(parts[1] ?? "0") / 255;
    b = parseInt(parts[2] ?? "0") / 255;
    a = parseFloat(parts[3] ?? "1");
  } else if (hex.startsWith("rgb(")) {
    const parts = hex.slice(4, -1).split(",");
    r = parseInt(parts[0] ?? "0") / 255;
    g = parseInt(parts[1] ?? "0") / 255;
    b = parseInt(parts[2] ?? "0") / 255;
  } else if (hex.startsWith("#")) {
    const c = hex.slice(1);
    if (c.length === 3) {
      r = parseInt(c.charAt(0) + c.charAt(0), 16) / 255;
      g = parseInt(c.charAt(1) + c.charAt(1), 16) / 255;
      b = parseInt(c.charAt(2) + c.charAt(2), 16) / 255;
    } else if (c.length >= 6) {
      r = parseInt(c.slice(0, 2), 16) / 255;
      g = parseInt(c.slice(2, 4), 16) / 255;
      b = parseInt(c.slice(4, 6), 16) / 255;
      if (c.length === 8) a = parseInt(c.slice(6, 8), 16) / 255;
    }
  }

  return [r, g, b, a];
}

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform float u_time;
uniform float u_pixelRatio;
uniform vec2 u_resolution;

uniform float u_scale;
uniform float u_rotation;
uniform vec4 u_color1;
uniform vec4 u_color2;
uniform vec4 u_color3;
uniform float u_proportion;
uniform float u_softness;
uniform float u_shape;
uniform float u_shapeScale;
uniform float u_distortion;
uniform float u_swirl;
uniform float u_swirlIterations;

out vec4 fragColor;

#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));

  vec2 u = f * f * (3.0 - 2.0 * f);

  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

vec4 blend_colors(vec4 c1, vec4 c2, vec4 c3, float mixer, float edgesWidth, float edge_blur) {
    vec3 color1 = c1.rgb * c1.a;
    vec3 color2 = c2.rgb * c2.a;
    vec3 color3 = c3.rgb * c3.a;

    float r1 = smoothstep(.0 + .35 * edgesWidth, .7 - .35 * edgesWidth + .5 * edge_blur, mixer);
    float r2 = smoothstep(.3 + .35 * edgesWidth, 1. - .35 * edgesWidth + edge_blur, mixer);

    vec3 blended_color_2 = mix(color1, color2, r1);
    float blended_opacity_2 = mix(c1.a, c2.a, r1);

    vec3 c = mix(blended_color_2, color3, r2);
    float o = mix(blended_opacity_2, c3.a, r2);
    return vec4(c, o);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;

    float t = .5 * u_time;

    float noise_scale = .0005 + .006 * u_scale;

    uv -= .5;
    uv *= (noise_scale * u_resolution);
    uv = rotate(uv, u_rotation * .5 * PI);
    uv /= u_pixelRatio;
    uv += .5;

    float n1 = noise(uv * 1. + t);
    float n2 = noise(uv * 2. - t);
    float angle = n1 * TWO_PI;
    uv.x += 4. * u_distortion * n2 * cos(angle);
    uv.y += 4. * u_distortion * n2 * sin(angle);

    float iterations_number = ceil(clamp(u_swirlIterations, 1., 30.));
    for (float i = 1.; i <= iterations_number; i++) {
        uv.x += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1.5 * uv.y);
        uv.y += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1. * uv.x);
    }

    float proportion = clamp(u_proportion, 0., 1.);

    float shape = 0.;
    float mixer = 0.;
    if (u_shape < .5) {
      vec2 checks_shape_uv = uv * (.5 + 3.5 * u_shapeScale);
      shape = .5 + .5 * sin(checks_shape_uv.x) * cos(checks_shape_uv.y);
      mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);
    } else if (u_shape < 1.5) {
      vec2 stripes_shape_uv = uv * (.25 + 3. * u_shapeScale);
      float f = fract(stripes_shape_uv.y);
      shape = smoothstep(.0, .55, f) * smoothstep(1., .45, f);
      mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);
    } else {
      float sh = 1. - uv.y;
      sh -= .5;
      sh /= (noise_scale * u_resolution.y);
      sh += .5;
      float shape_scaling = .2 * (1. - u_shapeScale);
      shape = smoothstep(.45 - shape_scaling, .55 + shape_scaling, sh + .3 * (proportion - .5));
      mixer = shape;
    }

    vec4 color_mix = blend_colors(u_color1, u_color2, u_color3, mixer, 1. - clamp(u_softness, 0., 1.), .01 + .01 * u_scale);

    fragColor = vec4(color_mix.rgb, color_mix.a);
}
`;

export default AnimatedGradient;
