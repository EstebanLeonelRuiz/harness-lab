"""Reporte HTML autocontenido de una sesión (tablero para el profesor)."""
from __future__ import annotations

import html

from . import keypoints as K

COLORS = {
    K.SQUAT: "#2a78d6", K.PUSHUP: "#e06c2a", K.PULLUP: "#8a4fd1", K.JUMPING_JACK: "#1f9e6e",
    K.PLANK: "#c9a227", K.REST: "var(--rest)", K.LYING: "#d0312d", K.UNKNOWN: "var(--rest)",
}
SEV = {"critico": "#d0312d", "riesgo": "#e06c2a", "aviso": "#c9a227", "info": "#7a8794"}


def _fmt_t(t):
    return f"{int(t // 60):02d}:{int(t % 60):02d}"


def _gantt(rep):
    dur = max(1.0, rep["duracion_s"])
    W, row, left = 1000, 22, 46
    H = row * len(rep["atletas"]) + 26
    parts = [f'<svg viewBox="0 0 {W + left} {H}" role="img" aria-label="Línea de tiempo por alumno">']
    for m in range(0, int(dur) + 1, 60):
        x = left + W * m / dur
        parts.append(f'<line x1="{x:.1f}" y1="0" x2="{x:.1f}" y2="{H - 18}" class="grid"/>'
                     f'<text x="{x:.1f}" y="{H - 4}" class="tick" text-anchor="middle">{m // 60}m</text>')
    alerts = {}
    for a in rep["alertas"]:
        alerts.setdefault(a["athlete"], []).append(a)
    for i, ath in enumerate(rep["atletas"]):
        y = i * row + 2
        parts.append(f'<text x="0" y="{y + 14}" class="lbl">{ath["athlete"]}</text>')
        for lab, t0, t1 in ath["segmentos"]:
            if lab in (K.REST, K.UNKNOWN):
                continue
            x0, x1 = left + W * t0 / dur, left + W * t1 / dur
            parts.append(f'<rect x="{x0:.1f}" y="{y + 3}" width="{max(1.0, x1 - x0):.1f}" height="{row - 8}" rx="2" '
                         f'fill="{COLORS.get(lab, "#999")}"><title>{lab} {_fmt_t(t0)}–{_fmt_t(t1)}</title></rect>')
        for a in alerts.get(ath["athlete"], []):
            if a["severity"] == "info":
                continue
            x = left + W * a["t"] / dur
            parts.append(f'<path d="M{x:.1f},{y + 1} l5,9 l-10,0 z" fill="{SEV[a["severity"]]}" stroke="var(--bg)" '
                         f'stroke-width="1"><title>{_fmt_t(a["t"])} {html.escape(a["message"])}</title></path>')
    parts.append("</svg>")
    return "".join(parts)


def _floor(rep):
    w, d = rep["area_m"]
    S = 16
    heat = rep["heatmap"]
    mx = max(1, max(max(r) for r in heat))
    parts = [f'<svg viewBox="-10 -10 {w * S + 20} {d * S + 20}" role="img" aria-label="Mapa del área 25x25 m">',
             f'<rect x="0" y="0" width="{w * S}" height="{d * S}" class="area"/>']
    for gy, r in enumerate(heat):
        for gx, v in enumerate(r):
            if v:
                parts.append(f'<rect x="{gx * S}" y="{(d - gy - 1) * S}" width="{S}" height="{S}" '
                             f'fill="#2a78d6" opacity="{0.08 + 0.6 * (v / mx) ** 0.5:.2f}"/>')
    for ath in rep["atletas"]:
        tr = ath["trayectoria"]
        if len(tr) > 1:
            pts = " ".join(f"{x * S:.1f},{(d - y) * S:.1f}" for _, x, y in tr)
            parts.append(f'<polyline points="{pts}" class="trail"/>')
        sx, sy = ath["estacion"]
        parts.append(f'<circle cx="{sx * S}" cy="{(d - sy) * S}" r="5" class="st"/>'
                     f'<text x="{sx * S + 7}" y="{(d - sy) * S - 6}" class="lbl">{ath["athlete"]}</text>')
    parts.append(f'<text x="{w * S / 2}" y="{d * S + 9}" class="tick" text-anchor="middle">cámara ▼</text>')
    parts.append("</svg>")
    return "".join(parts)


