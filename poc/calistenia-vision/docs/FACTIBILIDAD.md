# Análisis de factibilidad: monitoreo de calistenia por cámara de vigilancia

**Escenario:** 15 alumnos entrenando calistenia en un área de 25 × 25 m, vistos por cámaras de vigilancia (CCTV/IP).
**Objetivo:** métricas de desempeño por alumno, conteo de repeticiones, alertas de riesgo de lesión y todo lo demás que se pueda medir.
**Fecha:** 2026-11-13 · **Estado:** borrador de PoC

---

## 1. Veredicto

**Es factible, con condiciones.** El factor que decide todo es **cuántos píxeles mide cada alumno en la imagen**. Con eso resuelto, la parte de software ya funciona en este PoC.

| Condición | Resultado esperado |
|---|---|
| 1 cámara **1080p** para todo el área (lo típico en vigilancia) | ❌ **No alcanza.** Funciona sólo para los alumnos cercanos a la cámara (los primeros ~8 m). Al fondo se pierde el conteo y aparecen falsas alertas. |
| 1 cámara **4K** bien ubicada | ✅ Sirve para conteo, tiempos, caídas y ocupación. Técnica: aceptable, pero limitada por el ángulo de visión. |
| **2 cámaras 4K** en esquinas opuestas (**recomendado**) | ✅ Cada alumno mide ≥130 px en al menos una cámara y casi siempre hay dos ángulos de vista (frontal + lateral), así que la técnica mejora mucho. |
| 4 cámaras 4K (una por esquina) | ✅✅ Permite reconstruir los ángulos articulares reales en 3D (triangulación) y casi elimina las oclusiones. Es la opción para un producto "premium". |

Hace falta además **una GPU en el sitio** (PC con RTX 4060/4070 o Jetson Orin). Con la CPU sola no se llega al tiempo real con el modelo que da la precisión necesaria (medido abajo).

**Sobre las "alertas de riesgo de lesión":** lo que se puede detectar de forma confiable son **patrones de técnica y de carga que se asocian a mayor riesgo**: rodillas hacia adentro, cadera hundida, bajadas sin control, balanceo en barra, asimetrías y fatiga dentro de la serie. También las **caídas y las personas inmóviles en el piso**. Eso **no** es predecir lesiones en sentido clínico, y el producto no debe venderse así. El sistema le avisa al profe y el profe decide.

---

## 2. Qué se construyó (PoC)

El código está en `poc/calistenia-vision/` (Python). Ver el [README](../README.md).

```
Cámara/NVR (RTSP) ─► YOLO11-pose + ByteTrack ─► keypoints COCO-17 por persona y por frame
                                                   │
           calibración del piso (homografía) ◄─────┤ pies → posición (x, y) en metros
                                                   ▼
                     Identidad: track_id → alumno (estación / última posición / re-asignación)
                                                   ▼
             Por alumno: suavizado temporal → features biomecánicas 2D normalizadas
                    ├─ clasificador de ejercicio (reglas sobre una ventana de 2 s)
                    ├─ contadores de reps con histéresis (uno por ejercicio, en paralelo)
                    ├─ técnica por repetición (valgo, cadera, kipping, asimetría, excéntrica)
                    ├─ fatiga intra-serie (duración y rango de las reps vs. el inicio de la serie)
                    └─ chequeos continuos (caída, inmóvil en el piso, plancha con cadera hundida)
                                                   ▼
             Sesión: proximidad entre alumnos, fuera de área, pérdida de tracking
                                                   ▼
             Eventos en vivo (consola) + reporte HTML + JSON por alumno
```

* **Ejercicios del PoC:** sentadilla, flexión de brazos, dominada, jumping jack y plancha (isométrico).
* **Fuentes de datos:** (a) un **simulador** de una clase de 15 alumnos con verdad de campo, defectos inyectados y una caída; (b) **video real** o RTSP mediante Ultralytics YOLO-pose. El modo video se probó de punta a punta con un clip de prueba; **todavía no se probó con video real de una clase**.

---

## 3. Evidencia

### 3.1 Cuántos píxeles mide un alumno

El alto aparente de una persona de 1,70 m con una lente de ~90° de campo horizontal se calcula como `alto_px ≈ 1,70 × (ancho_px / 2) / distancia_m`:

| Distancia a la cámara | 4K (3840 px) | 1080p (1920 px) | 720p |
|---|---|---|---|
| 12,5 m (4 cámaras en esquinas, peor caso) | **261 px** | 131 px | 87 px |
| 17,7 m (centro del área visto desde una esquina) | **184 px** | 92 px | 61 px |
| 25 m (2 cámaras en esquinas opuestas, peor caso) | **131 px** | 65 px | 44 px |
| 35 m (1 cámara en esquina, esquina opuesta) | **93 px** | **47 px** | 31 px |

