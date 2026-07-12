import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  input,
} from '@angular/core';

// Neighbour lookups go through a spatial grid (see buildGrid), so this is O(n)
// per frame rather than O(n²) — raising it is safe, but past a few hundred the
// cost is the drawing, not the maths.
const NODE_COUNT = 54;

// Max distance at which two nodes still draw a connecting line, and the alpha of
// that line at distance 0 (fading linearly to 0 at CONNECT_DIST).
const CONNECT_DIST = 165;
const MAX_LINE_ALPHA = 0.45;

// Base drift speed (px/frame). Scaled per-node by depth, so the field has
// parallax instead of moving as one flat sheet.
const NODE_SPEED = 0.12;

// --- Signal propagation ---------------------------------------------------
// A cascade starts on one node and spreads outward hop by hop, which is what
// makes this read as a network firing rather than a static starfield.
const CASCADE_INTERVAL_MS = 2600; // gap between new cascades
const SIGNAL_SPEED = 0.34; // fraction of an edge traversed per frame (~3 frames/100px)
const CASCADE_HOPS = 4; // how many hops outward a cascade travels
const CASCADE_FANOUT = 2; // max neighbours a firing node forwards to
const FLASH_MS = 900; // how long a node stays lit after a signal reaches it
const MAX_SIGNALS = 40; // hard ceiling; a runaway cascade can't tank the frame

// Padding added around the avoided element's rect before nodes start steering.
const KEEP_OUT_MARGIN = 28;

// devicePixelRatio is capped: on a 3x phone the extra pixels cost real time and
// buy nothing for 1px lines at 30% alpha.
const MAX_DPR = 2;

// --- Cursor ---------------------------------------------------------------
// The network reaches toward the pointer: nearby nodes wire up to it and drift
// gently its way. Costs one extra neighbour scan per frame.
const CURSOR_DIST = 190;
const CURSOR_PULL = 0.0016;

type IconKey =
  | 'paperclip'
  | 'graduation-cap'
  | 'briefcase'
  | 'map-pin'
  | 'code'
  | 'mail'
  | 'bookmark'
  | 'link';

type IconOp =
  | { op: 'path'; d: string }
  | { op: 'circle'; cx: number; cy: number; r: number }
  | { op: 'rect'; x: number; y: number; w: number; h: number; rx: number }
  | { op: 'polyline'; points: [number, number][] };

/**
 * Path/shape data cloned from the shared IconComponent's inline SVGs (Lucide-style
 * outlines, 24x24 viewBox, stroke-only). Canvas has no equivalent of an SVG
 * <circle>/<rect>/<polyline> element — Path2D only parses `d` path syntax — so
 * those three shape kinds are drawn with plain canvas primitives instead.
 */
