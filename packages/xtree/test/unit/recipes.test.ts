import { describe, expect, it } from 'vitest';
import { anamorphic } from '../../src/effects/anamorphic/index.js';
import { bleachBypass } from '../../src/effects/bleach-bypass/index.js';
import { bloom } from '../../src/effects/bloom/index.js';
import { chromaticAberration } from '../../src/effects/chromatic-aberration/index.js';
import { colorBalance } from '../../src/effects/color-balance/index.js';
import { crt } from '../../src/effects/crt/index.js';
import { depthFog } from '../../src/effects/depth-fog/index.js';
import { filmGrain } from '../../src/effects/film-grain/index.js';
import { foilMaterial } from '../../src/effects/foil-material/index.js';
import { fresnelGlow } from '../../src/effects/fresnel-glow/index.js';
import { glitter } from '../../src/effects/glitter/index.js';
import { halation } from '../../src/effects/halation/index.js';
import { holographicFoil } from '../../src/effects/holographic-foil/index.js';
import { hudGrid } from '../../src/effects/hud-grid/index.js';
import { outline } from '../../src/effects/outline/index.js';
import { palette } from '../../src/effects/palette/index.js';
import { scanlines } from '../../src/effects/scanlines/index.js';
import { splitToning } from '../../src/effects/split-toning/index.js';
import { ssao } from '../../src/effects/ssao/index.js';
import { vignette } from '../../src/effects/vignette/index.js';

// The stacks on docs/guide/recipes.md, so a renamed preset or parameter fails here.
describe('recipes (X19.29)', () => {
  it('builds every recipe', () => {
    const stacks = [
      [
        bloom({ preset: 'neon' }),
        splitToning({ preset: 'cyberpunk' }),
        chromaticAberration({ preset: 'subtle' }),
        hudGrid({ preset: 'subtle' }),
        scanlines({ preset: 'subtle' }),
        vignette({ preset: 'cinematic' }),
      ],
      [
        palette({ preset: 'nes', pixelSize: 3 }),
        crt({ preset: 'arcade' }),
        bloom({ preset: 'subtle' }),
      ],
      [
        halation({ preset: 'film' }),
        anamorphic({ preset: 'subtle' }),
        colorBalance({ preset: 'filmic' }),
        bleachBypass({ preset: 'subtleBleach' }),
        filmGrain({ preset: 'fine' }),
        vignette({ preset: 'subtle' }),
      ],
      [
        foilMaterial({ preset: 'card' }),
        fresnelGlow({ preset: 'selected', pulse: 0 }),
        glitter({ preset: 'holo' }),
        bloom({ preset: 'subtle' }),
        holographicFoil({ preset: 'card' }),
      ],
      [
        ssao({ preset: 'contact' }),
        depthFog({ preset: 'haze' }),
        outline(),
        bloom({ preset: 'subtle' }),
      ],
    ];
    expect(stacks.flat()).toHaveLength(24);
    for (const effect of stacks.flat()) effect.dispose();
  });
});
