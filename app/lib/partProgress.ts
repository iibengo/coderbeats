/**
 * El progreso de una parte de Remixes (spec 050): el borde del botón de la parte que suena se ilumina poco a poco a lo largo de sus compases. Al acabar, con «Auto» entra la siguiente y, sin él, la parte
 * (que va en bucle) **empieza otra vez**: por eso el progreso da la vuelta (0 → 1 → 0…). Puro y sin DOM.
 */

/** Cuánto lleva la parte, de 0 a 1 (da la vuelta al llegar a 1). `bar` y `barPhase` son los del reloj del motor; la parte empezó a sonar en el compás `shownBar` y dura `bars` compases. */
export function partProgress(bar: number, barPhase: number, shownBar: number, bars: number): number {
  if (!Number.isFinite(bar) || !Number.isFinite(barPhase) || !Number.isFinite(shownBar) || !(bars > 0)) return 0
  const elapsed = bar - shownBar + barPhase
  if (elapsed <= 0) return 0
  return (elapsed / bars) % 1
}

/**
 * El ángulo (grados, de 0 a 360, desde arriba y en el sentido de las agujas del reloj) que corresponde a recorrer una fracción `p` del **perímetro** de un rectángulo de `w` × `h` empezando por el centro del lado
 * de arriba. Sirve para pintar el borde con un `conic-gradient` que avance con la longitud real del borde y no con el ángulo (un botón ancho y bajo recorre sus lados largos más deprisa que sus esquinas).
 */
export function borderAngle(p: number, w: number, h: number): number {
  if (!(w > 0) || !(h > 0) || !Number.isFinite(p)) return 0
  const f = Math.min(1, Math.max(0, p))
  if (f >= 1) return 360
  const s = f * 2 * (w + h)
  let x: number
  let y: number
  if (s <= w / 2) {
    x = s
    y = -h / 2
  } else if (s <= w / 2 + h) {
    x = w / 2
    y = -h / 2 + (s - w / 2)
  } else if (s <= (3 * w) / 2 + h) {
    x = w / 2 - (s - w / 2 - h)
    y = h / 2
  } else if (s <= (3 * w) / 2 + 2 * h) {
    x = -w / 2
    y = h / 2 - (s - (3 * w) / 2 - h)
  } else {
    x = -w / 2 + (s - (3 * w) / 2 - 2 * h)
    y = -h / 2
  }
  const deg = (Math.atan2(x, -y) * 180) / Math.PI
  return deg < 0 ? deg + 360 : deg
}
