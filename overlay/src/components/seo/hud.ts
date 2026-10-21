/* Shared HUD styling for the public SEO / embed / snapshot pages (inline, no extra request). */
export const HUD_CSS = `
.hud{--teal:#2DD4BF;--bg:#030912;--ink:#e6f1ff;--mut:#8ba3bd;--line:rgba(45,212,191,.18);background:var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,sans-serif;height:100vh;height:100dvh;overflow-y:auto;overflow-x:hidden;-webkit-font-smoothing:antialiased;position:relative}
body:has([data-rv-landing])>a[href="/credits"]{display:none}
.hud a{color:var(--teal)}
.hud::before{content:"";position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(rgba(45,212,191,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(45,212,191,.05) 1px,transparent 1px);background-size:56px 56px;mask-image:radial-gradient(ellipse at 50% 0%,#000 20%,transparent 75%);-webkit-mask-image:radial-gradient(ellipse at 50% 0%,#000 20%,transparent 75%)}
.hud::after{content:"";position:fixed;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.22) 0 1px,transparent 1px 3px);opacity:.45}
.hud-w{max-width:1080px;margin:0 auto;padding:0 20px;position:relative;z-index:1}
.hud-nav{display:flex;align-items:center;justify-content:space-between;height:60px;border-bottom:1px solid var(--line)}
.hud-brand{display:flex;gap:10px;align-items:center;color:var(--ink)!important;text-decoration:none;letter-spacing:.3em;font-size:13px}
.hud-mono{font-family:'JetBrains Mono',ui-monospace,monospace}
.hud-kick{font:12px 'JetBrains Mono',monospace;letter-spacing:.25em;color:var(--teal);margin:36px 0 10px}
.hud h1{font-size:clamp(30px,5vw,52px);line-height:1.05;margin:0 0 12px;letter-spacing:-.01em}
.hud h2{font-size:20px;margin:0 0 12px;font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.06em}
.hud-sub{color:var(--mut);font-size:17px;line-height:1.55;max-width:720px;margin:0 0 24px}
.hud-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.hud-g2{grid-template-columns:1.1fr 1fr}.hud-g12{grid-template-columns:1fr 2fr}.hud-short{display:none}
.hud-card{position:relative;border:1px solid var(--line);border-radius:4px;background:linear-gradient(180deg,rgba(13,24,40,.85),rgba(6,14,26,.85));padding:42px 18px 18px;transition:transform .45s cubic-bezier(.2,.8,.2,1),border-color .45s,box-shadow .45s}
.hud-card:hover{transform:translateY(-3px);border-color:rgba(45,212,191,.5);box-shadow:0 18px 50px -20px rgba(45,212,191,.35)}
.hud-card::before{content:attr(data-file);position:absolute;top:0;left:0;right:0;padding:8px 14px;font:10.5px 'JetBrains Mono',monospace;letter-spacing:.2em;color:#5eead4;border-bottom:1px dashed rgba(45,212,191,.3);background:rgba(45,212,191,.05)}
.hud-big{font:600 44px 'JetBrains Mono',monospace;line-height:1;margin:6px 0}
.hud-lbl{color:var(--mut);font-size:13px}
.hud-t{width:100%;border-collapse:collapse;font-size:14px}
.hud-t th{text-align:left;font:10.5px 'JetBrains Mono',monospace;letter-spacing:.15em;color:var(--mut);text-transform:uppercase;padding:6px 8px;border-bottom:1px solid var(--line)}
.hud-t td{padding:7px 8px;border-bottom:1px solid rgba(45,212,191,.07);vertical-align:top}
.hud-btn{display:inline-block;background:var(--teal);color:#032024!important;font-weight:700;border-radius:10px;padding:13px 20px;text-decoration:none;transition:transform .3s,box-shadow .3s}
.hud-btn:hover{transform:translateY(-1px);box-shadow:0 10px 30px -10px rgba(45,212,191,.8)}
.hud-ghost{display:inline-block;border:1px solid rgba(45,212,191,.4);color:var(--ink)!important;border-radius:10px;padding:12px 18px;text-decoration:none;transition:border-color .3s,background .3s}
.hud-ghost:hover{border-color:var(--teal);background:rgba(45,212,191,.06)}
.hud-map{width:100%;height:auto;display:block;border:1px solid var(--line);border-radius:4px;background:radial-gradient(ellipse at center,#06182a,#030912)}
.hud-map .land{fill:#0b2236;stroke:#1d4a66;stroke-width:.6}
.hud-map .hl{fill:rgba(45,212,191,.28);stroke:#2DD4BF;stroke-width:1.4}
.hud-map .dot{fill:#2DD4BF}
.hud-cta{margin:34px 0;padding:26px;border:1px solid rgba(45,212,191,.35);border-radius:6px;background:linear-gradient(120deg,rgba(45,212,191,.08),rgba(56,189,248,.04));display:flex;gap:18px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.hud-src{color:var(--mut);font-size:12.5px;line-height:1.6}
.hud-links{display:flex;flex-wrap:wrap;gap:8px}
.hud-links a{font-size:13px;border:1px solid var(--line);padding:6px 10px;border-radius:999px;text-decoration:none;color:var(--ink)}
.hud-links a:hover{border-color:var(--teal)}
.hud-foot{border-top:1px solid var(--line);margin-top:40px;padding:22px 0 40px;color:var(--mut);font-size:13px;display:flex;gap:16px;flex-wrap:wrap}
.hud-foot a{color:var(--mut)}
.hud-tgt{animation:hudtg .6s cubic-bezier(.2,1.6,.4,1) both;transform-origin:center;transform-box:fill-box}
@keyframes hudtg{from{opacity:0;transform:scale(2.4)}to{opacity:1;transform:none}}
@media(max-width:820px){.hud-grid,.hud-grid.hud-g2,.hud-grid.hud-g12{grid-template-columns:1fr}.hud-navx{display:none}.hud-btn .hud-long{display:none}.hud-btn .hud-short{display:inline}.hud-big{font-size:36px}.hud-card:hover{transform:none}}
@media(prefers-reduced-motion:reduce){.hud *{animation:none!important;transition:none!important}}
`;
