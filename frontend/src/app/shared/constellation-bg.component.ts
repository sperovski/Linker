import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  input,
} from '@angular/core';

// Total drifting nodes. O(n²) distance checks run every frame (line-drawing and
// pulse-pairing both scan all pairs), which is trivial at this count (~1,000
// pairs). If this ever needs to grow well past ~150, switch to a spatial grid
// before raising it further.
const NODE_COUNT = 46;

// Max distance at which two nodes still draw a connecting line.
const CONNECT_DIST = 160;
// Line opacity at distance 0, fading linearly to 0 at CONNECT_DIST. The spec's
// 0.10 is correct in a zoomed screenshot but reads as essentially invisible on a
// real monitor at 1x pixel density — same lesson as app-bg-decor's icons, bumped
// the same ~2.2x for consistency between the two.
const MAX_LINE_ALPHA = 0.22;
// Per-frame drift speed (px/frame) — every node moves at this same magnitude,
// just in a random initial direction, so the field never looks jittery.
const NODE_SPEED = 0.12;
// How often a new "match" pulse fires, and how long each one lasts.
const PULSE_INTERVAL_MS = 3500;
const PULSE_DURATION_MS = 1000;
// Padding added around the avoided element's rect before nodes start steering.
const KEEP_OUT_MARGIN = 28;

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
 *
 * public/ only has raster PNGs for graduation-cap and briefcase (the same two
 * app-bg-decor uses). At the ~16px this renders each icon, there's no benefit to
 * loading and offscreen-recolouring two bitmaps when the vector path already
 * exists and matches the other six exactly — so all 8 use this same approach.
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
  isIcon: boolean;
  iconKey?: IconKey;
}

interface Pulse {
  a: number;
  b: number;
  start: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function drawIcon(ctx: CanvasRenderingContext2D, key: IconKey, x: number, y: number, sizePx: number, alpha: number): void {
  const scale = sizePx / 24; // source icons are drawn on a 24x24 viewBox
  ctx.save();
  ctx.translate(x - sizePx / 2, y - sizePx / 2);
  ctx.scale(scale, scale);
  ctx.strokeStyle = '#4f46e5';
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
 * Animated network of drifting nodes behind the auth card: a subtle visual
 * metaphor for "linking students to opportunity." Renders to a single full-bleed
 * canvas, absolutely positioned behind the real content.
 *
 * - 46 nodes drift at a constant slow speed, bouncing off the viewport edges.
 * - Lines connect any two nodes within 160px, fading out with distance.
 * - Every ~3.5s, a currently-connected pair "pulses" brighter for ~1s — a
 *   stand-in for a match happening.
 * - 8 of the nodes render as faint outline icons instead of plain dots.
 * - An optional CSS selector (`avoidSelector`) names an element nodes should
 *   gently steer around rather than drift behind (e.g. the auth card).
 *
 * Respects prefers-reduced-motion: renders one static frame and starts no timers
 * or RAF loop at all, rather than a paused/slowed version of the animation.
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
  private width = 0;
  private height = 0;
  private dpr = 1;
  private rafId: number | null = null;
  private resizeObserver?: ResizeObserver;
  private reducedMotionQuery?: MediaQueryList;
  private readonly onReducedMotionChange = (): void => this.restart();
  private avoidRect: Rect | null = null;
  private nextPulseAt = 0;
  private pulse: Pulse | null = null;

  ngAfterViewInit(): void {
    this.ctx = this.canvasRef.nativeElement.getContext('2d')!;
    this.measureAndResize();
    this.seedNodes();

    // Layout can change without a window resize (font load reflow, sidebar
    // toggles) — watch the actual host box, not just the window.
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.canvasRef.nativeElement.parentElement ?? this.canvasRef.nativeElement);

    this.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotionQuery.addEventListener('change', this.onReducedMotionChange);

    this.start();
  }

  ngOnDestroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.resizeObserver?.disconnect();
    this.reducedMotionQuery?.removeEventListener('change', this.onReducedMotionChange);
  }

  private get reducedMotion(): boolean {
    return this.reducedMotionQuery?.matches ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private restart(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.start();
  }

  private start(): void {
    if (this.reducedMotion) {
      // One frame, no timers, no RAF: nodes keep their seeded positions and the
      // pulse never fires.
      this.render();
      return;
    }
    this.nextPulseAt = performance.now() + PULSE_INTERVAL_MS;
    this.loop();
  }

  private onResize(): void {
    const oldW = this.width;
    const oldH = this.height;
    this.measureAndResize();
    // Rescale existing positions proportionally rather than re-randomising, so a
    // resize redistributes the field into the new bounds without a jarring reset.
    if (oldW > 0 && oldH > 0) {
      const sx = this.width / oldW;
      const sy = this.height / oldH;
      for (const n of this.nodes) {
        n.x *= sx;
        n.y *= sy;
      }
    }
    if (this.reducedMotion) this.render();
  }

  private measureAndResize(): void {
    const canvas = this.canvasRef.nativeElement;
    const parent = canvas.parentElement ?? canvas;
    const rect = parent.getBoundingClientRect();
    this.width = Math.max(1, Math.round(rect.width));
    this.height = Math.max(1, Math.round(rect.height));
    this.dpr = window.devicePixelRatio || 1;
    canvas.width = this.width * this.dpr;
    canvas.height = this.height * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
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
    const iconKeys = Object.keys(ICON_OPS) as IconKey[]; // exactly 8 entries
    this.nodes = Array.from({ length: NODE_COUNT }, (_, i) => {
      const angle = Math.random() * Math.PI * 2;
      return {
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: Math.cos(angle) * NODE_SPEED,
        vy: Math.sin(angle) * NODE_SPEED,
        isIcon: i < iconKeys.length,
        iconKey: i < iconKeys.length ? iconKeys[i] : undefined,
      };
    });
  }

  private readonly loop = (): void => {
    this.step();
    this.render();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private step(): void {
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
    }

    const now = performance.now();
    if (!this.pulse && now >= this.nextPulseAt) this.startPulse(now);
    if (this.pulse && now > this.pulse.start + PULSE_DURATION_MS) {
      this.pulse = null;
      this.nextPulseAt = now + PULSE_INTERVAL_MS;
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

    // Bound the speed so repeated nudges (a node dawdling near the centre) can't
    // accelerate it indefinitely.
    const speed = Math.hypot(n.vx, n.vy);
    const maxSpeed = NODE_SPEED * 1.6;
    if (speed > maxSpeed) {
      n.vx = (n.vx / speed) * maxSpeed;
      n.vy = (n.vy / speed) * maxSpeed;
    }
  }

  /** Picks a pair of currently-connected nodes (so the highlighted line is always
   *  one that's actually visible) and starts their pulse. */
  private startPulse(now: number): void {
    const candidates: [number, number][] = [];
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const d = Math.hypot(this.nodes[i].x - this.nodes[j].x, this.nodes[i].y - this.nodes[j].y);
        if (d < CONNECT_DIST) candidates.push([i, j]);
      }
    }
    if (candidates.length === 0) {
      this.nextPulseAt = now + PULSE_INTERVAL_MS;
      return;
    }
    const [a, b] = candidates[Math.floor(Math.random() * candidates.length)];
    this.pulse = { a, b, start: now };
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    const now = performance.now();
    // Rise-and-fall envelope over the pulse's lifetime: 0 at both ends, 1 at the
    // midpoint, via a half sine — smoother than a linear ramp up/down.
    const pulseEnvelope = this.pulse ? Math.sin(Math.min(1, (now - this.pulse.start) / PULSE_DURATION_MS) * Math.PI) : 0;

    // Lines first, so node dots/icons paint on top of them.
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const a = this.nodes[i];
        const b = this.nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d >= CONNECT_DIST) continue;

        const isPulsing = !!this.pulse && ((this.pulse.a === i && this.pulse.b === j) || (this.pulse.a === j && this.pulse.b === i));
        const baseAlpha = MAX_LINE_ALPHA * (1 - d / CONNECT_DIST);

        ctx.strokeStyle = isPulsing ? '#818cf8' : '#4f46e5';
        ctx.globalAlpha = isPulsing ? baseAlpha + (0.65 - baseAlpha) * pulseEnvelope : baseAlpha;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // Nodes.
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const isPulsingNode = !!this.pulse && (this.pulse.a === i || this.pulse.b === i);
      const envelope = isPulsingNode ? pulseEnvelope : 0;

      if (n.isIcon && n.iconKey) {
        // Bumped from the spec's 0.16 for the same real-monitor visibility reason
        // as MAX_LINE_ALPHA above; stays fainter than the plain dots below, as
        // specced, just scaled up together.
        const baseAlpha = 0.32;
        drawIcon(ctx, n.iconKey, n.x, n.y, 16, baseAlpha + (0.55 - baseAlpha) * envelope);
      } else {
        const baseRadius = 1.8;
        const baseAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(n.x, n.y, baseRadius + baseRadius * 0.8 * envelope, 0, Math.PI * 2);
        ctx.fillStyle = envelope > 0 ? '#818cf8' : '#4f46e5';
        ctx.globalAlpha = baseAlpha + (0.9 - baseAlpha) * envelope;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
