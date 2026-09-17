#!/usr/bin/env python3
"""Qué landmarks fallan el chequeo de visibilidad, frame a frame, en un log.

Uso: scripts/log-visibility.py <archivo.json> [t0_ms] [t1_ms] [--track]
  Por defecto aplica el criterio del ENCUADRE (isUsable: vis ≥ 0.5, margen 0.03).
  --track aplica el del EJERCICIO (isTrackable: vis ≥ 0.3; rodillas/tobillos hasta y = 1.10).
Cada línea: t, fase, feedback y los landmarks clave que NO pasan, con visibilidad e y.
Sirve para ver si una rep se perdió por un punto concreto (p. ej. tobillo en el borde).
"""
import json, sys

NAMES = {0: "nose", 11: "Lsh", 12: "Rsh", 13: "Lel", 14: "Rel", 15: "Lwr", 16: "Rwr", 23: "Lhip", 24: "Rhip",
         25: "Lkn", 26: "Rkn", 27: "Lank", 28: "Rank", 29: "Lheel", 30: "Rheel", 31: "Lfoot", 32: "Rfoot"}
NEAR_FLOOR = {25, 26, 27, 28}
args = [a for a in sys.argv[1:] if not a.startswith("-")]
if not args:
    sys.exit(__doc__)
track = "--track" in sys.argv
min_vis, margin = (0.3, 0.03) if track else (0.5, 0.03)
t0 = int(args[1]) if len(args) > 1 else 0
t1 = int(args[2]) if len(args) > 2 else 10**9
d = json.load(open(args[0]))
for x in d["frames"]:
    if x["sp"] != "active" or not (t0 <= x["t"] <= t1):
        continue
    lms = x["lms"]
    if not lms:
        print("%6d SIN LANDMARKS" % x["t"])
        continue
    bad = []
    for i, n in NAMES.items():
        X, Y, _, V = lms[i]
        bottom = 0.10 if (track and i in NEAR_FLOOR) else margin
        if V < min_vis or X < -margin or X > 1 + margin or Y < -margin or Y > 1 + bottom:
            bad.append("%s(v%.2f y%.2f)" % (n, V, Y))
    r = x.get("r") or {}
    print("%6d %-10s %-24s %s" % (x["t"], r.get("p", ""), (r.get("fb") or "")[:24], " ".join(bad)))
