declare module '*.glsl' {
  const source: string;
  export default source;
}

/** Package version, injected at build time. */
declare const __XTREE_VERSION__: string;
