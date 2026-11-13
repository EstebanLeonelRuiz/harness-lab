import math
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from calimon import keypoints as K  # noqa: E402
from calimon.features import extract  # noqa: E402
from calimon.geometry import angle_deg, solve_homography, apply_h  # noqa: E402
from calimon.reps import SPECS, RepCounter  # noqa: E402
from calimon.sources.synthetic import Body, default_calibration, pose_front_squat, pose_pushup  # noqa: E402


def test_angle():
    assert angle_deg((1, 0), (0, 0), (0, 1)) == pytest.approx(90)
    assert math.isnan(angle_deg(None, (0, 0), (1, 1)))


def test_homography_roundtrip():
    cal = default_calibration("4k")
    for xy in [(0, 0), (12.5, 12.5), (25, 25), (3.2, 19.7)]:
        assert cal.to_floor(cal.to_image(xy)) == pytest.approx(xy, abs=1e-6)
    h = solve_homography([[0, 0], [1, 0], [1, 1], [0, 1]], [[0, 0], [2, 0], [2, 2], [0, 2]])
    assert apply_h(h, [[0.5, 0.5]])[0] == pytest.approx([1, 1])


def _signal_reps(depths, period=2.0, fps=15, top=170, bottom=80):
    t, out = 0.0, []
    for d in depths:
        n = int(period * fps)
        for i in range(n):
            u = i / n
            x = top - (top - bottom) * d * (0.5 - 0.5 * math.cos(2 * math.pi * u))
            out.append((t, x))
            t += 1 / fps
    out += [(t + i / fps, top) for i in range(10)]
    return out


def test_rep_counter_counts_and_rom():
    ctr = RepCounter(SPECS[K.PUSHUP])
    depths = [1, 1, 0.55, 1, 1]  # la tercera es parcial (codo ~120°)
    reps = [ev for ev in (ctr.update(t, x) for t, x in _signal_reps(depths)) if ev]
    assert len(reps) == 5
    assert [r[4] for r in reps] == [True, True, False, True, True]


def test_rep_counter_needs_start_position():
    ctr = RepCounter(SPECS[K.SQUAT])
    # arranca abajo (p.ej. al pararse desde el piso) y sube: no es una repetición
    seq = [(i / 15, 0.5 + 0.5 * i / 30) for i in range(31)] + [(2 + i / 15, 1.0) for i in range(10)]
    assert not [ev for ev in (ctr.update(t, x) for t, x in seq) if ev]


def _to_img(P, scale=100.0, origin=(500, 900)):
    k = np.zeros((17, 3))
    k[:, 0] = origin[0] + P[:, 0] * scale
    k[:, 1] = origin[1] - P[:, 1] * scale
    k[:, 2] = 0.9
    return k


def test_features_hip_sag_and_valgus():
    b = Body(1.75)
    ok = extract(0, _to_img(pose_pushup(b, 0.0, sag=0.0)))
    sag = extract(0, _to_img(pose_pushup(b, 0.0, sag=0.12)))
    assert abs(ok.hip_dev) < 0.02 and sag.hip_dev > 0.09
    assert ok.body_incl > 55
    good = extract(0, _to_img(pose_front_squat(b, 1.0)))
    bad = extract(0, _to_img(pose_front_squat(b, 1.0, valgus=1.0)))
    assert good.valgus_ratio > 1.0 and bad.valgus_ratio < 0.6


def test_end_to_end_small_class():
    from calimon.evaluate import evaluate
    from calimon.session import Session
    from calimon.sources.synthetic import SyntheticClass

    sim = SyntheticClass(n_athletes=5, rounds=1, seed=3)
    ses = Session(sim.calib, sim.roster, sim.fps)
    for fr in sim.frames():
        ses.process(fr)
    ev = evaluate(ses.report(), sim.truth())
    assert ev["reps"]["f1"] > 0.9
    assert ev["defectos_detectados"]["A03:valgo_rodilla"]
    assert ev["defectos_detectados"]["A05:kipping"]
    assert not ev["falsas_alertas_riesgo"]
