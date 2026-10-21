export const EMBED_CSS = `html,body{margin:0;background:#030912}body:has([data-rv-landing])>a[href="/credits"]{display:none}
.rve{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#e6f1ff;background:#030912;border:1px solid rgba(45,212,191,.3);border-radius:6px;min-height:100vh;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;background-image:repeating-linear-gradient(0deg,rgba(0,0,0,.2) 0 1px,transparent 1px 3px)}
.rve-top{display:flex;justify-content:space-between;gap:8px;padding:8px 12px;font:10.5px ui-monospace,'JetBrains Mono',monospace;letter-spacing:.18em;color:#5eead4;border-bottom:1px dashed rgba(45,212,191,.3);background:rgba(45,212,191,.05);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rve-body{display:flex;align-items:center;gap:12px;padding:12px;flex:1}
.rve-name{font-size:20px;font-weight:600}.rve-big{font:700 40px ui-monospace,monospace;line-height:1.1}.rve-big small{font-size:14px;color:#8ba3bd}
.rve-lbl{color:#8ba3bd;font-size:12px}
.rve-pw{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-top:1px solid rgba(45,212,191,.18);font-size:12px}
.rve-pw a{color:#2DD4BF;text-decoration:none;font-weight:600}.rve-pw a:hover{text-decoration:underline}`;
export function Powered({ href, label }: { href: string; label: string }) {
  return <div className="rve-pw"><span className="rve-lbl">{label}</span><a href={href} target="_blank" rel="noopener">Powered by RemoteView ↗</a></div>;
}
