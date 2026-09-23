import type { HlsConfig } from "hls.js";
import { browserStore, estimateFor } from "./bandwidth.ts";

// Generous buffers: the local proxy adds a hop, and a stall costs more than memory does.
const BASE: Partial<HlsConfig> = {
  enableWorker: true,
  lowLatencyMode: false,
  autoStartLoad: true,
  startLevel: -1,
  capLevelToPlayerSize: true,

  // A browser decoding badly drops frames rather than saying so, so hls.js caps the level
  // by itself to get back to a smooth picture. A level picked by hand still wins.
  capLevelOnFPSDrop: true,
  fpsDroppedMonitoringPeriod: 5000,
  fpsDroppedMonitoringThreshold: 0.2,

  maxBufferLength: 60,
  maxMaxBufferLength: 120,
  maxBufferSize: 120 * 1000 * 1000,
  backBufferLength: 30,
  maxBufferHole: 0.5,

  nudgeOffset: 0.1,
  nudgeMaxRetry: 20,
  maxFragLookUpTolerance: 0.25,

  maxStarvationDelay: 4,
  maxLoadingDelay: 4,
  abrEwmaFastVoD: 3,
  abrEwmaSlowVoD: 9,
  highBufferWatchdogPeriod: 1,
  // Slightly under what was measured, so a rise in quality has to be earned.
  abrBandWidthFactor: 0.9,
  abrBandWidthUpFactor: 0.85,

  manifestLoadingTimeOut: 10_000,
  manifestLoadingMaxRetry: 3,
  manifestLoadingRetryDelay: 500,
};

export function hlsConfigFor(host: string | null): Partial<HlsConfig> {
  return { ...BASE, abrEwmaDefaultEstimate: estimateFor(browserStore(), host) };
}
