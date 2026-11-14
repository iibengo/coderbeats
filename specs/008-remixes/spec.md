# 008 · Remixes

> Estado: **en marcha** (2026-11-14). Primera prueba: "Himno de la alegría" en dembow.
> Parte de: spec 005 (células y su demo del dembow, §20), 002 (melodía como loop) y 006 (Mis canciones).

## 1. Idea

Una categoría nueva, **Remixes**, junto a los estilos y a Mis canciones: **canciones de demo que mezclan un estilo con una melodía conocida**. Se abren como cualquier canción (varias células, con su código Strudel y editables) y sirven para oír lo que da de sí un estilo y para empezar a jugar desde algo que ya suena.

## 2. Regla: solo dominio público

- Solo melodías **de dominio público** (obras cuyo autor murió hace más de 70 años y de las que no se reproduce ninguna grabación ni edición protegida). **Aquí no hay ningún audio de terceros**: la melodía se escribe como notas y la tocan los sintes de la app; el **arreglo** (ritmo, bajo, acordes, estructura) es original de coderbeats.
- Cada remix lleva su **atribución** (compositor y años) a la vista en la lista.
- Antes de añadir uno, se comprueba que la obra y su melodía son de dominio público (compositor, fecha de muerte). Lista de candidatos posibles más adelante (no están hechos): la *Oda a la alegría* de Beethoven (1770–1827), el *Canon en re* de Pachelbel (1653–1706), *Für Elise* de Beethoven, *Greensleeves* (tradicional) o *La cucaracha*.

## 3. Cómo se ve y cómo se abre

- Un **botón "Remixes"** en la pantalla principal, junto al de Mis canciones (debajo, a la izquierda; en horizontal, a su lado), que abre una hoja como la de Mis canciones.
- La hoja lista los remixes con: título, **compositor y años**, estilo y tonalidad, cuántas células dura (en compases) y una línea por célula con lo que añade.
- **Abrir un remix** reemplaza la canción de ahora (como abrir una guardada, spec 006 §4.3): avisa si lo de ahora no está guardado, elige el **estilo** y el **kit** del remix y deja la primera célula a la vista. Si sonaba, arranca de nuevo desde ahí. **No** se marca como "viene de una guardada": al guardar es una canción nueva.
- Lo que se abre es una canción normal: se puede editar, copiar, fundir (005 §21) y guardar en Mis canciones.

## 4. Primer remix: "Himno de la alegría" en dembow

**La melodía.** El tema principal de la *Oda a la alegría* (final de la Novena sinfonía, Ludwig van Beethoven, 1824), en **re mayor** (F♯ y C♯): 16 compases en cuatro frases, de las que se usan dos de cuatro compases (cada frase cabe en un loop de melodía de 4 compases, spec 002):

- **Frase A (abierta):** `F♯ F♯ G A | A G F♯ E | D D E F♯ | F♯. E E` (en negras; la última es una negra con puntillo, una corchea y una blanca).
- **Frase A′ (cerrada):** las mismas tres primeras compases y `E. D D` al final.

**La tonalidad.** **Re mayor** tiene las mismas notas que **si menor** (la escala del dembow, spec 005 §20): el estilo no cambia (120 bpm, kit 808, acordes Bm–G y bajo b1/g1) y la ayuda de la melodía sigue yendo a la misma escala.

**Las siete células**, creciendo una a una hasta el subidón (cada una añade lo que dice a lo de la anterior, salvo donde se diga que quita):

| # | Célula | Vueltas | Qué suena |
|---|---|---|---|
| 1 | **Intro** | 4 | Solo los **acordes**, suaves (el filtro apenas se abre: 800 → 1 200 Hz) |
| 2 | **Despierta** | 4 | + **platillo** (en corcheas) + la **melodía** (frase A) **suave y lejana** (sinte pad, con su reverb) |
| 3 | **Entra el ritmo** | 4 | + **bombo** (0 4 8 12) |
| 4 | **Dembow** | 8 | + **caja dembow** (3 6 11 14), platillo en semicorcheas y la **melodía clara** (frase A, sinte lead) |
| 5 | **Subida** | 4 | **Sin bombo**; la **caja se acelera** (negras, corcheas y semicorcheas a lo largo de los 4 compases); el **filtro se abre** (600 → 6 000 Hz); la melodía (frase A′) sigue |
| 6 | **Subidón** | 8 | **Todo**: acordes, **bajo**, bombo, caja dembow, platillo y la melodía (frase A′) **una octava más aguda** |
| 7 | **Final** | 2 | Solo los **acordes**, que **se apagan** (el filtro se cierra: 1 500 → 350 Hz) |

Total: **34 compases** (unos 68 s a 120 bpm).

### 4.1 Qué se aproxima

