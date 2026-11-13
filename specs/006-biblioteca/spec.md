# Spec 006 · Mis canciones (guardar, abrir y borrar)

Estado: **aprobada** (2026-11-13). Primer paso de la "Biblioteca de estilos y canciones" de la
hoja de ruta (spec 001, §14.1). Solo lo mínimo: guardar, abrir, borrar y poner nombre.

## 1. Idea

- Hoy la app guarda solo **la canción de ahora** (`coderbeats:song:v1`), que se reescribe a cada cambio. Para
  empezar otra, hay que perder la anterior.
- **"Mis canciones"** es una lista de canciones guardadas a propósito, **en este dispositivo** y sin servidor.
- Se guarda con un **nombre automático (estilo + fecha), editable**, se abre desde la lista y se borra.
- Lo de ahora sigue guardándose solo, como siempre: la biblioteca es aparte.

## 2. Alcance

**Dentro**
- Botón **"Mis canciones"** arriba, que abre un panel.
- **Guardar** la canción de ahora con nombre automático editable; **guardar cambios** de una que se abrió.
- **Abrir** una guardada (reemplaza la de ahora, con aviso si la de ahora no está guardada).
- **Renombrar** y **borrar** (con confirmación y "↶ deshacer" unos segundos).
- Lo guardado sobrevive a recargar, y no se pierde por un fallo de lectura (§5).

**Fuera (después)**
- Árbol de estilos y subgéneros ("Estilos"), y buscador (§14.1 de la spec 001, con la spec 004).
- **Compartir por enlace** (datos en la URL, nunca código Strudel), exportar e importar archivos.
- Copia en la nube o entre dispositivos, carpetas, etiquetas, ordenar a mano, duplicar, miniaturas.
- Guardar el tutorial o los ajustes del dispositivo (retraso de imagen, ayuda…).

## 3. Qué se guarda

Una canción guardada es **todo lo que es de la canción** (spec 005, §3): sus células con sus loops, el orden y
las sueltas, el tempo, y además el estilo, el kit, el modo de fondo y los efectos (filtro, espacio, calor).

```ts
interface SavedSong {
  id: string        // único, generado al guardar
  name: string      // 1–60 caracteres
  savedAt: string   // ISO, de la última vez que se guardó
  style: StyleId
  kit: KitId
  bgMode: BackgroundMode
  fx: SongFx
  song: Song        // el modelo de la spec 005 (células, orden, bpm…), sin versiones previas ni nacimientos
}
interface Library { version: 1; songs: SavedSong[] }
```

**No se guarda** lo que es del dispositivo o del momento: ayuda, metrónomo, carriles que graban, retraso de
imagen, zoom, ni lo que está sonando.

## 4. Cómo se usa

### 4.1 El botón
- **"Mis canciones"**: un botón con un icono de lista, **arriba a la izquierda** (frente a ⋯). En el móvil en
  horizontal, donde los estilos ocupan la izquierda, **a la izquierda de ⋯**.
- Abre un panel como el de ⋯ (sube desde abajo, se cierra tocando fuera).
- Más adelante será la entrada del menú que lleve también los estilos y el buscador (§14.1); el panel deja
  sitio arriba.

### 4.2 El panel
1. **Guardar** (arriba): un campo con el **nombre automático**, editable, y el botón **Guardar**.
   - Nombre automático: **estilo + fecha y hora**, p. ej. "Drum and bass · 14 nov, 21:30".
   - Si lo vacías, vale el automático. Se recorta a 60 caracteres. Dos canciones pueden llamarse igual.
   - Si la de ahora **viene de la lista** (se abrió o se guardó desde ella), el botón principal es **"Guardar
     cambios"** (la sustituye, con su nombre) y hay otro, **"Guardar como nueva"**.
   - Con la canción de ahora vacía, Guardar está apagado.
