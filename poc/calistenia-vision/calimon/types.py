from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np


@dataclass
class Detection:
    track_id: int
    kpts: np.ndarray  # (17, 3): x_px, y_px, confianza
    bbox: tuple[float, float, float, float] | None = None
    score: float = 1.0


@dataclass
class Frame:
    t: float  # segundos desde el inicio de la sesión
    index: int
    detections: list[Detection]
    image: Any = None  # np.ndarray BGR si viene de video real


@dataclass
class Alert:
    t: float
    athlete: str
    code: str
    severity: str  # "info" | "aviso" | "riesgo" | "critico"
    message: str
    data: dict = field(default_factory=dict)

    def as_dict(self):
        return {
            "t": round(self.t, 2),
            "athlete": self.athlete,
            "code": self.code,
            "severity": self.severity,
            "message": self.message,
            "data": self.data,
        }


@dataclass
class RepEvent:
    athlete: str
    exercise: str
    t_start: float
    t_bottom: float
    t_end: float
    extreme: float  # valor mínimo de la señal (profundidad / ROM)
    full_rom: bool
    flags: list[str] = field(default_factory=list)

    @property
    def duration(self) -> float:
        return self.t_end - self.t_start

    @property
    def eccentric(self) -> float:
        return self.t_bottom - self.t_start

    @property
    def concentric(self) -> float:
        return self.t_end - self.t_bottom

    def as_dict(self):
        return {
            "exercise": self.exercise,
            "t_end": round(self.t_end, 2),
            "duration": round(self.duration, 2),
            "ecc": round(self.eccentric, 2),
            "con": round(self.concentric, 2),
            "extreme": round(self.extreme, 3),
            "full_rom": self.full_rom,
            "flags": self.flags,
        }
