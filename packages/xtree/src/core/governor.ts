/** Quality tiers an effect can render at. */
export type QualityLevel = 'low' | 'medium' | 'high';

/** Options for the composer's frame-time governor. */
export interface GovernorOptions {
  /** Frame time to hold, in milliseconds. Defaults to 16.7 (60 fps). */
  readonly targetMs?: number;
  /** Lowest resolution scale it may use. Defaults to 0.5. */
  readonly minScale?: number;
  /** Highest resolution scale it may use. Defaults to 1. */
  readonly maxScale?: number;
}

/** What the governor decides: a resolution scale and a quality tier for `auto` effects. */
export interface GovernorState {
  readonly scale: number;
  readonly quality: QualityLevel;
}

const levels: readonly QualityLevel[] = ['low', 'medium', 'high'];

/**
 * Holds a target frame time (X17.3). Each measured frame nudges the
 * resolution scale by the square root of target over measured time (cost
 * grows with pixels, so with the square of the scale), damped so it settles
 * instead of hunting. When the scale reaches its floor it lowers the quality
 * tier of `auto` effects, and when there is headroom at full scale it raises
 * it again, with hysteresis so it doesn't flip back and forth.
 */
export class FrameGovernor {
  readonly targetMs: number;
  readonly minScale: number;
  readonly maxScale: number;
  #scale: number;
  #level = 2;
  #average: number | null = null;
  #cooldown = 0;
  #steady = 0;

  constructor(options: GovernorOptions = {}) {
    this.targetMs = options.targetMs ?? 1000 / 60;
    this.minScale = options.minScale ?? 0.5;
    this.maxScale = options.maxScale ?? 1;
    if (!(this.minScale > 0 && this.minScale <= this.maxScale))
      throw new RangeError('FrameGovernor: need 0 < minScale <= maxScale');
    this.#scale = this.maxScale;
  }

  get state(): GovernorState {
    return { scale: this.#scale, quality: levels[this.#level]! };
  }

  /** Feeds one frame's time, in milliseconds, and returns the new state. */
  update(frameMs: number): GovernorState {
    if (!(frameMs > 0) || !Number.isFinite(frameMs)) return this.state;
    // A short moving average rides out single slow frames.
    this.#average =
      this.#average === null ? frameMs : this.#average * 0.6 + frameMs * 0.4;
    const ratio = this.targetMs / this.#average;
    if (this.#cooldown > 0) {
      this.#cooldown--;
      return this.state;
    }
    // Within 5% of the target: hold. Frame intervals can't show spare time
    // under vsync, so after a steady stretch below full quality it probes up;
    // a probe that misses the target is undone by the next updates.
    if (Math.abs(ratio - 1) < 0.05) {
      if (++this.#steady >= 60) {
        this.#steady = 0;
        if (this.#scale < this.maxScale)
          this.#scale = Math.min(this.maxScale, this.#scale * 1.15);
        else if (this.#level < levels.length - 1) {
          this.#level++;
          this.#scale = this.minScale;
          this.#average = null;
          this.#cooldown = 3;
        }
      }
      return this.state;
    }
    this.#steady = 0;
    const wanted = this.#scale * Math.sqrt(ratio);
    const damped = this.#scale + (wanted - this.#scale) * 0.5;
    if (damped < this.minScale && this.#level > 0) {
      // Out of resolution headroom: drop a quality tier and start over at full scale.
      this.#level--;
      this.#scale = this.maxScale;
      this.#average = null;
      this.#cooldown = 3;
    } else if (
      damped > this.maxScale &&
      ratio > 1.3 &&
      this.#level < levels.length - 1
    ) {
      // Plenty of headroom at full scale: raise a tier, from the bottom of the scale.
      this.#level++;
      this.#scale = this.minScale;
      this.#average = null;
      this.#cooldown = 3;
    } else {
      this.#scale = Math.min(this.maxScale, Math.max(this.minScale, damped));
    }
    return this.state;
  }
}
