"""Clasificador de ejercicio por reglas sobre una ventana temporal (~2 s).

Para producción conviene reemplazarlo por un modelo temporal entrenado
(ST-GCN / PoseC3D / un GRU sobre keypoints) o, más simple y robusto, que el
profesor cargue el bloque planificado ("ahora: 3x15 sentadillas") y el sistema
sólo verifique. Ver docs/FACTIBILIDAD.md.
"""
from __future__ import annotations

import math
from collections import deque

import numpy as np

from . import keypoints as K
from .features import PoseFeatures


def _rng(vals):
    v = np.asarray([x for x in vals if not math.isnan(x)])
    if len(v) < 4:
        return 0.0
    return float(np.percentile(v, 90) - np.percentile(v, 10))


def _med(vals):
    v = [x for x in vals if not math.isnan(x)]
    return float(np.median(v)) if v else math.nan


class ExerciseClassifier:
    def __init__(self, fps: float, window_s: float = 2.0, confirm_s: float = 0.6, eval_hz: float = 5.0):
        self.buf: deque[PoseFeatures] = deque(maxlen=max(4, int(window_s * fps)))
        self.stride = max(1, int(round(fps / eval_hz)))
        self.confirm_n = max(1, int(confirm_s * eval_hz))
        self._n = 0
        self.label = K.UNKNOWN
        self._cand = K.UNKNOWN
        self._cand_n = 0

    def raw_label(self, hip_calib: float) -> str:
        fs = [f for f in self.buf if f.valid]
        if len(fs) < max(4, self.buf.maxlen // 3):
            return K.UNKNOWN
        # horizontalidad por la línea tobillo-hombro (si faltan tobillos, por el torso)
        incl = _med([f.torso_incl if math.isnan(f.body_incl) else f.body_incl for f in fs])
        elbow_rng = _rng([f.elbow for f in fs])

        if incl > 55:
            # flexión: el codo se flexiona Y los hombros suben/bajan (evita confundir ruido con reps)
            if elbow_rng > 28 and _rng([f.shoulder_floor for f in fs]) > 0.2:
                return K.PUSHUP
            if _med([f.shoulder_floor for f in fs]) > 0.45:
                return K.PLANK
            return K.LYING

        wah = _med([f.wrists_above_head for f in fs])
        if wah >= 0.9 and elbow_rng > 35:
            return K.PULLUP
        if _rng([f.abduction for f in fs]) > 80:
            return K.JUMPING_JACK
        if hip_calib:
            hip_rng = _rng([f.hip_h_px / hip_calib for f in fs])
            if hip_rng > 0.18:
                return K.SQUAT
        return K.REST

    def update(self, f: PoseFeatures, hip_calib: float) -> str:
        self.buf.append(f)
        self._n += 1
        if self._n % self.stride:
            return self.label
        raw = self.raw_label(hip_calib)
        if raw == self._cand:
            self._cand_n += 1
        else:
            self._cand, self._cand_n = raw, 1
        if self._cand_n >= self.confirm_n or (raw == K.LYING and self._cand_n >= 1):
            self.label = self._cand
        return self.label
