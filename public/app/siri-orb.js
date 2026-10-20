/* Vorlage: smoothui, https://github.com/educlopez/smoothui — MIT License, Copyright (c) 2024 Eduardo Calvo.
   Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
   documentation files, to deal in the Software without restriction, subject to: the above copyright notice and this
   permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS
   PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND. Volltext: https://github.com/educlopez/smoothui/blob/main/LICENSE */
/* Siri Orb – Port der smoothui-Komponente (educlopez/smoothui, packages/smoothui/components/siri-orb) als Web Component ohne React/Motion.
   Attribute: size (px), state (idle|listening|thinking|speaking|error), colors via CSS-Variablen --c1..--c4, --bg. Property: amplitude (0..1). */
(function(){
  if(customElements.get('siri-orb'))return;
  const RM=matchMedia('(prefers-reduced-motion: reduce)');
  const MOTION={idle:{speed:1,scale:1,glow:.35,reactivity:.6,sat:1,hue:0,breathe:true},listening:{speed:1.6,scale:1.04,glow:.6,reactivity:1,sat:1.1,hue:0},thinking:{speed:2.4,scale:.96,glow:.5,reactivity:.15,sat:1.05,hue:-10},speaking:{speed:1.9,scale:1.05,glow:.8,reactivity:1,sat:1.15,hue:0},error:{speed:.8,scale:1,glow:.7,reactivity:0,sat:1.3,hue:-40}};
  class SiriOrb extends HTMLElement{
    constructor(){super();this.attachShadow({mode:'open'});this._amp=0;this._ampS=0;this._state='idle';}
    static get observedAttributes(){return ['size','state'];}
    set amplitude(v){this._amp=Math.max(0,Math.min(1,+v||0));}
    get amplitude(){return this._amp;}
    attributeChangedCallback(){this._apply();}
    // c2invoice: prefers-reduced-motion oder "Bewegung reduzieren" (<html data-motion="off">) = Standbild, wie cira-orb.js.
    connectedCallback(){this._build();this._apply();this._loop=t=>{this._raf=requestAnimationFrame(this._loop);const still=RM.matches||document.documentElement.getAttribute('data-motion')==='off';this.classList.toggle('still',still);if(!still||!this._gemalt){this._gemalt=true;this._tick();}};this._raf=requestAnimationFrame(this._loop);}
    disconnectedCallback(){cancelAnimationFrame(this._raf);}
    _build(){
      this.shadowRoot.innerHTML=`<style>
      @property --angle{syntax:"<angle>";inherits:false;initial-value:0deg}
      :host{display:block;position:relative;width:var(--orb-size,192px);height:var(--orb-size,192px);--bg:oklch(12% 0.01 60);--c1:oklch(72% 0.19 55);--c2:oklch(78% 0.16 75);--c3:oklch(62% 0.2 40);--c4:oklch(84% 0.12 85)}
      .root{position:absolute;inset:0;transition:transform .25s cubic-bezier(.2,.8,.3,1)}
      .glow{position:absolute;inset:-12%;border-radius:50%;background:radial-gradient(circle at 50% 50%,var(--c2) 0%,transparent 64%);filter:blur(calc(var(--orb-size) * .28));transition:opacity .25s}
      .orb{position:absolute;inset:0;display:grid;grid-template-areas:"stack";overflow:hidden;border-radius:50%;isolation:isolate;transition:scale .12s linear,filter .25s}
      .orb::before,.orb::after,.orb>span{content:"";display:block;grid-area:stack;width:100%;height:100%;border-radius:50%}
      .sheen{background:radial-gradient(circle at 30% 24%,hsl(0 0% 100% / .32),transparent 34%),radial-gradient(circle at 72% 80%,hsl(0 0% 100% / .07),transparent 48%);mix-blend-mode:screen;animation:drift var(--drift,12s) ease-in-out infinite alternate}
      .rim{box-shadow:inset 0 0 0 1px hsl(0 0% 100% / .16),inset 0 var(--rim) calc(var(--rim)*2) hsl(0 0% 100% / .22),inset 0 calc(var(--rim)*-1.2) calc(var(--rim)*2.4) hsl(0 0% 0% / .4);pointer-events:none}
      @keyframes drift{0%{transform:translate(-6%,-4%) scale(1.05)}100%{transform:translate(7%,6%) scale(1.12)}}
      .orb::before{background:conic-gradient(from calc(var(--angle)*2) at 25% 70%,var(--c3),transparent 20% 80%,var(--c3)),conic-gradient(from calc(var(--angle)*2) at 45% 75%,var(--c2),transparent 30% 60%,var(--c2)),conic-gradient(from calc(var(--angle)*-3) at 80% 20%,var(--c1),transparent 40% 60%,var(--c1)),conic-gradient(from calc(var(--angle)*1.5) at 60% 35%,var(--c4),transparent 25% 75%,var(--c4)),conic-gradient(from calc(var(--angle)*2) at 15% 5%,var(--c2),transparent 10% 90%,var(--c2)),conic-gradient(from calc(var(--angle)*1) at 20% 80%,var(--c1),transparent 10% 90%,var(--c1)),conic-gradient(from calc(var(--angle)*-2) at 85% 10%,var(--c3),transparent 20% 80%,var(--c3));box-shadow:inset var(--bg) 0 0 var(--shadow) calc(var(--shadow)*.2);filter:blur(var(--blur)) contrast(var(--contrast)) saturate(1.4);animation:rotate var(--dur,20s) linear infinite}
      .orb::after{background-image:radial-gradient(circle at center,var(--bg) var(--dot),transparent var(--dot));background-size:calc(var(--dot)*2) calc(var(--dot)*2);backdrop-filter:blur(calc(var(--blur)*2)) contrast(calc(var(--contrast)*2));mix-blend-mode:overlay;mask-image:radial-gradient(black var(--mask),transparent 75%)}
      @keyframes rotate{to{--angle:360deg}}
      @keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}
      .root.breathe{animation:breathe 5.5s cubic-bezier(.645,.045,.355,1) infinite}
      @keyframes shake{0%,100%{transform:translateX(0)}33%{transform:translateX(-3px)}66%{transform:translateX(3px)}}
      .root.error{animation:shake .18s cubic-bezier(.645,.045,.355,1)}
      :host(.still) *,:host(.still) *::before,:host(.still) *::after{animation:none!important;transition:none!important}
      </style><div class="root"><div class="glow"></div><div class="orb"><span class="sheen"></span><span class="rim"></span></div></div>`;
      this._root=this.shadowRoot.querySelector('.root');this._glow=this.shadowRoot.querySelector('.glow');this._orb=this.shadowRoot.querySelector('.orb');
    }
    _apply(){if(!this._orb)return;const size=+(this.getAttribute('size')||192);const st=this.getAttribute('state')||'idle';this._state=st;const m=MOTION[st]||MOTION.idle;
      this.style.setProperty('--orb-size',size+'px');
      const blur=size<50?Math.max(size*.008,1):Math.max(size*.015,4),contrast=size<50?Math.max(size*.004,1.2):Math.max(size*.008,1.5),dot=size<50?Math.max(size*.004,.05):Math.max(size*.008,.1),shadow=size<50?Math.max(size*.004,.5):Math.max(size*.008,2),mask=size<30?'0%':size<50?'5%':size<100?'15%':'25%';
      this._blur=blur;this._m=m;
      const o=this._orb.style;o.setProperty('--blur',blur+'px');o.setProperty('--contrast',size<30?1.1:contrast);o.setProperty('--dot',dot+'px');o.setProperty('--shadow',shadow+'px');o.setProperty('--mask',mask);o.setProperty('--rim',Math.max(size*.06,1.5)+'px');o.setProperty('--dur',(20/m.speed)+'s');o.setProperty('--drift',((12/(1+m.speed))*2)+'s');o.style&&0;o.filter=`saturate(${m.sat}) hue-rotate(${m.hue}deg)`;
      this._glow.style.opacity=m.glow*.7;this._root.className='root'+(m.breathe?' breathe':'')+(st==='error'?' error':'');}
    _tick(){if(!this._orb)return;const m=this._m||MOTION.idle;this._ampS+=(this._amp-this._ampS)*(this._amp>this._ampS?.3:.1);const level=this._ampS*m.reactivity;
      this._orb.style.scale=String(m.scale+level*.12);this._orb.style.setProperty('--blur',(this._blur*(1-level*.45))+'px');}
  }
  customElements.define('siri-orb',SiriOrb);
})();
