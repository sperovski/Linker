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

// The 8 icon nodes render the real product icons from /public. They're raster
// PNGs, so each is pre-tinted once into small offscreen canvases (base indigo +
// light indigo for the firing flash) and then blitted per frame — far cheaper
// than recolouring a 512px source on every draw.
const ICON_SRCS = [
  '/cv_3846805.png',
  '/graduation-cap_417180.png',
  '/paperclip_309037.png',
  '/briefcase_5782884.png',
  '/skills_11253617.png',
  '/projects.png',
  '/generate_review.png',
  '/gear_17279605.png',
];

const INDIGO = '79, 70, 229'; // #1D4D24
const INDIGO_LIGHT = '129, 140, 248'; // #6FB37E

// Pre-rendered tint size. Icon nodes draw ~16-20px, so 44 downscales crisply
// without a large offscreen.
const ICON_SPRITE_PX = 44;

/** A loaded icon with its two tint variants, ready to blit. */
interface IconSprite {
  base: HTMLCanvasElement;
  light: HTMLCanvasElement;
}

/** Offscreen canvas of `img` recoloured to `rgb`, preserving the icon's alpha. */
function tintSprite(img: HTMLImageElement, rgb: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = ICON_SPRITE_PX;
  c.height = ICON_SPRITE_PX;
  const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0, ICON_SPRITE_PX, ICON_SPRITE_PX);
  // Keep the silhouette, replace the colour.
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = `rgb(${rgb})`;
  g.fillRect(0, 0, ICON_SPRITE_PX, ICON_SPRITE_PX);
  return c;
}

interface NetNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 0 = far, 1 = near. Drives size, alpha and drift speed, giving the field depth. */
  z: number;
  isIcon: boolean;
  /** Index into ICON_SRCS / the loaded sprite array, for icon nodes. */
  iconIndex?: number;
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
  /** Loaded icon sprites, indexed like ICON_SRCS; null until the PNG loads. */
  private sprites: (IconSprite | null)[] = ICON_SRCS.map(() => null);
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
    this.loadSprites();

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
    const iconCount = ICON_SRCS.length; // exactly 8
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
        isIcon: i < iconCount,
        iconIndex: i < iconCount ? i : undefined,
        firedAt: -Infinity,
      };
    });
  }

  /** Loads each icon PNG and builds its two tint variants. Async: a node draws a
   *  plain dot until its sprite is ready, then swaps in. In reduced motion the
   *  static frame is repainted on each load so the icons still appear. */
  private loadSprites(): void {
    ICON_SRCS.forEach((src, i) => {
      const img = new Image();
      img.onload = () => {
        this.sprites[i] = { base: tintSprite(img, INDIGO), light: tintSprite(img, INDIGO_LIGHT) };
        if (this.reducedMotion) this.render(performance.now());
      };
      img.src = src;
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

      const sprite = n.iconIndex !== undefined ? this.sprites[n.iconIndex] : null;
      if (n.isIcon && sprite) {
        const size = 17 + n.z * 6;
        const base = 0.24 + n.z * 0.18;
        if (flash > 0.02) {
          ctx.shadowBlur = 12 * flash;
          ctx.shadowColor = `rgba(${INDIGO_LIGHT}, ${flash})`;
        }
        ctx.globalAlpha = base + (0.9 - base) * flash;
        // Swap to the light-tinted variant while the node is firing.
        ctx.drawImage(flash > 0.02 ? sprite.light : sprite.base, n.x - size / 2, n.y - size / 2, size, size);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        continue;
      }
      // Icon node whose sprite hasn't loaded yet: fall through to draw a dot.

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
