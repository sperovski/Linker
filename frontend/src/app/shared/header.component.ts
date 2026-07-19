import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { NotificationService } from '../core/api/notification.service';
import { IconComponent } from './icon.component';
import { relativeTime } from './dates';
import { fadeSlideIn } from './animations';

interface NavLink {
  label: string;
  link: string;
}

/**
 * Floating island navigation bar. A single dark-green pill fixed to the top of
 * the viewport, centred, with three zones: brand (left), route links (centre),
 * and bell + avatar actions (right).
 *
 * The active-link indicator is one absolutely-positioned `.pill` that slides and
 * resizes to the active anchor (measured from `routerLinkActive`), rather than a
 * per-link background. Measurement runs after render / on route change / on
 * container resize, deferred a tick so fonts have settled first.
 */
@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  animations: [fadeSlideIn],
  host: {
    '[class.scrolled]': 'scrolled()',
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'onEscape()',
  },
  template: `
    <div class="island">
      <!-- ============================ LEFT: brand ======================== -->
      <a class="brand" [routerLink]="auth.isLoggedIn() ? auth.homePath() : '/'" aria-label="Linker home">
        <img class="brand-logo" src="/linker-wordmark.png" alt="Linker" />
      </a>

      <!-- =========================== CENTRE: links ======================= -->
      <div class="link-row" #linkRow>
        <span
          class="pill"
          [class.pill-hidden]="pillWidth() === 0"
          [style.transform]="'translateX(' + pillLeft() + 'px)'"
          [style.width.px]="pillWidth()"
          [style.top.px]="pillTop()"
          [style.height.px]="pillHeight()"
          aria-hidden="true"
        ></span>
        @for (item of navLinks(); track item.link) {
          <a
            #navAnchor
            class="nav-link"
            [routerLink]="item.link"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: item.link === '/' }"
            >{{ item.label }}</a
          >
        }
      </div>

      <!-- ============================ RIGHT: actions ===================== -->
      <div class="actions">
        @if (auth.isLoggedIn()) {
          @if (!auth.isAdmin()) {
            <div class="pop-wrap" #bellWrap>
              <button
                type="button"
                class="bell-btn"
                (click)="toggleBell($event)"
                [attr.aria-expanded]="bellOpen()"
                aria-haspopup="menu"
                [attr.aria-label]="bellLabel()"
              >
                <app-icon name="bell" [size]="18" />
                @if (unread() > 0) {
                  <span class="notif-dot" aria-hidden="true"></span>
                }
              </button>

              @if (bellOpen()) {
                <div class="menu notif-menu" role="menu" tabindex="-1" @fadeSlideIn (keydown)="onMenuKeydown($event)">
                  <div class="notif-head">
                    <span>Notifications</span>
                    @if (unread() > 0) {
                      <button type="button" class="notif-clear" (click)="markAllRead()">Mark all read</button>
                    }
                  </div>
                  @if (notifications.items().length === 0) {
                    <p class="notif-empty">You're all caught up.</p>
                  } @else {
                    <ul class="notif-list">
                      @for (n of notifications.items(); track n.id) {
                        <li>
                          <button
                            type="button"
                            role="menuitem"
                            class="notif-item"
                            [class.unread]="!n.isRead"
                            (click)="openNotification(n.id, n.link)"
                          >
                            <span class="notif-msg">{{ n.message }}</span>
                            <span class="notif-time">{{ relativeTime(n.createdAtUtc) }}</span>
                          </button>
                        </li>
                      }
                    </ul>
                  }
                </div>
              }
            </div>
          }

          <div class="pop-wrap" #userWrap>
            <button
              type="button"
              class="avatar-btn"
              (click)="toggleUserMenu($event)"
              [attr.aria-expanded]="userMenuOpen()"
              aria-haspopup="menu"
              [attr.aria-label]="'Account menu for ' + auth.email()"
            >
              <span class="avatar-initials">{{ initials() }}</span>
              <app-icon name="chevron-down" [size]="14" class="avatar-chev" />
            </button>

            @if (userMenuOpen()) {
              <div class="menu" role="menu" tabindex="-1" @fadeSlideIn (keydown)="onMenuKeydown($event)">
                <a role="menuitem" class="menu-item" [routerLink]="profilePath">
                  <app-icon name="user" [size]="15" /> Profile
                </a>
                <button role="menuitem" type="button" class="menu-item danger" (click)="logout()">
                  <app-icon name="log-out" [size]="15" /> Log out
                </button>
              </div>
            }
          </div>
        } @else {
          <a class="nav-cta" routerLink="/login">Log in</a>
          <a class="nav-cta nav-cta-primary" routerLink="/register">Sign up</a>
        }

        <button
          type="button"
          class="icon-btn hamburger"
          #hamburger
          (click)="toggleMobile($event)"
          [attr.aria-expanded]="mobileOpen()"
          aria-haspopup="menu"
          aria-label="Toggle navigation menu"
        >
          <app-icon [name]="mobileOpen() ? 'x' : 'chevron-down'" [size]="18" />
        </button>
      </div>
    </div>

    <!-- =========================== MOBILE panel ========================== -->
    @if (mobileOpen()) {
      <nav class="mobile-panel" tabindex="-1" @fadeSlideIn (keydown)="onMobileKeydown($event)" aria-label="Main navigation">
        @for (item of navLinks(); track item.link) {
          <a
            class="mobile-link"
            [routerLink]="item.link"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: item.link === '/' }"
            >{{ item.label }}</a
          >
        }
      </nav>
    }
  `,
  styles: [
    `
      /* The host is the fixed, centred positioning context; the .island is the
         visible pill. Dropdowns/panels are absolute within the host. */
      :host {
        position: fixed;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        width: calc(100% - 32px);
        max-width: 1180px;
        z-index: 1000;
        display: block;
      }

      /* Light, frosted floating bar that blends with the landing page. A
         translucent surface over the page (backdrop blur), a hairline border and
         a soft shadow so it reads as a card floating on the light background. */
      .island {
        display: flex;
        align-items: stretch;
        gap: 6px;
        min-height: 54px;
        padding: 0 8px 0 18px;
        background: rgba(255, 255, 255, 0.72);
        -webkit-backdrop-filter: blur(14px);
        backdrop-filter: blur(14px);
        border: 1px solid var(--nav-divider);
        border-radius: 999px;
        box-shadow: 0 8px 28px -14px rgba(29, 77, 36, 0.28);
        transition: min-height 200ms ease, box-shadow 200ms ease, background-color 200ms ease;
      }

      /* Scrolled: firm up the surface and lift so it separates from content. */
      :host(.scrolled) .island {
        min-height: 48px;
        background: rgba(255, 255, 255, 0.9);
        box-shadow: 0 10px 30px -12px rgba(29, 77, 36, 0.34);
      }

      /* ------------------------------ brand ---------------------------- */
      /* Transparent green logo sits directly on the bar — no white chip. */
      .brand {
        display: flex;
        align-items: center;
        flex-shrink: 0;
        padding-right: 18px;
        margin-right: 4px;
        border-right: 1px solid var(--nav-divider);
      }

      .brand:hover {
        text-decoration: none;
      }

      .brand-logo {
        height: 27px;
        width: auto;
        display: block;
      }

      /* ------------------------- centre link row ----------------------- */
      /* Sizes to its links (actions take the flexible space via margin-left:auto).
         The pill is measured against the active anchor. */
      .link-row {
        position: relative;
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 0 6px 0 12px;
        flex-shrink: 0;
      }

      /* Single sliding indicator behind the links. Vertical extent is measured
         from the active anchor (top/height set inline) so it tracks the link
         regardless of the row's stretched height. */
      .pill {
        position: absolute;
        left: 0;
        top: 0;
        width: 0;
        height: 0;
        border-radius: 999px;
        background: var(--nav-active-bg);
        z-index: 0;
        transition: transform 260ms cubic-bezier(0.4, 0, 0.2, 1),
          width 260ms cubic-bezier(0.4, 0, 0.2, 1);
      }

      .pill-hidden {
        opacity: 0;
      }

      .nav-link {
        position: relative;
        z-index: 1;
        padding: 6px 13px;
        font-size: 13px;
        font-weight: 500;
        color: var(--nav-link);
        border-radius: 999px;
        white-space: nowrap;
        transition: color 200ms ease;
      }

      .nav-link:hover {
        color: var(--nav-wordmark);
        text-decoration: none;
      }

      /* Slightly roomier than inactive so the pill has a touch more presence;
         the pill measures this width, so they stay in sync. */
      .nav-link.active {
        color: var(--nav-active-text);
        padding: 6px 15px;
      }

      /* ------------------------------ actions -------------------------- */
      .actions {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-left: auto;
        padding-right: 6px;
        flex-shrink: 0;
      }

      .pop-wrap {
        position: relative;
        display: inline-flex;
      }

      .icon-btn {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: 0.5px solid var(--nav-icon-border);
        background: transparent;
        color: var(--nav-icon);
        cursor: pointer;
        transition: background-color 160ms ease;
      }

      .icon-btn:hover {
        background: var(--nav-hover);
      }

      /* Borderless bell: just the icon in a 32px hit area. */
      .bell-btn {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 50%;
        background: transparent;
        color: var(--nav-link);
        cursor: pointer;
        transition: color 160ms ease;
      }

      .bell-btn:hover {
        color: var(--nav-wordmark);
      }

      /* Unread indicator: a dot punched into the bar surface (border = bar bg),
         no count. The count lives in the button's aria-label instead. */
      .notif-dot {
        position: absolute;
        top: 2px;
        right: 2px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--nav-badge);
        border: 2px solid var(--nav-bg);
      }

      /* Avatar capsule: initials circle + chevron in one pill. */
      .avatar-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 3px 9px 3px 3px;
        border: 1px solid var(--nav-divider);
        border-radius: 999px;
        background: transparent;
        cursor: pointer;
        transition: background-color 160ms ease, border-color 160ms ease;
      }

      .avatar-btn:hover {
        background: var(--nav-hover);
        border-color: transparent;
      }

      .avatar-initials {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 27px;
        height: 27px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
        color: #ffffff;
        font-family: var(--font-sans);
        font-size: 12px;
        font-weight: 600;
      }

      .avatar-chev {
        color: var(--nav-link);
        display: inline-flex;
      }

      /* Logged-out CTAs, sized to sit on the dark bar. */
      .nav-cta {
        display: inline-flex;
        align-items: center;
        height: 34px;
        padding: 0 14px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 500;
        color: var(--nav-link);
        border: 0.5px solid var(--nav-icon-border);
      }

      .nav-cta:hover {
        color: var(--nav-wordmark);
        background: var(--nav-hover);
        text-decoration: none;
      }

      .nav-cta-primary {
        background: var(--nav-active-bg);
        color: var(--nav-active-text);
        border-color: transparent;
      }

      .nav-cta-primary:hover {
        background: var(--nav-active-bg);
        color: var(--nav-active-text);
        filter: brightness(1.05);
      }

      /* ---------------------------- dropdowns -------------------------- */
      .menu {
        position: absolute;
        top: calc(100% + 12px);
        right: 0;
        min-width: 184px;
        background: var(--nav-bg);
        border: 0.5px solid var(--nav-divider);
        border-radius: 14px;
        padding: 6px;
        z-index: 70;
        box-shadow: 0 16px 34px -18px rgba(29, 77, 36, 0.4);
      }

      .menu-item {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 10px 12px;
        border: none;
        border-radius: 9px;
        background: transparent;
        color: var(--nav-link);
        font-family: var(--font-sans);
        font-size: 13px;
        font-weight: 500;
        text-align: left;
        cursor: pointer;
      }

      .menu-item:hover {
        background: var(--nav-hover);
        color: var(--nav-wordmark);
        text-decoration: none;
      }

      .menu-item.danger {
        color: var(--nav-badge);
      }

      /* notifications dropdown */
      .notif-menu {
        width: 320px;
        max-width: 84vw;
        padding: 0;
        overflow: hidden;
      }

      .notif-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        font-size: 13px;
        font-weight: 700;
        color: var(--nav-wordmark);
        border-bottom: 0.5px solid var(--nav-divider);
      }

      .notif-clear {
        background: none;
        border: none;
        color: var(--nav-active-bg);
        font-family: var(--font-sans);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        padding: 0;
      }

      .notif-empty {
        margin: 0;
        padding: 20px 14px;
        text-align: center;
        color: var(--nav-link);
        font-size: 13px;
      }

      .notif-list {
        list-style: none;
        margin: 0;
        padding: 4px;
        max-height: 340px;
        overflow-y: auto;
      }

      .notif-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
        width: 100%;
        padding: 9px 10px;
        border: none;
        border-radius: 9px;
        background: transparent;
        color: var(--nav-link);
        font-family: var(--font-sans);
        text-align: left;
        cursor: pointer;
      }

      .notif-item:hover {
        background: var(--nav-hover);
      }

      .notif-item.unread {
        background: rgba(151, 196, 89, 0.14);
      }

      .notif-msg {
        font-size: 13px;
        color: var(--nav-wordmark);
        line-height: 1.35;
      }

      .notif-time {
        font-size: 11px;
        color: var(--nav-link);
        font-weight: 500;
      }

      /* ---------------------------- hamburger -------------------------- */
      .hamburger {
        display: none;
      }

      /* ---------------------------- mobile panel ----------------------- */
      .mobile-panel {
        position: absolute;
        top: calc(100% + 10px);
        left: 0;
        right: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
        background: var(--nav-bg);
        border: 0.5px solid var(--nav-divider);
        border-radius: 16px;
        padding: 8px;
        z-index: 65;
      }

      .mobile-link {
        display: flex;
        align-items: center;
        min-height: 44px;
        padding: 0 14px;
        border-radius: 10px;
        color: var(--nav-link);
        font-size: 15px;
        font-weight: 500;
      }

      .mobile-link:hover {
        background: var(--nav-hover);
        color: var(--nav-wordmark);
        text-decoration: none;
      }

      .mobile-link.active {
        background: var(--nav-active-bg);
        color: var(--nav-active-text);
      }

      /* ------------------------------ responsive ----------------------- */
      @media (max-width: 899px) {
        .link-row {
          display: none;
        }
        .hamburger {
          display: inline-flex;
        }
      }

      @media (min-width: 900px) {
        .mobile-panel {
          display: none;
        }
      }

      /* Respect reduced motion: the pill jumps instead of sliding. */
      @media (prefers-reduced-motion: reduce) {
        .pill {
          transition: none;
        }
      }
    `,
  ],
})
export class HeaderComponent implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  protected readonly notifications = inject(NotificationService);
  protected readonly relativeTime = relativeTime;
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly linkRow = viewChild<ElementRef<HTMLElement>>('linkRow');
  private readonly navAnchors = viewChildren<ElementRef<HTMLAnchorElement>>('navAnchor');
  private readonly bellWrap = viewChild<ElementRef<HTMLElement>>('bellWrap');
  private readonly userWrap = viewChild<ElementRef<HTMLElement>>('userWrap');
  private readonly hamburger = viewChild<ElementRef<HTMLButtonElement>>('hamburger');

  protected readonly scrolled = signal(false);
  protected readonly bellOpen = signal(false);
  protected readonly userMenuOpen = signal(false);
  protected readonly mobileOpen = signal(false);

  // Sliding-pill geometry, in px, relative to the link row.
  protected readonly pillLeft = signal(0);
  protected readonly pillWidth = signal(0);
  protected readonly pillTop = signal(0);
  protected readonly pillHeight = signal(0);

  protected readonly unread = this.notifications.unreadCount;

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private scrollTicking = false;

  private readonly studentNav: NavLink[] = [
    { label: 'Browse', link: '/internships' },
    { label: 'Saved', link: '/saved' },
    { label: 'Applications', link: '/applications' },
    { label: 'Rate my CV', link: '/cv-review' },
    { label: 'Community', link: '/community' },
  ];
  private readonly companyNav: NavLink[] = [
    { label: 'Dashboard', link: '/company/dashboard' },
    { label: 'My Listings', link: '/company/listings' },
    { label: 'Community', link: '/community' },
    { label: 'Profile', link: '/company/profile' },
  ];
  private readonly adminNav: NavLink[] = [
    { label: 'Admin', link: '/admin' },
    { label: 'Community', link: '/community' },
  ];
  private readonly guestNav: NavLink[] = [{ label: 'Browse', link: '/internships' }];

  protected readonly navLinks = computed<NavLink[]>(() => {
    if (this.auth.isStudent()) return this.studentNav;
    if (this.auth.isCompany()) return this.companyNav;
    if (this.auth.isAdmin()) return this.adminNav;
    return this.guestNav;
  });

  /** Initials from the account email's local part (e.g. jane.doe → JD). */
  protected readonly initials = computed(() => {
    const local = (this.auth.email() ?? '').split('@')[0];
    const parts = local.split(/[._-]+/).filter(Boolean);
    const letters =
      parts.length >= 2 ? parts[0][0] + parts[1][0] : (local || '?').slice(0, 2);
    return letters.toUpperCase();
  });

  /** No dedicated settings route exists; both items point at the profile page. */
  protected readonly profilePath = this.auth.isCompany() ? '/company/profile' : '/profile';

  protected readonly bellLabel = computed(() => {
    const n = this.unread();
    return n === 0 ? 'Notifications' : `Notifications, ${n} unread`;
  });

  constructor() {
    // Re-measure the pill whenever the visible anchor set changes (role change).
    effect(() => {
      this.navAnchors();
      this.scheduleMeasure();
    });

    // Route change: re-measure the active pill and close any open menus.
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.closeMenus();
        this.closeMobile(false);
        this.scheduleMeasure();
      });

    afterNextRender(() => {
      this.measure();
      const row = this.linkRow()?.nativeElement;
      if (row) {
        this.resizeObserver = new ResizeObserver(() =>
          this.zone.run(() => this.measure()),
        );
        this.resizeObserver.observe(row);
      }
      // Scroll listener runs outside Angular; it only re-enters when the
      // `scrolled` boolean actually flips.
      this.zone.runOutsideAngular(() =>
        window.addEventListener('scroll', this.onScroll, { passive: true }),
      );
    });
  }

  ngOnInit(): void {
    this.notifications.refresh();
    this.pollTimer = setInterval(() => this.notifications.refresh(), 60000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.resizeObserver?.disconnect();
    window.removeEventListener('scroll', this.onScroll);
  }

  // ------------------------------- sliding pill ---------------------------
  private scheduleMeasure(): void {
    // Deferred a tick so routerLinkActive has applied and fonts have settled;
    // otherwise the first measurement reads stale widths.
    setTimeout(() => this.measure(), 0);
  }

  private measure(): void {
    const row = this.linkRow()?.nativeElement;
    if (!row) return;
    const active = row.querySelector<HTMLElement>('a.active');
    if (!active) {
      this.pillWidth.set(0);
      return;
    }
    // Width/left drive the slide; top/height are read from the anchor too so the
    // pill wraps the link exactly even though the row is now vertically stretched.
    this.pillLeft.set(active.offsetLeft);
    this.pillWidth.set(active.offsetWidth);
    this.pillTop.set(active.offsetTop);
    this.pillHeight.set(active.offsetHeight);
  }

  // --------------------------------- scroll -------------------------------
  private readonly onScroll = (): void => {
    if (this.scrollTicking) return;
    this.scrollTicking = true;
    requestAnimationFrame(() => {
      const next = window.scrollY > 8;
      if (next !== this.scrolled()) {
        this.zone.run(() => this.scrolled.set(next));
      }
      this.scrollTicking = false;
    });
  };

  // --------------------------------- menus --------------------------------
  protected toggleBell(event: Event): void {
    event.stopPropagation();
    const next = !this.bellOpen();
    this.userMenuOpen.set(false);
    this.bellOpen.set(next);
    if (next) this.notifications.refresh();
  }

  protected toggleUserMenu(event: Event): void {
    event.stopPropagation();
    const next = !this.userMenuOpen();
    this.bellOpen.set(false);
    this.userMenuOpen.set(next);
  }

  protected openNotification(id: number, link: string | null): void {
    this.notifications.markRead(id);
    this.bellOpen.set(false);
    if (link) this.router.navigateByUrl(link);
  }

  protected markAllRead(): void {
    this.notifications.markAllRead();
  }

  private closeMenus(): void {
    this.bellOpen.set(false);
    this.userMenuOpen.set(false);
  }

  protected onDocumentClick(event: Event): void {
    const target = event.target as Node;
    if (this.bellOpen() && !this.bellWrap()?.nativeElement.contains(target)) {
      this.bellOpen.set(false);
    }
    if (this.userMenuOpen() && !this.userWrap()?.nativeElement.contains(target)) {
      this.userMenuOpen.set(false);
    }
  }

  protected onEscape(): void {
    this.closeMenus();
    if (this.mobileOpen()) this.closeMobile(true);
  }

  /** Roving focus for open dropdown menus (arrow keys, Home/End). */
  protected onMenuKeydown(event: KeyboardEvent): void {
    const menu = event.currentTarget as HTMLElement;
    const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    let next: number;
    switch (event.key) {
      case 'ArrowDown':
        next = current < 0 ? 0 : (current + 1) % items.length;
        break;
      case 'ArrowUp':
        next = current <= 0 ? items.length - 1 : current - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = items.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    items[next].focus();
  }

  // ------------------------------- mobile panel ---------------------------
  protected toggleMobile(event: Event): void {
    event.stopPropagation();
    if (this.mobileOpen()) {
      this.closeMobile(true);
    } else {
      this.closeMenus();
      this.mobileOpen.set(true);
      // Move focus into the panel once it renders.
      setTimeout(() => {
        const panel = this.host.nativeElement.querySelector<HTMLElement>('.mobile-panel');
        panel?.querySelector<HTMLElement>('a')?.focus();
      }, 0);
    }
  }

  private closeMobile(restoreFocus: boolean): void {
    if (!this.mobileOpen()) return;
    this.mobileOpen.set(false);
    if (restoreFocus) {
      setTimeout(() => this.hamburger()?.nativeElement.focus(), 0);
    }
  }

  /** Trap Tab within the open mobile panel; Escape closes and restores focus. */
  protected onMobileKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeMobile(true);
      return;
    }
    if (event.key !== 'Tab') return;
    const panel = event.currentTarget as HTMLElement;
    const focusable = Array.from(panel.querySelectorAll<HTMLElement>('a[href], button'));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // --------------------------------- logout -------------------------------
  protected logout(): void {
    this.notifications.clear();
    this.closeMenus();
    this.auth.logout();
  }
}
