// Carga fixtures JSON reales (validation/__fixtures__/*.json) como Landmark[][].
import * as fs from "fs";
import * as path from "path";
import { Landmark } from "../../validation/types";

const DIR = path.join(__dirname, "..", "..", "validation", "__fixtures__");

export type Fixture = { exerciseId: string; level: number; expectedReps?: number; frames: { t: number; lms: number[][] }[] };

export function listFixtures(): string[] {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR).filter((f) => f.endsWith(".json"));
}

export function loadFixture(name: string): { meta: Fixture; frames: Landmark[][] } {
  const meta = JSON.parse(fs.readFileSync(path.join(DIR, name), "utf-8")) as Fixture;
  const frames = meta.frames.map((f) => f.lms.map(([x, y, z, visibility]) => ({ x, y, z, visibility })));
  return { meta, frames };
}
