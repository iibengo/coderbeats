# Spec 024 · Tres mejoras al editar partes (propuesta, sin programar)

Estado: **aprobada por ti, en cola** (después de la auditoría 022, en el orden acordado; un commit por parte). Depende de 020 (Editar parte, Órgano, Batería).

## 1. «▶ Tocar en el Laboratorio»
Botón en el panel «Editar parte» y en «Remixes» del Estudio. Guarda lo que hay en **el mismo remix** (si viene de «Mis remixes») o lo crea (con el nombre «Mi …», una sola vez), y abre `/lab` directamente en **Remixes** con ese remix elegido (`/lab?remix=<id>`). Es el camino inverso de «Abrir en el Estudio». Sin copias nuevas cada vez.

## 2. Parte fija mientras edito (🔒)
- Al abrir cualquier editor de una parte (Órgano, Batería, y los de bajo y acordes de la fase 4), la parte queda **bloqueada en bucle**: la canción no avanza a la siguiente mientras edito. Es el «bucle» que ya existe (`loopTarget` / «Soltar bucle»), activado solo mientras el editor está abierto.
- **🔒** en la cabecera del editor, encendido por defecto; pulsarlo lo desbloquea (la canción sigue). **Al cerrar el editor se vuelve a como estaba** (si ya había un bucle puesto por la persona, se respeta; si no lo había, se suelta).
- Si no suena nada, no hace nada. No se guarda en el remix (es solo del momento).

## 3. Barra de tiempo del compás que edito
En el **Órgano** (y en la **Batería** si encaja): una barra con el compás o los 2 compases que se editan.
- **▶ / ⏸**: con ⏸ la parte deja de sonar pero **la aguja se queda** donde estaba.
- En pausa: **arrastrar la aguja** a cualquier punto (se imanta a la casilla); **tocar una casilla en pausa hace sonar la nota** (sin reproducir el resto) para colocarla con calma.
- En marcha, la barra muestra la posición como ahora. En la **Batería** la aguja se arrastra por el círculo/la cuadrícula; solo tiene sentido en la cuadrícula (los 16 pasos), así que en el círculo queda como indicador.
- Implementación: el reloj del motor no se detiene (riesgo alto, sin poder oír): «pausa» = silenciar la parte y congelar el indicador; «arrastrar» solo mueve el indicador y el punto desde el que suenan las notas al tocarlas.

## 4. Principios
1. **Una pantalla, una cosa:** cada editor edita una capa; la barra solo mueve el tiempo. ✔
2. **No puede sonar mal:** en pausa se oye cada nota al colocarla; todo en la escala. ✔
3. **Respuesta inmediata:** la nota suena al tocar, también en pausa. ✔
4. **Se siente mío:** yo decido cuándo se bloquea y cuándo avanza. ✔
5. **Pocas cosas a la vez:** ⚠ el Órgano gana 🔒 y la barra; se compensa quitando «Soltar bucle» de la pantalla principal mientras haya editor. 
6. **Fácil de compartir:** «Tocar en el Laboratorio» lleva al vídeo y a compartir. ✔
7. **Precedente:** el bucle por defecto de Song Maker y de los editores de patrones; la barra de tiempo de GarageBand. ✔
8. **Quitar antes de añadir:** se reutiliza el bucle y las vueltas que ya hay; no se añade reloj nuevo. ✔

## 5. DISENO.md
Botones ≥ 44 px; barra de tiempo de 44 px de alto como zona de toque; aguja blanca (`DISENO.md` «la aguja»); 🔒 en el color de acento solo cuando está activo; sin animaciones nuevas (movimiento reducido: sin cambios).

## 6. Fases (un commit cada una)
1. ▶ Tocar en el Laboratorio. 2. Parte fija 🔒. 3. Barra de tiempo en el Órgano. 4. Barra de tiempo en la Batería (si encaja).
