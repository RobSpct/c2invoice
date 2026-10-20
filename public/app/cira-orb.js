/* <cira-orb> – Cira-Partikel-Orb als Vanilla-Web-Component, ohne Abhängigkeiten.
   Port von drawOrb() / envAt() / spawnFlyers() aus mockups/"c2invoice x Jarvis v2.dc.html" (Logik ab Z. ~1210).
   Darf so in public/app/ übernommen werden (einbinden VOR shell.js).

   Attribute
     variant  "stage" (große Bühne im Cockpit) | "mini" (Standard: Seitenleiste, Dock, Banner)
     scale    Größenfaktor für mini (Mockup: 1.0 Dock, 1.1 Overlay, 1.2 Seitenleiste, 1.25 Banner)
     mode     ruht | spricht | hört | denkt
     state    auto | warn | paid | overdue | session | night   (färbt den Orb, auto = Akzent)
     accent   orange | blau | rot
     x        nur stage: horizontale Lage 0..1 (0.5 Mitte, 0.23 wenn rechts eine Szene offen ist)
   Methoden
     speak(text) → ms     Mund-Hüllkurve aus dem Text (15 Zeichen/s), setzt mode=spricht, danach ruht
     stop()               Sprechen abbrechen
     fly(elements)        stage: Partikel fliegen vom Orb zu den Elementen (Szenen-Werte, Skill-Kacheln)
   Ereignis
     cira-speak-end       wenn speak() fertig ist
   Ein gemeinsamer requestAnimationFrame für alle Orbs. prefers-reduced-motion: ein ruhiges Standbild,
   neu gezeichnet nur bei Attributwechsel. Für echte TTS: speak() mit demselben Text parallel zur
   SpeechSynthesis starten; amplitude-Property (0..1) überschreibt die Hüllkurve, wenn ein echter Pegel da ist. */