2. **La lista**, de la más reciente a la más antigua. Cada fila: nombre, y debajo "Drum and bass · 4 células ·
   18 compases · 174 bpm" y la fecha.
   - **Tocar la fila = abrir.**
   - **✎** renombrar (el nombre pasa a ser un campo; Intro lo guarda, Esc lo deja).
   - **🗑** borrar.
3. **Sin canciones:** "Aún no has guardado ninguna canción."

### 4.3 Abrir
- Reemplaza la canción de ahora por la guardada: sus células, el tempo, el estilo, el kit, el fondo y los
  efectos. Si sonaba, **arranca de nuevo desde su primera célula**, como "Cargar demo".
- **Aviso** si lo de ahora no está guardado ("¿Abrir «X»? Tu canción de ahora no está guardada."): se
  considera guardado si es igual a la última versión guardada o abierta, o si está vacía.
- Cierra el panel.

### 4.4 Borrar
- Pide confirmación ("¿Borrar «X»? Se puede deshacer unos segundos.").
- Después, arriba de la lista, "«X» borrada · **↶ deshacer**" durante **8 s**, como las células: la devuelve a
  su sitio, con su nombre, su fecha y todo. Un solo nivel (borrar otra reemplaza lo anterior). Pasados los 8 s
  (o al recargar), es definitivo: **solo está en memoria, no en el disco**.
- Borrar de la lista no toca la canción de ahora.

## 5. Datos seguros

Lo guardado es lo más valioso de la app, así que:
- Se guarda en `coderbeats:library:v1`. Leer **nunca borra**: si el JSON está roto, la biblioteca se ve vacía
  pero **se hace antes una copia del texto roto** en `coderbeats:library:v1:roto` y no se reescribe hasta que
  el usuario guarda algo.
- Una **entrada que esta versión no entiende** (rota, o de una versión futura) **no se muestra, pero se
  conserva tal cual** cada vez que se escribe.
