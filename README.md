# coderbeats

Un instrumento para jugar con la voz: haces beatbox (**bum · pff · ts**) y coderbeats lo convierte en batería que suena en bucle y en **código [Strudel](https://strudel.cc)** que puedes copiar y pegar. Todo corre en el navegador (también en el móvil): **el micrófono se analiza en tu dispositivo y no se envía nada a ningún servidor**; tus canciones y tus grabaciones se guardan solo en tu navegador.

> Estado: proyecto personal en marcha, en español. Se desarrolla con ayuda de IA y cada decisión queda escrita en [`specs/`](specs/).

## Para probarlo

1. Abre la app (HTTPS o `localhost`: el micrófono lo exige) y pulsa **Empezar**. No hay que calibrar nada: trae un modelo de sonidos por defecto.
2. Dale a **▶** y haz «bum · pff · ts»: tus golpes aparecen en la gota y suenan en bucle.
3. Si no acierta con tu voz o tu micro, sale «¿Te afino a tu voz?» (o ⋯ → «Calibrar mis sonidos»: unos 20 segundos, a manos libres).
4. Sin micro también se puede: «Entrar sin micro» abre una demo para tocar con el dedo.

## Qué hace

- **Escucha continua**: graba frases de beatbox, las cuantiza al compás y las deja como loops (bombo, caja, platillo).
- **Dos modos**: **Jugar** (una gota, la voz y el dedo, con un primer minuto guiado) y **Componer** (el mapa de células, grupos y disparadores). Son dos vistas de la misma canción.
- **Melodía**: con la voz (cantando «na»), con el órgano de la franja de melodía, con «🎹 Agua» y con la **célula de melodía**, un sintetizador de dedo (mantén y desliza: arriba/abajo = nota de la escala, lados = filtro).
- **Células y canción**: cada célula es un aro con sus loops, bajo y acordes; varias, una tras otra, forman una canción; hay grupos en paralelo.
- **Fondo y efectos**: bajo y acordes por estilo (hip hop, house, drum and bass, dembow, techno), filtro, espacio, calor y «wowo». Una opción de **Producción** (swing, matices, transiciones) para que suene menos a máquina.
- **Código = sonido**: el código mostrado, pegado en strudel.cc, suena igual que en coderbeats. (La app añade una cadena master «cálida» que strudel.cc no tiene: el código copiado suena algo más seco.)
- **Remixes** de dominio público (Himno de la alegría, Dies Irae, Sinfonía n.º 40) y **vídeo** (exportar lo que ves y oyes).
- **PWA**: se instala y funciona en móvil.

## Cómo se construye

Necesitas Node.js y npm.

```bash
npm install          # instala dependencias (y prepara Nuxt)
npm run dev          # servidor de desarrollo en http://localhost:3000 (incluye /spike, el banco de pruebas de Strudel, y /lab/wowo, el del wowo)
npm run dev:phone    # igual, accesible desde el móvil por HTTPS (el micrófono lo exige, salvo en localhost)
npm test             # tests unitarios (Vitest)
npm run test:coverage
npm run typecheck
npm run build        # build de producción (.output/); `npm run preview` para probarlo
```

Stack: [Nuxt](https://nuxt.com) 4, Vue 3, Tailwind, Web Audio y [Strudel](https://strudel.cc) (`@strudel/web`).

## Cómo está hecho

- `app/` — la aplicación (Nuxt 4 + Vue 3 + TypeScript): `lib/` es la lógica pura (con tests), `composables/useAudioEngine.ts` el motor de audio (Strudel/`superdough`), `workers/analysis.worker.ts` el análisis de la voz (detección de golpes, MFCC, clasificador) y `components/` la interfaz y los visuales (canvas 2D y WebGL2).
- `specs/` — las especificaciones, en orden, con sus enmiendas y decisiones. Empieza por [`specs/001-mvp`](specs/001-mvp/spec.md) y [`specs/ESTADO.md`](specs/ESTADO.md).
- `tests/unit/` — Vitest (más de mil tests de la lógica y del código Strudel generado, evaluado en Node). `tests/browser/` — guiones con Chrome sin pantalla y un micrófono de mentira (a mano; ver su README).
- `public/samples/` — los samples (con su licencia en [`CREDITS.md`](public/samples/CREDITS.md)). `kits/coderbeats-kits/` — el mismo kit «Vinilo» empaquetado para strudel.cc.

## Privacidad

Sin cuentas, sin analítica y sin servidor propio: el audio del micrófono se analiza en el navegador y no sale del dispositivo. Las canciones, la calibración y las voces grabadas se guardan en `localStorage`/IndexedDB de tu navegador; un enlace para compartir lleva solo los datos de la canción (no las voces).

## Contribuir

Issues y propuestas, bienvenidos. Antes de un cambio grande, mira `specs/` (cada función tiene la suya). Un cambio se acepta con `npm test`, `npm run typecheck` y `npm run build` en verde. Las tomas de voz de laboratorio (`tests/fixtures/voice/`) son privadas y no se suben: los tests que las usan se saltan si no están.

## Licencia

coderbeats es software libre bajo la **GNU Affero General Public License v3.0 o posterior** (AGPL-3.0-or-later). Mira el archivo [`LICENSE`](LICENSE). Si ofreces una versión modificada como servicio en red, la AGPL te obliga a ofrecer a sus usuarios el código fuente correspondiente.

Cualquiera puede usar, estudiar, modificar y compartir coderbeats con esas condiciones; el aviso y los créditos también están en la app (⋯ → «acerca de»).

## Créditos

- **[Strudel](https://strudel.cc)** (`@strudel/web`, AGPL-3.0-or-later): el motor de patrones y de audio. coderbeats genera y evalúa código Strudel; gracias al proyecto Strudel y a TidalCycles, de donde viene.
- **[Meyda](https://meyda.js.org)** (MIT): extracción de características de audio para clasificar los sonidos de la voz.
- **Samples**: ver [`public/samples/CREDITS.md`](public/samples/CREDITS.md) (tidal-drum-machines y uzu-drumkit, con sus licencias y condiciones).
- Nuxt, Vue, Tailwind y el resto de dependencias, con sus respectivas licencias (ver `package.json`).
