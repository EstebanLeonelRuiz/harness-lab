"""Estado por alumno: calibración, clasificación, conteo, técnica, riesgo y métricas."""
from __future__ import annotations

import math
import warnings
from collections import defaultdict, deque

import numpy as np

from . import keypoints as K
from .classifier import ExerciseClassifier
from .features import MIN_CONF, PoseFeatures, extract
from .reps import SPECS, RepCounter, signal
from .types import Alert, RepEvent

# ---- Umbrales de técnica / riesgo (heurísticos, a validar con un profesional) ----
VALGUS_RATIO = 0.80  # rodillas más juntas que el 80% del ancho de tobillos en el fondo
LATERAL_SHIFT = 0.28  # cadera corrida >28% del ancho de base
FAST_ECC_S = 0.40  # bajada "en caída libre"
HIP_SAG = 0.07  # cadera hundida >7% del largo hombro-tobillo
HIP_PIKE = -0.10
KIPPING_SWING = 0.9  # rango de balanceo tobillos vs manos / torso
FATIGUE_RATIO = 1.35  # reps 35% más lentas que el inicio de la serie
FALL_MAX_S = 0.8  # de parado a horizontal en menos de esto
IMMOBILE_S = 8.0
SET_GAP_S = 20.0


def _median(xs):
    xs = [x for x in xs if not math.isnan(x)]
    return float(np.median(xs)) if xs else math.nan


