// Without them a device gets the spec defaults, 256 MB per buffer, which a 4K chain outgrows;
// the failure is asynchronous and silent, the picture just goes black.
const RAISED_LIMITS = [
  "maxBufferSize",
  "maxStorageBufferBindingSize",
  "maxTextureDimension2D",
] as const;

export const hasWebGpu = (): boolean => "gpu" in navigator;

// Several megabytes of inlined shaders, for a feature that starts off.
const loadLibrary = () => import("anime4k-webgpu");
let library: ReturnType<typeof loadLibrary> | null = null;

export function anime4kLibrary(): ReturnType<typeof loadLibrary> {
  library ??= loadLibrary().catch((err: unknown) => {
    library = null;
    throw err;
  });
  return library;
}

// One device for the app: asking for a new one on each start leaks until garbage collection.
let device: Promise<GPUDevice> | null = null;

export function gpuDevice(): Promise<GPUDevice> {
  device ??= (async () => {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter) throw new Error("no WebGPU adapter");
    const limits: Record<string, number> = {};
    for (const name of RAISED_LIMITS) limits[name] = adapter.limits[name];
    const created = await adapter.requestDevice({ requiredLimits: limits });
    void created.lost.then(() => {
      device = null;
    });
    return created;
  })().catch((err: unknown) => {
    device = null;
    throw err;
  });
  return device;
}