const ICON_OPS: Record<IconKey, IconOp[]> = {
  paperclip: [
    { op: 'path', d: 'M13.234 20.252 21 12.3a2.5 2.5 0 0 0-3.536-3.536L8.464 17.77a4.5 4.5 0 0 0 6.364 6.364' },
    { op: 'path', d: 'm21 12.3-9.9 9.9a5.5 5.5 0 0 1-7.78-7.78l8.49-8.49' },
  ],
  'graduation-cap': [
    { op: 'path', d: 'M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z' },
    { op: 'path', d: 'M22 10v6' },
    { op: 'path', d: 'M6 12.5V16a6 3 0 0 0 12 0v-3.5' },
  ],
  briefcase: [
    { op: 'path', d: 'M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16' },
    { op: 'rect', x: 2, y: 6, w: 20, h: 14, rx: 2 },
  ],
  'map-pin': [
    { op: 'path', d: 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0' },
    { op: 'circle', cx: 12, cy: 10, r: 3 },
  ],
  code: [
    { op: 'polyline', points: [[16, 18], [22, 12], [16, 6]] },
    { op: 'polyline', points: [[8, 6], [2, 12], [8, 18]] },
  ],
  mail: [
    { op: 'path', d: 'm22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7' },
    { op: 'rect', x: 2, y: 4, w: 20, h: 16, rx: 2 },
  ],
  bookmark: [
    { op: 'path', d: 'm19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z' },
  ],
  link: [
    { op: 'path', d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' },
    { op: 'path', d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' },
  ],
};

// Path2D parsing is cheap, but there's no reason to re-parse the same `d` string
// every frame for every icon node — memoise by string.
const path2DCache = new Map<string, Path2D>();
function getPath2D(d: string): Path2D {
  let cached = path2DCache.get(d);
  if (!cached) {
    cached = new Path2D(d);
    path2DCache.set(d, cached);
  }
  return cached;
}

interface NetNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 0 = far, 1 = near. Drives size, alpha and drift speed, giving the field depth. */
  z: number;
  isIcon: boolean;
  iconKey?: IconKey;
  /** Timestamp this node last received a signal; drives its flash + glow. */
  firedAt: number;
}

/** A signal in flight along the edge from -> to. */
interface Signal {
  from: number;
  to: number;
  /** Progress along the edge, 0..1. */
  t: number;
  /** Remaining hops; at 0 the cascade stops rather than spreading forever. */
  hops: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const INDIGO = '79, 70, 229'; // #4f46e5
const INDIGO_LIGHT = '129, 140, 248'; // #818cf8

function drawIcon(ctx: CanvasRenderingContext2D, key: IconKey, x: number, y: number, sizePx: number, alpha: number): void {
  const scale = sizePx / 24; // source icons are drawn on a 24x24 viewBox
  ctx.save();
  ctx.translate(x - sizePx / 2, y - sizePx / 2);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 2; // matches the source icons' stroke-width in their own 24x24 space
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const op of ICON_OPS[key]) {
    if (op.op === 'path') {
      ctx.stroke(getPath2D(op.d));
    } else if (op.op === 'circle') {
      ctx.beginPath();
      ctx.arc(op.cx, op.cy, op.r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (op.op === 'rect') {
      ctx.beginPath();
      ctx.roundRect(op.x, op.y, op.w, op.h, op.rx);
      ctx.stroke();
    } else if (op.op === 'polyline') {
      ctx.beginPath();
      ctx.moveTo(op.points[0][0], op.points[0][1]);
      for (let i = 1; i < op.points.length; i++) ctx.lineTo(op.points[i][0], op.points[i][1]);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * Neural-network background: a field of drifting nodes wired by proximity, with
 * signals firing across it in cascades — one node fires, the pulse travels the
 * edge, the receiving node lights up and forwards it to its own neighbours. The
 * propagation is the point; a static web of dots and lines is just a starfield.
 *
 * - Nodes carry a depth (z) that drives size, alpha and drift speed, so the field
 *   has parallax rather than moving as one flat sheet.
 * - 8 of them render as faint outline icons instead of plain dots.
 * - `avoidSelector` names an element nodes steer around rather than drift behind
 *   (the auth card). Pass null to disable.
 *
 * Cheap by construction: neighbour lookups go through a spatial grid (O(n), not
 * O(n²)), devicePixelRatio is capped, and the RAF loop is suspended entirely
 * while the tab is hidden or the canvas is scrolled out of view.
 *
 * Respects prefers-reduced-motion: paints one static frame and starts no RAF loop
 * and no cascades at all — not a slowed-down version.
 */
@Component({
  selector: 'app-constellation-bg',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas class="constellation-canvas" aria-hidden="true"></canvas>`,
  styles: [
    `
      :host {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
        z-index: 0;
        display: block;
      }

      .constellation-canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        display: block;
      }
    `,
  ],
})
export class ConstellationBgComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;

  /**
   * CSS selector, resolved against this component's parent element, naming a box
   * nodes should steer around instead of drifting behind (e.g. '.auth-card').
   * Pass null to skip the keep-out zone entirely.
   */
  readonly avoidSelector = input<string | null>('.auth-card');

  private ctx!: CanvasRenderingContext2D;
  private nodes: NetNode[] = [];
  private signals: Signal[] = [];
  private width = 0;
  private height = 0;
  private rafId: number | null = null;
  private resizeObserver?: ResizeObserver;
  private intersectionObserver?: IntersectionObserver;
  private reducedMotionQuery?: MediaQueryList;
  private avoidRect: Rect | null = null;
  private nextCascadeAt = 0;

  /** Both must be true for the loop to run; either going false suspends it. */
  private visible = true;
  private onScreen = true;

  /** Pointer position in canvas space, or null when it's off the host. */
  private cursor: { x: number; y: number } | null = null;

  // Spatial grid, rebuilt each frame: cell size = CONNECT_DIST, so a node's
  // possible neighbours are always within its own cell plus the 8 around it.
  private grid = new Map<number, number[]>();
  private cols = 0;

  private readonly onReducedMotionChange = (): void => this.restart();
  private readonly onVisibilityChange = (): void => {
    this.visible = document.visibilityState === 'visible';
    this.syncLoop();
  };

  // The canvas is pointer-events:none (it must never eat clicks), so the move is
  // tracked on the window and converted into canvas space here.
  private readonly onPointerMove = (e: PointerEvent): void => {
    const box = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = e.clientX - box.left;
    const y = e.clientY - box.top;
    this.cursor = x < 0 || y < 0 || x > box.width || y > box.height ? null : { x, y };
  };

  private readonly onPointerLeave = (): void => {
    this.cursor = null;
  };

  ngAfterViewInit(): void {
    this.ctx = this.canvasRef.nativeElement.getContext('2d')!;
    this.measureAndResize();
    this.seedNodes();

    // Layout can change without a window resize (font load reflow, sidebar
    // toggles) — watch the actual host box, not just the window.
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.canvasRef.nativeElement.parentElement ?? this.canvasRef.nativeElement);

    // Don't burn frames animating a canvas that's scrolled off-screen.
    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        this.onScreen = entry.isIntersecting;
        this.syncLoop();
      },
      { threshold: 0 },
    );
    this.intersectionObserver.observe(this.canvasRef.nativeElement);

    this.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotionQuery.addEventListener('change', this.onReducedMotionChange);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    // Skip pointer wiring entirely under reduced motion — the frame is static, so
    // a cursor-reactive network would contradict that.
    if (!this.reducedMotion) {
      window.addEventListener('pointermove', this.onPointerMove, { passive: true });
      document.addEventListener('pointerleave', this.onPointerLeave);
    }

    this.start();
  }

  ngOnDestroy(): void {
    this.stopLoop();
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.reducedMotionQuery?.removeEventListener('change', this.onReducedMotionChange);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerleave', this.onPointerLeave);
  }

  private get reducedMotion(): boolean {
    return this.reducedMotionQuery?.matches ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private start(): void {
    if (this.reducedMotion) {
      // One frame, no RAF, no cascades — nodes hold their seeded positions.
      this.render(performance.now());
      return;
    }
    this.nextCascadeAt = performance.now() + CASCADE_INTERVAL_MS;
    this.syncLoop();
  }

  private restart(): void {
    this.stopLoop();
    this.start();
  }

  /** Runs the loop only when it can actually be seen. */
  private syncLoop(): void {
    if (this.reducedMotion) return;
    const shouldRun = this.visible && this.onScreen;
    if (shouldRun && this.rafId === null) {
      this.rafId = requestAnimationFrame(this.loop);
    } else if (!shouldRun) {
      this.stopLoop();
    }
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private onResize(): void {
    const oldW = this.width;
    const oldH = this.height;
    this.measureAndResize();
    // Rescale positions proportionally rather than re-randomising, so a resize
    // redistributes the field into the new bounds without a jarring reset.
    if (oldW > 0 && oldH > 0) {
      const sx = this.width / oldW;
      const sy = this.height / oldH;
      for (const n of this.nodes) {
        n.x *= sx;
        n.y *= sy;
      }
    }
    if (this.reducedMotion) this.render(performance.now());
  }

  private measureAndResize(): void {
    const canvas = this.canvasRef.nativeElement;
    const parent = canvas.parentElement ?? canvas;
    const rect = parent.getBoundingClientRect();
    this.width = Math.max(1, Math.round(rect.width));
    this.height = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.width = this.width * dpr;
    canvas.height = this.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cols = Math.max(1, Math.ceil(this.width / CONNECT_DIST));
    this.updateAvoidRect();
  }

  private updateAvoidRect(): void {
    this.avoidRect = null;
    const selector = this.avoidSelector();
    if (!selector) return;

    const canvas = this.canvasRef.nativeElement;
    const host = canvas.parentElement ?? canvas;
    const target = host.querySelector(selector) as HTMLElement | null;
    if (!target) return;

    const hostBox = host.getBoundingClientRect();
    const box = target.getBoundingClientRect();
    this.avoidRect = {
      x: box.left - hostBox.left - KEEP_OUT_MARGIN,
      y: box.top - hostBox.top - KEEP_OUT_MARGIN,
      w: box.width + KEEP_OUT_MARGIN * 2,
      h: box.height + KEEP_OUT_MARGIN * 2,
    };
  }

  private seedNodes(): void {
    const iconKeys = Object.keys(ICON_OPS) as IconKey[]; // exactly 8
    this.signals = [];
    this.nodes = Array.from({ length: NODE_COUNT }, (_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const z = Math.random();
      // Nearer nodes drift faster — the parallax cue that gives the field depth.
      const speed = NODE_SPEED * (0.55 + z * 0.75);
      return {
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        z,
        isIcon: i < iconKeys.length,
        iconKey: i < iconKeys.length ? iconKeys[i] : undefined,
        firedAt: -Infinity,
      };
    });
  }

  private readonly loop = (): void => {
    const now = performance.now();
    this.step(now);
    this.render(now);
    this.rafId = requestAnimationFrame(this.loop);
  };

  // --- Simulation ---------------------------------------------------------

  private step(now: number): void {
    for (const n of this.nodes) {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > this.width) {
        n.vx *= -1;
        n.x = Math.max(0, Math.min(this.width, n.x));
      }
      if (n.y < 0 || n.y > this.height) {
        n.vy *= -1;
        n.y = Math.max(0, Math.min(this.height, n.y));
      }
      this.steerAroundAvoidRect(n);
      this.pullTowardCursor(n);
    }

    this.buildGrid();
    this.advanceSignals(now);

    if (now >= this.nextCascadeAt) {
      this.startCascade(now);
      this.nextCascadeAt = now + CASCADE_INTERVAL_MS;
    }
  }

  /** Buckets nodes by CONNECT_DIST-sized cell, so neighbour queries only scan the
   *  3x3 cells around a node instead of every other node. */
  private buildGrid(): void {
    this.grid.clear();
    for (let i = 0; i < this.nodes.length; i++) {
      const key = this.cellKey(this.nodes[i].x, this.nodes[i].y);
      const bucket = this.grid.get(key);
      if (bucket) bucket.push(i);
      else this.grid.set(key, [i]);
    }
  }

  private cellKey(x: number, y: number): number {
    const cx = Math.floor(x / CONNECT_DIST);
    const cy = Math.floor(y / CONNECT_DIST);
    return cy * this.cols + cx;
  }

  /** Indices of nodes within CONNECT_DIST of node i (excluding i itself). */
  private neighboursOf(i: number, out: number[]): number[] {
    out.length = 0;
    const node = this.nodes[i];
    const cx = Math.floor(node.x / CONNECT_DIST);
    const cy = Math.floor(node.y / CONNECT_DIST);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const bucket = this.grid.get((cy + dy) * this.cols + (cx + dx));
        if (!bucket) continue;
        for (const j of bucket) {
          if (j === i) continue;
          if (Math.hypot(node.x - this.nodes[j].x, node.y - this.nodes[j].y) < CONNECT_DIST) out.push(j);
        }
      }
    }
    return out;
  }

  private readonly neighbourScratch: number[] = [];

  /** Kicks off a cascade from a node that actually has neighbours to fire into. */
  private startCascade(now: number): void {
    for (let attempt = 0; attempt < 8; attempt++) {
      const i = Math.floor(Math.random() * this.nodes.length);
      const neighbours = this.neighboursOf(i, this.neighbourScratch);
      if (neighbours.length === 0) continue;
      this.nodes[i].firedAt = now;
      this.emitFrom(i, -1, CASCADE_HOPS, neighbours);
      return;
    }
  }

  /** Sends signals from node `i` to up to CASCADE_FANOUT of its neighbours,
   *  skipping the one it just came from so a cascade spreads outward. */
  private emitFrom(i: number, cameFrom: number, hops: number, neighbours: number[]): void {
    if (hops <= 0) return;
    let sent = 0;
    // Walk from a random offset so the same neighbour isn't always favoured.
    const offset = Math.floor(Math.random() * neighbours.length);
    for (let k = 0; k < neighbours.length && sent < CASCADE_FANOUT; k++) {
      const j = neighbours[(k + offset) % neighbours.length];
      if (j === cameFrom) continue;
      if (this.signals.length >= MAX_SIGNALS) return;
      this.signals.push({ from: i, to: j, t: 0, hops: hops - 1 });
      sent++;
    }
  }

  private advanceSignals(now: number): void {
    for (let s = this.signals.length - 1; s >= 0; s--) {
      const sig = this.signals[s];
      const a = this.nodes[sig.from];
      const b = this.nodes[sig.to];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);

      // Nodes drift while a signal is in flight; if the edge stretches past the
      // connect radius the link is broken, so drop the signal with it.
      if (dist > CONNECT_DIST * 1.35) {
        this.signals.splice(s, 1);
        continue;
      }

      sig.t += SIGNAL_SPEED / Math.max(24, dist);
      if (sig.t < 1) continue;

      // Arrived: light the receiving node up and forward the cascade onward.
      b.firedAt = now;
      this.signals.splice(s, 1);
      if (sig.hops > 0) {
        this.emitFrom(sig.to, sig.from, sig.hops, this.neighboursOf(sig.to, this.neighbourScratch));
      }
    }
  }

  /** Nodes within reach of the pointer lean toward it — a light touch, capped by
   *  the same max speed as everything else so the field never lurches. */
  private pullTowardCursor(n: NetNode): void {
    const c = this.cursor;
    if (!c) return;
    const dx = c.x - n.x;
    const dy = c.y - n.y;
    const d = Math.hypot(dx, dy);
    if (d > CURSOR_DIST || d < 1) return;

    const strength = (1 - d / CURSOR_DIST) * CURSOR_PULL * (0.5 + n.z);
    n.vx += dx * strength;
    n.vy += dy * strength;

    const speed = Math.hypot(n.vx, n.vy);
    const maxSpeed = NODE_SPEED * (0.55 + n.z * 0.75) * 1.9;
    if (speed > maxSpeed) {
      n.vx = (n.vx / speed) * maxSpeed;
      n.vy = (n.vy / speed) * maxSpeed;
    }
  }

  /** Nudges velocity away from the keep-out zone's centre while a node is inside
   *  it, so it curves back out smoothly instead of clipping through or stopping
   *  dead at the card's edge. */
  private steerAroundAvoidRect(n: NetNode): void {
    const r = this.avoidRect;
    if (!r) return;
    if (n.x < r.x || n.x > r.x + r.w || n.y < r.y || n.y > r.y + r.h) return;

    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const dx = n.x - cx;
    const dy = n.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    n.vx += (dx / len) * 0.02;
    n.vy += (dy / len) * 0.02;

    // Bound the speed so repeated nudges can't accelerate a node indefinitely.
    const speed = Math.hypot(n.vx, n.vy);
    const maxSpeed = NODE_SPEED * (0.55 + n.z * 0.75) * 1.6;
    if (speed > maxSpeed) {
      n.vx = (n.vx / speed) * maxSpeed;
      n.vy = (n.vy / speed) * maxSpeed;
    }
  }

  // --- Drawing ------------------------------------------------------------

  /** 1 right after firing, decaying to 0 over FLASH_MS. */
  private flashOf(n: NetNode, now: number): number {
    const age = now - n.firedAt;
    if (age < 0 || age > FLASH_MS) return 0;
    const t = 1 - age / FLASH_MS;
    return t * t; // ease out — a sharp strike that lingers briefly
  }

  private render(now: number): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // In reduced-motion the grid is never built by step(), so build it once here
    // — the static frame still needs neighbours to know which lines to draw.
    if (this.reducedMotion) this.buildGrid();

    this.drawEdges(now);
    this.drawCursorLinks();
    this.drawSignals();
    this.drawNodes(now);

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  private drawEdges(now: number): void {
    const ctx = this.ctx;
    const neighbours: number[] = [];

    for (let i = 0; i < this.nodes.length; i++) {
      const a = this.nodes[i];
      this.neighboursOf(i, neighbours);
      for (const j of neighbours) {
        if (j < i) continue; // draw each undirected edge once
        const b = this.nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);

        // Depth: an edge is only as present as its dimmer endpoint.
        const depth = 0.55 + 0.45 * Math.min(a.z, b.z);
        const base = MAX_LINE_ALPHA * (1 - d / CONNECT_DIST) * depth;

        // An edge glows while either end is lit, so the cascade's path is legible.
        const lit = Math.max(this.flashOf(a, now), this.flashOf(b, now));

        ctx.strokeStyle = `rgba(${lit > 0.02 ? INDIGO_LIGHT : INDIGO}, ${base + (0.85 - base) * lit})`;
        ctx.lineWidth = 1.3 + 0.9 * lit;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }

  /** Wires the pointer into the network: every node in range gets a line to the
   *  cursor, brightest when closest. Makes the field feel responsive rather than
   *  like a video playing behind the card. */
  private drawCursorLinks(): void {
    const c = this.cursor;
    if (!c) return;
    const ctx = this.ctx;

    for (const n of this.nodes) {
      const d = Math.hypot(c.x - n.x, c.y - n.y);
      if (d > CURSOR_DIST) continue;
      const a = 0.5 * (1 - d / CURSOR_DIST);
      ctx.strokeStyle = `rgba(${INDIGO_LIGHT}, ${a})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(n.x, n.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
    }
  }

  /** The travelling pulse itself: a bright head with a short comet tail along the
   *  edge behind it, which is what sells the signal as *moving* rather than the
   *  whole edge just blinking. */
  private drawSignals(): void {
    const ctx = this.ctx;
    for (const sig of this.signals) {
      const a = this.nodes[sig.from];
      const b = this.nodes[sig.to];
      const hx = a.x + (b.x - a.x) * sig.t;
      const hy = a.y + (b.y - a.y) * sig.t;
      const tailT = Math.max(0, sig.t - 0.22);
      const tx = a.x + (b.x - a.x) * tailT;
      const ty = a.y + (b.y - a.y) * tailT;

      const tail = ctx.createLinearGradient(tx, ty, hx, hy);
      tail.addColorStop(0, `rgba(${INDIGO_LIGHT}, 0)`);
      tail.addColorStop(1, `rgba(${INDIGO_LIGHT}, 0.9)`);
      ctx.strokeStyle = tail;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(hx, hy, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${INDIGO_LIGHT}, 0.95)`;
      ctx.shadowBlur = 8;
      ctx.shadowColor = `rgba(${INDIGO_LIGHT}, 0.9)`;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  private drawNodes(now: number): void {
    const ctx = this.ctx;

    for (const n of this.nodes) {
      const flash = this.flashOf(n, now);

      if (n.isIcon && n.iconKey) {
        const base = 0.22 + n.z * 0.16;
        ctx.strokeStyle = flash > 0.02 ? `rgb(${INDIGO_LIGHT})` : `rgb(${INDIGO})`;
        if (flash > 0.02) {
          ctx.shadowBlur = 12 * flash;
          ctx.shadowColor = `rgba(${INDIGO_LIGHT}, ${flash})`;
        }
        drawIcon(ctx, n.iconKey, n.x, n.y, 15 + n.z * 4, base + (0.85 - base) * flash);
        ctx.shadowBlur = 0;
        continue;
      }

      const radius = 1.1 + n.z * 1.7 + 1.6 * flash;
      const base = 0.28 + n.z * 0.34;

      if (flash > 0.02) {
        ctx.shadowBlur = 14 * flash;
        ctx.shadowColor = `rgba(${INDIGO_LIGHT}, ${flash})`;
      }
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = flash > 0.02 ? `rgba(${INDIGO_LIGHT}, ${base + (1 - base) * flash})` : `rgba(${INDIGO}, ${base})`;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
}
