"""Features biomecánicas 2D por persona y por frame, a partir de keypoints COCO-17.

Todas las señales se normalizan por longitudes corporales (no por píxeles) para
que sean comparables entre alumnos cerca y lejos de la cámara.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from . import keypoints as K
from .geometry import angle_deg

MIN_CONF = 0.35
NAN = math.nan


def _pt(k: np.ndarray, i: int):
    return k[i, :2] if k[i, 2] >= MIN_CONF else None


def _mid(a, b):
    if a is None and b is None:
        return None
    if a is None:
        return b
    if b is None:
        return a
    return (a + b) / 2.0


def _nanmean(*vals) -> float:
    v = [x for x in vals if not math.isnan(x)]
    return sum(v) / len(v) if v else NAN


@dataclass
class PoseFeatures:
    t: float
    valid: bool
    mean_conf: float = NAN
    foot_px: np.ndarray | None = None  # punto de apoyo en el piso (px)
    center_px: np.ndarray | None = None
    torso_px: float = NAN  # largo hombro-cadera (px) = escala corporal
    torso_incl: float = NAN  # grados respecto de la vertical (0 = parado, 90 = horizontal)
    body_incl: float = NAN  # línea tobillos->hombros respecto de la vertical (robusta a cadera hundida)
    hip_h_px: float = NAN  # altura de cadera sobre tobillos (px)
    shoulder_floor: float = NAN  # altura de hombros sobre el "piso" / torso
    elbow_l: float = NAN
    elbow_r: float = NAN
    knee_l: float = NAN
    knee_r: float = NAN
    abduction: float = NAN  # abducción de hombro (0 brazos abajo, 180 arriba)
    wrists_above_head: float = NAN  # 1/0
    frontal: float = NAN  # ancho de hombros / torso (alto = vista frontal)
    valgus_ratio: float = NAN  # dist rodillas / dist tobillos (vista frontal)
    lateral_shift: float = NAN  # corrimiento de cadera sobre base / ancho de base
    hip_dev: float = NAN  # desvío de cadera respecto línea hombro-tobillo (+ = hundida)
    swing: float = NAN  # tobillos vs muñecas en x / torso (balanceo en barra)

    @property
    def elbow(self) -> float:
        return _nanmean(self.elbow_l, self.elbow_r)

    @property
    def knee(self) -> float:
        return _nanmean(self.knee_l, self.knee_r)


def extract(t: float, k: np.ndarray) -> PoseFeatures:
    conf = k[:, 2]
    if (conf >= MIN_CONF).sum() < 8:
        return PoseFeatures(t=t, valid=False, mean_conf=float(conf.mean()))

    p = {i: _pt(k, i) for i in range(K.N_KPTS)}
    sho = _mid(p[K.L_SHO], p[K.R_SHO])
    hip = _mid(p[K.L_HIP], p[K.R_HIP])
    ank = _mid(p[K.L_ANK], p[K.R_ANK])
    wri = _mid(p[K.L_WRI], p[K.R_WRI])
    if sho is None or hip is None:
        return PoseFeatures(t=t, valid=False, mean_conf=float(conf.mean()))

    f = PoseFeatures(t=t, valid=True, mean_conf=float(conf.mean()))
    vis = k[conf >= MIN_CONF, :2]
    f.center_px = vis.mean(axis=0)

    torso_v = sho - hip
    f.torso_px = float(np.linalg.norm(torso_v))
    if f.torso_px < 3:
        f.valid = False
        return f
    T = f.torso_px
    f.torso_incl = math.degrees(math.acos(max(-1.0, min(1.0, -torso_v[1] / T))))

    f.foot_px = ank if ank is not None else hip + np.array([0.0, 1.6 * T])
    if ank is not None:
        bv = sho - ank
        bl = float(np.linalg.norm(bv))
        if bl > 1e-6:
            f.body_incl = math.degrees(math.acos(max(-1.0, min(1.0, -bv[1] / bl))))
    if ank is not None:
        f.hip_h_px = float(ank[1] - hip[1])

    # "piso" local = el punto más bajo de apoyo (tobillos o muñecas)
    floor_candidates = [q[1] for q in (p[K.L_ANK], p[K.R_ANK], p[K.L_WRI], p[K.R_WRI]) if q is not None]
    if floor_candidates:
        f.shoulder_floor = float((max(floor_candidates) - sho[1]) / T)

    f.elbow_l = angle_deg(p[K.L_SHO], p[K.L_ELB], p[K.L_WRI])
    f.elbow_r = angle_deg(p[K.R_SHO], p[K.R_ELB], p[K.R_WRI])
    f.knee_l = angle_deg(p[K.L_HIP], p[K.L_KNE], p[K.L_ANK])
    f.knee_r = angle_deg(p[K.R_HIP], p[K.R_KNE], p[K.R_ANK])

    abds = []
    for s, w in ((K.L_SHO, K.L_WRI), (K.R_SHO, K.R_WRI)):
        if p[s] is not None and p[w] is not None:
            v = p[w] - p[s]
            n = np.linalg.norm(v)
            if n > 0.3 * T:  # brazo suficientemente visible en el plano de imagen
                abds.append(math.degrees(math.acos(max(-1.0, min(1.0, v[1] / n)))))
    f.abduction = float(np.mean(abds)) if abds else NAN

    if wri is not None and p[K.NOSE] is not None:
        f.wrists_above_head = 1.0 if wri[1] < p[K.NOSE][1] else 0.0

    if p[K.L_SHO] is not None and p[K.R_SHO] is not None:
        f.frontal = float(abs(p[K.L_SHO][0] - p[K.R_SHO][0]) / T)

    la, ra, lk, rk = p[K.L_ANK], p[K.R_ANK], p[K.L_KNE], p[K.R_KNE]
    if all(q is not None for q in (la, ra, lk, rk)):
        ank_w = abs(la[0] - ra[0])
        if ank_w > 0.25 * T:
            f.valgus_ratio = float(abs(lk[0] - rk[0]) / ank_w)
            f.lateral_shift = float((hip[0] - ank[0]) / ank_w)

    if ank is not None and f.body_incl > 45:
        v = sho - ank
        L = float(np.linalg.norm(v))
        if L > 1e-6:
            n = np.array([-v[1], v[0]]) / L
            if n[1] < 0:
                n = -n  # normal apuntando hacia abajo en la imagen (hacia el piso)
            f.hip_dev = float(np.dot(hip - ank, n) / L)

    if ank is not None and wri is not None:
        f.swing = float((ank[0] - wri[0]) / T)
    return f