En la flexión y la plancha el cuerpo queda horizontal. Si el alumno está orientado hacia la cámara, el escorzo lo hace casi ilegible. Por eso **las colchonetas deben quedar perpendiculares al eje de la cámara**, y eso es una regla de organización de la clase.

### 3.2 Medición con un detector real: precisión de la pose según el tamaño de la persona

`experiments/pose_vs_resolution.py` corre YOLO11-pose real sobre 10 imágenes y sus espejos (15–17 personas). Achica a cada persona hasta el alto indicado, la pega en un cuadro de 1920 × 1080 con compresión JPEG tipo CCTV y la compara contra la detección en alta resolución. Resultados en `results/pose_vs_resolution.json`:

| Alto de la persona | Detección (n / m) | Error de keypoint (m), % del alto | PCK@5% (m) | Error de ángulo articular, mediana (n / m) |
|---|---|---|---|---|
| 400 px | 100% / 100% | 0,6% | 0,99 | 4,1° / 3,3° |
| 160 px | 100% / 100% | 1,1% | 0,95 | 5,2° / 6,4° |
| 120 px | 100% / 100% | 1,5% | 0,96 | 10,5° / 5,7° |
| 90 px | 100% / 100% | 1,5% | 0,90 | 8,9° / 7,1° |
| 70 px | **88%** / 100% | 2,3% | 0,85 | 14,8° / 8,9° |
| 50 px | **29%** / 100% | 2,9% | 0,79 | 14,8° / **14,4°** |
| 35 px | **0%** / 100% | 5,1% | 0,49 | – / 15,4° |

(n = yolo11n-pose, m = yolo11m-pose)

**Tiempo de inferencia en la CPU de este entorno (4 núcleos):** yolo11n tarda 79 ms por cuadro a 1280 y 187 ms a 1920. yolo11m tarda 532 ms y **1264 ms**. Con la CPU sola no hay tiempo real usando el modelo preciso, así que hace falta GPU. Según las cifras publicadas por Ultralytics para GPU con TensorRT, el modelo m procesa del orden de decenas de cuadros por segundo a 1920 px. **Hay que validarlo en el hardware elegido.**

Limitaciones de esta medición: se compara contra el propio modelo en alta resolución (no contra una anotación humana) y se usan imágenes estáticas de personas de pie. En una clase real habrá desenfoque de movimiento, compresión H.264/H.265 y poses en el piso o invertidas, que se representan mal en COCO. Por eso el simulador usa por defecto un error **más pesimista** que el medido.

### 3.3 Sistema completo sobre la clase simulada (15 alumnos, ~12 min, 15 fps)

Resumen en `results/simulacion_resumen.json`. Cada escenario agrega 1733 repeticiones reales y 7 defectos inyectados: valgo de rodilla, kipping, cadera hundida, asimetría lateral, fatiga, bajada rápida y caída.

| Escenario | F1 de reps | F1 por fila (cerca / medio / lejos) | ROM completo vs parcial | Defectos detectados | Caída + inmóvil | Falsas alertas de técnica |
|---|---|---|---|---|---|---|
| **4K**, error pesimista | **0,979** | 0,98 / 0,98 / 0,98 | 99,5% | **7/7** | ✅ | 0 |
| 4K, error ≈ medido | 0,980 | – | 99,3% | 7/7 | ✅ | 1 (fatiga) |
| 4K, otra semilla | 0,981 | – | 99,7% | 7/7 | ✅ | 1 (bajada rápida) |
| **1080p**, error pesimista | 0,611 | 0,97 / 0,61 / **0** | 96,9% | 4/7 | ❌ | 17 |
| 1080p, error ≈ medido | 0,730 | 0,98 / 0,86 / **0** | 97,1% | 4/7 | ❌ | 11 |
| 720p | 0,085 | 0,22 / 0 / 0 | – | 0/7 | ❌ | 7 |

**Cómo leer la tabla:**

* Con alumnos de ≥90 px de alto, el conteo de repeticiones es muy confiable (precisión ≈ 0,998, recall ≈ 0,96). La mayoría de las reps perdidas cae en **oclusiones**: la simulación tapa a cada alumno ~1 vez por minuto durante 0,5–2,5 s. Sin oclusiones, el recall sube a 0,987, y lo que sigue faltando son sobre todo flexiones. Una segunda cámara reduce directamente ese faltante. El modo `--plan` (el profe carga el ejercicio del bloque) acredita las reps sin esperar al clasificador; no se midió por separado.
* **El límite práctico está entre 70 y 80 px de alto.** Por debajo de eso se pierde el conteo y aparecen alertas falsas. El simulador coincide con la medición real: el modelo liviano deja de detectar personas por debajo de ~70 px y el error de ángulo se duplica.
* **Advertencia:** son datos sintéticos. Validan la lógica y permiten comparar escenarios, pero **no garantizan** estas cifras con video real. La Fase 0 (sección 7) existe para medirlas en el sitio.

