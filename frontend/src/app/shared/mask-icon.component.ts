import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';

/** Named icons (in /public) rendered as CSS masks so they take currentColor. */
const ICON_SRC: Record<string, string> = {
  gear: '/gear_17279605.png',
  trending: '/trending-content_16705905.png',
  cv: '/cv.svg',
  'generate-review': '/generate.svg',
  experience: '/experience.svg',
  projects: '/projects.svg',
  university: '/university.svg',
  skills: '/skills.svg',
  recommended: '/recommended.svg',

  // Field/industry glyphs. Only the decorative background draws these today —
  // they name the kinds of work on the platform rather than anything in the UI.
  'code-branch': '/code-branch.svg',
  'drafting-compass': '/drafting-compass.svg',
  engine: '/engine.svg',
  'machine-learning': '/machine-learning.svg',
  'robotic-arm': '/robotic-arm.svg',
  stethoscope: '/stethoscope.svg',
};

export type MaskIconName = keyof typeof ICON_SRC;

/**
 * Renders a transparent-background image as a solid shape tinted with the current
 * text colour (via CSS mask). Lets black line-art icons adopt the badge/section
 * colour they sit in — e.g. the gear turning green/amber with a match tier.
 */
@Component({
  selector: 'app-mask-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="mi" [style]="style()"></span>`,
  styles: [`.mi { display: inline-block; background-color: currentColor; flex-shrink: 0; }`],
})
export class MaskIconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly name = input.required<MaskIconName>();
  readonly size = input(16);

  protected readonly style = computed<SafeStyle>(() => {
    const src = ICON_SRC[this.name()];
    const s = this.size();
    return this.sanitizer.bypassSecurityTrustStyle(
      `width:${s}px;height:${s}px;` +
        `-webkit-mask:url('${src}') center/contain no-repeat;` +
        `mask:url('${src}') center/contain no-repeat`,
    );
  });
}
