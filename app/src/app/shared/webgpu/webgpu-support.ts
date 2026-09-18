/** True when the browser exposes WebGPU (`navigator.gpu`). MorphCharts path tracing needs it. */
export function isWebGpuAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator && !!(navigator as { gpu?: unknown }).gpu;
}
