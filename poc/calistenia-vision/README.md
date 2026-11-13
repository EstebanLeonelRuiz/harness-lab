# calimon: PoC de monitoreo de calistenia por cámara de vigilancia

Borrador de prueba de concepto para seguir a **15 alumnos entrenando calistenia en un área de 25 × 25 m** a partir del video de cámaras de vigilancia. Genera métricas de desempeño por alumno, cuenta repeticiones y emite alertas de técnica de riesgo, caídas y fatiga.

👉 **Análisis de factibilidad completo:** [`docs/FACTIBILIDAD.md`](docs/FACTIBILIDAD.md)
👉 **Ejemplo de tablero:** [`docs/reporte_ejemplo_4k.html`](docs/reporte_ejemplo_4k.html) (y la versión [1080p](docs/reporte_ejemplo_1080p.html) para comparar). Hay que descargarlos y abrirlos en un navegador.

## Qué mide

| Por alumno | Alertas |
|---|---|
| Reps por ejercicio (válidas y parciales) | 🔴 Posible caída · inmóvil en el piso |
| Tempo: excéntrica, concéntrica y duración por rep | 🟠 Rodillas hacia adentro (valgo) en sentadilla |
| Rango de movimiento por rep | 🟠 Cadera hundida en flexión o plancha |
| Puntaje de técnica (0–100) | 🟡 Bajada sin control · kipping en barra · asimetría lateral |
| Tiempo activo, de descanso y densidad de trabajo | 🟡 Fatiga (reps más lentas y con menos rango que al inicio de la serie) |
| Mejor plancha sostenida | 🟡 Proximidad entre alumnos durante ejercicio dinámico |
| Recorrido (m), mapa de calor, línea de tiempo por ejercicio | ⚪ Fuera de área · sin seguimiento |

Ejercicios del PoC: sentadilla, flexión, dominada, jumping jack y plancha.

## Uso

```bash
cd poc/calistenia-vision
pip install numpy

# Clase sintética de 15 alumnos con verdad de campo (no requiere GPU ni modelos)
python -m calimon simulate --rounds 2 --resolution 4k --out out/sim_4k -v
python -m calimon simulate --rounds 2 --resolution 1080p --out out/sim_1080p   # ver cómo se degrada

# Video real o RTSP (requiere: pip install ultralytics lap opencv-python)
python -m calimon video --source rtsp://usuario:clave@nvr/stream1 \
    --calib config/calibracion_ejemplo.json --roster config/alumnos_ejemplo.json \
    --model yolo11m-pose.pt --imgsz 1920 --out out/clase --save-video [--plan sentadilla]

# Experimento con detector real: precisión de la pose según el tamaño de la persona en píxeles
python experiments/pose_vs_resolution.py --images img1.jpg img2.jpg --models yolo11n-pose.pt yolo11m-pose.pt

pytest -q tests
```

Cada corrida escribe `reporte.html` (tablero), `sesion.json` (métricas y reps por alumno) y, en modo simulación, `evaluacion.json` (comparación contra la verdad de campo).

## Resultados del PoC (resumen)

| Escenario (simulado, 1733 reps, 7 defectos inyectados) | F1 de reps | Defectos detectados | Caída | Falsas alertas |
|---|---|---|---|---|
| 1 cámara **4K** | **0,98** | **7/7** | ✅ | 0–1 |
| 1 cámara 1080p | 0,61–0,73 (0 en la fila lejana) | 4/7 | ❌ | 11–17 |
| 1 cámara 720p | 0,09 | 0/7 | ❌ | 7 |

También se midió el detector real (YOLO11-pose) sobre imágenes reales: el modelo liviano deja de detectar personas por debajo de ~70 px de alto, y el error de ángulo articular se duplica por debajo de ~70 px. **Conclusión: hace falta ≥90 px por alumno, o sea 4K o varias cámaras.** Detalle y limitaciones en `docs/FACTIBILIDAD.md`.

## Estructura

```
calimon/
  keypoints.py     esquema COCO-17 y nombres de ejercicios
  geometry.py      ángulos y homografía imagen <-> piso (m)
  features.py      features biomecánicas 2D normalizadas por persona y frame
  classifier.py    clasificador de ejercicio por reglas (ventana de 2 s)
  reps.py          contador de reps con histéresis (una señal por ejercicio)
  athlete.py       estado por alumno: técnica, fatiga, caída, métricas  <- umbrales acá
  session.py       identidad (track -> alumno), posición en el piso, reglas grupales
  evaluate.py      evaluación contra la verdad de campo
  report.py        tablero HTML
  overlay.py       dibujo sobre el video
  sources/
    synthetic.py   simulador de la clase (15 alumnos, defectos, caída, oclusiones)
    video.py       YOLO-pose + ByteTrack sobre archivo o RTSP
experiments/pose_vs_resolution.py
results/           resultados medidos (JSON)
config/            calibración y lista de alumnos de ejemplo
```

## Limitaciones conocidas

* La analítica se validó con datos **sintéticos**. El modo video se probó de punta a punta sólo con un clip de prueba, **no con una clase real**. El siguiente paso es la Fase 0 de `docs/FACTIBILIDAD.md`.
* Los umbrales de técnica son heurísticos y deben calibrarse con un profesional.
* Las métricas de pose son 2D con una sola cámara: algunas dependen de la orientación del alumno, y el PoC se abstiene cuando la vista no corresponde.
* Ultralytics YOLO es AGPL-3.0. Para un producto cerrado hace falta licencia, o usar RTMPose o ViTPose (Apache-2.0).
