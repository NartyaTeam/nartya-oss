import type { Anime4KPipeline } from "anime4k-webgpu";
import type { Anime4kMode } from "./anime4k-modes.ts";
import { grownBase, upscaleTarget, type Size } from "./anime4k-size.ts";
import { gpuDevice, anime4kLibrary } from "./webgpu.ts";

const PRESETS = {
  a: "ModeA",
  b: "ModeB",
  c: "ModeC",
  aa: "ModeAA",
  bb: "ModeBB",
  ca: "ModeCA",
} as const;

const FORMAT_INPUT: GPUTextureFormat = "rgba16float";

const STRETCH_WGSL = `
struct Varying {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vertexMain(@builtin(vertex_index) index: u32) -> Varying {
  let uv = vec2f(f32((index << 1u) & 2u), f32(index & 2u));
  var out: Varying;
  out.position = vec4f(uv * vec2f(2.0, -2.0) + vec2f(-1.0, 1.0), 0.0, 1.0);
  out.uv = uv;
  return out;
}

@group(0) @binding(0) var linearSampler: sampler;
@group(0) @binding(1) var picture: texture_2d<f32>;

@fragment
fn fragmentMain(@location(0) uv: vec2f) -> @location(0) vec4f {
  return textureSampleBaseClampToEdge(picture, linearSampler, uv);
}
`;

// Presets have no destroy(): their textures, one per layer at the target size, are only
// reachable through these fields, and leaving them to the collector piles up 4K chains.
function destroyStage(stage: unknown): void {
  if (typeof stage !== "object" || stage === null) return;
  if ("outputTexture" in stage && stage.outputTexture instanceof GPUTexture) {
    stage.outputTexture.destroy();
  }
  if ("pipelines" in stage && Array.isArray(stage.pipelines)) {
    stage.pipelines.forEach(destroyStage);
  }
}

function drawInto(
  encoder: GPUCommandEncoder,
  view: GPUTextureView,
  pipeline: GPURenderPipeline,
  group: GPUBindGroup,
): void {
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      { view, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: "clear", storeOp: "store" },
    ],
  });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, group);
  pass.draw(3);
  pass.end();
}

