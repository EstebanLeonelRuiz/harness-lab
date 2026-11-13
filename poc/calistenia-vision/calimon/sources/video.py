"""Fuente real: archivo de video o stream RTSP del NVR -> YOLO-pose + ByteTrack.

Requiere `pip install ultralytics` (instala PyTorch). En GPU (RTX 3060/4060,
Jetson Orin) un modelo yolo11m-pose procesa 4K a 10-15 fps; en CPU sólo sirve
para pruebas offline. Ver docs/FACTIBILIDAD.md (cómputo).
"""
from __future__ import annotations

from collections.abc import Iterator

import numpy as np

from ..types import Detection, Frame


def video_frames(source: str, model: str = "yolo11m-pose.pt", imgsz: int = 1280, conf: float = 0.25,
                 tracker: str = "bytetrack.yaml", device: str | None = None, keep_image: bool = False,
                 fps_override: float | None = None) -> Iterator[Frame]:
    from ultralytics import YOLO  # import diferido: el resto del PoC no depende de torch

    import cv2

    cap = cv2.VideoCapture(source)
    fps = fps_override or cap.get(cv2.CAP_PROP_FPS) or 15.0
    cap.release()

    yolo = YOLO(model)
    stream = yolo.track(source=source, stream=True, persist=True, tracker=tracker, imgsz=imgsz, conf=conf,
                        device=device, verbose=False, classes=[0])
    for i, r in enumerate(stream):
        dets: list[Detection] = []
        if r.keypoints is not None and r.boxes is not None and r.boxes.id is not None:
            kxy = r.keypoints.xy.cpu().numpy()  # (n,17,2)
            kcf = r.keypoints.conf.cpu().numpy() if r.keypoints.conf is not None else np.ones(kxy.shape[:2])
            ids = r.boxes.id.int().cpu().numpy()
            boxes = r.boxes.xyxy.cpu().numpy()
            scores = r.boxes.conf.cpu().numpy()
            for j in range(len(ids)):
                k = np.concatenate([kxy[j], kcf[j][:, None]], axis=1)
                dets.append(Detection(int(ids[j]), k, tuple(boxes[j]), float(scores[j])))
        yield Frame(t=i / fps, index=i, detections=dets, image=r.orig_img if keep_image else None)


def fps_of(source: str) -> float:
    import cv2

    cap = cv2.VideoCapture(source)
    fps = cap.get(cv2.CAP_PROP_FPS) or 15.0
    cap.release()
    return float(fps)