class AthleteState:
    def __init__(self, name: str, fps: float, plan: dict | None = None):
        self.name = name
        self.fps = fps
        self.plan = plan or {}
        self.clf = ExerciseClassifier(fps)
        self.counters = {ex: RepCounter(spec) for ex, spec in SPECS.items()}
        self.hist: deque[PoseFeatures] = deque(maxlen=int(12 * fps))
        self.hip_samples: deque[float] = deque(maxlen=int(30 * fps))
        self.hip_calib = 0.0
        self.label = K.UNKNOWN
        self.pending: list[tuple[float, RepEvent]] = []
        self.reps: list[RepEvent] = []
        self.alerts: list[Alert] = []
        self._cooldown: dict[str, float] = {}
        # métricas
        self.time_by_label: dict[str, float] = defaultdict(float)
        self.segments: list[list] = []  # [label, t0, t1]
        self.floor_xy: np.ndarray | None = None
        self._floor_smooth: np.ndarray | None = None
        self._last_dist_xy: np.ndarray | None = None
        self.distance_m = 0.0
        self.trail: list[tuple[float, float]] = []
        self.last_seen = -1.0
        self.frames_seen = 0
        self.frames_valid = 0
        self.plank_hold = 0.0
        self.plank_best = 0.0
        self._t_vertical = None
        self._fall_t = None
        self._lying_since = None
        self._kbuf: deque[np.ndarray] = deque(maxlen=5)

    # ------------------------------------------------------------------ alerts
    def _alert(self, t, code, severity, message, cooldown=20.0, **data):
        if t - self._cooldown.get(code, -1e9) < cooldown:
            return None
        self._cooldown[code] = t
        a = Alert(t, self.name, code, severity, message, data)
        self.alerts.append(a)
        return a

    # ------------------------------------------------------------------ update
    def update_kpts(self, t: float, kpts: np.ndarray, floor_xy=None) -> list:
        """Suaviza keypoints (mediana temporal de 5 frames) y procesa el frame."""
        self._kbuf.append(kpts)
        stack = np.stack(self._kbuf)  # (n,17,3)
        ok = stack[:, :, 2] >= MIN_CONF
        xy = np.where(ok[..., None], stack[:, :, :2], np.nan)
        n_ok = ok.sum(axis=0)
        with np.errstate(all="ignore"), warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)
            med = np.nanmedian(xy, axis=0)
            conf = np.where(n_ok >= max(1, len(self._kbuf) // 2), np.nanmean(np.where(ok, stack[:, :, 2], np.nan), axis=0), 0.0)
        sm = np.concatenate([np.nan_to_num(med), np.nan_to_num(conf)[:, None]], axis=1)
        return self.update(t, extract(t, sm), floor_xy)

    def update(self, t: float, f: PoseFeatures, floor_xy=None) -> list:
        """Procesa un frame. Devuelve eventos nuevos (RepEvent / Alert)."""
        events: list = []
        dt = 0.0 if self.last_seen < 0 else min(t - self.last_seen, 1.0)
        self.last_seen = t
        self.frames_seen += 1
        if not f.valid:
            return events
        self.frames_valid += 1
        self.hist.append(f)

        # calibración: altura de cadera de pie (p95 de frames erguidos)
        if f.torso_incl < 20 and not math.isnan(f.hip_h_px):
            self.hip_samples.append(f.hip_h_px)
            if len(self.hip_samples) >= 5:
                self.hip_calib = float(np.percentile(self.hip_samples, 90))

        prev_label = self.label
        planned = self.plan.get("exercise")  # modo "bloque planificado por el profe"
        self.label = self.clf.update(f, self.hip_calib)
        if planned and self.label in K.EXERCISES and self.label != planned:
            self.label = planned
        self._track_time(t, dt, prev_label)
        self._update_floor(t, floor_xy)

        # contadores en paralelo; la rep se acredita si el clasificador coincide
        for ex, ctr in self.counters.items():
            out = ctr.update(t, signal(ex, f, self.hip_calib))
            if out:
                ev = RepEvent(self.name, ex, out[0], out[1], out[2], out[3], out[4])
                self.pending.append((t + 1.2, ev))
        still = []
        for deadline, ev in self.pending:
            # con plan cargado por el profe no hace falta esperar al clasificador (sin latencia en la 1ª rep)
            if self.label == ev.exercise or (planned and ev.exercise == planned and self.label != K.LYING):
                events.extend(self._credit_rep(ev))
            elif t < deadline:
                still.append((deadline, ev))
        self.pending = still

        events.extend(self._continuous_checks(t, f, dt))
        return events

    def _track_time(self, t, dt, prev_label):
        self.time_by_label[self.label] += dt
        if self.segments and self.segments[-1][0] == self.label and t - self.segments[-1][2] < 2.0:
            self.segments[-1][2] = t
        else:
            self.segments.append([self.label, t, t])
        if self.label == K.PLANK:
            self.plank_hold += dt
            self.plank_best = max(self.plank_best, self.plank_hold)
        elif prev_label == K.PLANK:
            self.plank_hold = 0.0

    def _update_floor(self, t, floor_xy):
        if floor_xy is None:
            return
        xy = np.asarray(floor_xy, float)
        self._floor_smooth = xy if self._floor_smooth is None else 0.15 * xy + 0.85 * self._floor_smooth
        self.floor_xy = self._floor_smooth
        if self._last_dist_xy is None:
            self._last_dist_xy = self.floor_xy.copy()
        step = float(np.linalg.norm(self.floor_xy - self._last_dist_xy))
        if step > 0.25:  # filtra jitter de keypoints
            self.distance_m += step
            self._last_dist_xy = self.floor_xy.copy()
        if not self.trail or t - self.trail[-1][0] >= 1.0:
            self.trail.append((round(t, 1), round(float(self.floor_xy[0]), 2), round(float(self.floor_xy[1]), 2)))

    # ------------------------------------------------------------- per-rep form
    def _rep_frames(self, ev: RepEvent):
        return [h for h in self.hist if ev.t_start - 0.05 <= h.t <= ev.t_end + 0.05]

    def _credit_rep(self, ev: RepEvent) -> list:
        out: list = [ev]
        fr = self._rep_frames(ev)
        if ev.exercise == K.SQUAT:
            bottom = [h for h in fr if self.hip_calib and not math.isnan(h.hip_h_px)
                      and h.hip_h_px / self.hip_calib < 0.85 and h.frontal > 0.35]
            vr = _median([h.valgus_ratio for h in bottom])
            if vr < VALGUS_RATIO:
                ev.flags.append("valgo_rodilla")
            ls = _median([abs(h.lateral_shift) for h in bottom])
            if ls > LATERAL_SHIFT:
                ev.flags.append("asimetria_lateral")
            if ev.eccentric < FAST_ECC_S:
                ev.flags.append("bajada_rapida")
        elif ev.exercise == K.PUSHUP:
            dev = _median([h.hip_dev for h in fr])
            if dev > HIP_SAG:
                ev.flags.append("cadera_hundida")
            elif dev < HIP_PIKE:
                ev.flags.append("cadera_alta")
            if ev.eccentric < FAST_ECC_S * 0.75:
                ev.flags.append("bajada_rapida")
        elif ev.exercise == K.PULLUP:
            sw = [h.swing for h in fr if not math.isnan(h.swing)]
            if len(sw) > 4 and (np.percentile(sw, 95) - np.percentile(sw, 5)) > KIPPING_SWING:
                ev.flags.append("kipping")
        if not ev.full_rom:
            ev.flags.append("rom_parcial")
        self.reps.append(ev)

        msgs = {
            "valgo_rodilla": ("riesgo", "Rodillas hacia adentro (valgo) en sentadilla: riesgo LCA/rótula"),
            "asimetria_lateral": ("aviso", "Carga asimétrica: cadera corrida hacia un lado"),
            "bajada_rapida": ("aviso", "Bajada sin control (excéntrica muy rápida)"),
            "cadera_hundida": ("riesgo", "Cadera hundida: hiperextensión lumbar"),
            "kipping": ("aviso", "Balanceo/kipping en dominadas: estrés de hombro"),
        }
        recent = [r for r in self.reps[-4:] if r.exercise == ev.exercise]
        for flag, (sev, msg) in msgs.items():
            # exigimos 2 de las últimas 4 reps con el mismo defecto (evita falsos positivos por ruido)
            if flag in ev.flags and sum(flag in r.flags for r in recent) >= 2:
                a = self._alert(ev.t_end, flag, sev, msg, cooldown=45.0, exercise=ev.exercise)
                if a:
                    out.append(a)
        a = self._fatigue_check(ev)
        if a:
            out.append(a)
        return out

    def current_set(self, ev: RepEvent) -> list[RepEvent]:
        s = []
        for r in reversed(self.reps):
            if r.exercise != ev.exercise:
                break
            if s and s[-1].t_start - r.t_end > SET_GAP_S:
                break
            s.append(r)
        return list(reversed(s))

    def _fatigue_check(self, ev: RepEvent):
        # sólo reps de rango completo: una rep parcial es más corta y sesga la línea base
        s = [r for r in self.current_set(ev) if r.full_rom]
        if len(s) < 7:
            return None
        base = np.median([r.duration for r in s[:3]])
        last = np.median([r.duration for r in s[-3:]])
        ratio = last / base
        spec = SPECS[ev.exercise]
        rom_loss = np.median([r.extreme for r in s[-3:]]) - np.median([r.extreme for r in s[:3]])
        rom_loss_rel = rom_loss / max(1e-6, spec.up - spec.full)
        if ratio > FATIGUE_RATIO or (ratio > 1.2 and rom_loss_rel > 0.25):
            return self._alert(ev.t_end, "fatiga", "aviso",
                               f"Fatiga: reps {ratio:.0%} de la duración inicial y pérdida de rango",
                               cooldown=90.0, ratio=round(float(ratio), 2),
                               rom_loss=round(float(rom_loss_rel), 2), exercise=ev.exercise)
        return None

    # -------------------------------------------------------- continuous checks
    def _continuous_checks(self, t, f: PoseFeatures, dt) -> list:
        out = []
        # Caída: de erguido a horizontal muy rápido y luego en el piso
        if f.torso_incl < 30:
            self._t_vertical = t
        if (f.torso_incl > 65 and self._t_vertical is not None and self._fall_t is None
                and t - self._t_vertical < FALL_MAX_S and self.label not in (K.PUSHUP, K.PLANK)):
            self._fall_t = t
        if self._fall_t is not None:
            # se confirma si en los 4 s siguientes queda "en el piso" (no en flexión/plancha)
            if self.label == K.LYING:
                a = self._alert(t, "caida", "critico", "Posible caída: pasó de parado a estar en el piso en <1 s",
                                cooldown=60.0)
                if a:
                    out.append(a)
                self._fall_t = None
            elif t - self._fall_t > 4.0:
                self._fall_t = None

        if self.label == K.LYING:
            self._lying_since = self._lying_since or t
            recent = [h for h in self.hist if h.t >= t - 3.0 and h.center_px is not None]
            if len(recent) > 3:
                c = np.array([h.center_px for h in recent])
                move = float(np.ptp(c, axis=0).max() / max(1.0, f.torso_px))
                if t - self._lying_since > IMMOBILE_S and move < 0.25:
                    a = self._alert(t, "inmovil_en_piso", "critico",
                                    f"Inmóvil en el piso hace >{IMMOBILE_S:.0f} s: revisar al alumno", cooldown=60.0)
                    if a:
                        out.append(a)
        else:
            self._lying_since = None

        # Plancha con cadera hundida (isométrico, no hay reps)
        if self.label == K.PLANK:
            dev = _median([h.hip_dev for h in self.hist if h.t >= t - 2.0])
            if dev > HIP_SAG:
                a = self._alert(t, "cadera_hundida", "riesgo", "Plancha con cadera hundida: hiperextensión lumbar",
                                cooldown=45.0, exercise=K.PLANK)
                if a:
                    out.append(a)
        return out

    # ----------------------------------------------------------------- summary
    def summary(self) -> dict:
        by_ex = {}
        for ex in K.EXERCISES:
            rs = [r for r in self.reps if r.exercise == ex]
            if not rs:
                continue
            full = [r for r in rs if r.full_rom]
            by_ex[ex] = {
                "reps": len(rs),
                "reps_validas": len(full),
                "reps_parciales": len(rs) - len(full),
                "duracion_media_s": round(float(np.mean([r.duration for r in rs])), 2),
                "excentrica_media_s": round(float(np.mean([r.eccentric for r in rs])), 2),
                "concentrica_media_s": round(float(np.mean([r.concentric for r in rs])), 2),
                "rom_medio": round(float(np.mean([r.extreme for r in rs])), 3),
                "reps_con_defecto": sum(1 for r in rs if set(r.flags) - {"rom_parcial"}),
            }
        rep_scores = []
        for r in self.reps:
            s = 100.0
            if not r.full_rom:
                s -= 30
            s -= 35 * len(set(r.flags) - {"rom_parcial"})
            rep_scores.append(max(0.0, s))
        active = sum(v for k, v in self.time_by_label.items() if k in K.ACTIVE_LABELS)
        rest = sum(v for k, v in self.time_by_label.items() if k not in K.ACTIVE_LABELS)
        fatigue = [a.data.get("ratio", 0) for a in self.alerts if a.code == "fatiga"]
        return {
            "athlete": self.name,
            "estado_actual": self.label,
            "reps_totales": len(self.reps),
            "por_ejercicio": by_ex,
            "tecnica_score": round(float(np.mean(rep_scores)), 1) if rep_scores else None,
            "tiempo_activo_s": round(active, 1),
            "tiempo_descanso_s": round(rest, 1),
            "densidad_trabajo": round(active / (active + rest), 2) if active + rest else None,
            "plancha_mejor_s": round(self.plank_best, 1),
            "distancia_m": round(self.distance_m, 1),
            "fatiga_max_ratio": max(fatigue) if fatigue else None,
            "alertas": len(self.alerts),
            "calidad_tracking": round(self.frames_valid / self.frames_seen, 3) if self.frames_seen else 0,
            "segmentos": [[s[0], round(s[1], 1), round(s[2], 1)] for s in self.segments if s[2] - s[1] >= 1.0],
            "trayectoria": self.trail,
            "reps_detalle": [r.as_dict() for r in self.reps],
        }
