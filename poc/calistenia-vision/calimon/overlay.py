"""Dibuja esqueleto, nombre, ejercicio, reps y alertas sobre el frame (modo video)."""
from __future__ import annotations

from . import keypoints as K
from .features import MIN_CONF

SEV_COLOR = {"info": (200, 200, 200), "aviso": (0, 200, 255), "riesgo": (0, 120, 255), "critico": (0, 0, 255)}


def draw(img, frame, session):
    import cv2

    name_by_track = session.ids.track_to_name
    for det in frame.detections:
        k = det.kpts
        for a, b in K.SKELETON:
            if k[a, 2] >= MIN_CONF and k[b, 2] >= MIN_CONF:
                cv2.line(img, tuple(map(int, k[a, :2])), tuple(map(int, k[b, :2])), (80, 220, 80), 2)
        name = name_by_track.get(det.track_id)
        if not name:
            continue
        ath = session.athletes[name]
        x0, y0 = (int(det.bbox[0]), int(det.bbox[1])) if det.bbox is not None else (0, 0)
        txt = f"{name} {ath.label} reps:{len(ath.reps)}"
        cv2.putText(img, txt, (x0, max(15, y0 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        recent = [a for a in ath.alerts if frame.t - a.t < 5.0]
        if recent:
            a = recent[-1]
            cv2.putText(img, a.code, (x0, max(30, y0 + 14)), cv2.FONT_HERSHEY_SIMPLEX, 0.6,
                        SEV_COLOR.get(a.severity, (0, 0, 255)), 2)
    return img
