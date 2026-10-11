/**
 * GPU time per labelled span, from `EXT_disjoint_timer_query_webgl2`.
 * Results arrive a frame or more late; `latest` holds the last complete set.
 */
interface TimerExtension {
  readonly TIME_ELAPSED_EXT: number;
  readonly GPU_DISJOINT_EXT: number;
}

/** GPU time per labelled span from `EXT_disjoint_timer_query_webgl2`; results arrive a frame or more late. */
export class GpuTimer {
  readonly #gl: WebGL2RenderingContext;
  readonly #ext: TimerExtension | null;
  #pending: { label: string; query: WebGLQuery }[][] = [];
  #frame: { label: string; query: WebGLQuery }[] = [];
  #active = false;
  /** Milliseconds per label from the most recent frame whose queries have resolved. */
  latest: Readonly<Record<string, number>> = {};

  constructor(gl: WebGL2RenderingContext) {
    this.#gl = gl;
    this.#ext = gl.getExtension(
      'EXT_disjoint_timer_query_webgl2',
    ) as TimerExtension | null;
  }

  /** Whether the GPU can report timings here. */
  get supported(): boolean {
    return this.#ext !== null;
  }

  /** Measures `run` as `label`. Spans can't nest. */
  measure(label: string, run: () => void): void {
    const ext = this.#ext;
    if (!ext || this.#active) {
      run();
      return;
    }
    const gl = this.#gl;
    const query = gl.createQuery();
    if (!query) {
      run();
      return;
    }
    this.#active = true;
    gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
    try {
      run();
    } finally {
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      this.#active = false;
    }
    this.#frame.push({ label, query });
  }

  /** Closes the frame and collects frames whose results are ready. */
  endFrame(): void {
    if (this.#frame.length) this.#pending.push(this.#frame);
    this.#frame = [];
    const ext = this.#ext;
    if (!ext) return;
    const gl = this.#gl;
    const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT) as boolean;
    while (this.#pending.length) {
      const frame = this.#pending[0]!;
      const ready = frame.every(({ query }) =>
        gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE),
      );
      if (!ready && !disjoint) break;
      this.#pending.shift();
      if (!disjoint) {
        const result: Record<string, number> = {};
        for (const { label, query } of frame)
          result[label] =
            (result[label] ?? 0) +
            (gl.getQueryParameter(query, gl.QUERY_RESULT) as number) / 1e6;
        this.latest = result;
      }
      for (const { query } of frame) gl.deleteQuery(query);
    }
    // Don't let unresolved frames pile up if the GPU stalls.
    while (this.#pending.length > 4)
      for (const { query } of this.#pending.shift()!) gl.deleteQuery(query);
  }

  /** Deletes the timer's outstanding queries. */
  dispose(): void {
    for (const frame of [...this.#pending, this.#frame])
      for (const { query } of frame) this.#gl.deleteQuery(query);
    this.#pending = [];
    this.#frame = [];
  }
}
