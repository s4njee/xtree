// The part of HoloCSS's three.js bridge the fixture uses (aliased to its source in vite.config.ts).
declare module '@holocss/three' {
  import type { Camera, Scene, WebGLRenderer } from 'three';
  export interface Stage {
    readonly canvas: HTMLCanvasElement;
    readonly renderer: WebGLRenderer;
    readonly lost: boolean;
    own<T extends { dispose(): void }>(resource: T): T;
    render(scene: Scene, camera: Camera): boolean;
    destroy(): void;
  }
  export function createStage(
    element: HTMLElement,
    options?: { placement?: 'overlay' | 'inside' },
  ): Promise<Stage | undefined>;
  export interface SceneContext {
    readonly stage: Stage;
  }
  export interface SceneView {
    readonly camera: Camera;
  }
  export interface SceneController {
    readonly stage: Stage;
    progress: number;
    destroy(): void;
  }
  export function scene(
    element: HTMLElement,
    build: (context: SceneContext) => SceneView,
  ): Promise<SceneController | undefined>;
  export interface ProgressControl {
    progress: number;
    finish(): void;
  }
  export function transition3d(
    from: HTMLElement | ImageBitmap | OffscreenCanvas,
    to: HTMLElement | ImageBitmap | OffscreenCanvas,
    effect: {
      readonly name: string;
      readonly fallback: string;
      readonly fragment: string;
    },
    options: {
      target: HTMLElement;
      update(): void;
      driver?(control: ProgressControl): void | (() => void);
    },
  ): Promise<{ status: string }>;
}

declare module '@holocss/runtime' {
  export function motionAllowed(element: Element): boolean;
  export function watchMotion(
    element: Element,
    callback: (allowed: boolean) => void,
  ): () => void;
}

declare module '@holocss-src/theme/registry' {
  export const builtinThemes: readonly string[];
}

declare module '*.css?inline' {
  const css: string;
  export default css;
}

declare module '@holocss-src/three/scenes/gradient' {
  import type { SceneContext, SceneView } from '@holocss/three';
  export const gradient: (context: SceneContext) => SceneView;
}
