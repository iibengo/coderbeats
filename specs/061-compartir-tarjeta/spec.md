# Spec 061 · Compartir una canción como tarjeta (por pasos; este es el paso 1)

## Por qué
Compartir un remix como una tarjeta bonita, estilo Spotify, con la estética de coderbeats, sin backend: un enlace corto `/s#…`, una página con la tarjeta y ▶, y un vídeo de ~15 s para las historias. Plan aprobado por Ion (2026-11-25).

## Pasos (un commit por paso, con el diff enseñado antes)
1. **Enlace y resumen** (este): `app/lib/shareCard.ts` y `app/lib/cardSummary.ts`, con tests.
2. La página `/s`: tarjeta, ▶ grande, promo y «Abrir en coderbeats». 3. La tarjeta en lienzo y el vídeo con `navigator.share`. 4. La animación con `AnalyserNode`. 5. Textos ES/EN/EU.

## Paso 1: qué hace
- **Enlace:** `/s#r=<id>` (un remix de la app: corto) o `/s#c=<datos>` (una canción propia: los mismos datos de `shareLink.ts`), con **firma opcional** `&f=<texto>` (24 caracteres, sin caracteres de control ni de dirección; vacía = la tarjeta no muestra autor). Todo en el fragmento, nunca llega a un servidor. Solo datos: id con forma de id, datos por `decodeShare`, firma como texto.
- **Tamaño medido** (canción más grande, Lacrimosa en drill, 8 partes): **3,4 KB** comprimida (los demás, entre 1,4 y 2 KB). Muy por debajo de los 8 KB. Las grabaciones de voz no son audio (se guardan como notas y golpes): cualquier remix cabe.
- **Resumen:** una canción derivada con entrada, subida y drop (por nombre de célula o por lo que llevan), a compases enteros, a 15 s lo más cerca posible (**14,5–16,6 s** en los 12 remixes de la app) y con un fundido corto (0,6 s) que aplicará la grabación. **El motor mantiene una célula al menos lo que dura su loop más largo** (medido: con 2 vueltas y un loop de 4 compases, la célula dura 4), así que se recortan los propios loops a los compases del tramo; la nota que cruza el final se acorta. Los grupos en paralelo que sonaban se encienden donde tocan. Los tramos duran de 2 a 8 compases.

## Paso 2: la página `/s` (`app/pages/s.vue`)
- Lee el fragmento (`parseCardHash` → `resolveCard`), pinta la tarjeta (barras del remix en rosa, título, «firma · estilo · bpm» en mono, «hecha con coderbeats») y un **▶ grande** de 80 px que arranca el motor en ese toque y toca la canción entera (ya sin micro: `useLab().begin`). Segundo toque, ■.
- Debajo: «hazla tuya · crea tus remixes · toca, juega» y **«Abrir en coderbeats»**: un remix de la app abre `/lab?remix=<id>` (Remixes), una canción propia abre `/#c=<datos>` (el enlace de siempre, que abre el Estudio).
- Un enlace roto, un id que no existe o datos que no valen enseñan un aviso y un botón a la app. `noindex`. La ruta `/s` va sin SSR. Textos en ES, EN y EU (`card.*`). `STYLE_SHORT` pasa a `app/lib/styleNames.ts`, compartido con el Estudio.
- Probado en el navegador sin pantalla (390 × 844): remix con y sin firma, canción propia, id desconocido, datos rotos y sin fragmento; ▶ y ■ cambian `engine.playing`. La franja inferior queda libre.

