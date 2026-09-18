// Compatibility shim for the vendored MorphCharts renderer: @types/web dropped the
// GPUExtent3DStrict alias that @webgpu/types used to declare.
type GPUExtent3DStrict = GPUExtent3D;