- **Si guardar falla** (almacenamiento lleno o bloqueado, modo privado), se avisa ("No se ha podido guardar:
  el navegador no deja escribir") y no se pierde nada: la canción de ahora sigue donde estaba.
- Al abrir se valida la canción (`isSong`, `withValidBpm`, estilo y kit conocidos, efectos entre 0 y 1). Una
  guardada que no vale **no se abre ni se borra**: sale en la lista como "no se puede abrir" y se puede borrar.
- Guardar siempre escribe una copia nueva de la lista (no hay estados a medias entre dos escrituras).
- Al borrar, la entrada sale de la lista que se escribe en el disco, y se queda 8 s en memoria para deshacer.

## 6. Lógica y tests

`lib/library.ts`, puro y sin DOM:
- `autoName(style, date)`, `cleanName(text, fallback)` (recorta, 60 caracteres, vacío → automático).
- `makeSaved(state, now, id)`: la canción de ahora → `SavedSong` (con `storableSong`).
- `parseLibrary(raw)` → `{ songs, unknown, broken }`: entradas válidas, entradas que no se entienden y si el
  texto está roto. `serializeLibrary(songs, unknown)`: escribe las dos.
- `addSong`, `replaceSong`, `renameSong`, `removeSong` (devuelve lo quitado y dónde estaba) y `restoreEntry`
  (para deshacer), y la ordenación (más reciente primero).
- `summarize(saved)`: células, compases y tempo para la fila.
- `isUnsaved(current, reference)`: si lo de ahora difiere de lo guardado o abierto (y no está vacío).

Tests: nombre automático y limpieza; entradas válidas e inválidas; un JSON roto no se pierde; las entradas
desconocidas se conservan al escribir; añadir, renombrar, sustituir y borrar; orden; resumen; sin guardar.

La parte de pantalla (`LibrarySheet.vue`) y el motor (`openSavedSong`, que pone estilo, kit, fondo, efectos y
canción) usan esa lógica y no se prueban con tests de unidad.

## 7. Fases

Cada parte termina en algo que se prueba en el iPhone y en un commit.
- **1.1 Lógica y guardado:** `lib/library.ts` con tests, y su lectura y escritura segura (§5).
- **1.2 Guardar y abrir:** el botón, el panel, el campo de nombre, la lista, abrir con aviso.
- **1.3 Renombrar, guardar cambios y borrar:** ✎, 🗑, "Guardar cambios / como nueva" y los avisos.

## 8. Aceptación

1. Guardar crea una entrada con nombre "estilo · fecha" editable; recargar la página la conserva.
2. Abrir una guardada reemplaza la canción de ahora (células, orden, sueltas, tempo, estilo, kit, fondo y
   efectos) y suena igual que cuando se guardó.
3. Con lo de ahora sin guardar, abrir pide confirmación; con lo de ahora guardado o vacío, no.
4. Una canción abierta y modificada se actualiza con "Guardar cambios" sin crear otra, y "Guardar como nueva"
   crea una distinta.
5. Renombrar y borrar funcionan; borrar pide confirmación y se puede deshacer 8 s.
6. Un JSON roto o una entrada rara no borra nada y no rompe la lista.
7. Una guardada con una canción inválida no se abre y se puede borrar.
8. Con el almacenamiento lleno o bloqueado, avisa y no pierde la canción de ahora.

## 9. Decisiones a revisar

Las he tomado yo al escribir la spec; cámbialas sin más si no gustan.
1. **Dónde está el botón:** icono arriba a la izquierda (a la izquierda de ⋯ en horizontal), no entre los estilos.
2. **Guardar cambios** frente a **como nueva**: si se vino de la lista, lo normal es actualizar; si no, se
   acumularían copias.
3. **Qué se guarda:** estilo, kit, fondo y efectos van con la canción (spec 005, §3); ayuda, metrónomo,
   carriles y retraso de imagen no (son del dispositivo).
4. **Abrir** pide confirmación solo si lo de ahora no está guardado; **borrar** siempre la pide, y se puede
   deshacer 8 s (decisión del 2026-11-13).
5. **Sin límite** de canciones, ni nombres únicos. Si el almacenamiento se llena, avisa.
6. **Abrir reinicia** lo que suena, igual que "Cargar demo", sin esperar a la línea de compás.
7. **Fecha del nombre** en español y de la zona del dispositivo.

## 10. Decisiones tomadas al programarlo (a revisar)

Las he tomado yo al hacer las tres partes (2026-11-13); se cambian sin más.
1. **Renombrar:** Intro guarda, Esc lo deja y **salir del campo también guarda** (en el móvil no hay Esc).
2. **"Guardar cambios" también renombra:** el campo lleva el nombre de la guardada de la que viene lo de ahora;
   si lo editas, al guardar cambios se renombra. "Como nueva" guarda una distinta con lo que haya en el campo.
3. **De qué guardada viene lo de ahora se recuerda al recargar** (`coderbeats:library:current`), para que
   "Guardar cambios" y el aviso al abrir sigan funcionando. Es solo un id; no guarda ninguna canción.
4. **"Cargar demo", "Borrar todo" y la demo de prueba del diagnóstico desvinculan** la canción de la guardada
   de la que venía (cambiado el 2026-11-13): el botón vuelve a "Guardar" y no se puede machacar una guardada
   sin querer. Deshacer "Borrar todo" tampoco la vuelve a vincular. Cambiar el estilo, un golpe o el tempo, en
   cambio, sigue siendo editar esa canción: se puede "Guardar cambios".
5. **El "↶ deshacer" del borrado dura 8 s aunque cierres el panel:** si lo reabres a tiempo, sigue ahí.
6. **Si borras la guardada de la que viene lo de ahora,** el botón vuelve a ser "Guardar" (nueva).
7. **Guardar cambios sube la entrada arriba** (la lista va por la fecha de la última vez que se guardó).
8. **Una guardada rota no se puede renombrar,** pero sí borrar (y deshacer).
9. **El campo de nombre se rehace al abrir el panel** (nombre automático, o el de la guardada de la que viene).
