"""Geometría 2D: ángulos articulares y homografía imagen <-> piso (metros)."""
from __future__ import annotations

import json
import math
from dataclasses import dataclass

import numpy as np


def angle_deg(a, b, c) -> float:
    """Ángulo ABC en grados (vértice en b). NaN si falta algún punto."""
    if a is None or b is None or c is None:
        return math.nan
    v1 = np.asarray(a, float) - np.asarray(b, float)
    v2 = np.asarray(c, float) - np.asarray(b, float)
    n1, n2 = np.linalg.norm(v1), np.linalg.norm(v2)
    if n1 < 1e-6 or n2 < 1e-6:
        return math.nan
    cos = float(np.dot(v1, v2) / (n1 * n2))
    return math.degrees(math.acos(max(-1.0, min(1.0, cos))))


def solve_homography(src: np.ndarray, dst: np.ndarray) -> np.ndarray:
    """DLT con >=4 correspondencias. Devuelve H (3x3) tal que dst ~ H @ src."""
    src = np.asarray(src, float)
    dst = np.asarray(dst, float)
    if src.shape[0] < 4:
        raise ValueError("Se necesitan al menos 4 puntos")
    rows = []
    for (x, y), (u, v) in zip(src, dst):
        rows.append([-x, -y, -1, 0, 0, 0, u * x, u * y, u])
        rows.append([0, 0, 0, -x, -y, -1, v * x, v * y, v])
    _, _, vt = np.linalg.svd(np.asarray(rows))
    h = vt[-1].reshape(3, 3)
    return h / h[2, 2]


def apply_h(h: np.ndarray, pts) -> np.ndarray:
    pts = np.atleast_2d(np.asarray(pts, float))
    homo = np.hstack([pts, np.ones((pts.shape[0], 1))]) @ h.T
    return homo[:, :2] / homo[:, 2:3]


@dataclass
class FloorCalibration:
    """Calibración de la cámara contra el piso.

    Se marcan 4+ puntos del piso en la imagen (p.ej. las 4 esquinas del área de
    25x25 m o conos) y sus coordenadas reales en metros.
    """

    image_points: np.ndarray  # (N,2) px
    floor_points: np.ndarray  # (N,2) m
    image_size: tuple[int, int] = (3840, 2160)
    area_m: tuple[float, float] = (25.0, 25.0)

    def __post_init__(self):
        self.image_points = np.asarray(self.image_points, float)
        self.floor_points = np.asarray(self.floor_points, float)
        self.H_img2floor = solve_homography(self.image_points, self.floor_points)
        self.H_floor2img = np.linalg.inv(self.H_img2floor)

    def to_floor(self, px) -> np.ndarray:
        return apply_h(self.H_img2floor, px)[0]

    def to_image(self, m) -> np.ndarray:
        return apply_h(self.H_floor2img, m)[0]

    def px_per_m(self, floor_xy) -> float:
        """Escala local aproximada (px por metro) en un punto del piso."""
        x, y = floor_xy
        a = self.to_image((x - 0.5, y))
        b = self.to_image((x + 0.5, y))
        return float(np.linalg.norm(b - a))

    def inside_area(self, floor_xy, margin: float = 0.5) -> bool:
        x, y = floor_xy
        w, d = self.area_m
        return -margin <= x <= w + margin and -margin <= y <= d + margin

    @classmethod
    def from_json(cls, path: str) -> "FloorCalibration":
        with open(path) as f:
            cfg = json.load(f)
        return cls(
            image_points=cfg["image_points"],
            floor_points=cfg["floor_points"],
            image_size=tuple(cfg.get("image_size", (3840, 2160))),
            area_m=tuple(cfg.get("area_m", (25.0, 25.0))),
        )
