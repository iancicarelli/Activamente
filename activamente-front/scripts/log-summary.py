#!/usr/bin/env python3
"""Resumen de logs de ejercicio (validation/__logs__/*.json) sin pasar por jest.

Uso: scripts/log-summary.py [archivo.json ...] [-v] [--events]
  sin archivos → todos los de validation/__logs__/
  -v           → una línea por frame activo (fase, ok, REP, feedback, métricas)
  --events     → línea de tiempo de eventos (fases del validador, reps, series)

Muestra por log: objetivo, fps, resumen, frames por fase de sesión, fases del
validador, distribución de feedback, frames ok, tiempos JS/nativo y métricas.
Lo que se ve acá es lo que el validador calculó EN EL TELÉFONO; para reproducir
con el código actual usar scripts/replay-logs.sh.
"""
import collections, glob, json, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "validation", "__logs__")
args = [a for a in sys.argv[1:] if not a.startswith("-")]
files = args or sorted(glob.glob(os.path.join(ROOT, "*.json")))
verbose, events = "-v" in sys.argv, "--events" in sys.argv

for f in files:
    d = json.load(open(f))
    fr, ev, s = d["frames"], d["events"], d["summary"]
    print("=" * 100)
    print(f"{os.path.basename(f)} | objetivo {d['totalSeries']}x{d['totalReps']} | fps {d['fps']} | {s}")
    if events:
        for e in ev:
            print("   ev %6d %s" % (e["t"], {k: v for k, v in e.items() if k != "t"}))
    if not fr:
        continue
    print("   fases sesión:", dict(collections.Counter(x["sp"] for x in fr)))
    act = [x for x in fr if x["sp"] == "active" and x.get("r")]
    if not act:
        print("   (sin frames activos)")
        continue
    dt = sorted(b["t"] - a["t"] for a, b in zip(act, act[1:]))
    print(f"   frames activos {len(act)} · dt mediana {dt[len(dt)//2] if dt else None} ms · máx {dt[-1] if dt else None} ms")
    print("   fases validador:", dict(collections.Counter(x["r"]["p"] for x in act)))
    print("   feedback:", dict(collections.Counter(x["r"]["fb"] for x in act)))
    print(f"   ok {sum(1 for x in act if x['r']['ok'])}/{len(act)} · reps {sum(1 for x in act if x['r']['rep'])}")
    js = [x["js"] for x in act if "js" in x]
    n = [x["n"] for x in act if "n" in x]
    if js:
        print("   js ms prom %.1f máx %d" % (sum(js) / len(js), max(js)))
    if n:
        print("   nativo conv prom %.0f · det prom %.0f · det máx %d ms" % (sum(a["c"] for a in n) / len(n), sum(a["d"] for a in n) / len(n), max(a["d"] for a in n)))
    keys = sorted({k for x in act for k in (x["r"].get("m") or {})})
    print("   métricas:", keys)
    if verbose:
        for x in act:
            m = x["r"].get("m") or {}
            print("   %6d %-10s %s %s %-28s %s" % (x["t"], x["r"]["p"], "ok" if x["r"]["ok"] else "--", "REP" if x["r"]["rep"] else "   ", (x["r"]["fb"] or "")[:28], " ".join(f"{k}={m.get(k)}" for k in keys)))