## Paso 3: el botón Compartir y el vídeo de la historia
- **El botón:** la flechita junto a «⋯» en Remixes del Laboratorio y en el Estudio abre `ShareSheet`: «firmar como» (opcional, vacío, solo en el enlace; no se guarda), **Compartir** (hoja del sistema) y **Copiar enlace** (con respaldo si el portapapeles no deja). Un remix de la app da un enlace corto `/s#r=<id>`; una canción propia, `/s#c=<datos>`.
- **El vídeo** (`useCardVideo`, `cardCanvas.ts`): ~20 s en vertical (1080 × 1920). Un lienzo propio con la tarjeta y el audio del motor en un `MediaRecorder`, en tiempo real, sin ffmpeg; la canción derivada (`planSummary`) se toca de principio a fin con el reproductor de siempre. El avance que se enseña (**«Preparando tu vídeo… 53 %»**) es el real: dónde va la canción respecto a sus compases. Al acabar, el motor vuelve a lo que había. Si la persona sale de la pantalla, se cancela (el audio de una pestaña oculta no es fiable).
- **Al terminar:** vista previa, **Compartir vídeo** (`navigator.share` con el archivo) o **Guardar vídeo** (descarga), y el enlace sigue a mano para pegarlo en el sticker de enlace de la historia.
- **Fundido:** imagen y audio bajan a negro en los últimos 0,6 s. El audio grabado va unas décimas por detrás de la imagen, así que se graban 0,6 s más (ya en negro) para que la rampa termine dentro del vídeo; el vídeo dura ~22 s.
- **Medido** (navegador sin pantalla, Korobeiniki, 132 bpm): 1080 × 1920, 15,15 s, audio con sonido (−19 dB de media, −3 dB de pico) que cae a silencio en el último 0,4 s; la franja de abajo (350 px) y la de arriba (220 px), **0 píxeles** que no sean fondo. Un test comprueba además que `drawCard` no pinta fuera de la zona útil.
- No hay barra de progreso falsa; el botón de vídeo solo sale si el navegador sabe grabar vídeo con sonido (si no, un texto lo dice).
## Paso 4: la animación al ritmo (rehecha tras ver el vídeo en un iPhone)
- **Primera versión (descartada):** un `AnalyserNode` con la energía por bandas. En el iPhone las barras apenas se movían (±15 %) y la fila de bloques `▁▂▃` se veía como una banda gris. Se quitó (`engine.levels`, `cardLevels.ts`).
- **Ahora, como el «Pulso» de Remixes:** las cinco barras del icono son las cinco voces (bombo, bajo, caja, platillo, melodía), cada una **con el color de su instrumento** (`VOICE_HEX`, un instrumento un color), y **saltan en su golpe y se apagan rápido** (`sampleLane` del Pulso sobre `songTimeline`). La energía sale de los golpes de la canción, no del sonido: salta justo en el golpe, sin analizar audio ni tocar la cadena maestra. En reposo, el dibujo de siempre; con movimiento reducido, quietas. Sin fila fina.
- **Resumen de ~20 s** (antes 15): con 20 s caben tramos de 4 compases y la melodía suena entera. En los 12 remixes de la app salen entre 18,8 y 21,8 s; el vídeo dura unos 23 s con el final animado. Cortar un loop pesa más al elegir los compases.
- **La línea en mono se encoge** (de 36 a 22 px como mínimo) para caber con margen: con una firma de 24 caracteres tocaba los dos bordes de la tarjeta.
- Medido en el navegador sin pantalla con una firma de 22 caracteres: las columnas cambian de altura a lo largo del vídeo (solo la melodía a los 2 s; bajo, caja y platillo después; todas a los 16 s).

## Paso 5: el diablillo de coderbeats y la animación del final
- **El icono nuevo** (v4, aprobada por Ion): un diablillo con cascos en una sola línea de neón, en degradado de lila (`#B7A6F2`) a rosa (`#F496BC`) con brillo. Dibujo grande en `public/brand/diablillo.svg`; para tamaños pequeños, una versión más gruesa y sin brillo (`DevilMark.vue`, favicon de 48 px). Sustituye a los cascos en el icono de la app y del móvil (`icon-192/512`, `icon-maskable-512`, `apple-touch-icon`, el README que usa `icon-192`) y en el botón del Estudio que lleva al Laboratorio. **Para la pestaña (favicon de 16 y 32 px) se conservan los cascos de antes**: a 16 px el diablillo es una mancha y los cascos se leen.
- **La animación** (`cardOutro.ts`, ~2,2 s en el último compás): la tarjeta se apaga, el contorno con los cuernos se dibuja como un neón (el trazo avanza con `setLineDash`), luego los cascos, los ojos y la sonrisa, y debajo aparece «coderbeats.» subiendo y con fundido. El icono entra con un pequeño crecimiento. Después, una cola de 1,3 s con la imagen completa (se sigue dibujando para que el vídeo recoja fotogramas: un lienzo quieto no los da). El audio baja a silencio dentro del final.
- Medido en el navegador sin pantalla: los últimos ~2 s del vídeo muestran el diablillo y el nombre completos y estables. Tests: no pinta nada antes de empezar, 6 trazos + nombre + punto al acabar, todo dentro de la zona útil, y el dibujo del código es idéntico al del SVG aprobado.
- **Sin cambiar todavía:** `og.png` (la imagen del enlace compartido) sigue con el nombre y el punto rosa.

