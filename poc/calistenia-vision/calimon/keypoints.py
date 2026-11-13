"""Esquema de keypoints COCO-17 (el que emiten YOLO-pose, RTMPose, ViTPose, etc.)."""

NOSE = 0
L_EYE, R_EYE = 1, 2
L_EAR, R_EAR = 3, 4
L_SHO, R_SHO = 5, 6
L_ELB, R_ELB = 7, 8
L_WRI, R_WRI = 9, 10
L_HIP, R_HIP = 11, 12
L_KNE, R_KNE = 13, 14
L_ANK, R_ANK = 15, 16

N_KPTS = 17

SKELETON = [
    (L_SHO, R_SHO), (L_SHO, L_ELB), (L_ELB, L_WRI), (R_SHO, R_ELB), (R_ELB, R_WRI),
    (L_SHO, L_HIP), (R_SHO, R_HIP), (L_HIP, R_HIP),
    (L_HIP, L_KNE), (L_KNE, L_ANK), (R_HIP, R_KNE), (R_KNE, R_ANK),
    (NOSE, L_SHO), (NOSE, R_SHO),
]

# Ejercicios soportados por el PoC (+ estados no-ejercicio)
SQUAT = "sentadilla"
PUSHUP = "flexion"
PULLUP = "dominada"
JUMPING_JACK = "jumping_jack"
PLANK = "plancha"
REST = "descanso"
LYING = "en_el_piso"
UNKNOWN = "desconocido"

EXERCISES = (SQUAT, PUSHUP, PULLUP, JUMPING_JACK)
ACTIVE_LABELS = (SQUAT, PUSHUP, PULLUP, JUMPING_JACK, PLANK)
