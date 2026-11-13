"""CLI del PoC.

  python -m calimon simulate --rounds 2 --resolution 4k --out out/
  python -m calimon video --source clase.mp4 --calib config/calibracion_ejemplo.json \
      --roster config/alumnos_ejemplo.json --out out/ [--save-video]
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from .geometry import FloorCalibration
from .report import render
from .session import Session


def _write(out: Path, rep: dict, ev: dict | None, title: str):
    out.mkdir(parents=True, exist_ok=True)
    (out / "sesion.json").write_text(json.dumps(rep, ensure_ascii=False))
    if ev:
        (out / "evaluacion.json").write_text(json.dumps(ev, indent=1, ensure_ascii=False))
    (out / "reporte.html").write_text(render(rep, ev, title))
    print(f"-> {out / 'reporte.html'}")


def cmd_simulate(a):
    from .evaluate import evaluate
    from .sources.synthetic import SyntheticClass

    sim = SyntheticClass(rounds=a.rounds, fps=a.fps, resolution=a.resolution, seed=a.seed,
                         error_scale=a.error_scale)
    ses = Session(sim.calib, sim.roster, sim.fps)
    t0 = time.perf_counter()
    for fr in sim.frames():
        for ev in ses.process(fr):
            if a.verbose and hasattr(ev, "severity") and ev.severity in ("critico", "riesgo"):
                print(f"[{ev.t:6.1f}s] {ev.severity.upper():8s} {ev.athlete}: {ev.message}")
    dt = time.perf_counter() - t0
    rep = ses.report()
    ev = evaluate(rep, sim.truth())
    n_upd = sum(a_.frames_seen for a_ in ses.athletes.values())
    print(f"sesión {rep['duracion_s']:.0f}s, {n_upd} pose-updates en {dt:.1f}s "
          f"({1000 * dt / max(1, n_upd):.2f} ms por persona-frame)")
    print(json.dumps({k: v for k, v in ev.items() if k != "por_atleta"}, indent=1, ensure_ascii=False))
    _write(Path(a.out), rep, ev, f"Clase simulada · cámara {a.resolution} · error x{a.error_scale:g}")


def cmd_video(a):
    from .sources.video import fps_of, video_frames

    calib = FloorCalibration.from_json(a.calib)
    roster = json.loads(Path(a.roster).read_text())
    fps = a.fps or fps_of(a.source)
    plan = {"exercise": a.plan} if a.plan else None
    ses = Session(calib, roster, fps, plan)
    writer = None
    for fr in video_frames(a.source, model=a.model, imgsz=a.imgsz, device=a.device, keep_image=a.save_video,
                           fps_override=a.fps):
        for ev in ses.process(fr):
            if hasattr(ev, "severity") and ev.severity != "info":
                print(f"[{ev.t:6.1f}s] {ev.severity.upper():8s} {ev.athlete}: {ev.message}")
        if a.save_video and fr.image is not None:
            import cv2

            from .overlay import draw

            if writer is None:
                h, w = fr.image.shape[:2]
                Path(a.out).mkdir(parents=True, exist_ok=True)
                writer = cv2.VideoWriter(str(Path(a.out) / "overlay.mp4"), cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))
            writer.write(draw(fr.image.copy(), fr, ses))
    if writer is not None:
        writer.release()
    _write(Path(a.out), ses.report(), None, f"Clase · {Path(a.source).name}")


def main():
    ap = argparse.ArgumentParser(prog="calimon")
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("simulate", help="clase sintética de 15 alumnos + evaluación")
    s.add_argument("--rounds", type=int, default=2)
    s.add_argument("--fps", type=float, default=15.0)
    s.add_argument("--resolution", choices=["4k", "1080p", "720p"], default="4k")
    s.add_argument("--seed", type=int, default=7)
    s.add_argument("--error-scale", type=float, default=1.0,
                   help="1.0 = error de keypoints pesimista; 0.5 ~ medido con YOLO11m en imágenes estáticas")
    s.add_argument("--out", default="out/sim")
    s.add_argument("-v", "--verbose", action="store_true")
    s.set_defaults(fn=cmd_simulate)
    v = sub.add_parser("video", help="video/RTSP real con YOLO-pose (requiere ultralytics)")
    v.add_argument("--source", required=True)
    v.add_argument("--calib", required=True)
    v.add_argument("--roster", required=True)
    v.add_argument("--model", default="yolo11m-pose.pt")
    v.add_argument("--imgsz", type=int, default=1920)
    v.add_argument("--device", default=None)
    v.add_argument("--fps", type=float, default=None)
    v.add_argument("--plan", default=None, help="ejercicio planificado del bloque (sentadilla, flexion, ...)")
    v.add_argument("--out", default="out/video")
    v.add_argument("--save-video", action="store_true")
    v.set_defaults(fn=cmd_video)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
