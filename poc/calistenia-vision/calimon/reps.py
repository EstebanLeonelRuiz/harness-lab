"""Contador de repeticiones por máquina de estados con histéresis.

Cada ejercicio se reduce a una señal 1D que es ALTA en reposo y BAJA en el punto
de máximo esfuerzo (sentadilla: altura de cadera normalizada; flexión/dominada:
ángulo de codo; jumping jack: 180 - abducción de hombro). Así un único contador
sirve para todos, cambiando sólo los umbrales.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from . import keypoints as K
from .features import PoseFeatures


@dataclass(frozen=True)
class RepSpec:
    exercise: str
    down: float  # cruzar por debajo => entra en fase "abajo"
    up: float  # volver por encima => repetición completa
    full: float  # el extremo debe llegar por debajo de esto para ROM completo
    min_s: float = 0.4
    max_s: float = 10.0


SPECS = {
    K.SQUAT: RepSpec(K.SQUAT, down=0.80, up=0.92, full=0.68),
    K.PUSHUP: RepSpec(K.PUSHUP, down=128, up=150, full=102),
    K.PULLUP: RepSpec(K.PULLUP, down=120, up=145, full=78),
    K.JUMPING_JACK: RepSpec(K.JUMPING_JACK, down=95, up=135, full=45, min_s=0.3),
}


def signal(exercise: str, f: PoseFeatures, hip_calib: float) -> float:
    if not f.valid:
        return math.nan
    if exercise == K.SQUAT:
        if math.isnan(f.hip_h_px) or not hip_calib or f.torso_incl > 50:
            return math.nan
        return f.hip_h_px / hip_calib
    if exercise in (K.PUSHUP, K.PULLUP):
        return f.elbow
    if exercise == K.JUMPING_JACK:
        return 180.0 - f.abduction if not math.isnan(f.abduction) else math.nan
    return math.nan


class RepCounter:
    def __init__(self, spec: RepSpec, alpha: float = 0.55, max_gap_s: float = 1.5):
        self.spec = spec
        self.alpha = alpha
        self.max_gap_s = max_gap_s
        self.reset()

    def reset(self):
        self.state = "top"
        self.ema = math.nan
        self.t_last = None
        self.t_leave = None
        self.t_bottom = None
        self.extreme = math.inf
        self.samples: list[tuple[float, float]] = []
        self.armed = False  # sólo cuenta si antes se vio la posición inicial (evita contar transiciones)

    def update(self, t: float, v: float):
        """Devuelve (t_start, t_bottom, t_end, extreme, full) al completar una rep."""
        if math.isnan(v):
            if self.t_last is not None and t - self.t_last > self.max_gap_s:
                self.reset()  # oclusión larga: no inventamos repeticiones
            return None
        self.t_last = t
        self.ema = v if math.isnan(self.ema) else self.alpha * v + (1 - self.alpha) * self.ema
        x, s = self.ema, self.spec

        if self.state == "top":
            if x > s.up:
                self.armed = True
            if not self.armed:
                return None
            if x < s.up:
                if self.t_leave is None:
                    self.t_leave = t
                    self.samples = []
                self.samples.append((t, x))
            else:
                self.t_leave = None
            if x < s.down:
                self.state = "bottom"
                self.extreme, self.t_bottom = x, t
                if self.t_leave is None:
                    self.t_leave = t
            return None

        # state == bottom
        self.samples.append((t, x))
        if x < self.extreme:
            self.extreme, self.t_bottom = x, t
        if x > s.up:
            # "fondo" = centro de la meseta cerca del extremo (robusto a ruido de keypoints)
            thr = self.extreme + 0.12 * (s.up - self.extreme)
            plateau = [ts for ts, xs in self.samples if xs <= thr]
            t_bottom = (plateau[0] + plateau[-1]) / 2 if plateau else self.t_bottom
            out = (self.t_leave, t_bottom, t, self.extreme, self.extreme <= s.full)
            self.state, self.t_leave, self.extreme, self.samples = "top", None, math.inf, []
            dur = out[2] - out[0]
            if s.min_s <= dur <= s.max_s:
                return out
        return None
