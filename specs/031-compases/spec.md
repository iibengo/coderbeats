# Spec 031 · Compases de verdad (3/4, 6/8…) — idea para más adelante

Estado: **idea apuntada, sin programar.** No toca nada de lo guardado. Nace de la sesión del 17/11/2026 con el Cumpleaños feliz (ver 028 §11).

## 1. El problema

Hoy la app cuenta **siempre 16 pasos por compás (4/4)**, y el formato de canción no tiene ningún campo de compás. Una canción en 3/4 (Cumpleaños, valses, "Estrellita", nanas) o en 6/8 (jigs, himnos) no cabe: se **aparenta** metiendo 12 pasos de música y 4 de silencio detrás.

**Lo que funciona hoy** (y no hay que romperlo):

```
[g4@2 g4@2 a4@4 g4@4 ~@4]    "Cum-ple-a-ños"   ← 12 de música + 4 de silencio
[c5@4 b4@8 ~@4]              "fe-liz"
```

**Los límites de ese apaño:**
- El silencio de 4 pasos **existe**: el acompañamiento tiene que copiar el mismo hueco o se cruza.
- La duración del compás no es la real, así que el tempo hay que compensarlo a mano.
- Un 6/8 (12 semicorcheas en dos grupos de 3) no se puede aparentar bien: necesita los tresillos del 6/8.
- Un 3/4 con un compás de 4/4 en medio (pasa en canciones reales) no se puede hacer.

## 2. La idea

Un campo opcional de compás, **por canción y por célula**:

```json
{ "compas": [3, 4] }
```

- **Sin el campo** (todo lo guardado y todo lo que se haga hoy): 4/4, exactamente el código de siempre. Test de que el código Strudel no cambia un carácter.
- **Con el campo**: la célula se toca con ese compás. La rejilla del motor (`setcpm` y los 16 pasos) pasa a **pasos por compás = 16 × (numerador / denominador) × (4/4)**. Para 3/4, 12 pasos; para 6/8, 12 pasos en grupos de 3.
- El editor (Órgano) dibuja 12 casillas en vez de 16 (o 6 grupos de 2 en el 6/8).
- El Laboratorio (círculo, capas) puede seguir mostrando la rejilla de 16 y marcar el compás: es un detalle de dibujo.

## 3. Lo que cuesta

- **Motor:** `setcpm` y la rejilla de pasos (`useAudioEngine.ts`). Tocar el reloj es lo más arriesgado del proyecto: **no se puede comprobar sin oír**.
- **Formato guardado:** campo nuevo opcional, compatible (como se hizo en 028).
- **Editor:** rejilla variable; hay que revisar los tresillos (028 §3) porque 6/8 los necesita.
- **Laboratorio:** el círculo y las capas asumen 16 pasos; hay que decidir si se dibujan 12.
- **Compartir e importar:** el campo va en el enlace y en el archivo; el validador lo comprueba (numerador 2–12, denominador 2, 4, 8, 16).

## 4. Orden y riesgo

1. **Datos y validación** del campo `compas` (sin motor): bajo riesgo.
2. **Generación de código** con el compás (solo la rejilla de notas; los loops de batería se quedan en 16 y se recortan): medio.
3. **Motor**: que un 3/4 suene en 3/4 de verdad. **Alto: aquí hace falta oído.**
4. **Editor** con la rejilla de 12: medio.
5. **Laboratorio**: el dibujo. Bajo.

**Se puede parar en el 1 sin haber roto nada**, y el apaño actual (12 + 4) sigue valiendo hasta que el 3 esté probado.

## 5. Principios

1. Una pantalla, una cosa ✔ (el compás es un dato, no una pantalla).
2. No puede sonar mal: el compás se elige de una lista cerrada; sin campo, lo de siempre ✔.
3. Inmediata: se aplica al abrir la canción ✔.
4. Tuyo: puedes escribir valses y nanas ✔.
5. Pocas cosas ⚠: un campo más, en «Avanzado».
6. Compartir: el compás va en el enlace y el archivo ✔.
7. Precedente: cualquier DAW (secuenciador) tiene compás por pista y por compás.
8. Quitar antes de añadir ⚠: se añade un campo; compensa que hoy no se puede hacer un 3/4 de verdad.

## 6. Qué falta decidir

- ¿Compás **por canción** o **por célula**? (Propongo por célula, con el de la canción como valor por defecto: un puente en 6/8 es real.)
- ¿Cambio de compás **a mitad de célula**? (Propongo que no: complica el motor y el editor.)
- ¿El 6/8 como compás de 12 pasos con tresillos, o como compás de 6 pasos? (Propongo 12 con grupos de 3.)
- ¿Cuándo se hace? Cuando haya dos o tres canciones seguidas que necesiten 3/4. Con una, el apaño funciona.
