# Spec 052 · Remixes como reproductor, fase 2: la pantalla «reproduciendo» (corta)

## Por qué
La fase 1 (spec 051) dio la biblioteca y el mini reproductor. Falta la otra mitad: que la pantalla del remix se vea y se maneje como un reproductor, **más limpia**, con **anterior y siguiente** remix y los extras (grabar, vídeo, enlace, Estudio, opciones…) recogidos en un menú «⋯». Pedido de Ion (2026-11-19: «fase 2 adelante»).

## Qué es
- **Cabecera:** «← Menú», el **título del remix** (antes decía «Remixes») y un **«⋯»** a la derecha. Debajo, una fila con el **«⌄»** (a la biblioteca, sin parar el sonido) y «compositor · tonalidad · estilo». El Pulso (o los círculos, la vista elegida) se queda como lienzo grande; en el Pulso en directo, la línea de arriba pasa a «compositor · estilo» (el título ya está en la cabecera; el vídeo y el modo escuchar siguen llevando el título dentro del lienzo).
- **Transporte** bajo el lienzo: **⏮ anterior · ▶/■ · ⏭ siguiente** (iconos de trazo propio, no emoji). ▶/■ hace lo mismo que el del mini reproductor. **Anterior y siguiente** recorren la biblioteca (los de coderbeats y luego Mis canciones, dando la vuelta); si **sonaba**, el nuevo **sigue sonando** desde su primera parte (la persona ya había empezado: no es «solo»); si estaba parado, queda parado.
- **Lo que ya se hacía y se queda a la vista:** el **pad de partes** (con el borde que se ilumina) y el **DJ**; el texto de ayuda, más pequeño; y, solo cuando hay algo en marcha, una **tarjeta de grabación** («● 3/20 · final» con su botón **Terminar**) y los avisos del vídeo y del enlace, para no perder de vista qué pasa con el menú cerrado.
- **El menú «⋯»** (una hoja desde abajo, con fondo que oscurece y `Escape`/tocar fuera para cerrar, `role="dialog"`, respeta el área segura): **Mi versión** (● Grabar mi versión, escuchar la mía y Mi vídeo cuando hay), **Escuchar y compartir** (escuchar el remix original, enlace, Abrir en el Estudio, Elegir otra canción) y **Opciones** (Auto, Vista, Zoom, con su estado en el acento). Las acciones cierran la hoja para ver el resultado; las opciones no. Con la hoja cerrada, **sus botones siguen en el DOM** (`v-show`), así los guiones del navegador y todo lo que ya existía siguen funcionando.
- **No cambia nada de lo que existe:** ni el sonido, ni las partes, el DJ, Auto, el Pulso, los círculos (siguen **idénticos**), la grabación, el vídeo o el enlace; solo dónde está cada botón. Se **quita** de la pantalla principal lo que ahora vive en el menú: la fila de grabar/mi versión/vídeo, las opciones, los enlaces y los dos botones grandes del final («otra canción» y «Abrir en el Estudio»: ahora «⌄» y el menú).

## Reglas de diseño (`specs/DISENO.md`)
Fondo negro; un instrumento, un color; botones de **44 px o más** (el ▶/■ de 64, anterior y siguiente de 48); texto de al menos 11 px; el rojo solo para «grabando»; las hojas entran con fundido (`sheet`: sin movimiento con `prefers-reduced-motion`); un solo `requestAnimationFrame` por pantalla (no se añade ninguno).

## Principios (`specs/PRINCIPIOS.md`)
1. **Una pantalla, una cosa** ✔ tocar; lo demás, en el menú.
2. **No se puede sonar mal** ✔ no toca el sonido.
3. **Respuesta inmediata** ✔ ▶/■, anterior y siguiente responden al tocar.
4. **Se siente tuyo** ✔ el pad y el DJ siguen a la vista; anterior/siguiente solo continúan lo que la persona ya había empezado.
5. **Pocas cosas a la vez** ✔ de unos 15 controles a la vista a unos 8.
6. **Compartir fácil** ⚠ vídeo y enlace pasan a un toque más (el «⋯»): se acepta a cambio de una pantalla limpia; su estado sigue a la vista.
7. **Precedente** ✔ la pantalla «reproduciendo» de cualquier reproductor ⚠ sin probar con alguien que no conozca la app.
8. **Antes de añadir, quitar** ✔ se **quita** mucho de la pantalla principal (ver arriba) y se añade el transporte y el menú.

## Decisiones a revisar
- Si anterior/siguiente deberían **empezar a sonar siempre** (como un reproductor) y no solo si ya sonaba.
- Dónde queda **Mi versión** si se usa mucho: en el menú son dos toques.
- El tamaño del lienzo (540 × 700) con el transporte debajo en un móvil pequeño.

## Hecho y sin hacer
**Hecho (2026-11-20):** la cabecera con el título y el «⋯» (hueco `header` en `LabShell`), la fila «⌄ · compositor · tonalidad · estilo», el transporte (⏮ ▶/■ ⏭ con iconos SVG), la tarjeta de grabación con su Terminar, el menú «⋯» (hoja con `role="dialog"`, Escape y tocar fuera para cerrar), `neighborId` (pura, con tests), textos en es/en/eu y la referencia del guion `lab-remix-igual` regrabada (los botones cambiaron a propósito; **el hash del lienzo de círculos y las capas, idénticos**).
- **Comprobado en el navegador sin pantalla (pantalla real):** los controles miden lo que deben (⋯ 44, ▶/■ 64, ⏮ y ⏭ 48); la hoja está oculta por defecto, se abre y se cierra con Escape; **siguiente con el remix sonando sigue sonando** (■) desde la primera parte del nuevo, **anterior** vuelve al anterior sonando, y **con el remix parado, siguiente lo deja parado** (▶); el paso automático de la primera parte tarda lo mismo con y sin saltar (se pide a ~6 s y entra a ~8 s en un Intro de 4 compases a 120 bpm); y el **flujo largo de `lab-remix.mjs` pasa entero**: grabar desde el menú, terminar con el botón de la tarjeta, escuchar «mi versión» y exportar el vídeo hasta «vídeo listo», sin errores.
- Un detalle del entorno, no de la app: `lab-remix.mjs` (y los demás guiones que sacan capturas) guarda en la carpeta de `OUT`, y por defecto apuntaba a una carpeta de una sesión antigua; hay que pasar `OUT=<carpeta>`.
**Sin hacer:** probarlo en un iPhone (**el gesto de cerrar la hoja, el área segura, el teclado y la fluidez sin comprobar**), el mini reproductor en el menú del Laboratorio y otras pantallas, y quitar pantallas del Lab (decisión de Ion). Anterior y siguiente recorren la lista entera (los de coderbeats y luego Mis canciones); no respetan el filtro de la biblioteca.
