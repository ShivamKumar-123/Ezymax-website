/**
 * `threejs-components` ships no type declarations. Declared here with the real
 * shape rather than silenced with `any` (hard rule #6).
 *
 * The `cursors/*` builds inline their own three.js, so nothing here refers to
 * the `three` package — it is deliberately not a dependency.
 */
declare module "threejs-components/build/cursors/tubes1.min.js" {
  export interface TubesLightsOptions {
    intensity?: number;
    colors?: string[];
  }

  export interface TubesOptions {
    colors?: string[];
    lights?: TubesLightsOptions;
  }

  export interface TubesCursorOptions {
    tubes?: TubesOptions;
    bloom?: { strength?: number; radius?: number; threshold?: number };
    sleepRadiusX?: number;
    sleepRadiusY?: number;
    sleepTimeScale1?: number;
    sleepTimeScale2?: number;
  }

  export interface TubesCursorApp {
    tubes: {
      setColors: (colors: string[]) => void;
      setLightsColors: (colors: string[]) => void;
    };
    dispose: () => void;
  }

  export default function TubesCursor(
    canvas: HTMLCanvasElement,
    options?: TubesCursorOptions,
  ): TubesCursorApp;
}