**Costo de la analítica (todo lo que viene después de la pose):** se midieron ~0,6 ms por persona y por cuadro en Python puro. Con 15 alumnos a 15 fps eso ocupa ~14% de un núcleo. Es despreciable: el cuello de botella es la red de pose.

---

## 4. Matriz de qué se puede medir

| Métrica / alerta | Factibilidad | Requisitos y notas |
|---|---|---|
| Asistencia, presencia, tiempo en el área | **Alta** | Detección de personas. Funciona incluso con 1080p. |
| Posición, recorrido (m), mapa de calor, uso de estaciones | **Alta** | Calibración de 4 puntos del piso (homografía). Error típico de 0,3–1 m. Implementado. |
| Proximidad o riesgo de choque entre alumnos | **Alta** | Distancia en el piso < 0,9 m durante un ejercicio dinámico. Implementado. |
| Salida del área, pérdida de seguimiento | **Alta** | Implementado. |
| Clasificación del ejercicio | **Media-alta** | Las reglas alcanzan para pocos ejercicios. Para un catálogo grande (burpees, muscle-ups, fondos, estocadas, L-sit, pistol, etc.) hace falta un modelo temporal entrenado (ST-GCN, PoseC3D o un GRU sobre keypoints). **Alta** si el profe carga el plan del bloque. |
| **Contador de repeticiones** | **Alta** (con ≥90 px) | Implementado para sentadilla, flexión, dominada y jumping jack. Se extiende agregando una señal y umbrales por ejercicio. |
| Rango de movimiento (rep completa vs parcial) | **Alta-media** | ~99% de acierto en la simulación. "No-rep" automático. |
| Tempo (excéntrica / concéntrica), cadencia | **Alta** | 15 fps alcanza. Para bajadas muy rápidas conviene 25–30 fps. |
| Densidad de trabajo (activo / descanso), tiempo bajo tensión | **Alta** | Implementado. |
| Isométricos (plancha, dead hang, L-sit): duración | **Alta** | Implementado para plancha (mejor tiempo sostenido). |
| Fatiga intra-serie (caída de velocidad y rango, tipo VBT) | **Media** | Es un indicador **relativo** dentro de la serie. Ruidoso en ejercicios cortos (por ejemplo, jumping jacks). Implementado. |
| Técnica: cadera hundida en flexión o plancha | **Media** | Necesita vista **lateral**. Implementado. |
| Técnica: valgo de rodilla, asimetría lateral en sentadilla | **Media** | Necesita vista **frontal**. El PoC verifica la vista y se abstiene si no corresponde. Implementado. |
| Técnica: kipping o balanceo en barra, bajada sin control | **Media** | Implementado. |
| Ángulos articulares exactos (grados reales) | **Baja con 1 cámara**, **media-alta con 2+** | Con una sola cámara, el ángulo 2D depende de la orientación del alumno. Con varias cámaras se puede triangular en 3D. |
| **Caída / persona inmóvil en el piso** | **Alta** | Alerta **crítica**. Distingue la caída (de parado a horizontal en menos de 0,8 s y quedar en el piso) de bajar a hacer flexiones. Hay que validar falsos positivos con burpees y ejercicios de suelo. |
| "Riesgo de lesión" predictivo | **Baja** | No hay modelos validados que predigan lesiones desde video. Se presenta como señales de técnica + carga + fatiga. |
| Frecuencia cardíaca por video (rPPG), calorías precisas, carga externa (lastre) | **No factible** a 10–35 m con CCTV | Usar bandas cardíacas o relojes si se necesitan, e integrarlos a la misma sesión. |
| Identidad persistente de los 15 alumnos | **Media** | Sólo con el tracking se pierde la identidad en cada oclusión (en la simulación hubo ~80 cambios de ID en 12 min, resueltos por posición). Ver la sección 6. |

---

## 5. Arquitectura recomendada para producción

```
 2–4 cámaras IP 4K (H.265, 15–25 fps, ≥8 Mbps)
          │ RTSP (LAN)
          ▼
 Equipo en el sitio con GPU (PC RTX 4060/4070 o Jetson AGX Orin)
   ├─ decodificación por hardware (NVDEC)
   ├─ pose + tracking por cámara (TensorRT, entrada 1920 px o recortes)
   ├─ homografía por cámara → fusión multicámara en coordenadas del piso
   ├─ (opcional) triangulación 3D de keypoints con 2+ vistas
   └─ motor de analítica (este PoC) → eventos
          │ WebSocket / MQTT
          ▼
 Tablet del profe (en vivo): semáforo por alumno, reps, alertas
 Backend (Postgres/Timescale): sesiones, historial y progreso por alumno, reportes
```

