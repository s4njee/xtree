// The part of HoloCSS's runtime this entry uses. HoloCSS is an optional peer
// that isn't on npm yet; when it is installed its own types take over.
declare module '@mk7s/holocss/runtime' {
  export function motionAllowed(element: Element): boolean;
  export function watchMotion(
    element: Element,
    callback: (allowed: boolean) => void,
  ): () => void;
}
