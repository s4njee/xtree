// The part of HoloCSS's three.js bridge the fixture uses (aliased to its source in vite.config.ts).
declare module '@holocss/three' {
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