(function () {
  if (customElements.get('cira-orb')) return;
  const N = 520, PTS = [];
  for (let i = 0; i < N; i++) { const y = 1 - 2 * (i + .5) / N, r = Math.sqrt(1 - y * y), a = i * 2.39996; PTS.push([Math.cos(a) * r, y, Math.sin(a) * r]); }
  const ACC = { orange: [249, 115, 22], blau: [74, 142, 255], rot: [232, 52, 58] };
  const ST = { warn: [224, 179, 85], paid: [87, 201, 138], overdue: [239, 68, 68], session: [249, 115, 22], night: [128, 128, 142] };
  const CPS = 15;
  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  // c2invoice: auch die Einstellung "Bewegung reduzieren" (<html data-motion="off">) haelt den Orb an.
  const ruhig = () => RM.matches || document.documentElement.dataset.motion === 'off';
  const alle = new Set(); let raf = 0;
  // c2invoice: im Hintergrund-Tab steht die Schleife, beim Zurueckkommen laeuft sie weiter.
  function loop(t) { raf = alle.size && !document.hidden ? requestAnimationFrame(loop) : 0; alle.forEach(o => o._draw(t)); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && alle.size && !raf) raf = requestAnimationFrame(loop); });

  class CiraOrb extends HTMLElement {
    static get observedAttributes() { return ['mode', 'state', 'accent', 'variant', 'scale', 'x']; }
    constructor() {
      super();
      const sr = this.attachShadow({ mode: 'open' });
      sr.innerHTML = '<style>:host{display:block;position:relative}canvas{position:absolute;inset:0;width:100%;height:100%;display:block}</style><canvas></canvas>';
      this._c = sr.querySelector('canvas');
      this._rgb = null; this._k = 1; this._x = null; this._dirty = true;
      this._txt = ''; this._t0 = 0; this._ef = 0; this._es = 0; this._prevT = 0; this._amp = null;
      this._flyers = [];
    }
    connectedCallback() { alle.add(this); this._dirty = true; if (!raf && !document.hidden) raf = requestAnimationFrame(loop); }
    disconnectedCallback() { alle.delete(this); clearTimeout(this._spT); }
    attributeChangedCallback() { this._dirty = true; }
    get mode() { return this.getAttribute('mode') || 'ruht'; }
    set mode(v) { this.setAttribute('mode', v); }
    set amplitude(v) { this._amp = v == null ? null : Math.max(0, Math.min(1, +v || 0)); }
    get amplitude() { return this._amp; }

    speak(text) {
      clearTimeout(this._spT);
      this._txt = String(text || ''); this._t0 = performance.now(); this.mode = 'spricht';
      const ms = this._txt.length / CPS * 1000 + 500;
      this._spT = setTimeout(() => { this._txt = ''; if (this.mode === 'spricht') this.mode = 'ruht'; this.dispatchEvent(new CustomEvent('cira-speak-end', { bubbles: true })); }, ms);
      return ms;
    }
    stop() { clearTimeout(this._spT); this._txt = ''; if (this.mode === 'spricht') this.mode = 'ruht'; }

    fly(elements) {
      if (ruhig()) return;
      const cr = this._c.getBoundingClientRect(), now = performance.now();
      this._flyers = [];
      [...elements].slice(0, 6).forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const ex = r.left + Math.min(r.width / 2, 60) - cr.left, ey = r.top + r.height / 2 - cr.top;
        for (let k = 0; k < 9; k++) this._flyers.push({ ex, ey, t0: now + i * 160 + k * 40, d: 850 + Math.random() * 350, o: Math.random() * Math.PI * 2, rr: .5 + Math.random() * .6, cy: (Math.random() - .5) * 120 });
      });
    }

    _env(t) {
      if (this._amp != null) return this._amp;
      let target = 0; const txt = this._txt;
      if (txt) {
        const pos = (t - this._t0) / 1000 * CPS, i = Math.floor(pos), fr = pos - i, c = (txt[i] || '').toLowerCase();
        if (/[aeiouäöüy]/.test(c)) target = .8 + .2 * Math.sin(fr * Math.PI);
        else if (/[a-zß]/.test(c)) target = .55;
        else if (/[0-9€%]/.test(c)) target = .7;
        else if (c === ' ') target = .3;
        else if (/[.,:;!?–]/.test(c)) target = .05;
        target *= .8 + .35 * ((Math.floor(pos / 6) * 7919) % 13 / 13);
      } else { const s = t / 1000; target = Math.max(0, Math.sin(s * 9.1) * Math.sin(s * 2.3 + 1) * .8 + .2 * Math.sin(s * 17)); }
      const dt = Math.min(50, t - (this._prevT || t)); this._prevT = t;
      const k = ms => 1 - Math.exp(-dt / ms);
      this._ef += (target - this._ef) * k(target > this._ef ? 90 : 200);
      this._es += (this._ef - this._es) * k(320);
      return Math.pow(Math.max(0, Math.min(1, .75 * this._es + .25 * this._ef)), .9);
    }

    _draw(t) {
      const c = this._c, w = c.clientWidth, h = c.clientHeight; if (!w || !h) return;
      const still = ruhig();
      if (still && !this._dirty) return;
      this._dirty = false;
      const d = devicePixelRatio || 1;
      if (c.width !== Math.round(w * d) || c.height !== Math.round(h * d)) { c.width = Math.round(w * d); c.height = Math.round(h * d); }
      const x = c.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, w, h);
      const mode = this.mode, stage = this.getAttribute('variant') === 'stage', st = this.getAttribute('state') || 'auto';
      const target = ST[st] || ACC[this.getAttribute('accent')] || ACC.orange;
      if (!this._rgb) this._rgb = target.slice();
      this._rgb = this._rgb.map((v, i) => still ? target[i] : v + (target[i] - v) * .04);
      const rgb = this._rgb.map(Math.round).join(','), dim = st === 'night' ? .45 : 1;
      const s = still ? 0 : t / 1000, small = Math.min(w, h) < 80;
      const tx = stage ? (parseFloat(this.getAttribute('x')) || .5) : .5;
      if (this._x == null) this._x = tx; this._x += (tx - this._x) * (still ? 1 : .06);
      let amp = .016 * Math.sin(s * .9), spd = .17, env = 0;
      if (mode === 'spricht' && !still) { env = this._env(t); amp = .014; spd = .2; }
      const tk = mode === 'denkt' ? .78 : mode === 'spricht' ? 1 + .09 * env : 1;
      this._k += (tk - this._k) * (still ? 1 : mode === 'spricht' ? .16 : .05);
      const R = (stage ? Math.min(w, h) * .31 : Math.min(w, h) * .34 * (parseFloat(this.getAttribute('scale')) || 1)) * this._k;
      const cx = stage ? w * this._x : w / 2, cy = stage ? h / 2 - 10 : h / 2 - (small ? 0 : 8);
      if (mode === 'hört') { amp = .04 * (.5 + .5 * Math.sin(s * 8)); spd = .22; }
      if (mode === 'denkt') { amp = .025; spd = .95; }
      if (st === 'session') spd *= 1.2;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, R * 1.7);
      g.addColorStop(0, `rgba(${rgb},${(.22 + .22 * env) * dim})`); g.addColorStop(.5, `rgba(${rgb},${(.06 + .07 * env) * dim})`); g.addColorStop(1, `rgba(${rgb},0)`);
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      const ry = s * spd, ca = Math.cos(ry), sa = Math.sin(ry), ct = Math.cos(.38), stt = Math.sin(.38), step = small ? 3 : 1;
      for (let i = 0; i < N; i += step) {
        const p = PTS[i];
        let X = p[0] * ca + p[2] * sa, Z = -p[0] * sa + p[2] * ca, Y = p[1];
        const Y2 = Y * ct - Z * stt; Z = Y * stt + Z * ct; Y = Y2;
        const k = 1 + amp * Math.sin(p[1] * 6 + s * 3.4) + amp * .6 * Math.sin(p[0] * 5 - s * 2.1), depth = (Z + 1) / 2;
        x.fillStyle = `rgba(${rgb},${((.12 + .85 * depth) * dim * (1 + env * .25)).toFixed(3)})`;
        const sz = ((small ? .7 : .6) + depth * (small ? 1 : 1.5)) * (1 + env * .35);
        x.fillRect(cx + X * R * k - sz / 2, cy + Y * R * k - sz / 2, sz, sz);
      }
      if (!small) {
        x.lineWidth = 1; x.strokeStyle = `rgba(${rgb},${.22 * dim})`; x.beginPath(); x.ellipse(cx, cy, R * 1.42, R * .34, -.12, 0, Math.PI * 2); x.stroke();
        x.strokeStyle = `rgba(${rgb},${(.7 + .3 * env) * dim})`; x.lineWidth = 1.5 + env; x.beginPath();
        const a0 = mode === 'denkt' ? s * 2 : s * .42; x.ellipse(cx, cy, R * 1.42, R * .34, -.12, a0, a0 + (mode === 'denkt' ? 1 : .5)); x.stroke();
        x.strokeStyle = `rgba(${rgb},${.12 * dim})`; x.lineWidth = 1; x.beginPath(); x.arc(cx, cy, R * 1.22, 0, Math.PI * 2); x.stroke();
        if ((st === 'session' || st === 'overdue') && mode !== 'ruht' && !still) {
          const ph = (s * .4) % 1, e = 1 - Math.pow(1 - ph, 2);
          x.strokeStyle = `rgba(${rgb},${(.16 * Math.sin(ph * Math.PI)).toFixed(3)})`; x.lineWidth = 1; x.beginPath(); x.arc(cx, cy, R * (1.24 + e * .18), 0, Math.PI * 2); x.stroke();
        }
      }
      if (stage && this._flyers.length) {
        let alive = false;
        this._flyers.forEach(f => {
          const p = (t - f.t0) / f.d; if (p < 0) { alive = true; return; } if (p > 1) return; alive = true;
          const e = 1 - Math.pow(1 - p, 2.2);
          const sx = cx + Math.cos(f.o) * R * f.rr, sy = cy + Math.sin(f.o) * R * f.rr * .6, mx = (sx + f.ex) / 2, my = (sy + f.ey) / 2 + f.cy;
          const X = (1 - e) * (1 - e) * sx + 2 * (1 - e) * e * mx + e * e * f.ex, Y = (1 - e) * (1 - e) * sy + 2 * (1 - e) * e * my + e * e * f.ey;
          x.fillStyle = `rgba(${rgb},${(.9 * (1 - Math.pow(p, 4))).toFixed(3)})`; x.beginPath(); x.arc(X, Y, 1.6 + (1 - p) * 1.2, 0, Math.PI * 2); x.fill();
        });
        if (!alive) this._flyers = [];
      }
    }
  }
  customElements.define('cira-orb', CiraOrb);
})();
