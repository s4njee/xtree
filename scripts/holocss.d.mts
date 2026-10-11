/** Directory of the HoloCSS checkout (HOLOCSS_DIR or .cache/holocss). */
export function holocssDir(): string;
/** Fetches the pinned HoloCSS source if needed and returns its directory. */
export function ensureHolocss(): string;
