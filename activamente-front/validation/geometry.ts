/**
 * Helpers geométricos compartidos por todos los validadores.
 */

type Point3D = { x: number; y: number; z: number };
type PointXY = { x: number; y: number };

/** Ángulo en grados en el vértice `b` entre los segmentos b→a y b→c (3D). */
export function calcularAngulo(a: Point3D, b: Point3D, c: Point3D): number {
  const bax = a.x - b.x;
  const bay = a.y - b.y;
  const baz = a.z - b.z;
  const bcx = c.x - b.x;
  const bcy = c.y - b.y;
  const bcz = c.z - b.z;

  const dot = bax * bcx + bay * bcy + baz * bcz;
  const magBA = Math.sqrt(bax * bax + bay * bay + baz * baz);
  const magBC = Math.sqrt(bcx * bcx + bcy * bcy + bcz * bcz);
  if (magBA === 0 || magBC === 0) return 0;

  const cos = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Ángulo en 2D (solo x, y). Más estable cuando z de MediaPipe es ruidoso. */
export function calcularAngulo2D(a: PointXY, b: PointXY, c: PointXY): number {
  return calcularAngulo({ ...a, z: 0 }, { ...b, z: 0 }, { ...c, z: 0 });
}

/** Distancia absoluta en el eje Y (vertical). */
export function distanciaY(a: { y: number }, b: { y: number }): number {
  return Math.abs(a.y - b.y);
}

/** Distancia absoluta en el eje X (horizontal). */
export function distanciaX(a: { x: number }, b: { x: number }): number {
  return Math.abs(a.x - b.x);
}

export const promedio = (a: number, b: number): number => (a + b) / 2;