def _ex_cell(ath, ex):
    e = ath["por_ejercicio"].get(ex)
    if not e:
        return "<td class='num muted'>–</td>"
    extra = f" <span class='muted'>({e['reps_parciales']} parc.)</span>" if e["reps_parciales"] else ""
    return f"<td class='num'>{e['reps_validas']}{extra}</td>"


def render(rep: dict, evaluation: dict | None = None, title: str = "Clase de calistenia") -> str:
    n_alert = {s: sum(1 for a in rep["alertas"] if a["severity"] == s) for s in SEV}
    total_reps = sum(a["reps_totales"] for a in rep["atletas"])
    rows = []
    for a in rep["atletas"]:
        al = [x for x in rep["alertas"] if x["athlete"] == a["athlete"] and x["severity"] != "info"]
        chips = " ".join(f'<span class="chip" style="--c:{SEV[x["severity"]]}">{html.escape(x["code"])}</span>'
                         for x in {x["code"]: x for x in al}.values())
        score = a["tecnica_score"]
        rows.append(
            f"<tr><td><b>{a['athlete']}</b></td>"
            + "".join(_ex_cell(a, ex) for ex in K.EXERCISES)
            + f"<td class='num'>{a['plancha_mejor_s']:.0f}s</td>"
            f"<td class='num'>{'' if score is None else f'{score:.0f}'}</td>"
            f"<td class='num'>{a['tiempo_activo_s'] / 60:.1f}′</td>"
            f"<td class='num'>{(a['densidad_trabajo'] or 0) * 100:.0f}%</td>"
            f"<td class='num'>{a['distancia_m']:.0f} m</td>"
            f"<td>{chips}</td></tr>")
    alert_rows = "".join(
        f"<tr><td class='num'>{_fmt_t(a['t'])}</td><td><span class='dot' style='--c:{SEV[a['severity']]}'></span>"
        f"{a['severity']}</td><td><b>{html.escape(a['athlete'])}</b></td><td>{html.escape(a['message'])}</td></tr>"
        for a in rep["alertas"] if a["severity"] != "info")
    legend = "".join(f'<span class="lg"><i style="background:{COLORS[k]}"></i>{k}</span>'
                     for k in (K.SQUAT, K.PUSHUP, K.PULLUP, K.JUMPING_JACK, K.PLANK, K.LYING))
    ev_html = ""
    if evaluation:
        r = evaluation["reps"]
        ev_html = (
            "<section><h2>Validación contra verdad de campo (simulación)</h2><div class='kpis'>"
            f"<div><span>F1 conteo de reps</span><b>{r['f1']:.3f}</b><small>precisión {r['precision']:.3f} · recall {r['recall']:.3f}</small></div>"
            f"<div><span>ROM completo vs parcial</span><b>{(r['rom_completo_vs_parcial_acierto'] or 0) * 100:.1f}%</b><small>acierto en reps emparejadas</small></div>"
            f"<div><span>Defectos inyectados detectados</span><b>{sum(evaluation['defectos_detectados'].values())}/{len(evaluation['defectos_detectados'])}</b><small>{', '.join(k for k, v in evaluation['defectos_detectados'].items() if not v) or 'todos'}</small></div>"
            f"<div><span>Falsas alertas de técnica</span><b>{len(evaluation['falsas_alertas_riesgo'])}</b><small>{', '.join(evaluation['falsas_alertas_riesgo'][:6]) or 'ninguna'}</small></div>"
            "</div><p class='muted'>Datos sintéticos con un modelo de error supuesto: valida la lógica, no garantiza la precisión con video real.</p></section>")
    return f"""<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Monitor de calistenia</title>
<style>
:root{{--bg:#f7f8fa;--card:#fff;--fg:#1c232b;--muted:#6b7682;--line:#e3e7ec;--rest:#d5dbe2}}
@media (prefers-color-scheme:dark){{:root{{--bg:#12161b;--card:#1b2128;--fg:#e6eaee;--muted:#93a0ad;--line:#2b333c;--rest:#36404a}}}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}}
main{{max-width:1180px;margin:0 auto;padding:20px 16px 48px}}h1{{font-size:22px;margin:0 0 4px}}h2{{font-size:16px;margin:0 0 12px}}
section{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;margin-top:16px;overflow-x:auto}}
.kpis{{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}}.kpis div{{display:flex;flex-direction:column}}
.kpis span{{color:var(--muted);font-size:12px}}.kpis b{{font-size:24px;font-variant-numeric:tabular-nums}}.kpis small{{color:var(--muted)}}
table{{border-collapse:collapse;width:100%;min-width:760px}}th,td{{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);white-space:nowrap}}
th{{font-size:12px;color:var(--muted);font-weight:600}}.num{{text-align:right;font-variant-numeric:tabular-nums}}.muted{{color:var(--muted)}}
.chip{{display:inline-block;border:1px solid var(--c);color:var(--c);border-radius:10px;padding:0 7px;font-size:11px;margin-right:3px}}
.dot{{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--c);margin-right:6px}}
svg{{width:100%;height:auto;display:block}}.grid{{stroke:var(--line)}}.tick,.lbl{{fill:var(--muted);font-size:11px}}
.area{{fill:none;stroke:var(--muted);stroke-dasharray:4 3}}.trail{{fill:none;stroke:var(--fg);stroke-opacity:.35;stroke-width:1}}.st{{fill:var(--fg)}}
.two{{display:grid;grid-template-columns:2fr 1fr;gap:16px}}@media(max-width:860px){{.two{{grid-template-columns:1fr}}}}
.lg{{margin-right:12px;font-size:12px;color:var(--muted)}}.lg i{{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}}
</style></head><body><main>
<h1>{html.escape(title)}</h1><div class="muted">Duración {_fmt_t(rep['duracion_s'])} · {len(rep['atletas'])} alumnos · área {rep['area_m'][0]:.0f}×{rep['area_m'][1]:.0f} m · {rep['fps']:.0f} fps · reasignaciones de ID: {rep['reasignaciones_id']}</div>
<section><div class="kpis">
<div><span>Repeticiones totales</span><b>{total_reps}</b></div>
<div><span>Alertas críticas</span><b style="color:{SEV['critico']}">{n_alert['critico']}</b><small>caída / inmóvil en el piso</small></div>
<div><span>Alertas de riesgo de lesión</span><b style="color:{SEV['riesgo']}">{n_alert['riesgo']}</b><small>valgo, cadera hundida</small></div>
<div><span>Avisos de técnica / carga</span><b>{n_alert['aviso']}</b><small>fatiga, kipping, asimetría, proximidad</small></div>
</div></section>
{ev_html}
<section><h2>Actividad por alumno</h2><div>{legend}<span class="lg">▲ alerta</span></div>{_gantt(rep)}</section>
<section class="two" style="overflow:visible;background:none;border:none;padding:0">
<section style="margin:0"><h2>Alertas</h2><table style="min-width:520px"><thead><tr><th>t</th><th>nivel</th><th>alumno</th><th>detalle</th></tr></thead><tbody>{alert_rows or '<tr><td colspan=4 class=muted>Sin alertas</td></tr>'}</tbody></table></section>
<section style="margin:0"><h2>Piso (ocupación y recorridos)</h2>{_floor(rep)}</section>
</section>
<section><h2>Desempeño por alumno</h2><table><thead><tr><th>alumno</th><th class="num">sentadillas</th><th class="num">flexiones</th><th class="num">dominadas</th><th class="num">jumping jacks</th><th class="num">mejor plancha</th><th class="num">técnica</th><th class="num">activo</th><th class="num">densidad</th><th class="num">recorrido</th><th>defectos detectados</th></tr></thead><tbody>{''.join(rows)}</tbody></table>
<p class="muted">Reps = válidas con rango completo (parciales entre paréntesis). Técnica = 100 por rep limpia, −30 por rango parcial, −35 por defecto. Densidad = tiempo activo / tiempo total.</p></section>
</main></body></html>"""
