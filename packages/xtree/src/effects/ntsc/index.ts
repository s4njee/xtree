import { bool, defineEffect, float } from '../../effect/index.js';
import { colorSpaceChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Composite NTSC video: dot crawl, rainbow artifacts and soft color. */
export const ntsc = defineEffect({
  name: 'ntsc',
  meta: {
    title: 'NTSC composite',
    family: 'retro',
    story: 'X7.10',
    description:
      'Sends the image through a simulated composite video signal and back: soft color, crawling dots along edges and rainbow artifacts in fine detail, like a game console on an old TV.',
    related: ['vhs', 'crt', 'scanlines'],
  },
  sampling: 'input',
  chunks: [colorSpaceChunks],
  motion: 'freeze',
  params: {
    artifacts: float({
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Mix between the clean image and the composite decode.',
    }),
    sharpness: float({
      default: 0.4,
      min: 0,
      max: 1,
      step: 0.01,
      description:
        'Luma sharpness; sharper keeps more detail and more dot crawl.',
    }),
    resolution: float({
      default: 640,
      min: 160,
      max: 1280,
      step: 10,
      description: 'Signal samples per line.',
    }),
    dotCrawl: bool({
      default: true,
      description:
        'Alternate the subcarrier phase every frame, so artifacts crawl.',
    }),
  },
  presets: {
    console: { resolution: 320, sharpness: 0.6 },
    soft: { sharpness: 0, resolution: 480 },
    subtle: { artifacts: 0.5 },
    still: { dotCrawl: false },
  },
  fragment,
});
