// Theme vor dem ersten Paint (K2), sonst blitzt beim Laden das falsche auf.
// Steht synchron im <head> vor app.css; eigene Datei statt Inline-Skript, weil
// die CSP Inline-Skripte nur per Hash erlaubt (server.js).
// Wahl je Browser: system | dunkel | hell (Einstellungen → Darstellung, shell.js setzeTheme).
(function () {
  var w = 'system';
  try { w = localStorage.getItem('c2invoice.theme') || 'system'; } catch (e) { /* ohne Speicher: System */ }
  var hell = w === 'hell' || (w !== 'dunkel' && window.matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.setAttribute('data-theme', hell ? 'light' : 'dark');
})();
