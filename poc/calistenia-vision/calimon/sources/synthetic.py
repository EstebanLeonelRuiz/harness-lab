"""Simulador de una clase de calistenia: 15 alumnos en 25x25 m vistos por 1 cámara.

Genera keypoints COCO-17 en píxeles (como los emitiría un detector de pose),
con un modelo de error que empeora con el tamaño aparente de la persona
(resolución + distancia), pérdidas de detección, oclusiones y cambios de
track_id. Guarda la verdad de campo (reps reales, defectos inyectados, caída)
para medir el sistema de punta a punta.

IMPORTANTE: el modelo de error es SUPUESTO (no medido contra un detector real);
sirve para validar la lógica y comparar escenarios, no para prometer precisión.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from .. import keypoints as K
from ..geometry import FloorCalibration
from ..types import Detection, Frame

RESOLUTIONS = {"4k": (3840, 2160), "1080p": (1920, 1080), "720p": (1280, 720)}

# Defectos inyectados por alumno (índice 1-based)
FAULTS = {
    3: "valgo_rodilla",
    5: "kipping",
    7: "cadera_hundida",
    9: "asimetria_lateral",
    11: "fatiga",
    12: "bajada_rapida",
    14: "caida",
}


def default_calibration(res: str = "4k") -> FloorCalibration:
    """Cámara de vigilancia en el medio de un lado, alta y detrás del área."""
    w, h = RESOLUTIONS[res]
    sx, sy = w / 3840, h / 2160
    img = np.array([[250, 2050], [3590, 2050], [2650, 520], [1190, 520]], float) * [sx, sy]
    floor = np.array([[0, 0], [25, 0], [25, 25], [0, 25]], float)
    return FloorCalibration(img, floor, image_size=(w, h), area_m=(25.0, 25.0))


def default_roster() -> list[dict]:
    xs = [2.5, 7.5, 12.5, 17.5, 22.5]
    ys = [5.0, 12.5, 20.0]
    roster = []
    i = 1
    for y in ys:
        for x in xs:
            roster.append({"name": f"A{i:02d}", "station": [x, y]})
            i += 1
    return roster


# ----------------------------------------------------------------- kinemática
@dataclass
class Body:
    H: float

    def __post_init__(self):
        H = self.H
        self.shin, self.thigh, self.torso = 0.25 * H, 0.245 * H, 0.30 * H
        self.uarm, self.farm, self.head = 0.17 * H, 0.16 * H, 0.13 * H
        self.sho_hw, self.hip_hw, self.stance = 0.115 * H, 0.085 * H, 0.10 * H
        self.ank_y = 0.04 * H


def _elbow(S, W, u, f, outward):
    S, W = np.asarray(S, float), np.asarray(W, float)
    v = W - S
    D = max(1e-6, float(np.linalg.norm(v)))
    D = min(D, u + f - 1e-6)
    e = v / D
    a = (u * u - f * f + D * D) / (2 * D)
    h = math.sqrt(max(0.0, u * u - a * a))
    n = np.array([-e[1], e[0]])
    if np.dot(n, outward) < 0:
        n = -n
    return S + a * e + h * n


def _blank():
    return np.zeros((K.N_KPTS, 2))


def pose_front_squat(b: Body, d: float, valgus=0.0, shift=0.0, arms_fwd=True):
    P = _blank()
    st = b.stance
    for side, sg in ((0, -1), (1, 1)):
        ank_i, kne_i, hip_i, sho_i, elb_i, wri_i = (
            (K.L_ANK, K.L_KNE, K.L_HIP, K.L_SHO, K.L_ELB, K.L_WRI) if side == 0
            else (K.R_ANK, K.R_KNE, K.R_HIP, K.R_SHO, K.R_ELB, K.R_WRI))
        P[ank_i] = (sg * st, b.ank_y)
        kx = st * (1 + 0.35 * d) if valgus == 0 else st * (1 - 0.55 * d * valgus)
        P[kne_i] = (sg * kx, b.ank_y + b.shin * (1 - 0.12 * d))
        hip_y = b.ank_y + (b.shin + b.thigh) * (1 - 0.45 * d)
        dx = shift * d * st
        P[hip_i] = (sg * b.hip_hw + dx, hip_y)
        lean = math.radians(40 * d)
        sho_y = hip_y + b.torso * math.cos(lean)
        P[sho_i] = (sg * b.sho_hw + dx, sho_y)
        a = 0.9 * d if arms_fwd else 0.0  # brazos hacia la cámara => se acortan en 2D
        P[elb_i] = P[sho_i] + (sg * 0.02 * b.H, -b.uarm * (1 - a))
        P[wri_i] = P[elb_i] + (sg * 0.01 * b.H, -b.farm * (1 - a))
    smid = (P[K.L_SHO] + P[K.R_SHO]) / 2
    P[K.NOSE] = smid + (0, b.head * math.cos(math.radians(40 * d)))
    return P


def pose_jj(b: Body, d: float):
    P = pose_front_squat(b, 0.0, arms_fwd=False)
    abd = math.radians(12 + 158 * d)
    arm = b.uarm + b.farm
    for sg, sho, elb, wri, ank, kne, hip in (
            (-1, K.L_SHO, K.L_ELB, K.L_WRI, K.L_ANK, K.L_KNE, K.L_HIP),
            (1, K.R_SHO, K.R_ELB, K.R_WRI, K.R_ANK, K.R_KNE, K.R_HIP)):
        dirv = np.array([sg * math.sin(abd), -math.cos(abd)])
        P[wri] = P[sho] + arm * dirv
        P[elb] = P[sho] + b.uarm * dirv
        P[ank] = (sg * (b.stance * 0.8 + 0.18 * b.H * d), b.ank_y)
        P[kne] = (P[hip] + P[ank]) / 2
    return P


def pose_pullup(b: Body, d: float, swing: float = 0.0, bar: float = 2.4):
    P = _blank()
    theta = math.radians(165 - 120 * d)
    u, f = b.uarm, b.farm
    D = math.sqrt(u * u + f * f - 2 * u * f * math.cos(theta))
    gx = 0.2 * b.H
    dx = gx - b.sho_hw
    dv = math.sqrt(max(1e-6, D * D - dx * dx))
    for sg, sho, elb, wri, hip, kne, ank in (
            (-1, K.L_SHO, K.L_ELB, K.L_WRI, K.L_HIP, K.L_KNE, K.L_ANK),
            (1, K.R_SHO, K.R_ELB, K.R_WRI, K.R_HIP, K.R_KNE, K.R_ANK)):
        P[wri] = (sg * gx, bar)
        P[sho] = (sg * b.sho_hw, bar - dv)
        P[elb] = _elbow(P[sho], P[wri], u, f, np.array([sg, 0.0]))
        P[hip] = (sg * b.hip_hw + 0.4 * swing, bar - dv - b.torso)
        P[kne] = (sg * b.hip_hw * 0.9 + 0.7 * swing, P[hip][1] - b.thigh)
        P[ank] = (sg * b.hip_hw * 0.8 + 1.0 * swing, P[kne][1] - b.shin)
    smid = (P[K.L_SHO] + P[K.R_SHO]) / 2
    P[K.NOSE] = smid + (0, b.head)
    return P


def pose_pushup(b: Body, d: float, sag: float = 0.0, facing: int = 1):
    """Vista lateral. d=0 brazos extendidos (plancha alta), d=1 pecho abajo."""
    P = _blank()
    theta = math.radians(170 - 90 * d)
    u, f = b.uarm, b.farm
    D = math.sqrt(u * u + f * f - 2 * u * f * math.cos(theta))
    A = np.array([0.0, 0.06 * b.H])
    wy = 0.03 * b.H
    Lb = b.shin + b.thigh + b.torso
    hs = wy + D - A[1]
    xw = math.sqrt(max(1e-6, Lb * Lb - hs * hs))
    S = np.array([xw, wy + D])
    W = np.array([xw, wy])
    v = (S - A) / Lb
    n = np.array([v[1], -v[0]])  # normal hacia el piso
    if n[1] > 0:
        n = -n
    Kn = A + v * b.shin
    Hp = A + v * (b.shin + b.thigh) + n * sag * Lb
    E = _elbow(S, W, u, f, np.array([-1.0, 0.0]))
    far = np.array([0.012 * b.H, 0.006 * b.H])
    for near_i, far_i, pt in ((K.L_ANK, K.R_ANK, A), (K.L_KNE, K.R_KNE, Kn), (K.L_HIP, K.R_HIP, Hp),
                              (K.L_SHO, K.R_SHO, S), (K.L_ELB, K.R_ELB, E), (K.L_WRI, K.R_WRI, W)):
        P[near_i] = pt
        P[far_i] = pt + far
    P[K.NOSE] = S + (0.12 * b.H, 0.03 * b.H)
    P[:, 0] *= facing
    return P


def pose_lying(b: Body, facing: int = 1):
    P = _blank()
    xs = {K.L_ANK: 0.0, K.L_KNE: b.shin, K.L_HIP: b.shin + b.thigh,
          K.L_SHO: b.shin + b.thigh + b.torso, K.L_ELB: b.shin + b.thigh + b.torso - 0.05 * b.H,
          K.L_WRI: b.shin + b.thigh + 0.08 * b.H}
    ys = {K.L_ANK: 0.05, K.L_KNE: 0.07, K.L_HIP: 0.09, K.L_SHO: 0.09, K.L_ELB: 0.12, K.L_WRI: 0.1}
    pair = {K.L_ANK: K.R_ANK, K.L_KNE: K.R_KNE, K.L_HIP: K.R_HIP, K.L_SHO: K.R_SHO, K.L_ELB: K.R_ELB,
            K.L_WRI: K.R_WRI}
    for i, x in xs.items():
        P[i] = (x, ys[i] * b.H)
        P[pair[i]] = (x + 0.01 * b.H, ys[i] * b.H + 0.03 * b.H)
    P[K.NOSE] = P[K.L_SHO] + (0.12 * b.H, 0.02 * b.H)
    P[:, 0] *= facing
    return P


def _rep_profile(u: float, ecc=0.42, hold=0.08, con=0.38):
    """Profundidad d(u) para u en [0,1) dentro de una rep."""
    if u < ecc:
        return 0.5 - 0.5 * math.cos(math.pi * u / ecc)
    if u < ecc + hold:
        return 1.0
    if u < ecc + hold + con:
        return 0.5 + 0.5 * math.cos(math.pi * (u - ecc - hold) / con)
    return 0.0


# --------------------------------------------------------------- programa
@dataclass
class AthleteSim:
    idx: int
    name: str
    station: np.ndarray
    body: Body
    rng: np.random.Generator
    fps: float
    fault: str | None = None
    facing: int = 1
    frames: list = field(default_factory=list)  # (local_pts, floor_xy, front_view)
    truth_reps: list = field(default_factory=list)  # (exercise, t_end, full)
    truth_fall: float | None = None
    tempo: dict = field(default_factory=dict)

    @property
    def t(self):
        return len(self.frames) / self.fps

    def emit(self, P, xy=None, view="front"):
        self.frames.append((P, np.asarray(self.station if xy is None else xy, float).copy(), view))

    def hold(self, P, seconds, xy=None, view="front", breathe=0.004):
        for _ in range(int(seconds * self.fps)):
            jitter = self.rng.normal(0, breathe * self.body.H, P.shape)
            self.emit(P + jitter, xy, view)

    def blend(self, P0, P1, seconds, view="front"):
        n = max(1, int(seconds * self.fps))
        for i in range(n):
            a = (i + 1) / n
            self.emit((1 - a) * P0 + a * P1, view=view)

    def stand(self):
        return pose_front_squat(self.body, 0.0, arms_fwd=False)

    def rest(self, seconds, walk_to=None):
        P = self.stand()
        if walk_to is None or seconds < 30:
            self.hold(P, seconds)
            return
        target = np.asarray(walk_to, float)
        dist = float(np.linalg.norm(target - self.station))
        t_walk = dist / 1.2
        n = int(t_walk * self.fps)
        for back in (False, True):
            for i in range(n):
                a = (i + 1) / n
                xy = self.station + (target - self.station) * (1 - a if back else a)
                step = math.sin(2 * math.pi * 0.9 * i / self.fps)
                Pw = P.copy()
                Pw[K.L_ANK, 0] += 0.06 * self.body.H * step
                Pw[K.R_ANK, 0] -= 0.06 * self.body.H * step
                self.emit(Pw, xy)
            if not back:
                self.hold(P, max(0.0, seconds - 2 * t_walk), xy=target)

    def do_set(self, ex: str, n_reps: int, fall_at: int | None = None):
        b = self.body
        base = self.tempo[ex]
        if ex == K.PUSHUP:
            self.blend(self.stand(), pose_pushup(b, 0, self._sag(), self.facing), 2.0, view="side")
        for r in range(n_reps):
            if fall_at is not None and r == fall_at:
                self.fall()
                return
            prog = r / max(1, n_reps - 1)
            dur = base * (1 + (0.75 * prog if self.fault == "fatiga" else 0.0)) * self.rng.uniform(0.93, 1.07)
            depth = 1.0
            if self.fault == "fatiga":
                depth = 1.0 - 0.15 * prog
            if self.rng.random() < 0.08:
                depth = 0.55  # rep parcial
            ecc = 0.12 if (self.fault == "bajada_rapida" and ex == K.SQUAT) else 0.42
            con = 0.38 if ecc == 0.42 else 0.60
            if ex == K.JUMPING_JACK:
                ecc, con = 0.45, 0.45
            n = int(dur * self.fps)
            for i in range(n):
                d = depth * _rep_profile(i / n, ecc=ecc, con=con)
                self.emit(self._pose(ex, d, r, i / n), view="side" if ex == K.PUSHUP else "front")
            self.truth_reps.append((ex, self.t, depth >= 0.8))
        if ex == K.PUSHUP:
            self.blend(pose_pushup(b, 0, self._sag(), self.facing), self.stand(), 2.0)

    def _sag(self):
        return 0.12 if self.fault == "cadera_hundida" else float(self.rng.uniform(-0.02, 0.02))

    def _pose(self, ex, d, r, u):
        b = self.body
        if ex == K.SQUAT:
            return pose_front_squat(b, d, valgus=1.0 if self.fault == "valgo_rodilla" else 0.0,
                                    shift=0.8 if self.fault == "asimetria_lateral" else 0.0)
        if ex == K.JUMPING_JACK:
            return pose_jj(b, d)
        if ex == K.PULLUP:
            amp = 0.25 * b.H if self.fault == "kipping" else 0.02 * b.H
            return pose_pullup(b, d, swing=amp * math.sin(2 * math.pi * u))
        if ex == K.PUSHUP:
            return pose_pushup(b, d, self._sag(), self.facing)
        raise ValueError(ex)

    def plank(self, seconds):
        P0 = pose_pushup(self.body, 0.0, self._sag(), self.facing)
        self.blend(self.stand(), P0, 2.0, view="side")
        self.hold(P0, seconds, view="side")
        self.blend(P0, self.stand(), 2.0)

    def fall(self):
        self.truth_fall = self.t
        L = pose_lying(self.body, self.facing)
        self.blend(self.stand(), L, 0.45, view="side")
        self.hold(L, 15.0, view="side", breathe=0.002)
        self.blend(L, self.stand(), 2.5)
        self.rest(40)


CIRCUIT = [(K.SQUAT, 15), (K.PUSHUP, 12), (K.PULLUP, 6), (K.JUMPING_JACK, 25), (K.PLANK, 30)]


class SyntheticClass:
    def __init__(self, n_athletes=15, rounds=2, fps=15.0, resolution="4k", seed=7, occlusion=True,
                 error_scale=1.0):
        # error_scale=1.0: modelo pesimista (blur, compresión H.264, poses en el piso).
        # error_scale~0.5: aprox. lo medido con YOLO11m-pose real en imágenes estáticas
        # (experiments/pose_vs_resolution.py).
        self.error_scale = error_scale
        self.fps = fps
        self.resolution = resolution
        self.calib = default_calibration(resolution)
        self.roster = default_roster()[:n_athletes]
        self.rng = np.random.default_rng(seed)
        self.occlusion = occlusion
        self.sims: list[AthleteSim] = []
        water = (12.5, 23.5)
        for i, a in enumerate(self.roster, start=1):
            rng = np.random.default_rng(seed * 100 + i)
            sim = AthleteSim(i, a["name"], np.asarray(a["station"], float), Body(rng.uniform(1.55, 1.90)), rng, fps,
                             fault=FAULTS.get(i), facing=1 if i % 2 else -1)
            sim.tempo = {K.SQUAT: rng.uniform(1.9, 2.8), K.PUSHUP: rng.uniform(1.6, 2.4),
                         K.PULLUP: rng.uniform(2.6, 3.6), K.JUMPING_JACK: rng.uniform(0.9, 1.2)}
            sim.hold(sim.stand(), rng.uniform(2.0, 6.0))
            order = CIRCUIT[(i - 1) % 5:] + CIRCUIT[:(i - 1) % 5]
            for rnd in range(rounds):
                for j, (ex, n) in enumerate(order):
                    if ex == K.PLANK:
                        sim.plank(n)
                    else:
                        fall_at = 8 if (sim.fault == "caida" and ex == K.SQUAT and rnd == 0) else None
                        sim.do_set(ex, n, fall_at)
                    sim.rest(rng.uniform(25, 45), walk_to=water if (j + i) % 3 == 0 else None)
            self.sims.append(sim)
        self.n_frames = max(len(s.frames) for s in self.sims)

    # ------------------------------------------------------- error model
    def _project(self, sim: AthleteSim, P, xy, view):
        rng = self.rng
        o = self.calib.to_image(xy)
        s = self.calib.px_per_m(xy)
        img = np.empty((K.N_KPTS, 3))
        img[:, 0] = o[0] + P[:, 0] * s
        img[:, 1] = o[1] - P[:, 1] * s * 0.85
        h = sim.body.H * s * 0.85  # alto aparente de la persona en px
        e = self.error_scale
        sigma = e * h * (0.012 + 0.03 * np.clip((150 - h) / 150, 0, 1))
        img[:, :2] += rng.normal(0, sigma, (K.N_KPTS, 2))
        p_out = e * float(np.clip((110 - h) / 250, 0.01, 0.3))
        out = rng.random(K.N_KPTS) < p_out
        img[out, :2] += rng.normal(0, 0.15 * h, (out.sum(), 2))
        base = float(np.clip((h - 25) / 90, 0.05, 0.97))
        conf = np.clip(base + rng.normal(0, 0.08, K.N_KPTS), 0, 1)
        if view == "side":
            far = [K.R_ANK, K.R_KNE, K.R_HIP, K.R_SHO, K.R_ELB, K.R_WRI, K.R_EYE, K.R_EAR]
            conf[far] *= 0.75
        img[:, 2] = conf
        p_miss = e * float(np.clip((70 - h) / 150, 0.003, 0.4))
        return img, h, p_miss

    def frames(self):
        tracks = {s.name: s.idx for s in self.sims}
        next_tid = 100
        occl_until = {s.name: -1.0 for s in self.sims}
        occl_len = {s.name: 0.0 for s in self.sims}
        p_occl = 1.0 / (60.0 * self.fps)  # ~1 oclusión por minuto por alumno
        for fi in range(self.n_frames):
            t = fi / self.fps
            dets = []
            for sim in self.sims:
                P, xy, view = sim.frames[min(fi, len(sim.frames) - 1)]
                if self.occlusion and t >= occl_until[sim.name] and self.rng.random() < p_occl:
                    occl_len[sim.name] = self.rng.uniform(0.5, 2.5)
                    occl_until[sim.name] = t + occl_len[sim.name]
                if t < occl_until[sim.name]:
                    continue
                if occl_len[sim.name] > 0:
                    if occl_len[sim.name] > 1.5:
                        tracks[sim.name] = next_tid  # oclusión larga: el tracker suele dar ID nuevo
                        next_tid += 1
                    occl_len[sim.name] = 0.0
                kp, h, p_miss = self._project(sim, P, xy, view)
                if self.rng.random() < p_miss:
                    continue
                x0, y0 = kp[:, :2].min(axis=0)
                x1, y1 = kp[:, :2].max(axis=0)
                dets.append(Detection(tracks[sim.name], kp, (x0, y0, x1, y1)))
            yield Frame(t, fi, dets)

    def truth(self) -> dict:
        return {s.name: {"reps": s.truth_reps, "fault": s.fault, "fall": s.truth_fall} for s in self.sims}
