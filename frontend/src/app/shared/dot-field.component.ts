import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  input,
  viewChild,
} from '@angular/core';

interface Dot {
  hx: number; // home x
  hy: number; // home y
  dx: number; // current cursor displacement x
  dy: number; // current cursor displacement y
  px: number; // resolved render x (home + bulge + breathing)
  py: number; // resolved render y
  tw: number; // twinkle / breathing phase seed
}

/**
 * Canvas dot-grid background that bulges away from the cursor with a soft glow —
 * a native Angular rewrite of the React Bits "DotField" (the algorithm, not the
 * code). Ambient by design: low-opacity dots read as texture behind a form.
 *
 * Enhancements over the reference:
 * - a constellation mesh linking grid-neighbour dots, brightening near the cursor;
 * - a gentle always-on "breathing" drift so the field feels alive when idle.
 *
 * Colours default to the app's brand tokens (read at runtime from the CSS custom
 * properties) rather than the reference's dark-theme purple. Honours
 * prefers-reduced-motion (static mesh, no drift) and thins out / goes static on
 * mobile, where there's no persistent cursor to react to.
 *
 * Drop it inside a `position: relative` container; it fills the container at
 * z-index 0 with pointer-events disabled, so content on top stays interactive.
 */
@Component({
  selector: 'app-dot-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas aria-hidden="true"></canvas>`,
  styles: [
    `
      :host {
        position: absolute;
        inset: 0;
        z-index: 0;
        overflow: hidden;
        pointer-events: none;
      }
      canvas {
        display: block;
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class DotFieldComponent implements AfterViewInit, OnDestroy {
  readonly dotRadius = input(1.9);
  readonly dotSpacing = input(30);
  readonly cursorRadius = input(140);
  readonly cursorForce = input(26);
  readonly bulgeOnly = input(true);
  readonly bulgeStrength = input(1);
  readonly glowRadius = input(200);
  readonly sparkle = input(true);
  readonly waveAmplitude = input(0);
  /** Constellation mesh linking neighbouring dots. */
  readonly links = input(false);
  /** Gentle always-on drift so the field breathes when the cursor is away. */
  readonly breathing = input(true);
  readonly breathAmplitude = input(2.6);
  /** Empty → resolved from --color-primary at 0.22 alpha. */
  readonly gradientFrom = input('');
  /** Empty → resolved from --color-secondary at 0.13 alpha. */
  readonly gradientTo = input('');
  /** Empty → resolved from --color-primary. */
  readonly glowColor = input('');

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private ctx!: CanvasRenderingContext2D;
  private dots: Dot[] = [];
  private cols = 0;
  private rows = 0;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private spacing = 30;
  private raf = 0;
  private start = 0;

  private readonly pointer = { x: -9999, y: -9999, on: false };
  private resizeObserver?: ResizeObserver;

  private reducedMotion = false;
  private mobile = false;
  private colorFrom = 'rgba(29,77,36,0.22)';
  private colorTo = 'rgba(62,123,79,0.13)';
  private colorGlow = 'rgba(29,77,36,0.30)';
  private primary = { r: 29, g: 77, b: 36 };

  ngAfterViewInit(): void {
    const canvas = this.canvasRef().nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.mobile = window.matchMedia('(max-width: 640px), (pointer: coarse)').matches;
    // No persistent cursor on touch / reduced motion — render a calm static mesh.
    const interactive = !this.reducedMotion && !this.mobile;

    this.resolveColors();
    this.measure();

    this.resizeObserver = new ResizeObserver(() => this.measure());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);

    if (interactive) {
      window.addEventListener('pointermove', this.onPointerMove, { passive: true });
      window.addEventListener('pointerleave', this.onPointerLeave, { passive: true });
      window.addEventListener('blur', this.onPointerLeave);
      this.start = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    } else {
      this.drawStatic();
    }
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerleave', this.onPointerLeave);
    window.removeEventListener('blur', this.onPointerLeave);
  }

  private readonly onPointerMove = (e: PointerEvent): void => {
    const rect = this.canvasRef().nativeElement.getBoundingClientRect();
    this.pointer.x = e.clientX - rect.left;
    this.pointer.y = e.clientY - rect.top;
    this.pointer.on =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;
  };

  private readonly onPointerLeave = (): void => {
    this.pointer.on = false;
  };

  /** Resolve unset colours from the design-system tokens. */
  private resolveColors(): void {
    const css = getComputedStyle(document.documentElement);
    const token = (name: string) => css.getPropertyValue(name).trim();
    this.primary = this.hexToRgb(token('--color-primary')) ?? { r: 29, g: 77, b: 36 };
    const secondary = this.hexToRgb(token('--color-secondary')) ?? { r: 62, g: 123, b: 79 };
    const p = this.primary;

    this.colorFrom = this.gradientFrom() || `rgba(${p.r},${p.g},${p.b},0.22)`;
    this.colorTo = this.gradientTo() || `rgba(${secondary.r},${secondary.g},${secondary.b},0.13)`;
    const glow = this.glowColor();
    const g = this.hexToRgb(glow) ?? p;
    this.colorGlow = glow.startsWith('rgb') ? glow : `rgba(${g.r},${g.g},${g.b},0.30)`;
  }

  private measure(): void {
    const canvas = this.canvasRef().nativeElement;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    this.width = rect.width;
    this.height = rect.height;
    canvas.width = Math.round(rect.width * this.dpr);
    canvas.height = Math.round(rect.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.buildGrid();
    if (this.reducedMotion || this.mobile) this.drawStatic();
  }

  private buildGrid(): void {
    // Thin the grid out on mobile where the effect is static anyway.
    this.spacing = this.dotSpacing() * (this.mobile ? 1.6 : 1);
    this.cols = Math.max(1, Math.floor(this.width / this.spacing));
    this.rows = Math.max(1, Math.floor(this.height / this.spacing));
    const offX = (this.width - (this.cols - 1) * this.spacing) / 2;
    const offY = (this.height - (this.rows - 1) * this.spacing) / 2;

    const dots: Dot[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const hx = offX + c * this.spacing;
        const hy = offY + r * this.spacing;
        dots.push({ hx, hy, dx: 0, dy: 0, px: hx, py: hy, tw: Math.random() * Math.PI * 2 });
      }
    }
    this.dots = dots;
  }

  private gradientFill(): CanvasGradient {
    const grad = this.ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, this.colorFrom);
    grad.addColorStop(1, this.colorTo);
    return grad;
  }

  /** One-shot render for reduced-motion / mobile: a calm static mesh. */
  private drawStatic(): void {
    for (const d of this.dots) {
      d.px = d.hx;
      d.py = d.hy;
    }
    this.ctx.clearRect(0, 0, this.width, this.height);
    if (this.links()) this.drawLinks(false);
    this.drawDots(0);
  }

  private readonly frame = (now: number): void => {
    const t = (now - this.start) / 1000;
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Cursor glow, painted under everything.
    if (this.pointer.on && this.glowRadius() > 0) {
      const glow = this.ctx.createRadialGradient(
        this.pointer.x, this.pointer.y, 0,
        this.pointer.x, this.pointer.y, this.glowRadius(),
      );
      glow.addColorStop(0, this.colorGlow);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      this.ctx.fillStyle = glow;
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    // Resolve every dot's position first (bulge + breathing) so the mesh can
    // follow the displaced dots.
    const cr = this.cursorRadius();
    const wave = this.waveAmplitude();
    const breath = this.breathing() ? this.breathAmplitude() : 0;
    for (const d of this.dots) {
      let tx = 0;
      let ty = 0;
      if (this.pointer.on) {
        const vx = d.hx - this.pointer.x;
        const vy = d.hy - this.pointer.y;
        const dist = Math.hypot(vx, vy) || 0.0001;
        if (dist < cr) {
          const force = (1 - dist / cr) * this.cursorForce() * this.bulgeStrength();
          tx = (vx / dist) * force;
          ty = (vy / dist) * force;
        }
      }
      d.dx += (tx - d.dx) * 0.15;
      d.dy += (ty - d.dy) * 0.15;

      // Gentle breathing drift — slow, offset per position so it undulates.
      const bx = breath ? Math.sin(t * 0.6 + d.hy * 0.015) * breath : 0;
      const by = breath ? Math.cos(t * 0.5 + d.hx * 0.015) * breath : 0;
      const wy = wave ? Math.sin(t * 1.4 + d.hx * 0.02) * wave : 0;

      d.px = d.hx + d.dx + bx;
      d.py = d.hy + d.dy + by + wy;
    }

    if (this.links()) this.drawLinks(true);
    this.drawDots(t);

    this.raf = requestAnimationFrame(this.frame);
  };

  /** Constellation mesh: link each dot to its right and lower grid neighbours. */
  private drawLinks(interactive: boolean): void {
    const ctx = this.ctx;
    const p = this.primary;
    const hotR = this.cursorRadius() * 1.5;
    ctx.lineWidth = 1;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const a = this.dots[r * this.cols + c];
        if (c < this.cols - 1) this.link(a, this.dots[r * this.cols + c + 1], p, hotR, interactive);
        if (r < this.rows - 1) this.link(a, this.dots[(r + 1) * this.cols + c], p, hotR, interactive);
      }
    }
  }

  private link(
    a: Dot,
    b: Dot,
    p: { r: number; g: number; b: number },
    hotR: number,
    interactive: boolean,
  ): void {
    let alpha = 0.05;
    if (interactive && this.pointer.on) {
      const mx = (a.px + b.px) / 2;
      const my = (a.py + b.py) / 2;
      const d = Math.hypot(mx - this.pointer.x, my - this.pointer.y);
      if (d < hotR) alpha += (1 - d / hotR) * 0.22;
    }
    const ctx = this.ctx;
    ctx.strokeStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`;
    ctx.beginPath();
    ctx.moveTo(a.px, a.py);
    ctx.lineTo(b.px, b.py);
    ctx.stroke();
  }

  private drawDots(t: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = this.gradientFill();
    const rad = this.dotRadius();
    const sparkle = this.sparkle() && t > 0;
    for (const d of this.dots) {
      if (sparkle) ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 2 + d.tw);
      ctx.beginPath();
      ctx.arc(d.px, d.py, rad, 0, Math.PI * 2);
      ctx.fill();
      if (sparkle) ctx.globalAlpha = 1;
    }
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return null;
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
  }
}