## Paso 6: pulido tras ver el vídeo de Korobeiniki en un iPhone
- **Resumen de ~23 s en total** (21,5 s de música + 1,5 s de cola): la **intro dura 1–2 compases**, la subida 2–4 y el **drop (donde suena el tema) 4–8**; el planificador castiga que el tema suene menos del 70 % del resumen y cada compás sin tema antes de que entre. Cortes siempre en compases enteros. En los 12 remixes de la app: entre 19,3 y 22,7 s de música.
- **Fondo:** detrás de la tarjeta, un brillo muy suave y difuso con los cinco colores de las barras (opacidad 0,07; hasta 0,12 con el bajo), que **respira con el bajo**. Cada mancha cabe entera en la zona útil.
- **Arriba, pequeña y en mono:** la dirección (`location.host`, «coderbeats.vercel.app»). Nada en la franja de abajo (medido: 0 de diferencia con el fondo en los 350 px de abajo y en los 220 de arriba).
- **Final suave:** el audio baja en el último segundo (antes 0,6 s), las barras vuelven a su reposo al apagarse la tarjeta y, tras el diablillo, el último 40 % de la cola se funde a oscuro, para que el bucle de la historia no corte en seco.
- **Firma vacía:** la línea queda «techno · 132 bpm», sin separador delante (con test).
- **`<html lang>`:** sí está en el HTML servido (`lang="es"`, también en la web publicada) y sigue el idioma del navegador: es→es, en→en, eu→eu y los demás → en, en `/`, `/lab`, `/estudio` y `/s` (comprobado con un contexto limpio por caso; con la cookie `coderbeats_lang` manda la cookie). Sin cambios.

## Paso 7: el sonido del diablillo (`devilSting.ts`, `engine.playSting`)
- **La versión D1, elegida por Ion** tras oír tres propuestas (y la risa en dos vocales): un **barrido que sube** (el neón que se enciende), un **golpe grave** cuando se cierra el contorno y una **risita «ji-ji»** (voz de formantes, vocal «i», dos sílabas, la segunda más alta), con una cola corta. 2,4 s, pico en −3 dBFS, la risa unos 5 dB por debajo del golpe. **Sintetizado** en el navegador (osciladores, filtro de estado variable y formantes; sin muestras, sin derechos), repetible (generador con semilla) y con la frecuencia de muestreo del contexto.
- **Por su propio camino:** entra **directo al final de la cadena** (`masterEnd`, antes del limitador de pico, que lo suena y lo graba), sin pasar por la ganancia maestra. Así el fundido de la canción (`fadeOut`) no lo apaga y suena **mientras la canción baja**, como en la mezcla que le gustó. Se dispara cuando el diablillo empieza a dibujarse (1,6 s antes del final de la música).
- **Medido en el audio grabado** (navegador sin pantalla): la música baja de −3 a −13 dB mientras el sonido sube a −0,8 y −4,8 dB (golpe y risa), la cola se apaga y a 0,5 s del final hay silencio. Tests: dura 2,4 s en 44,1 y 48 kHz, sin NaN, pico −3 dBFS, repetible, estéreo, cada cosa en su sitio (barrido, golpe, las dos sílabas, cola) y acaba sin chasquido.
- **Un fallo encontrado al portarlo** de Python a TypeScript: el filtro del barrido se volvía inestable por el orden de los pasos (ahora con un comentario y cubierto por los tests).
- **Sin oír:** nadie ha oído todavía el sonido dentro del vídeo grabado en el iPhone.

## Canciones propias y voz
- Una canción propia se comparte con `/s#c=<datos>` (en el Estudio y en «Mis remixes» del Laboratorio); la página, el ▶ y «Abrir en coderbeats» (que abre el Estudio) funcionan igual. **Las voces grabadas como audio no viajan en el enlace** (el audio vive en el navegador de quien lo grabó): la hoja avisa. El vídeo sí las lleva, porque se graba en el mismo dispositivo. Aviso también si el enlace pasa de 8 000 caracteres.
- Comprobado en el navegador: el enlace de una canción propia y su página (`/s#c=…`) con firma; **sin comprobar** el vídeo de una canción propia con varias células.


## Principios
1 ✔ · 2 ✔ solo suena lo que la canción ya lleva · 3 ✔ · 4 ✔ la persona decide si firma y comparte · 5 ✔ · 6 ✔ compartir fácil y sin servidor · 7 ⚠ precedente: las tarjetas de Spotify y los vídeos de Reels; sin probar con alguien que no conozca la app · 8 ✔ reutiliza el enlace, el motor y el exportador de siempre.

## Decisiones a revisar
- La vista previa del enlace (WhatsApp, Instagram…) será siempre la `og.png` genérica: el fragmento no llega al servidor y no hay backend.
- En un remix de la app, el compositor original va en los datos (`composer`) pero la tarjeta, sin firma, no muestra autor.
- Recortar loops a 2 compases puede dejar una frase de melodía a medias: cae en compás entero y el fundido final lo cubre; hay que oírlo.

## No comprobado
Solo con navegador sin pantalla (la canción derivada cambia de célula a los compases previstos). **No oído y no visto en un iPhone.**
