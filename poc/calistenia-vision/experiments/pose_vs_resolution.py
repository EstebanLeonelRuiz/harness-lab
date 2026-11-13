"""Experimento con un detector REAL (YOLO11-pose): ¿cuánto se degradan los keypoints
cuando la persona ocupa pocos píxeles (persona lejos / cámara de baja resolución)?

Método: se detecta la pose en la imagen original (referencia, persona ~400+ px de alto),
se achica la imagen para que la persona mida H px, se pega en un lienzo 1920x1080
con compresión JPEG tipo CCTV, se vuelve a detectar y se compara contra la referencia
escalada. Mide degradación por resolución (no exactitud absoluta del modelo).

Uso:
  python experiments/pose_vs_resolution.py --images bus.jpg zidane.jpg --models yolo11n-pose.pt yolo11m-pose.pt
"""
from __future__ import annotations

import argparse
import json
import math
import sys
import time
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from calimon import keypoints as K  # noqa: E402
from calimon.geometry import angle_deg  # noqa: E402

TARGETS = [400, 250, 160, 120, 90, 70, 50, 35]
JOINTS = {
    "codo_izq": (K.L_SHO, K.L_ELB, K.L_WRI), "codo_der": (K.R_SHO, K.R_ELB, K.R_WRI),
    "rodilla_izq": (K.L_HIP, K.L_KNE, K.L_ANK), "rodilla_der": (K.R_HIP, K.R_KNE, K.R_ANK),
}


def iou(a, b):
    x0, y0, x1, y1 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, x1 - x0) * max(0, y1 - y0)
    ua = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / ua if ua else 0.0


def detect(model, img, imgsz):
    r = model.predict(img, imgsz=imgsz, conf=0.2, classes=[0], verbose=False)[0]
    if r.keypoints is None or r.boxes is None or len(r.boxes) == 0:
        return np.zeros((0, 4)), np.zeros((0, 17, 3))
    k = np.concatenate([r.keypoints.xy.cpu().numpy(), r.keypoints.conf.cpu().numpy()[..., None]], axis=2)
    return r.boxes.xyxy.cpu().numpy(), k


def run(images, model_paths, canvas=(1920, 1080), jpeg_q=60):
    from ultralytics import YOLO

    out = {}
    for mp in model_paths:
        model = YOLO(mp)
        rows = {h: {"personas": 0, "detectadas": 0, "err": [], "pck05": [], "conf": [], "ang": []} for h in TARGETS}
        imgs = []
        for ip in images:
            im = cv2.imread(ip)
            if im is not None:
                imgs += [im, cv2.flip(im, 1)]  # + espejo: duplica las muestras de pose
        for img in imgs:
            rb, rk = detect(model, img, imgsz=int(math.ceil(max(img.shape[:2]) / 32) * 32))
            # sólo personas de cuerpo entero bien vistas como referencia
            keep = [i for i in range(len(rb)) if (rk[i, :, 2] > 0.5).sum() >= 10 and rb[i, 3] - rb[i, 1] >= 200]
            if not keep:
                continue
            ref_h = float(max(rb[i, 3] - rb[i, 1] for i in keep))
            for H in TARGETS:
                s = H / ref_h
                if s > 1.0:
                    continue
                small = cv2.resize(img, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
                cv = np.full((canvas[1], canvas[0], 3), 114, np.uint8)
                oy, ox = (canvas[1] - small.shape[0]) // 2, (canvas[0] - small.shape[1]) // 2
                cv[oy:oy + small.shape[0], ox:ox + small.shape[1]] = small
                ok, enc = cv2.imencode(".jpg", cv, [cv2.IMWRITE_JPEG_QUALITY, jpeg_q])
                cv = cv2.imdecode(enc, cv2.IMREAD_COLOR)
                pb, pk = detect(model, cv, imgsz=canvas[0])
                for i in keep:
                    box = rb[i] * s + [ox, oy, ox, oy]
                    if box[3] - box[1] < 0.6 * H:
                        continue  # persona mucho más chica que el objetivo: no representa este tamaño
                    kref = rk[i].copy()
                    kref[:, :2] = kref[:, :2] * s + [ox, oy]
                    hh = box[3] - box[1]
                    rows[H]["personas"] += 1
                    m = [j for j in range(len(pb)) if iou(pb[j], box) > 0.4]
                    if not m:
                        continue
                    j = max(m, key=lambda j: iou(pb[j], box))
                    rows[H]["detectadas"] += 1
                    vis = kref[:, 2] > 0.5
                    e = np.linalg.norm(pk[j, vis, :2] - kref[vis, :2], axis=1) / hh
                    rows[H]["err"].extend(e.tolist())
                    rows[H]["pck05"].extend((e < 0.05).astype(float).tolist())
                    rows[H]["conf"].extend(pk[j, vis, 2].tolist())
                    for a, b, c in JOINTS.values():
                        if kref[[a, b, c], 2].min() > 0.5:
                            ar = angle_deg(kref[a, :2], kref[b, :2], kref[c, :2])
                            ap = angle_deg(pk[j, a, :2], pk[j, b, :2], pk[j, c, :2])
                            if not (math.isnan(ar) or math.isnan(ap)):
                                rows[H]["ang"].append(abs(ar - ap))
        # tiempo de inferencia CPU en 1280 y 1920
        dummy = np.full((1080, 1920, 3), 114, np.uint8)
        timing = {}
        for sz in (1280, 1920):
            model.predict(dummy, imgsz=sz, verbose=False)
            t0 = time.perf_counter()
            for _ in range(3):
                model.predict(dummy, imgsz=sz, verbose=False)
            timing[sz] = round((time.perf_counter() - t0) / 3 * 1000)
        out[Path(mp).stem] = {
            "por_altura_px": {
                H: {
                    "personas": r["personas"],
                    "deteccion": round(r["detectadas"] / r["personas"], 2) if r["personas"] else None,
                    "error_kpt_%altura": round(100 * float(np.median(r["err"])), 1) if r["err"] else None,
                    "pck@5%": round(float(np.mean(r["pck05"])), 2) if r["pck05"] else None,
                    "conf_media": round(float(np.mean(r["conf"])), 2) if r["conf"] else None,
                    "error_angulo_deg_mediana": round(float(np.median(r["ang"])), 1) if r["ang"] else None,
                    "error_angulo_deg_p90": round(float(np.percentile(r["ang"], 90)), 1) if r["ang"] else None,
                }
                for H, r in rows.items()
            },
            "ms_por_frame_cpu": timing,
        }
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--images", nargs="+", required=True)
    ap.add_argument("--models", nargs="+", default=["yolo11n-pose.pt", "yolo11m-pose.pt"])
    ap.add_argument("--out", default="results/pose_vs_resolution.json")
    a = ap.parse_args()
    res = run(a.images, a.models)
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(json.dumps(res, indent=1, ensure_ascii=False))
    print(json.dumps(res, indent=1, ensure_ascii=False))
