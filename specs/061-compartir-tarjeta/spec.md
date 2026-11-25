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

## Principios
1 ✔ · 2 ✔ solo suena lo que la canción ya lleva · 3 ✔ · 4 ✔ la persona decide si firma y comparte · 5 ✔ · 6 ✔ compartir fácil y sin servidor · 7 ⚠ precedente: las tarjetas de Spotify y los vídeos de Reels; sin probar con alguien que no conozca la app · 8 ✔ reutiliza el enlace, el motor y el exportador de siempre.

## Decisiones a revisar
- La vista previa del enlace (WhatsApp, Instagram…) será siempre la `og.png` genérica: el fragmento no llega al servidor y no hay backend.
- En un remix de la app, el compositor original va en los datos (`composer`) pero la tarjeta, sin firma, no muestra autor.
- Recortar loops a 2 compases puede dejar una frase de melodía a medias: cae en compás entero y el fundido final lo cubre; hay que oírlo.

## No comprobado
Solo con navegador sin pantalla (la canción derivada cambia de célula a los compases previstos). **No oído y no visto en un iPhone.**
