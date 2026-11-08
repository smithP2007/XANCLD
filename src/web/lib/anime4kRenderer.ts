/**
 * anime4kRenderer — a cancellable WebGPU video renderer wrapping the
 * `anime4k-webgpu` preset pipelines (Mode A / AA / B / BB / C / CA from
 * bloc97's Anime4K, the same chains animex.one exposes).
 *
 * Why a custom loop instead of the package's `render()` helper:
 *   the package's helper registers a self-perpetuating
 *   `requestVideoFrameCallback` and offers NO way to stop it, no way to
 *   swap presets without leaking a GPUDevice, and it skips the frame copy
 *   while paused (canvas goes stale/black on seek-while-paused). This
 *   module reimplements the ~40-line loop with:
 *     - a `cancelled` flag + GPUDevice.destroy() for a hard, synchronous
 *       teardown ("safely restarts the GPU renderer — playback is never
 *       interrupted": the <video> element itself is never touched),
 *     - an always-copy loop so seeks / re-decodes while paused repaint,
 *     - canvas sized at a fixed supersampled multiple of the video's
 *       native resolution (no rebuilds when the window resizes — the
 *       browser scales the canvas buffer exactly like object-contain).
 *
 * The heavy package (~3.5 MB of WGSL) is dynamically imported on first
 * enable, so it code-splits out of the main bundle.
 */

import type { Anime4KPipeline } from "anime4k-webgpu";

export type Anime4KPresetId = "mode-a" | "mode-aa" | "mode-b" | "mode-bb" | "mode-c" | "mode-ca";

export interface Anime4KPresetInfo {
  id: Anime4KPresetId;
  label: string;
  desc: string;
}

export const ANIME4K_PRESETS: Anime4KPresetInfo[] = [
  { id: "mode-a",   label: "Mode A",   desc: "Restore (light) + Upscale — balanced, fastest CNN chain" },
  { id: "mode-aa",  label: "Mode A+A", desc: "Double Mode A — heavier restore for blurry sources" },
  { id: "mode-b",   label: "Mode B",   desc: "Restore (medium) + Downscale/Upscale — sharper lines" },
  { id: "mode-bb",  label: "Mode B+B", desc: "Double Mode B — strongest deblur, most GPU-heavy" },
  { id: "mode-c",   label: "Mode C",   desc: "Denoise + Upscale — best for noisy/bitstarved streams" },
  { id: "mode-ca",  label: "Mode C+A", desc: "Denoise then Mode A — denoise + balanced restore" },
];

/** Same GPU shader modules the package's own renderer binds (fullscreen quad + sample). */
const VERT_WGSL = /* wgsl */ `
struct VertexOutput {
  @builtin(position) Position : vec4<f32>,
  @location(0) fragUV : vec2<f32>,
}

@vertex
fn vert_main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
  const pos = array(
    vec2( 1.0,  1.0),
    vec2( 1.0, -1.0),
    vec2(-1.0, -1.0),
    vec2( 1.0,  1.0),
    vec2(-1.0, -1.0),
    vec2(-1.0,  1.0),
  );

  const uv = array(
    vec2(1.0, 0.0),
    vec2(1.0, 1.0),
    vec2(0.0, 1.0),
    vec2(1.0, 0.0),
    vec2(0.0, 1.0),
    vec2(0.0, 0.0),
  );

  var output : VertexOutput;
  output.Position = vec4(pos[VertexIndex], 0.0, 1.0);
  output.fragUV = uv[VertexIndex];
  return output;
}
`;

const FRAG_WGSL = /* wgsl */ `
@group(0) @binding(1) var mySampler: sampler;
@group(0) @binding(2) var myTexture: texture_2d<f32>;

@fragment
fn main(@location(0) fragUV : vec2f) -> @location(0) vec4f {
  return textureSampleBaseClampToEdge(myTexture, mySampler, fragUV);
}
`;

/** True when this browser exposes WebGPU (toggle is hidden/disabled otherwise). */
export function isWebGPUAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export interface Anime4kSession {
  /** Hard-stops the render loop and releases the GPUDevice. Idempotent. */
  destroy(): void;
}

export interface Anime4kStartOptions {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  preset: Anime4KPresetId;
  /**
   * Supersample factor for the canvas backing store. 2 = render at 2× the
   * video's native resolution, letting the browser downscale to the display
   * (crisp on HiDPI, no rebuild on window resize). Clamped internally.
   */
  scale?: number;
  /** Called once when the device is lost / a GPU error kills the loop. */
  onError?: (message: string) => void;
}

