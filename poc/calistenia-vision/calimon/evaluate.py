"""Compara la salida del sistema contra la verdad de campo del simulador."""
from __future__ import annotations

from collections import defaultdict

from . import keypoints as K

FAULT_CODES = {"valgo_rodilla", "kipping", "cadera_hundida", "asimetria_lateral", "fatiga", "bajada_rapida", "caida"}


def evaluate(report: dict, truth: dict, tol_s: float = 1.2) -> dict:
    tp = fp = fn = 0
    rom_ok = rom_n = 0
    per_ex = defaultdict(lambda: {"real": 0, "detectadas": 0, "tp": 0})
    per_athlete = {}
    for ath in report["atletas"]:
        name = ath["athlete"]
        real = list(truth[name]["reps"])
        det = [(r["exercise"], r["t_end"], r["full_rom"]) for r in ath["reps_detalle"]]
        used = [False] * len(real)
        a_tp = 0
        for ex, t, full in det:
            per_ex[ex]["detectadas"] += 1
            best, best_dt = None, tol_s
            for i, (rex, rt, rfull) in enumerate(real):
                if not used[i] and rex == ex and abs(rt - t) <= best_dt:
                    best, best_dt = i, abs(rt - t)
            if best is None:
                fp += 1
            else:
                used[best] = True
                tp += 1
                a_tp += 1
                per_ex[ex]["tp"] += 1
                rom_n += 1
                rom_ok += int(real[best][2] == full)
        for rex, _, _ in real:
            per_ex[rex]["real"] += 1
        fn += used.count(False)
        per_athlete[name] = {"real": len(real), "detectadas": len(det), "tp": a_tp}

    # alertas de técnica / riesgo
    alerts_by = defaultdict(set)
    alert_t = defaultdict(list)
    for a in report["alertas"]:
        alerts_by[a["athlete"]].add(a["code"])
        alert_t[(a["athlete"], a["code"])].append(a["t"])
    faults = {}
    false_alerts = []
    for name, tr in truth.items():
        f = tr["fault"]
        if f:
            hit = f in alerts_by[name]
            if f == "caida" and hit:
                hit = any(0 <= t - tr["fall"] <= 6 for t in alert_t[(name, "caida")])
            faults[f"{name}:{f}"] = hit
        for code in alerts_by[name] & FAULT_CODES:
            if code != f:
                false_alerts.append(f"{name}:{code}")

    prec = tp / (tp + fp) if tp + fp else 0.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    return {
        "reps": {
            "reales": tp + fn,
            "detectadas": tp + fp,
            "precision": round(prec, 3),
            "recall": round(rec, 3),
            "f1": round(2 * prec * rec / (prec + rec), 3) if prec + rec else 0.0,
            "rom_completo_vs_parcial_acierto": round(rom_ok / rom_n, 3) if rom_n else None,
            "por_ejercicio": {k: dict(v) for k, v in per_ex.items() if k in K.EXERCISES},
        },
        "por_atleta": per_athlete,
        "defectos_detectados": faults,
        "recall_defectos": round(sum(faults.values()) / len(faults), 3) if faults else None,
        "falsas_alertas_riesgo": sorted(false_alerts),
        "inmovil_detectado": any("inmovil_en_piso" in alerts_by[n] for n, tr in truth.items() if tr["fall"]),
    }
