# Spec 051 · Remixes como reproductor: biblioteca y mini reproductor (fase 1, corta)

## Por qué
Ion quiere «subir de nivel» el Laboratorio con un diseño tipo reproductor (como Spotify): poder **cambiar de canción**, **buscar un remix** y que la pantalla se entienda a primera vista, **manteniendo todas las funciones**. Decisiones de Ion (2026-11-19): la **primera fase es la biblioteca con buscador y el mini reproductor**; la búsqueda es **por texto y con filtros por estilo**. La fase 2 (pantalla «reproduciendo» con carátula grande, anterior/siguiente y un menú «⋯» para los extras) queda para después. Se toma el **patrón**, no la marca: nada de verde ni de logos; negro, acento rosa y los colores de los instrumentos (`specs/DISENO.md`).

## Qué es
- **Biblioteca** (la lista de Remixes de hoy, rediseñada): un **buscador** (título, compositor, tonalidad, estilo; sin acentos ni mayúsculas, todas las palabras tienen que coincidir), **chips de estilo** para filtrar (los que haya: «todos», drill, techno…) y **filas** con una **carátula** (cinco barritas en los colores de los instrumentos, quietas; su altura sale de la **línea de tiempo** del remix —spec 049—, así cada remix tiene la suya), el título, «compositor · estilo», la duración y, si es el que está cargado, el título en rosa. Los «de coderbeats» y **Mis canciones** siguen en dos grupos. Sin resultados: un aviso.
- **Mini reproductor:** si hay un remix cargado y se está en la biblioteca, una barra fija abajo con su carátula, el título, la parte que suena y **▶/■**; tocarla vuelve al reproductor. Así se puede **seguir oyendo mientras se busca**.
- **Cambiar de remix:** elegir otro en la biblioteca **para** el que suena (no se pueden mezclar dos) y carga el nuevo **sin empezar solo** (la persona decide cuándo, principio 4; en la fase 2 se podrá cambiar a «empieza al elegir»). El botón **«otra canción»** del reproductor ahora **vuelve a la biblioteca sin parar el sonido** (antes paraba todo); el mini reproductor lo muestra y lo para con ■. Un botón «⌄» arriba (con `aria-label` «biblioteca») hace lo mismo.
- **No cambia nada de lo que existe:** el reproductor (Pulso o círculos, partes, DJ, grabar, escuchar, vídeo, enlace, Estudio, Auto, Vista, Zoom) queda **igual**; los remixes y su audio, igual; el guion que compara los círculos píxel a píxel debe seguir diciendo «IGUAL».
- `app/lib/remixLibrary.ts` (puro, con tests): `normalizeText`, `filterRemixes`, `styleChips`, `coverBars`, `fmtDuration`. `app/components/lab/LabCover.vue`: la carátula. `LabShell` gana `bare` (sin la fila ▶/■ y la frase) para la biblioteca.

## Reglas de diseño (`specs/DISENO.md`)
Fondo negro; un instrumento, un color, el de `VOICE_HEX`; botones de **44 px o más**; texto de **al menos 11 px** (el buscador, de 16 px para que iOS no haga zoom); nada se mueve sin música (las carátulas son estáticas); la barra fija respeta el área segura del iPhone.

## Principios (`specs/PRINCIPIOS.md`)
1. **Una pantalla, una cosa** ✔ la biblioteca solo elige; el reproductor solo toca.
2. **No se puede sonar mal** ✔ no toca el sonido.
3. **Respuesta inmediata** ✔ el filtro responde al teclear; ▶/■ del mini reproductor, al instante.
4. **Se siente tuyo** ✔ elegir un remix no lo pone a sonar solo; la persona decide cuándo. ⚠ Un reproductor invita a escuchar: el pad de partes sigue siendo lo central del reproductor.
5. **Pocas cosas a la vez** ✔ la biblioteca no suena; el mini reproductor es una sola barra.
6. **Compartir fácil** ✔ no cambia (enlace, vídeo y Estudio siguen en el reproductor).
7. **Precedente** ✔ Spotify, Apple Music y cualquier reproductor (biblioteca + mini reproductor) ⚠ sin probar con alguien que no conozca la app.
8. **Antes de añadir, quitar** ⚠ se añade el buscador, los filtros y el mini reproductor; no se quita nada todavía (en la fase 2 los extras pasarán a un menú «⋯» y la pantalla quedará más limpia).

## Decisiones a revisar
- Si elegir un remix debería **empezar a sonar** (como un reproductor) o esperar a que se toque una parte (como hoy).
- Que «otra canción» ya **no pare** el sonido.
- Con pocos remixes el buscador de texto casi sobra; los chips de estilo sí sirven.
- Fase 2: la carátula grande con el Pulso, anterior/siguiente y el menú «⋯».

## Hecho y sin hacer
**Hecho (2026-11-19):** `app/lib/remixLibrary.ts` (`normalizeText`, `matchesQuery`, `filterRemixes`, `styleKey`, `styleChips`, `coverBars`, `fmtDuration`), `LabCover.vue`, `LabShell` con `bare`, y la biblioteca y el mini reproductor dentro de `LabRemix.vue` (vista `lista` / `player`), textos en es/en/eu y 11 tests nuevos.
- **Comprobado en el navegador sin pantalla (pantalla real):** 12 filas con su carátula, duración y subtítulo con el nombre del estilo; buscar «mozart» da la Sinfonía n.º 40 y el Lacrimosa; el chip «Drill» da solo el Lacrimosa y «Techno» sus cinco remixes; «zzzz» da el aviso de sin resultados; entrar a un remix muestra el reproductor con su «⌄»; volver con el remix sonando muestra el **mini reproductor** (título, parte y ■) y **sigue sonando**; su ■ para y su ▶ pone a sonar; **elegir otro remix mientras suena para el anterior y carga el nuevo sin empezar solo** (el mini muestra ▶). El guion «lab-remix-igual» sigue diciendo **«IGUAL que antes del zoom»** (los círculos, idénticos píxel a píxel).
- **Fallos que salieron al probarlo y se corrigieron:** (1) los chips salían **duplicados** («Techno» dos veces: `techno` y `techno2`, y lo mismo con House): ahora se agrupan por el nombre que ve la persona (`styleKey`); (2) los textos largos **desbordaban las filas** y la página se ensanchaba, el navegador la encogía y el mini reproductor quedaba fuera de pantalla: `grid-cols-1` y `min-w-0` en las filas (comprobado: ancho 400, filas de 376 como el buscador, mini en y = 791 de 860); (3) «n.º» no se normalizaba y «sinfonia n.o 40» no encontraba la Sinfonía.
**Sin hacer:** la fase 2 (carátula grande con el Pulso, anterior/siguiente y el menú «⋯»), el mini reproductor en el menú del Laboratorio y en otras pantallas (hoy solo dentro de Remixes), que las carátulas se distingan más entre sí (casi todas tienen el charles y la melodía altos: contar golpes los iguala; una raíz cuadrada las separaría), y probarlo en un iPhone (**teclado, área segura y fluidez sin comprobar**).
