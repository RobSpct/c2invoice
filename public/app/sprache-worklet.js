'use strict';
/* AudioWorklet fuer Push-to-Talk (C10): Mikrofon → 16 kHz mono Int16 fuer
   whisper, dazu der Pegel je 100 ms (Stille-Erkennung, Orb). Eigene Datei,
   weil die CSP keine Worklets aus blob: zulaesst. Herunterrechnen per
   Mittelwert ueber das Fenster — fuer Sprache reicht das. */
class C2iAufnahme extends AudioWorkletProcessor {
  constructor() {
    super();
    this.schritt = sampleRate / 16000;
    this.pos = 0; this.summe = 0; this.n = 0;
    this.aus = []; this.q = 0; this.qn = 0;
  }
  process(inputs) {
    const ein = inputs[0] && inputs[0][0];
    if (!ein) return true;
    for (let i = 0; i < ein.length; i++) {
      const s = ein[i];
      this.q += s * s; this.qn++;
      this.summe += s; this.n++;
      if (++this.pos >= this.schritt) {
        this.pos -= this.schritt;
        this.aus.push(Math.max(-1, Math.min(1, this.summe / this.n)) * 0x7fff);
        this.summe = 0; this.n = 0;
      }
    }
    if (this.aus.length >= 1600) {
      this.port.postMessage({ pcm: Int16Array.from(this.aus), rms: Math.sqrt(this.q / this.qn) });
      this.aus = []; this.q = 0; this.qn = 0;
    }
    return true;
  }
}
registerProcessor('c2i-aufnahme', C2iAufnahme);