export async function startAnime4k(opts: Anime4kStartOptions): Promise<Anime4kSession> {
  const { video, canvas, preset, onError } = opts;
  if (!isWebGPUAvailable()) throw new Error("WebGPU is not supported in this browser.");

  // Dynamic import → the 3.5 MB shader package lives in its own chunk that
  // is only fetched the first time the user enables the renderer.
  const mod = await import("anime4k-webgpu");

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("No suitable GPU adapter found.");
  const device = await adapter.requestDevice();
  let cancelled = false;
  let stopped = false;

  device.lost.then((info) => {
    if (!stopped) onError?.(`GPU device lost (${info.reason || "unknown"}).`);
  });
  device.onuncapturederror = (e) => {
    if (!stopped) onError?.(e.error.message || "GPU error.");
  };

  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;
  const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
  const scale = Math.min(Math.max(opts.scale ?? Math.max(1, dpr), 1), 2.5);
  const targetW = Math.min(Math.round(vw * scale), 3840);
  const targetH = Math.min(Math.round(vh * scale), 2160);

  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext("webgpu");
  if (!ctx) {
    device.destroy();
    throw new Error("Could not acquire a WebGPU canvas context.");
  }
  const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format: canvasFormat, alphaMode: "premultiplied" });

  // Input texture — rgba16float matches what the CNN shaders expect.
  const inputTexture = device.createTexture({
    size: [vw, vh, 1],
    format: "rgba16float",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const descriptor = {
    device,
    inputTexture,
    nativeDimensions: { width: vw, height: vh },
    targetDimensions: { width: targetW, height: targetH },
  };
  const pipelines: Anime4KPipeline[] = [buildPreset(mod, preset, descriptor)];

  // Final blit pipeline: last pipeline output → canvas.
  const bindGroupLayout = device.createBindGroupLayout({
    label: "xan-anime4k-blit-layout",
    entries: [
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    ],
  });
  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });
  const blitPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module: device.createShaderModule({ code: VERT_WGSL }), entryPoint: "vert_main" },
    fragment: {
      module: device.createShaderModule({ code: FRAG_WGSL }),
      entryPoint: "main",
      targets: [{ format: canvasFormat }],
    },
    primitive: { topology: "triangle-list" },
  });
  const sampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 1, resource: sampler },
      { binding: 2, resource: pipelines[pipelines.length - 1].getOutputTexture().createView() },
    ],
  });

  const renderFrame = () => {
    if (cancelled) return;
    // Always copy — seeks while paused must repaint (the package's own
    // renderer skips the copy when paused, leaving a stale frame).
    try {
      device.queue.copyExternalImageToTexture(
        { source: video },
        { texture: inputTexture },
        [vw, vh],
      );
    } catch {
      // Not enough decoded data yet — the next frame callback will retry.
    }
    const encoder = device.createCommandEncoder();
    for (const p of pipelines) p.pass(encoder);
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: "clear",
        storeOp: "store",
      }],
    });
    pass.setPipeline(blitPipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(6);
    pass.end();
    device.queue.submit([encoder.finish()]);
    // rVFC only fires on newly presented frames — seeks and the very first
    // decoded frame both trigger it, so paused-seek repaints for free.
    video.requestVideoFrameCallback(renderFrame);
  };
  video.requestVideoFrameCallback(renderFrame);

  return {
    destroy() {
      if (stopped) return;
      stopped = true;
      cancelled = true;
      // Destroying the device releases every pipeline + texture at once.
      try { device.destroy(); } catch { /* already lost */ }
      try {
        const webgpuCtx = canvas.getContext("webgpu") as GPUCanvasContext | null;
        webgpuCtx?.unconfigure();
      } catch { /* ignore */ }
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPreset(mod: any, preset: Anime4KPresetId, descriptor: {
  device: GPUDevice;
  inputTexture: GPUTexture;
  nativeDimensions: { width: number; height: number };
  targetDimensions: { width: number; height: number };
}): Anime4KPipeline {
  switch (preset) {
    case "mode-aa": return new mod.ModeAA(descriptor);
    case "mode-b":  return new mod.ModeB(descriptor);
    case "mode-bb": return new mod.ModeBB(descriptor);
    case "mode-c":  return new mod.ModeC(descriptor);
    case "mode-ca": return new mod.ModeCA(descriptor);
    case "mode-a":
    default:        return new mod.ModeA(descriptor);
  }
}
