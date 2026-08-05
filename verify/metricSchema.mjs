/**
 * Canonical machine-readable verification metric schema shared by gates, reports,
 * demo verification, and benchmark collection.
 */
export const VERIFICATION_METRIC_KEYS = Object.freeze([
  'frames',
  'cameraDiagnostics',
  'rendererDiagnostics',
  'terrainDiagnostics',
  'poseDifferences',
  'frameStats',
]);

export const VERIFICATION_FRAME_KEYS = Object.freeze([
  'name',
  'meanLuminance',
  'flatFrameRatio',
  'characterAreaFraction',
  'localLuminanceVariation',
  'edgeDensity',
]);
