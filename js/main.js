(() => {
  'use strict';
  const doc = document, root = doc.documentElement;
  const $ = (s, r = doc) => r.querySelector(s);
  const $$ = (s, r = doc) => Array.from(r.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';
  const S = (tag, attrs, parent) => {
    const e = doc.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const T = (el, text) => { el.textContent = text; return el; };
  const num = (v, d = 1) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(d);

  /* ---------- tooltip ---------- */
  const tip = doc.createElement('div');
  tip.className = 'tip'; tip.hidden = true; tip.setAttribute('aria-hidden', 'true');
  doc.body.appendChild(tip);
  function showTip(value, label, x, y) {
    tip.replaceChildren(T(doc.createElement('strong'), value), T(doc.createElement('span'), label));
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    let tx = x + 14, ty = y - r.height - 12;
    if (tx + r.width > innerWidth - 8) tx = x - r.width - 14;
    if (ty < 8) ty = y + 18;
    tip.style.transform = `translate(${Math.round(tx)}px, ${Math.round(ty)}px)`;
  }
  const hideTip = () => { tip.hidden = true; };
  function bindTip(el, value, label, hooks = {}) {
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', label + ': ' + value);
    el.addEventListener('pointermove', e => { hooks.on && hooks.on(); showTip(value, label, e.clientX, e.clientY); });
    el.addEventListener('pointerleave', () => { hooks.off && hooks.off(); hideTip(); });
    el.addEventListener('focus', () => { hooks.on && hooks.on(); const r = el.getBoundingClientRect(); showTip(value, label, r.left + r.width / 2, r.top); });
    el.addEventListener('blur', () => { hooks.off && hooks.off(); hideTip(); });
  }
  addEventListener('scroll', hideTip, { passive: true });

  /* ---------- chart scaffolding ---------- */
  function chart(id, render) {
    const fig = doc.getElementById(id);
    if (!fig) return;
    const plot = $('.plot', fig);
    let w = 0;
    const draw = () => {
      const nw = Math.round(plot.clientWidth);
      if (!nw || Math.abs(nw - w) < 2) return;
      w = nw;
      plot.replaceChildren();
      render(plot, nw);
      $$('.line', plot).forEach(p => { try { p.style.setProperty('--len', Math.ceil(p.getTotalLength()) + 'px'); } catch (e) {} });
    };
    draw();
    let raf = 0;
    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };
    if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(plot);
    else addEventListener('resize', schedule);
  }
  const barPath = (x0, y, w, h, r) => {
    r = Math.max(0, Math.min(r, w, h / 2));
    return `M${x0},${y} H${x0 + w - r} Q${x0 + w},${y} ${x0 + w},${y + r} V${y + h - r} Q${x0 + w},${y + h} ${x0 + w - r},${y + h} H${x0} Z`;
  };
  const barPathNeg = (x0, y, w, h, r) => {
    r = Math.max(0, Math.min(r, w, h / 2));
    return `M${x0},${y} H${x0 - w + r} Q${x0 - w},${y} ${x0 - w},${y + r} V${y + h - r} Q${x0 - w},${y + h} ${x0 - w + r},${y + h} H${x0} Z`;
  };

  /* SHIFT: mAP by condition (real data, Table 2) */
  chart('ch-shift', (plot, W) => {
    const data = [['Переменная облачность', 47.4], ['Ясный день · обучение', 46.9], ['Дождь', 41.3], ['Пасмурно', 41.1], ['Рассвет и сумерки', 37.3], ['Туман', 21.0], ['Ночь', 15.4]];
    const narrow = W < 560;
    const labelW = narrow ? 132 : 200, padR = 46, top = 4, rowH = narrow ? 32 : 36, barH = 18, axisH = 26;
    const H = top + data.length * rowH + axisH;
    const x = v => labelW + v / 50 * (W - labelW - padR);
    const svg = S('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'mAP по условиям съёмки: ночь 15.4 против 46.9 на ясном дне' }, plot);
    [0, 10, 20, 30, 40, 50].forEach(t => {
      S('line', { x1: x(t), x2: x(t), y1: top, y2: H - axisH + 4, class: t === 0 ? 'zero' : 'grid' }, svg);
      T(S('text', { x: x(t), y: H - 6, 'text-anchor': 'middle', class: 't-3 tick' }, svg), t);
    });
    data.forEach(([name, v], i) => {
      const y = top + i * rowH + (rowH - barH) / 2;
      const night = name === 'Ночь';
      T(S('text', { x: labelW - 12, y: y + barH / 2 + 4.5, 'text-anchor': 'end', class: night ? 't-1 strong' : 't-2' }, svg), name);
      const bar = S('path', { d: barPath(x(0), y, x(v) - x(0), barH, 4), class: 'bar ' + (night ? 'm-b' : 'm-n'), style: `--i:${i}` }, svg);
      T(S('text', { x: x(v) + 8, y: y + barH / 2 + 4.5, class: night ? 't-1 strong' : 't-2' }, svg), v.toFixed(1));
      const hit = S('rect', { x: 0, y: top + i * rowH, width: W, height: rowH, class: 'hit' }, svg);
      bindTip(hit, v.toFixed(1) + ' mAP', name, { on: () => bar.classList.add('is-hot'), off: () => bar.classList.remove('is-hot') });
    });
  });

  /* Albireo: ΔAP@50 vs per-frame (real data, §IV-C) */
  chart('ch-skip', (plot, W) => {
    const data = [
      { name: 'Albireo · пропущено 19.3 % вызовов', v: 0.8 },
      { name: 'Каждый 2-й кадр · FixedSkip-2', v: -8.6 },
      { name: '4 кадра из 5 · FixedSkip-5', v: -28.8 }];
    const padL = 52, padR = 46, top = 4, rowH = 58, barH = 18, axisH = 26;
    const H = top + data.length * rowH + axisH;
    const lo = -30, hi = 5;
    const x = v => padL + (v - lo) / (hi - lo) * (W - padL - padR);
    const svg = S('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Изменение AP@50: Albireo плюс 0.8, каждый второй кадр минус 8.6, четыре из пяти минус 28.8' }, plot);
    [-30, -20, -10, 0].forEach(t => {
      S('line', { x1: x(t), x2: x(t), y1: top, y2: H - axisH + 4, class: t === 0 ? 'zero' : 'grid' }, svg);
      T(S('text', { x: x(t), y: H - 6, 'text-anchor': 'middle', class: 't-3 tick' }, svg), num(t, 0));
    });
    data.forEach((d, i) => {
      const yL = top + i * rowH + 15, y = top + i * rowH + 24;
      T(S('text', { x: padL, y: yL, class: 't-2 halo' }, svg), d.name);
      const pos = d.v >= 0;
      const w = Math.abs(x(d.v) - x(0));
      const bar = S('path', { d: pos ? barPath(x(0), y, w, barH, 4) : barPathNeg(x(0), y, w, barH, 4), class: 'bar ' + (pos ? 'm-a' : 'm-b neg'), style: `--i:${i}` }, svg);
      T(S('text', { x: pos ? x(d.v) + 8 : x(d.v) - 8, y: y + barH / 2 + 4.5, 'text-anchor': pos ? 'start' : 'end', class: 't-1 strong' }, svg), (pos ? '+' : '') + num(d.v));
      const hit = S('rect', { x: 0, y: top + i * rowH, width: W, height: rowH, class: 'hit' }, svg);
      bindTip(hit, (pos ? '+' : '') + num(d.v) + ' п.п. AP@50', d.name, { on: () => bar.classList.add('is-hot'), off: () => bar.classList.remove('is-hot') });
    });
  });

  /* generic line chart */
  function lineChart(plot, W, cfg) {
    const H = cfg.height || 230;
    const m = Object.assign({ l: 40, r: 24, t: 14, b: 30 }, cfg.margin || {});
    const x = v => m.l + (v - cfg.x[0]) / (cfg.x[1] - cfg.x[0]) * (W - m.l - m.r);
    const y = v => m.t + (1 - (v - cfg.y[0]) / (cfg.y[1] - cfg.y[0])) * (H - m.t - m.b);
    const svg = S('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': cfg.aria }, plot);
    (cfg.zones || []).forEach(z => {
      S('rect', { x: x(z.from), y: m.t, width: x(z.to) - x(z.from), height: H - m.t - m.b, class: z.cls }, svg);
    });
    (cfg.zoneLabels || []).forEach(z => T(S('text', { x: x(z.at), y: m.t + 14, 'text-anchor': 'middle', class: 't-2 tick' }, svg), z.label));
    cfg.yTicks.forEach(t => {
      S('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: 'grid' }, svg);
      T(S('text', { x: m.l - 8, y: y(t) + 4, 'text-anchor': 'end', class: 't-3 tick' }, svg), cfg.yFmt ? cfg.yFmt(t) : t);
    });
    (cfg.xTicks || []).forEach(t => T(S('text', { x: x(t.v), y: H - 8, 'text-anchor': t.anchor || 'middle', class: 't-3 tick' }, svg), t.label));
    (cfg.refs || []).forEach(r => {
      S('line', { x1: m.l, x2: W - m.r, y1: y(r.v), y2: y(r.v), class: 'ref' }, svg);
      if (r.label) T(S('text', { x: W - m.r, y: y(r.v) - 6, 'text-anchor': 'end', class: 't-2 tick' }, svg), r.label);
    });
    cfg.series.forEach((s, si) => {
      const d = s.pts.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ',' + y(p[1]).toFixed(1)).join(' ');
      S('path', { d, class: 'line ' + s.cls, style: `--i:${si}` }, svg);
    });
    (cfg.dots || []).forEach((p, i) => S('circle', { cx: x(p.x), cy: y(p.y), r: p.r || 4.5, class: 'dot ' + p.cls, style: `--i:${i}` }, svg));
    (cfg.notes || []).forEach((n, i) => T(S('text', { x: x(n.x) + (n.dx || 0), y: y(n.y) + (n.dy || 0), 'text-anchor': n.anchor || 'start', class: (n.cls || 't-1') + ' pop', style: `--i:${i}` }, svg), n.text));
    return { svg, x, y, H, m };
  }

  /* Mamedov et al.: counting error vs detection rate (real data, Table 1) */
  chart('ch-sort', (plot, W) => {
    const xs = ['5 Гц', '3 Гц', '2 Гц'];
    const sort = [8.3, 10.8, 17.3], own = [4.1, 4.1, 4.3];
    const g = lineChart(plot, W, {
      height: 230, x: [-0.12, 2.12], y: [0, 20], yTicks: [0, 5, 10, 15, 20],
      margin: { l: 34, r: 46, t: 12, b: 28 },
      aria: 'Ошибка подсчёта: SORT 8.3, 10.8, 17.3; трекер авторов 4.1, 4.1, 4.3 при 5, 3 и 2 Гц',
      xTicks: xs.map((l, i) => ({ v: i, label: l })),
      series: [
        { cls: 'm-b', pts: sort.map((v, i) => [i, v]) },
        { cls: 'm-a', pts: own.map((v, i) => [i, v]) }],
      dots: [
        ...sort.map((v, i) => ({ x: i, y: v, cls: 'm-b' })),
        ...own.map((v, i) => ({ x: i, y: v, cls: 'm-a' }))],
      notes: [
        { x: 2, y: 17.3, dx: 10, dy: 4, text: '17.3', cls: 't-1 strong' },
        { x: 2, y: 4.3, dx: 10, dy: 4, text: '4.3', cls: 't-1 strong' },
        { x: 0, y: 8.3, dx: 0, dy: -12, text: '8.3', anchor: 'middle', cls: 't-2' }]
    });
    const xh = S('line', { x1: 0, x2: 0, y1: g.m.t, y2: g.H - g.m.b, class: 'xhair' }, g.svg);
    const colW = (W - g.m.l - g.m.r) / 3;
    xs.forEach((lab, i) => {
      const cx = g.x(i);
      const hit = S('rect', { x: cx - colW / 2, y: g.m.t, width: colW, height: g.H - g.m.t - g.m.b, class: 'hit' }, g.svg);
      bindTip(hit, `SORT ${sort[i].toFixed(1)} · трекер [4] ${own[i].toFixed(1)}`, 'ошибка подсчёта, ' + lab,
        { on: () => { xh.setAttribute('x1', cx); xh.setAttribute('x2', cx); xh.classList.add('on'); }, off: () => xh.classList.remove('on') });
    });
  });

  /* Idea 2: uncertainty growth per object (illustration) */
  chart('ch-q', (plot, W) => {
    const N = 30, tau = 0.5;
    const mk = k => Array.from({ length: N + 1 }, (_, t) => [t, Math.min(1, k * t)]).filter(p => p[1] <= 0.96);
    const kf = 0.034, ks = 0.072, kl = 0.02;
    lineChart(plot, W, {
      height: 230, x: [0, N], y: [0, 1], yTicks: [0, 0.5, 1], yFmt: t => (t === 0.5 ? 'τ' : t.toFixed(0)),
      margin: { l: 30, r: 16, t: 12, b: 28 },
      aria: 'Иллюстрация: неопределённость манёвренного объекта растёт быстрее и пересекает порог раньше, медленного — позже',
      xTicks: [{ v: 0, label: '0', anchor: 'start' }, { v: N, label: 'кадров с последней детекции →', anchor: 'end' }],
      refs: [{ v: tau, label: '' }],
      series: [{ cls: 'm-n', pts: mk(kf) }, { cls: 'm-b', pts: mk(ks) }, { cls: 'm-a', pts: mk(kl) }],
      dots: [{ x: tau / ks, y: tau, cls: 'm-b' }, { x: tau / kf, y: tau, cls: 'm-n' }, { x: tau / kl, y: tau, cls: 'm-a' }],
      notes: [
        { x: tau / ks, y: tau, dx: -6, dy: -14, text: 'будим раньше', anchor: 'end', cls: 't-1' },
        { x: tau / kl, y: tau, dx: 0, dy: 22, text: 'спит дольше', anchor: 'middle', cls: 't-1' }]
    });
  });

  /* Idea 3: gate error rate, fixed threshold vs ACI (illustration) */
  chart('ch-aci', (plot, W) => {
    const N = 200, cut = 100, alpha = 0.1;
    const n1 = t => 0.011 * Math.sin(t * 0.83) + 0.007 * Math.sin(t * 2.17 + 1) + 0.004 * Math.sin(t * 5.3 + 2);
    const n2 = t => 0.009 * Math.sin(t * 0.71 + 0.5) + 0.006 * Math.sin(t * 1.93 + 2) + 0.004 * Math.sin(t * 4.7);
    const fixed = [], aci = [];
    for (let t = 0; t <= N; t += 2) {
      fixed.push([t, (t < cut ? 0.08 : 0.08 + 0.19 * (1 - Math.exp(-(t - cut) / 4))) + n1(t)]);
      aci.push([t, (t < cut ? alpha : alpha + 0.15 * Math.exp(-(t - cut) / 13) * (1 - Math.exp(-(t - cut) / 2))) + n2(t)]);
    }
    const g = lineChart(plot, W, {
      height: 230, x: [0, N], y: [0, 0.35], yTicks: [0, 0.1, 0.2, 0.3], yFmt: t => (t === 0.1 ? 'α' : t.toFixed(1)),
      margin: { l: 30, r: 16, t: 12, b: 28 },
      aria: 'Иллюстрация: после смены дня на ночь доля ошибок с фиксированным порогом растёт, а ACI возвращает её к уровню α',
      zones: [{ from: cut, to: N, cls: 'zone' }],
      zoneLabels: [{ at: cut / 2, label: 'день' }, { at: (cut + N) / 2, label: 'ночь' }],
      xTicks: [{ v: N, label: 'кадры →', anchor: 'end' }],
      refs: [{ v: alpha, label: '' }],
      series: [{ cls: 'm-n', pts: fixed }, { cls: 'm-b', pts: aci }]
    });
    const y0 = g.y(0.03), xa = g.x(cut), xb = g.x(150);
    const br = S('g', { class: 'pop', style: '--i:1' }, g.svg);
    S('path', { d: `M${xa} ${y0 - 5} V${y0} H${xb} V${y0 - 5}`, fill: 'none', class: 'ref', style: 'stroke-dasharray:none' }, br);
    T(S('text', { x: (xa + xb) / 2, y: y0 + 14, 'text-anchor': 'middle', class: 't-2 tick' }, br), 'восстановление');
  });

  /* ---------- build-in observer: arms only off-screen blocks, plays when seen ---------- */
  function countUp(el) {
    const target = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0);
    const t0 = performance.now(), dur = 1100;
    const tick = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = (target * e).toFixed(dec);
      if (k < 1) requestAnimationFrame(tick); else el.textContent = target.toFixed(dec);
    };
    requestAnimationFrame(tick);
  }
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      for (const en of entries) {
        const el = en.target;
        if (!en.isIntersecting) { el.classList.remove('play'); el.classList.add('armed'); continue; }
        const enough = en.intersectionRatio >= 0.3 || en.intersectionRect.height >= innerHeight * 0.35;
        if (enough && el.classList.contains('armed')) {
          el.classList.remove('armed'); void el.getBoundingClientRect(); el.classList.add('play');
          $$('[data-count]', el).forEach(countUp);
        }
      }
    }, { threshold: [0, 0.1, 0.2, 0.3, 0.45] });
    $$('[data-anim]').forEach(el => io.observe(el));
  }

  /* ---------- papers filter ---------- */
  const papers = $('#papers');
  $$('.fchip').forEach(b => b.addEventListener('click', () => {
    papers.dataset.filter = b.dataset.f;
    $$('.fchip').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  }));

  /* ---------- progress, side nav, keyboard ---------- */
  const bar = $('.progress i');
  const onScroll = () => { const max = root.scrollHeight - innerHeight; bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`; };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const secs = $$('.sec');
  const nav = doc.createElement('nav');
  nav.className = 'dots'; nav.setAttribute('aria-label', 'Разделы');
  secs.forEach(s => {
    const a = doc.createElement('a');
    a.href = '#' + s.id; a.dataset.for = s.id; a.setAttribute('aria-label', s.dataset.nav);
    a.append(T(doc.createElement('span'), s.dataset.nav));
    nav.append(a);
  });
  doc.body.append(nav);
  const setActive = s => {
    $$('a', nav).forEach(a => a.classList.toggle('on', a.dataset.for === s.id));
    nav.classList.toggle('on-band', s.classList.contains('band'));
  };
  if ('IntersectionObserver' in window) {
    const nio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) setActive(e.target); }), { rootMargin: '-48% 0px -48% 0px' });
    secs.forEach(s => nio.observe(s));
  }
  setActive(secs[0]);
  addEventListener('keydown', e => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    let dir = 0;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') dir = 1;
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') dir = -1;
    else return;
    const tEl = e.target;
    if (tEl && tEl.closest && tEl.closest('input, textarea, select, [contenteditable]')) return;
    const yy = scrollY + 6;
    let cur = 0;
    secs.forEach((s, i) => { if (s.offsetTop <= yy) cur = i; });
    let target;
    if (dir > 0) target = secs[Math.min(secs.length - 1, cur + 1)];
    else target = scrollY > secs[cur].offsetTop + 12 ? secs[cur] : secs[Math.max(0, cur - 1)];
    e.preventDefault();
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  });

  /* ---------- pause looping media off-screen ---------- */
  const loopers = [$('#scene'), ...$$('.b-media')].filter(Boolean);
  if ('IntersectionObserver' in window) {
    const pio = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('paused', !e.isIntersecting)), { threshold: 0 });
    loopers.forEach(el => pio.observe(el));
  }

  /* ---------- hero: gate simulation (illustration) ---------- */
  (function hero() {
    const scene = $('#scene');
    if (!scene) return;
    const carA = $('#carA', scene), carB = $('#carB', scene), boxA = $('#boxA', scene), boxB = $('#boxB', scene);
    const tagT = $('#tagA-t', scene), miss = $('#miss', scene), hudF = $('#hud-frame', scene), hudP = $('#hud-phase', scene);
    const cPhase = $('#c-phase'), cU = $('#c-u'), cFill = $('#c-fill'), cLog = $('#c-log'), cPill = $('#c-pill'), cWhat = $('#c-what');
    const N = 32, NIGHT = 15, Q = 0.11, TL = 0.5, TH = 0.8, BASE = 412;
    const EVENTS = { 0: 'старт', 9: 'новый объект', 28: 'контрольный' };
    const frames = [];
    let u = 0.05, xPred = 0;
    for (let i = 0; i < N; i++) {
      let x = Math.round(5 * Math.sin(i * 0.8));
      if (i >= 19) x = Math.min(140, 40 * (i - 18)) + Math.round(3 * Math.sin(i));
      const uPre = i === 0 ? 0.05 : Math.round((u + Q) * 100) / 100;
      let d = 'P', why = 'прогноз трекера';
      if (EVENTS[i]) { d = 'H'; why = 'YOLO26x · ' + EVENTS[i]; }
      else if (uPre >= TH) { d = 'H'; why = 'YOLO26x'; }
      else if (uPre >= TL) { d = 'L'; why = 'YOLO26n'; }
      if (d === 'L') { u = 0.12; xPred = x; } else if (d === 'H') { u = 0.05; xPred = x; } else { u = uPre; }
      frames.push({ i, night: i >= NIGHT, x, xPred, u: uPre, d, why, miss: Math.abs(x - xPred) >= 60, carB: i >= 9 });
    }
    const tagText = d => (d === 'P' ? 'P · прогноз' : d === 'L' ? 'L · YOLO26n' : 'H · YOLO26x');
    const fno = i => String(BASE + i).padStart(4, '0');
    const logLine = f => {
      const li = doc.createElement('li');
      const dd = T(doc.createElement('span'), f.d); dd.className = 'd'; dd.dataset.d = f.d;
      const why = T(doc.createElement('span'), f.miss ? 'прогноз · рамка мимо' : f.why); why.className = 'why' + (f.miss ? ' x' : '');
      li.append(T(doc.createElement('span'), fno(f.i)), T(doc.createElement('span'), 'u ' + f.u.toFixed(2)), dd, why);
      return li;
    };
    function render(f) {
      scene.classList.toggle('night', f.night);
      carA.style.transform = `translate(${405 + f.x}px, 262px)`;
      boxA.style.transform = `translate(${f.xPred}px, 0px)`;
      boxA.setAttribute('data-d', f.d);
      boxA.classList.toggle('is-miss', f.miss);
      tagT.textContent = tagText(f.d);
      miss.classList.toggle('on', f.miss);
      carB.classList.toggle('on', f.carB);
      boxB.classList.toggle('on', f.carB);
      hudF.textContent = 'КАДР ' + fno(f.i);
      hudP.textContent = f.night ? 'НОЧЬ' : 'ДЕНЬ';
      cPhase.textContent = f.night ? 'ночь' : 'день';
      cPhase.classList.toggle('is-night', f.night);
      cU.textContent = f.u.toFixed(2);
      cFill.style.width = Math.min(100, f.u * 100) + '%';
      cPill.setAttribute('data-d', f.d);
      cPill.textContent = f.d;
      cWhat.textContent = f.miss ? 'прогноз · гейт уверен' : f.why;
    }
    function prime(k) {
      scene.classList.add('no-tr');
      render(frames[k]);
      cLog.replaceChildren();
      for (let j = Math.max(0, k - 4); j <= k; j++) cLog.append(logLine(frames[j]));
      requestAnimationFrame(() => requestAnimationFrame(() => scene.classList.remove('no-tr')));
    }
    if (reduce) { prime(21); return; }
    let k = 4, timer = null, visible = true;
    prime(k);
    const dur = f => (f.miss ? 1500 : f.d !== 'P' ? 950 : 680);
    function step() {
      k = (k + 1) % N;
      const f = frames[k];
      render(f);
      cLog.append(logLine(f));
      while (cLog.children.length > 5) cLog.firstElementChild.remove();
      timer = setTimeout(step, dur(f));
    }
    const start = () => { if (!timer && visible && !doc.hidden) timer = setTimeout(step, 700); };
    const stop = () => { clearTimeout(timer); timer = null; };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => es.forEach(e => { visible = e.isIntersecting; visible ? start() : stop(); }), { threshold: 0.15 }).observe(scene);
    }
    doc.addEventListener('visibilitychange', () => (doc.hidden ? stop() : start()));
    start();
  })();

  /* ---------- idea 1: tokens through the gate (illustration) ---------- */
  (function router() {
    const svg = $('#router');
    if (!svg || reduce) return;
    const layer = $('#rt-tokens', svg);
    const PATHS = {
      P: 'M18 128 H150 C196 128 204 52 252 52 H548',
      L: 'M18 128 H548',
      H: 'M18 128 H150 C196 128 204 204 252 204 H548'
    };
    const seq = 'PPPLPPPPHPPLPPPPLPPH';
    let k = 0, timer = null;
    function spawn() {
      const d = seq[k++ % seq.length];
      const g = S('g', { class: 'tok tok-' + d }, layer);
      S('rect', { x: -7, y: -5, width: 14, height: 10, rx: 3 }, g);
      const am = S('animateMotion', { dur: '2.6s', fill: 'freeze', begin: 'indefinite', path: PATHS[d], calcMode: 'paced' }, g);
      try { am.beginElement(); } catch (e) { g.remove(); return; }
      setTimeout(() => g.remove(), 2700);
    }
    const run = () => { if (!timer) { spawn(); timer = setInterval(spawn, 620); } };
    const halt = () => { clearInterval(timer); timer = null; };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => es.forEach(e => (e.isIntersecting && !doc.hidden ? run() : halt())), { threshold: 0.2 }).observe(svg);
    } else run();
    doc.addEventListener('visibilitychange', () => { if (doc.hidden) halt(); });
  })();
})();