* **No se guarda video por defecto**: se procesa en el sitio y sólo se guardan keypoints y métricas. Reduce el riesgo legal, el almacenamiento y el ancho de banda.
* **Licencias:** YOLO11 de Ultralytics es **AGPL-3.0**, así que un producto comercial cerrado requiere la licencia Enterprise. Alternativas con licencia Apache-2.0: **RTMPose/RTMO** (MMPose) y ViTPose. El PoC sólo depende de keypoints COCO-17, así que el detector es intercambiable.
* **Ajuste fino:** conviene re-entrenar el modelo de pose con unos cientos de cuadros etiquetados de la propia sala, en especial poses en el piso, en barra y con ropa deportiva holgada.

### Instalación de cámaras

* Altura de 4–6 m con ángulo de 25–40° hacia abajo. Evitar ojo de pez o corregir la distorsión en la calibración.
* Mínimo 15 fps (ideal 25), obturador rápido (≤1/250 s) e iluminación de ≥300 lux para que no haya desenfoque en jumping jacks y burpees. Evitar contraluz.
* Disposición: estaciones fijas, colchonetas perpendiculares a la cámara principal y barras de dominadas frente a una cámara.
* Calibración: 4 conos o marcas en el piso con coordenadas conocidas (una vez por cámara). Ejemplo en `config/calibracion_ejemplo.json`.

### Costo orientativo de hardware

Los valores son orientativos y varían según el país.

| Componente | Rango aproximado (USD) |
|---|---|
| Cámara IP 4K (8 MP) con lente varifocal | 150–400 c/u |
| Equipo con GPU en el sitio (RTX 4060/4070) o Jetson Orin NX/AGX | 900–2.000 |
| Tablet para el profe | 200–400 |
| **Total con 2 cámaras** | **≈ 1.500–3.200** |

---

## 6. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Resolución insuficiente (cámaras de vigilancia existentes en 1080p) | Crítico | 4K o más cámaras. Validar en la Fase 0 con el criterio de ≥90 px por alumno. |
| Cambios de identidad por oclusión | Alto | Pecheras numeradas o de colores (barato y robusto), estaciones asignadas, re-identificación por apariencia (OSNet), check-in con QR. El reconocimiento facial es posible pero tiene implicancias legales. |
| Ángulo de visión inadecuado para una métrica de técnica | Medio | El sistema se abstiene si la vista no corresponde (ya lo hace para el valgo). Multicámara. |
| Poses en el piso o invertidas mal detectadas | Medio | Ajuste fino con datos propios. |
| Fatiga de alertas (el profe deja de mirarlas) | Medio | Pedir 2 de las últimas 4 reps con el defecto, enfriamiento por tipo de alerta, alertas críticas separadas (ya está en el PoC). Resúmenes por bloque. |
| Falsos positivos de caída (burpees, sprawls) | Medio | Contexto del plan de clase y una ventana de confirmación. Validar con video real. |
| Privacidad y datos sensibles (biométricos y de salud; posibles menores) | Alto | Consentimiento informado (y de los tutores si hay menores), finalidad explícita, aviso de videovigilancia, procesamiento local sin video, retención mínima. Cumplir la ley local de datos personales (por ejemplo, Ley 25.326 en Argentina, LGPD en Brasil, RGPD en la UE). No presentarlo como dispositivo médico. |
| Umbrales heurísticos sin validación profesional | Medio | Calibrar los umbrales con un kinesiólogo o preparador físico usando clips etiquetados. Todos los umbrales están en un solo lugar (`calimon/athlete.py`, `calimon/reps.py`). |

---

## 7. Plan sugerido

**Fase 0: validación en el sitio (1–2 semanas).** Es la decisión de seguir o no.

1. Instalar 1–2 cámaras 4K provisorias y grabar 2–3 clases reales con consentimiento.
2. Etiquetar unos 30 minutos (CVAT): reps por alumno, reps parciales y defectos de técnica.
3. Correr `python -m calimon video ...` y medir contra la etiqueta.
4. **Criterios para seguir:** F1 de reps ≥ 0,95; caídas sin falsos negativos en las pruebas y con < 1 falso positivo por semana; precisión de las alertas de técnica ≥ 0,8; ≥ 90% del tiempo con identidad correcta.

**Fase 1: MVP (4–6 semanas).** Equipo con GPU, fusión de 2 cámaras, tablet del profe en vivo, carga del plan de clase, pecheras numeradas y reporte por alumno.

**Fase 2: producto.** Modelo temporal entrenado (más ejercicios y defectos), 3D multivista, historial y progresión por alumno, integración de bandas cardíacas y comparación entre clases.
