/**
 * Helpers geométricos compartidos por todos los validadores.
 * Si tu ejercicio necesita una operación nueva (distancia 3D, ángulo en
 * plano, proyección, etc.), agregala acá en lugar de definirla local en el
 * validador, así otros la pueden reutilizar.
 */

type Point3D = { x: number; y: number; z: number };
type PointY = { y: number };

/**
 * Ángulo en grados formado en el vértice `b` entre los segmentos b→a y b→c.
 * Usa los tres ejes (x, y, z); para ángulo articular típico (codo, rodilla,
 * cadera) este es el que se quiere.
 */
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

  // Clamp por errores de coma flotante: acos(1.0000001) → NaN
  const cos = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Distancia absoluta en el eje Y (vertical). Útil para chequeos de alineación. */
export function distanciaY(a: PointY, b: PointY): number {
  return Math.abs(a.y - b.y);
}
