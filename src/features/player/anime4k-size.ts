export type Size = { width: number; height: number };

const SCALE = 2;
const MAX_OUTPUT: Size = { width: 3840, height: 2160 };

// The presets only double: any other ratio doubles then blurs back down, which comes out
// softer than the source. Past 4K the cost explodes for nothing, so the size stays.
export function upscaleTarget(base: Size): Size {
  const fits = base.width * SCALE <= MAX_OUTPUT.width && base.height * SCALE <= MAX_OUTPUT.height;
  const scale = fits ? SCALE : 1;
  return { width: base.width * scale, height: base.height * scale };
}

// The chain is built for the largest frame seen and only grows: a lower variant is stretched
// up to it, so a dip in adaptive bitrate does not tear down a cascade of textures.
export function grownBase(base: Size, frame: Size): Size | null {
  if (frame.width <= base.width && frame.height <= base.height) return null;
  return {
    width: Math.max(base.width, frame.width),
    height: Math.max(base.height, frame.height),
  };
}