1. **"Suave y lejana"** (células 1 y 2) se aproxima con **filtro y sinte**: los acordes con el filtro cerrado y la melodía con el sinte *pad* (ataque lento, reverb grande). La app no tiene volumen ni reverb **por loop**: la mezcla es automática (spec 005 §20.4).
2. **Cada frase de 4 compases es un loop de melodía** (el máximo del modelo): en la célula 4 (8 vueltas) la frase A suena **dos veces seguidas** y en la 6, la A′ dos veces; el tema completo (A, A′, B, A′) no cabe en un loop de más de 4 compases. Llegar a 8 compases por loop sería otro cambio del modelo (no hecho).
3. **El filtro que se abre y se apaga** es un **filtro paso bajo por vuelta** (`Cell.lpf`, §5): sube o baja a saltos, **una vez por compás**, no de forma continua.
4. **La caja que se acelera** es un loop de **4 compases** con más golpes en cada uno (no un redoble continuo): compás 1 a negras (0 4 8 12), compás 2 a corcheas, compases 3 y 4 a semicorcheas.
5. **La melodía una octava más aguda** va escrita 12 semitonos arriba (re mayor se queda en el registro del lead, hasta la A5).
6. **Se conservan** el sidechain del bombo, las ganancias y el resto de lo que se dice en la spec 005 §20.4.

## 5. Cambio de modelo: el filtro por vuelta (`Cell.lpf`)

Nada de lo que ya existe permite que **el filtro se abra durante una célula** (el filtro de la pantalla es uno solo para toda la canción, y el barrido de 005 §4.3 es de unos tiempos al final de cada célula). Se añade a la célula un campo opcional:

```ts
interface Cell {
  // … como hoy
  /** filtro paso bajo (Hz) de cada vuelta de la célula; si hay menos valores que vueltas, vale el último */
  lpf?: number[]
}
```

- **En el código:** `.lpf("<v1 v2 v3 …>")` después del `stack` de la célula, con un valor por vuelta. Es Strudel normal: **vale en strudel.cc**. En el código mostrado (`arrange`) cada sección empieza en su ciclo 0, así que va tal cual; en el **motor**, que trabaja con compases globales, el patrón va **rotado** al compás en el que empieza la célula para que la vuelta 1 de la célula use el primer valor (spec 005, §4.2).
- Es un filtro de la célula, **independiente** del filtro de la pantalla (DJ, `djf`): los dos suenan a la vez. Sustituye al `lpf` propio del bajo y de los acordes mientras dura (por eso las células con `lpf` no llevan bajo).
- **Validación estricta** (`isCell`): una lista de 1 a 32 números finitos entre 60 y 20 000. Se escribe en el código con redondeo a entero; nada leído se escribe tal cual.
- Copiar y fundir células lo conservan en la copia (la fusión, el de la célula destino).
- No hay interfaz para editarlo todavía.

## 6. Datos y código

- `lib/remixes.ts`: la lista de remixes (`REMIXES`) y, de cada uno, su estilo, su kit, su compositor, sus células y una función que construye la `Song`. Las melodías están como notas (`[paso, duración, MIDI]`) con sus frases reutilizables.
- Los remixes **no se guardan** en el almacenamiento: son código; lo que se guarda es lo que el usuario guarda desde ellos.
- Los loops llevan `synth` propio (pad para la melodía lejana, lead para la clara), como el `drone` del dembow (005 §20).

## 7. Cómo se comprueba

- **Tests de datos** (`tests/unit/remixes.test.ts`): la lista y su atribución; las siete células con sus vueltas, loops y partes; las notas de cada frase (secuencia, duraciones que suman 4 compases, todas en la escala de si menor / re mayor, y la octava más aguda a +12); `isSong` y la ida y vuelta por JSON.
- **El código que sale se evalúa en Strudel** (el mismo intérprete de Node de la demo del dembow, 005 §20.3): 34 ciclos; en cada sección, qué suena y qué no (la Intro y el Final solo con acordes; la caja acelerada de la Subida con 4, 8, 16 y 16 golpes por compás y **sin bombo**; el bajo solo en el Subidón; la melodía clara frente a la octava más aguda) y el `lpf` de cada vuelta.
- **Filtro por vuelta:** validación (rechaza valores raros), rotación del patrón en el motor y que el código mostrado sigue siendo Strudel válido.
- **Interfaz:** la hoja lista el remix; abrirlo deja 7 células y cambia estilo y kit (probado en Chrome).

## 8. Decisiones a revisar

1. **Qué frase va en cada célula:** A en las células 2, 3 y 4 y A′ en la 5 y la 6 (la 5 y la 6 siguen una a otra). La frase B (el puente) no se usa porque no se reconoce tanto.
2. **La melodía continúa en la célula 3** (Entra el ritmo, solo "+ bombo"): se interpretó como que lo anterior sigue. En la 5 (Subida) también sigue.
3. **El platillo** va en corcheas en las células 2 y 3 y en semicorcheas desde la 4 (el patrón del dembow).
4. **El bajo solo en el Subidón**, como pedía la descripción.
5. **Dónde está el botón** (debajo del de Mis canciones) y su icono: a revisar al verlo en el móvil.
6. **Atribución visible** (compositor y años): en la hoja de la lista; no hay pantalla de créditos.
