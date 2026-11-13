"""Sesión de entrenamiento: identidad de alumnos, posición en el piso y reglas grupales."""
from __future__ import annotations

import itertools
import math

import numpy as np

from . import keypoints as K
from .athlete import AthleteState
from .features import MIN_CONF
from .geometry import FloorCalibration
from .types import Alert, Frame

PROXIMITY_M = 0.9
LOST_S = 5.0
REASSIGN_M = 2.5


def foot_point(k: np.ndarray):
    """Punto de apoyo en el piso: tobillos visibles; si no, base del bbox de keypoints."""
    ank = k[[K.L_ANK, K.R_ANK]]
    ok = ank[:, 2] >= MIN_CONF
    if ok.any():
        return ank[ok, :2].mean(axis=0)
    vis = k[k[:, 2] >= MIN_CONF, :2]
    if len(vis) < 5:
        return None
    return np.array([vis[:, 0].mean(), vis[:, 1].max()])


class IdentityRegistry:
    """Asocia track_ids (que cambian tras oclusiones) a alumnos persistentes.

    PoC: cada alumno arranca en su estación conocida; cuando aparece un track
    nuevo se asigna al alumno libre más cercano a su última posición conocida.
    Producción: pecheras numeradas / colores + re-ID por apariencia (OSNet), o
    check-in con QR al empezar. Ver FACTIBILIDAD.md (identidad).
    """

    def __init__(self, roster: list[dict]):
        self.roster = roster
        self.last_xy = {a["name"]: np.asarray(a["station"], float) for a in roster}
        self.last_t = {a["name"]: -1.0 for a in roster}
        self.track_to_name: dict[int, str] = {}
        self.reassignments = 0

    def resolve(self, t: float, track_id: int, xy: np.ndarray | None, active_tracks: set[int]) -> str | None:
        name = self.track_to_name.get(track_id)
        if name is None and xy is not None:
            taken = {self.track_to_name[tid] for tid in active_tracks if tid in self.track_to_name and tid != track_id}
            best, best_score = None, math.inf
            for a in self.roster:
                n = a["name"]
                if n in taken:
                    continue
                d = float(np.linalg.norm(self.last_xy[n] - xy))
                if self.last_t[n] < 0:
                    # alumno aún no visto: acepta cualquier track (auto-enrolamiento), con menor prioridad
                    score = d + 100.0
                else:
                    lost_s = t - self.last_t[n]
                    # radio de búsqueda crece con el tiempo perdido (velocidad máx. ~2 m/s caminando/trotando)
                    if d > REASSIGN_M + 2.0 * lost_s:
                        continue
                    score = d - (1.0 if lost_s > 0.5 else 0.0)  # preferir alumnos que acaban de perderse
                if score < best_score:
                    best, best_score = n, score
            if best is not None:
                stale = [tid for tid, nm in self.track_to_name.items() if nm == best]
                for tid in stale:
                    del self.track_to_name[tid]
                if self.last_t[best] >= 0:
                    self.reassignments += 1
                self.track_to_name[track_id] = best
                name = best
        if name is not None:
            if xy is not None:
                self.last_xy[name] = xy
            self.last_t[name] = t
        return name


class Session:
    def __init__(self, calib: FloorCalibration, roster: list[dict], fps: float, plan: dict | None = None):
        self.calib = calib
        self.fps = fps
        self.roster = roster
        self.ids = IdentityRegistry(roster)
        self.athletes = {a["name"]: AthleteState(a["name"], fps, plan) for a in roster}
        self.session_alerts: list[Alert] = []
        self.events: list = []
        self.t = 0.0
        self.n_frames = 0
        self._cool: dict[tuple, float] = {}
        self.heat = np.zeros((int(math.ceil(calib.area_m[1])), int(math.ceil(calib.area_m[0]))), int)

    def _alert(self, t, athlete, code, sev, msg, cooldown=30.0, **data):
        key = (athlete, code)
        if t - self._cool.get(key, -1e9) < cooldown:
            return
        self._cool[key] = t
        a = Alert(t, athlete, code, sev, msg, data)
        self.session_alerts.append(a)
        self.events.append(a)

    def process(self, frame: Frame) -> list:
        t = frame.t
        self.t = t
        self.n_frames += 1
        new_events: list = []
        active = {d.track_id for d in frame.detections}
        seen = set()
        for det in frame.detections:
            foot = foot_point(det.kpts)
            xy = self.calib.to_floor(foot) if foot is not None else None
            name = self.ids.resolve(t, det.track_id, xy, active)
            if name is None or name in seen:
                continue
            seen.add(name)
            ath = self.athletes[name]
            evs = ath.update_kpts(t, det.kpts, xy)
            new_events.extend(evs)
            if xy is not None:
                gx, gy = int(xy[0]), int(xy[1])
                if 0 <= gy < self.heat.shape[0] and 0 <= gx < self.heat.shape[1]:
                    self.heat[gy, gx] += 1
                if not self.calib.inside_area(xy):
                    self._alert(t, name, "fuera_de_area", "info", "Salió del área de entrenamiento", 60.0)

        if self.n_frames % max(1, int(self.fps)) == 0:
            self._group_checks(t)
        self.events.extend(new_events)
        return new_events

    def _group_checks(self, t):
        dynamic = (K.JUMPING_JACK, K.PULLUP, K.SQUAT, K.PUSHUP)
        live = [a for a in self.athletes.values() if a.floor_xy is not None and t - a.last_seen < 1.0]
        for a, b in itertools.combinations(live, 2):
            d = float(np.linalg.norm(a.floor_xy - b.floor_xy))
            if d < PROXIMITY_M and (a.label in dynamic or b.label in dynamic):
                self._alert(t, f"{a.name}+{b.name}", "proximidad", "aviso",
                            f"{a.name} y {b.name} a {d:.1f} m durante ejercicio dinámico", 30.0)
        for a in self.athletes.values():
            if a.last_seen >= 0 and t - a.last_seen > LOST_S:
                self._alert(t, a.name, "sin_tracking", "info",
                            f"Sin seguimiento hace {t - a.last_seen:.0f} s (oclusión o salió de cámara)", 60.0)

    def report(self) -> dict:
        alerts = sorted([a for ath in self.athletes.values() for a in ath.alerts] + self.session_alerts,
                        key=lambda a: a.t)
        return {
            "duracion_s": round(self.t, 1),
            "fps": self.fps,
            "frames": self.n_frames,
            "area_m": list(self.calib.area_m),
            "reasignaciones_id": self.ids.reassignments,
            "atletas": [self.athletes[a["name"]].summary() | {"estacion": a["station"]} for a in self.roster],
            "alertas": [a.as_dict() for a in alerts],
            "heatmap": self.heat.tolist(),
        }