// The video keeps decoding and carrying the sound; each frame goes through the chain onto
// a canvas laid over it, and nothing comes back to the CPU.
export function startAnime4k(
  video: HTMLVideoElement,
  host: HTMLElement,
  mode: Anime4kMode,
  onFailure: (err: unknown) => void,
): () => void {
  const canvas = document.createElement("canvas");
  // Above the video and poster, under artplayer's controls; contain matches its letterbox.
  canvas.className = "pointer-events-none absolute inset-0 z-[12] h-full w-full object-contain";
  canvas.style.opacity = "0";
  host.append(canvas);

  const listeners = new AbortController();
  const undo: (() => void)[] = [];
  let stopped = false;
  let frameId: number | null = null;

  const showCanvas = (shown: boolean): void => {
    canvas.style.opacity = shown ? "1" : "0";
    video.style.opacity = shown ? "0" : "";
  };

  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    if (frameId !== null) video.cancelVideoFrameCallback(frameId);
    listeners.abort();
    undo.forEach((step) => step());
    canvas.remove();
    showCanvas(false);
  };

  const fail = (err: unknown): void => {
    if (stopped) return;
    stop();
    onFailure(err);
  };

  const run = async (): Promise<void> => {
    const [presets, gpu] = await Promise.all([anime4kLibrary(), gpuDevice()]);
    if (stopped) return;

    gpu.onuncapturederror = (event) => fail(event.error);
    undo.push(() => {
      gpu.onuncapturederror = null;
    });
    void gpu.lost.then((info) => fail(new Error(info.message)));

    if (!video.videoWidth) {
      await new Promise<void>((resolve) => {
        video.addEventListener("loadeddata", () => resolve(), { signal: listeners.signal });
        listeners.signal.addEventListener("abort", () => resolve());
      });
    }
    if (stopped) return;

    const context = canvas.getContext("webgpu");
    if (!context) throw new Error("no WebGPU canvas context");
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device: gpu, format, alphaMode: "opaque" });

    const module = gpu.createShaderModule({ code: STRETCH_WGSL });
    const pipelineTo = (target: GPUTextureFormat): GPURenderPipeline =>
      gpu.createRenderPipeline({
        layout: "auto",
        vertex: { module, entryPoint: "vertexMain" },
        fragment: { module, entryPoint: "fragmentMain", targets: [{ format: target }] },
      });
    const toInput = pipelineTo(FORMAT_INPUT);
    const toCanvas = pipelineTo(format);
    const sampler = gpu.createSampler({ magFilter: "linear", minFilter: "linear" });
    const groupFor = (pipeline: GPURenderPipeline, texture: GPUTexture): GPUBindGroup =>
      gpu.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: texture.createView() },
        ],
      });

    let frame: Size = { width: 0, height: 0 };
    let base: Size = { width: 0, height: 0 };
    let source: GPUTexture | null = null;
    let input: GPUTexture | null = null;
    let chain: Anime4KPipeline | null = null;
    let sourceGroup: GPUBindGroup | null = null;
    let outputGroup: GPUBindGroup | null = null;

    undo.push(() => {
      destroyStage(chain);
      source?.destroy();
      input?.destroy();
      context.unconfigure();
    });

    // Follows every variant the adaptive bitrate picks; small, and cheap to reallocate.
    const takeFrame = (size: Size): void => {
      frame = size;
      source?.destroy();
      const texture = gpu.createTexture({
        size: [size.width, size.height],
        format: FORMAT_INPUT,
        // copyExternalImageToTexture refuses a destination without RENDER_ATTACHMENT, silently.
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
      });
      sourceGroup = groupFor(toInput, texture);
      source = texture;
    };

    const build = (size: Size): void => {
      base = size;
      destroyStage(chain);
      input?.destroy();
      const texture = gpu.createTexture({
        size: [size.width, size.height],
        format: FORMAT_INPUT,
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
      });
      const Preset = presets[PRESETS[mode]];
      const built = new Preset({
        device: gpu,
        inputTexture: texture,
        nativeDimensions: size,
        targetDimensions: upscaleTarget(size),
      });
      const output = built.getOutputTexture();
      canvas.width = output.width;
      canvas.height = output.height;
      outputGroup = groupFor(toCanvas, output);
      input = texture;
      chain = built;
    };

    const render = (): void => {
      if (!source || !input || !chain || !sourceGroup || !outputGroup) return;
      gpu.queue.copyExternalImageToTexture({ source: video }, { texture: source }, [
        frame.width,
        frame.height,
      ]);
      const encoder = gpu.createCommandEncoder();
      drawInto(encoder, input.createView(), toInput, sourceGroup);
      chain.pass(encoder);
      drawInto(encoder, context.getCurrentTexture().createView(), toCanvas, outputGroup);
      gpu.queue.submit([encoder.finish()]);
      // Only once a frame is really drawn: hiding the video earlier flashes black.
      showCanvas(true);
    };

    const arm = (): void => {
      if (stopped || frameId !== null) return;
      frameId = video.requestVideoFrameCallback(onFrame);
    };

    // The presented frame's own size: videoWidth lags a variant switch by a few frames, and
    // copying with it crops the new frame and stretches the corner.
    const present = (size: Size): boolean => {
      try {
        if (size.width !== frame.width || size.height !== frame.height) {
          takeFrame(size);
          const grown = grownBase(base, size);
          if (grown) build(grown);
        }
        render();
        return true;
      } catch (err) {
        // A video served without CORS taints the frame and the GPU refuses to read it.
        fail(err);
        return false;
      }
    };

    function onFrame(_now: number, meta: VideoFrameCallbackMetadata): void {
      frameId = null;
      if (present({ width: meta.width, height: meta.height })) arm();
    }

    // A long seek back replaces the media segments, and Chromium may drop the pending
    // callback: the canvas would freeze on the last frame while the sound carries on.
    video.addEventListener(
      "seeking",
      () => {
        if (frameId !== null) video.cancelVideoFrameCallback(frameId);
        frameId = null;
        showCanvas(false);
      },
      { signal: listeners.signal },
    );
    video.addEventListener(
      "seeked",
      () => {
        // A paused video seeks without presenting the frame to the callback.
        const size = { width: video.videoWidth, height: video.videoHeight };
        if (video.paused && !present(size)) return;
        arm();
      },
      { signal: listeners.signal },
    );

    const first = { width: video.videoWidth, height: video.videoHeight };
    takeFrame(first);
    build(first);
    // A paused video presents no frame: draw the one on screen now.
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) render();
    arm();
  };

  run().catch(fail);
  return stop;
}
