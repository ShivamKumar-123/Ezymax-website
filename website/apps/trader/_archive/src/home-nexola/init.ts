/* eslint-disable @typescript-eslint/no-explicit-any */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

/**
 * All motion for the marketing pages in one place. Every block checks for
 * its elements first, so the same bootstrap serves the homepage and the
 * inner pages. Returns a cleanup so pages can be left and re-entered
 * without leaking triggers or listeners.
 */
export function initNexola(root: HTMLElement): () => void {
  gsap.registerPlugin(ScrollTrigger);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover: none)').matches;
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector(sel) as T | null;
  const $$ = <T extends Element = HTMLElement>(sel: string) => Array.from(root.querySelectorAll(sel)) as T[];
  const cleanups: Array<() => void> = [];
  const on = (el: EventTarget, ev: string, fn: any, opts?: any) => { el.addEventListener(ev, fn, opts); cleanups.push(() => el.removeEventListener(ev, fn, opts)); };

  /* Smooth scroll ------------------------------------------------------- */
  let lenis: Lenis | null = null;
  if (!reduced) {
    lenis = new Lenis({ lerp: 0.065, smoothWheel: true, wheelMultiplier: 0.9, touchMultiplier: 1.1 });
    lenis.on('scroll', () => ScrollTrigger.update());
    const raf = (t: number) => lenis && lenis.raf(t * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    cleanups.push(() => { gsap.ticker.remove(raf); lenis && lenis.destroy(); lenis = null; });
  }

  const ctx = gsap.context(() => {
    const themeOf = (el: Element) => (el.closest('[data-theme]') || root).getAttribute('data-theme') || 'light';
    const splitWords = (el: HTMLElement, mask: boolean) => {
      const words = (el.textContent || '').trim().split(/\s+/);
      el.innerHTML = words.map((w) => (mask ? `<span class="wm"><span class="w">${w}</span></span>` : `<span class="w">${w}</span>`)).join(' ');
      return Array.from(el.querySelectorAll('.w')) as HTMLElement[];
    };

    /* Menu drawer ---------------------------------------------------------- */
    const burger = $('#nxBurger'), drawer = $('#nxDrawer'), backdrop = $('#nxBackdrop'), header = $('#nxHeader');
    const drawerLinks = drawer ? drawer.querySelectorAll('nav a') : [];
    let menuOpen = false;
    const openMenu = () => {
      if (!burger || !drawer || !backdrop) return;
      menuOpen = true;
      burger.classList.add('is-open'); burger.setAttribute('aria-expanded', 'true');
      drawer.classList.add('is-open'); drawer.setAttribute('aria-hidden', 'false');
      backdrop.classList.add('is-open');
      if (lenis) lenis.stop();
      gsap.fromTo(drawerLinks, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: 0.08, delay: 0.3, overwrite: true });
    };
    const closeMenu = () => {
      if (!menuOpen || !burger || !drawer || !backdrop) return;
      menuOpen = false;
      burger.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false');
      drawer.classList.remove('is-open'); drawer.setAttribute('aria-hidden', 'true');
      backdrop.classList.remove('is-open');
      if (lenis) lenis.start();
      gsap.to(drawerLinks, { opacity: 0, y: 14, duration: 0.3, overwrite: true });
    };
    if (burger) on(burger, 'click', () => (menuOpen ? closeMenu() : openMenu()));
    if (backdrop) on(backdrop, 'click', closeMenu);
    on(document, 'keydown', (e: KeyboardEvent) => e.key === 'Escape' && closeMenu());
    if (drawer) drawer.querySelectorAll('a').forEach((a) => on(a, 'click', closeMenu));

    /* In-page anchors ------------------------------------------------------ */
    $$('a[href^="#"]').forEach((a) => {
      on(a, 'click', (e: Event) => {
        const id = a.getAttribute('href') || '';
        if (id.length < 2) { e.preventDefault(); return; }
        const el = root.querySelector(id);
        if (!el) return;
        e.preventDefault();
        closeMenu();
        if (lenis) lenis.scrollTo(el as HTMLElement, { offset: 0, duration: 1.5 });
        else el.scrollIntoView({ behavior: 'smooth' });
      });
    });

    /* Header inverts on dark sections ------------------------------------ */
    if (header) {
      $$('[data-theme="dark"]').forEach((sec) => {
        ScrollTrigger.create({ trigger: sec, start: 'top 30px', end: 'bottom 30px',
          onToggle: (self) => header.classList.toggle('on-dark', self.isActive) });
      });
    }

    /* Hero: image first, then wordmark rises, stat + buttons follow --------- */
    const wordmark = $('#nxWordmark'), heroImg = $('#nxHeroImg'), heroCtas = $('#nxHeroCtas'), heroStat = $('#nxHeroStat');
    if (wordmark) {
      const wmImg = wordmark.querySelector('img');
      if (wmImg) gsap.set(wmImg, { y: '110%' });
      else wordmark.innerHTML = (wordmark.textContent || '').split('').map((l) => `<span class="wm"><span class="w">${l}</span></span>`).join('');
      const wmTargets = wmImg ?? wordmark.querySelectorAll('.w');
      if (!reduced) {
        const tl = gsap.timeline({ delay: 0.15, defaults: { ease: 'expo.out' } });
        if (heroImg) tl.fromTo(heroImg, { scale: 1.08, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.8 });
        tl.to(wmTargets, { y: 0, duration: 1.4, stagger: 0.06 }, heroImg ? '-=1.4' : 0);
        if (heroStat) tl.fromTo(heroStat, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 1 }, '-=0.9');
        if (heroCtas) tl.fromTo(heroCtas, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1 }, '-=0.8');
        if (header) tl.fromTo(header, { y: -10, opacity: 0 }, { y: 0, opacity: 1, duration: 1 }, '-=1.1');
      } else {
        gsap.set(wmTargets, { y: 0 });
      }
    } else if (header && !reduced) {
      gsap.fromTo(header, { y: -10, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'expo.out', delay: 0.2 });
    }
    if (heroStat) {
      const stats = heroStat.querySelectorAll('.stat');
      const statDots = heroStat.querySelectorAll('.sdots i');
      let statIdx = 0;
      if (stats.length > 1) {
        const timer = window.setInterval(() => {
          const next = (statIdx + 1) % stats.length;
          gsap.to(stats[statIdx], { y: -10, opacity: 0, duration: 0.6, ease: 'power2.inOut' });
          gsap.fromTo(stats[next], { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'expo.out', delay: 0.4 });
          statDots.forEach((d, i) => d.classList.toggle('on', i === next));
          statIdx = next;
        }, 3000);
        cleanups.push(() => window.clearInterval(timer));
      }
    }

    /* Headings: masked word rise ---------------------------------------- */
    $$('[data-split]').forEach((el) => {
      const words = splitWords(el, true);
      if (reduced) { gsap.set(words, { y: 0 }); return; }
      gsap.to(words, { y: 0, duration: 1.3, ease: 'expo.out', stagger: 0.07, scrollTrigger: { trigger: el, start: 'top 86%', once: true } });
    });

    /* Statements: scrubbed word colour reveal ----------------------------- */
    $$('[data-reveal]').forEach((el) => {
      const words = splitWords(el, false);
      const dark = themeOf(el) === 'dark';
      const idle = dark ? '#454545' : '#C4C4C4', full = dark ? '#FFFFFF' : '#0D0D0D';
      gsap.set(words, { color: idle });
      if (reduced) { gsap.set(words, { color: full }); return; }
      gsap.to(words, { color: full, ease: 'none', stagger: 0.06, scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 48%', scrub: 0.9 } });
    });

    /* Count-ups -------------------------------------------------------------- */
    $$('[data-count]').forEach((el) => {
      const target = parseFloat(el.dataset.count || '0'), prefix = el.dataset.prefix || '', suffix = el.dataset.suffix || '';
      const obj = { v: 0 };
      const render = () => { el.textContent = prefix + Math.round(obj.v).toLocaleString('en-US') + suffix; };
      if (reduced) { obj.v = target; render(); return; }
      render();
      gsap.to(obj, { v: target, duration: 2.2, ease: 'expo.out', onUpdate: render, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });

    /* Image placeholders + parallax ---------------------------------------- */
    $$('.img-ph:not(.avatar):not(.hero-img)').forEach((el) => {
      if (reduced) return;
      gsap.fromTo(el, { clipPath: 'inset(100% 0 0 0)', scale: 1.12 }, { clipPath: 'inset(0% 0 0 0)', scale: 1, duration: 1.7, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });
    $$('[data-parallax]').forEach((el) => {
      if (reduced) return;
      const amt = parseFloat(el.dataset.parallax || '-6');
      gsap.fromTo(el, { yPercent: -amt }, { yPercent: amt, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    /* Drop-in artwork: a placeholder with data-src shows the file once it exists,
       and stays a labelled grey box until then (missing files never break layout). */
    $$<HTMLElement>('.img-ph[data-src]').forEach((el) => {
      const src = el.dataset.src; if (!src) return;
      const probe = new Image();
      probe.onload = () => { el.style.backgroundImage = `url("${src}")`; el.classList.add('has-img'); };
      probe.src = src;
    });

    /* Staggered lists / cards; group fades; soft rises --------------------- */
    $$('[data-stagger]').forEach((wrap) => {
      if (reduced) return;
      gsap.fromTo(wrap.children, { y: 32, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.09, scrollTrigger: { trigger: wrap, start: 'top 86%', once: true } });
    });
    $$('[data-stagger-lines]').forEach((el) => {
      if (reduced) return;
      gsap.fromTo(el.children, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.08, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });
    $$('[data-fade-group]').forEach((el) => {
      if (reduced) return;
      gsap.fromTo(el, { opacity: 0.15 }, { opacity: 1, duration: 1.8, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 80%', once: true } });
    });
    $$('.intro-quote, .skill-updated, .team-note, .team-copy, .team-stat, .nl-right, .contact-left .copy, .contact-email, .footer-cols, .page-hero .lead, .page-hero .lead-ctas, .spec-wrap, .note, [data-rise]').forEach((el) => {
      if (reduced) return;
      gsap.fromTo(el, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
    });

    /* Stacked rows (homepage markets) ------------------------------------ */
    const rows = $$('.project-row');
    if (rows.length) {
      const activate = (i: number) => rows.forEach((r, k) => r.classList.toggle('is-active', k === i));
      const offset = () => (parseFloat(getComputedStyle(root).getPropertyValue('--header-h')) || 60) + 24;
      const absTop = (el: Element) => el.getBoundingClientRect().top + window.scrollY;
      const hold = () => Math.round(window.innerHeight * 0.35);
      const last = rows[rows.length - 1];
      rows.forEach((row, i) => {
        gsap.set(row, { zIndex: i + 1 });
        const isLast = row === last;
        ScrollTrigger.create({
          trigger: row, start: () => `top ${offset()}px`,
          end: () => `+=${Math.max(1, absTop(last) - absTop(row) + hold())}`,
          pin: true, pinSpacing: isLast, anticipatePin: 1,
          onEnter: () => activate(i), onEnterBack: () => activate(i),
        });
        if (!isLast && !reduced) {
          gsap.to(row, { scale: 0.95, opacity: 0.45, transformOrigin: '50% 30%', ease: 'none',
            scrollTrigger: { trigger: rows[i + 1], start: 'top bottom', end: () => `top ${offset()}px`, scrub: true } });
        }
      });
    }

    /* Data visuals ----------------------------------------------------------- */
    const bars = $('#nxBars'), dotsgrid = $('#nxDots'), squares = $$('#nxSquares i');
    if (bars) {
      bars.innerHTML = '';
      [14, 18, 16, 24, 22, 30, 28, 36, 40, 38, 48, 54, 60, 70, 84, 100].forEach((h) => { const i = document.createElement('i'); i.style.height = h + '%'; bars.appendChild(i); });
      if (!reduced) gsap.from(bars.children, { scaleY: 0, duration: 1.4, ease: 'expo.out', stagger: 0.06, scrollTrigger: { trigger: bars, start: 'top 85%', once: true } });
    }
    if (dotsgrid) {
      dotsgrid.innerHTML = '';
      for (let i = 0; i < 140; i++) dotsgrid.appendChild(document.createElement('i'));
      if (!reduced) gsap.to(dotsgrid.children, { opacity: 1, duration: 0.5, ease: 'power2.out', stagger: { each: 0.012, from: 'start' }, scrollTrigger: { trigger: dotsgrid, start: 'top 85%', once: true } });
      else gsap.set(dotsgrid.children, { opacity: 1 });
    }
    if (squares.length) {
      if (!reduced) ScrollTrigger.create({ trigger: '#nxSquares', start: 'top 85%', once: true, onEnter: () => squares.forEach((s, i) => setTimeout(() => s.classList.add('on'), 150 + i * 180)) });
      else squares.forEach((s) => s.classList.add('on'));
    }

    /* Accordions — one open at a time per group ----------------------------- */
    $$('.acc').forEach((group) => {
      const items = Array.from(group.querySelectorAll('.acc-item'));
      items.forEach((item) => {
        const btn = item.querySelector('.acc-btn') as HTMLElement | null, panel = item.querySelector('.acc-panel') as HTMLElement | null;
        if (!btn || !panel) return;
        on(btn, 'click', () => {
          const willOpen = !item.classList.contains('is-open');
          items.forEach((other) => {
            if (other !== item && other.classList.contains('is-open')) {
              other.classList.remove('is-open');
              other.querySelector('.acc-btn')?.setAttribute('aria-expanded', 'false');
              gsap.to(other.querySelector('.acc-panel'), { height: 0, duration: 0.7, ease: 'expo.inOut' });
            }
          });
          item.classList.toggle('is-open', willOpen);
          btn.setAttribute('aria-expanded', String(willOpen));
          gsap.to(panel, { height: willOpen ? 'auto' : 0, duration: 0.8, ease: 'expo.inOut', onComplete: () => ScrollTrigger.refresh() });
        });
      });
    });

    /* Avatars pop in ---------------------------------------------------------------- */
    const avatars = $$('#nxAvatars > *');
    if (avatars.length) {
      if (!reduced) gsap.to(avatars, { scale: 1, duration: 1, ease: 'expo.out', stagger: 0.07, scrollTrigger: { trigger: '#nxAvatars', start: 'top 88%', once: true } });
      else gsap.set(avatars, { scale: 1 });
    }

    /* Switch (decorative toggle; animates any [data-price] values if present) ---- */
    const sw = $('#nxBilling');
    if (sw) {
      let onState = false;
      on(sw, 'click', () => {
        onState = !onState;
        sw.classList.toggle('on', onState);
        sw.setAttribute('aria-checked', String(onState));
        $$('[data-price]').forEach((el) => {
          const base = parseFloat(el.dataset.price || '0'), to = onState ? Math.round(base * 0.8) : base;
          const obj = { v: parseFloat((el.textContent || '').replace(/,/g, '')) || base };
          gsap.to(obj, { v: to, duration: reduced ? 0 : 0.9, ease: 'power3.out', onUpdate: () => { el.textContent = Math.round(obj.v).toLocaleString('en-US'); } });
        });
      });
    }

    /* Marquee: duplicate for a seamless loop ------------------------------------ */
    const track = $('#nxMarquee');
    if (track && !track.dataset.doubled) { track.innerHTML += track.innerHTML; track.dataset.doubled = '1'; }

    /* Forms: floating labels ----------------------------------------------------- */
    $$('.field input, .field textarea').forEach((input) => {
      const sync = () => input.parentElement!.classList.toggle('has-value', (input as HTMLInputElement).value.trim() !== '');
      on(input, 'input', sync); on(input, 'blur', sync);
    });

    const refresh = () => ScrollTrigger.refresh();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
    on(window, 'load', refresh);
    setTimeout(refresh, 600);
  }, root);

  return () => {
    cleanups.forEach((fn) => fn());
    ctx.revert();
  };
}
