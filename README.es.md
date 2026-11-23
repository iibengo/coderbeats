<p align="center"><img src="public/icon-192.png" alt="coderbeats" width="96"></p>

# coderbeats

[English](README.md) · **Español**

Un instrumento para *jugar*, no una herramienta de producción. coderbeats convierte tus toques (y, si quieres, tu voz) en música que siempre suena bien, sobre [Strudel](https://strudel.cc). No hace falta saber música, está pensado primero para el móvil y todo corre en el navegador.

Inspirado en Incredibox, Magic Piano, Groove Pizza y Song Maker. El código que muestra, pegado en strudel.cc, suena igual.

> Estado: proyecto personal en marcha. Se desarrolla con ayuda de IA y cada decisión queda escrita en [`specs/`](specs/).

## Las dos partes

- **Laboratorio** (`/lab`, también lo que abre `/`): pantallas pequeñas, cada una una forma de tocar, sin micrófono. Capas (con el DJ dentro), Piano mágico, Coro, Círculo de ritmo y Remixes. Aquí un remix se **actúa**.
- **Estudio** (`/estudio`; los enlaces compartidos `/#…` abren aquí): la app avanzada, para **crear y editar remixes** (partes, capas, batería, melodía con el Órgano).

Un remix es un único objeto con dos caras: se edita en el Estudio y se actúa en el Laboratorio. Hasta 8 partes, 4 capas por parte, de 1 a 2 minutos.

## Qué hace

- **No se puede sonar mal**: escala bloqueada, todo al compás y solo sonidos que encajan con el estilo (hip hop, house, drum and bass, dembow, techno y drill).
- **Remixes** de melodías de dominio público (Mozart, Beethoven, Grieg, canto gregoriano, canciones populares rusas…) con arreglos escritos para coderbeats.
- **Guardar y compartir**: un enlace (la canción va en el fragmento de la URL y nunca llega a un servidor), un vídeo o un MP3 del remix.
- **Código = sonido**: puedes ver el código Strudel de lo que suena.
- **PWA**: se instala y funciona sin conexión.
- **Idiomas**: español, inglés y euskera (el del navegador, con selector en «Acerca de»).

## Para ejecutarlo

Necesitas Node.js y npm.

```bash
npm install          # instala dependencias (y prepara Nuxt)
npm run dev          # servidor de desarrollo en http://localhost:3000
npm run dev:phone    # igual, por HTTPS, para usar el micrófono desde el móvil
npm test             # tests unitarios (Vitest)
npm run typecheck
npm run build        # build de producción (.output/); `npm run preview` para probarlo
```

Stack: [Nuxt](https://nuxt.com) 4, Vue 3, Tailwind, Web Audio y [Strudel](https://strudel.cc) (`@strudel/web`). No hay backend: el motor de audio necesita el navegador, así que las rutas de la app se renderizan en el cliente.

## Cómo está hecho

- `app/lib/`: lógica pura y sin DOM, con tests en `tests/unit/`.
- `app/composables/`: el motor de audio (`useAudioEngine.ts`) y el estado de la app.
- `app/components/lab/`: las pantallas del Laboratorio. `app/components/`: el Estudio.
- `specs/`: las especificaciones, una por función, más [`specs/ESTADO.md`](specs/ESTADO.md) (lo hecho y qué probar) y los principios del proyecto ([`PRINCIPIOS.md`](specs/PRINCIPIOS.md), [`DISENO.md`](specs/DISENO.md)).
- `tests/unit/` (Vitest) y `tests/browser/` (guiones de Chrome sin pantalla, a mano).
- `public/samples/`: los samples, con su licencia en [`CREDITS.md`](public/samples/CREDITS.md).

## Hacer canciones con un asistente de IA (Claude Code / opencode)

`tools/conversor/` tiene un conversor que pasa una canción en texto (notas, bajo, acordes) a un `.json` que se importa en la app, con su guía y ejemplos. El repo incluye un agente **cancionero** (`.claude/agents/` para Claude Code, `.opencode/agent/` para opencode) que guía a una persona sin conocimientos técnicos, una pregunta cada vez, y puede mejorar el conversor si se lo pides. En este repo solo entra música de dominio público u original. Mira [`tools/conversor/guia.md`](tools/conversor/guia.md).

## Privacidad

Sin cuentas, sin analítica y sin servidor propio. El audio se analiza en tu navegador y no sale del dispositivo. Tus canciones, calibración y preferencias se guardan en tu navegador (`localStorage` / IndexedDB). Un enlace para compartir lleva solo los datos de la canción. Las canciones nunca se suben a ningún sitio.

## Contribuir

Issues y propuestas, bienvenidos. Antes de un cambio grande, mira `specs/` (cada función tiene la suya). Un cambio se acepta con `npm test`, `npm run typecheck` y `npm run build` en verde.

Reglas de música: samples solo con licencia clara (CC0, Unlicense o similar) y melodías solo de **dominio público**, escritas como notas. Ni grabaciones, ni arreglos modernos, ni temas con derechos de autor.

## Licencia

coderbeats es software libre bajo la **GNU Affero General Public License v3.0 o posterior** (AGPL-3.0-or-later). Mira el archivo [`LICENSE`](LICENSE). Si ofreces una versión modificada como servicio en red, la AGPL te obliga a ofrecer a sus usuarios el código fuente correspondiente.

El aviso y los créditos también están en la app («⋯» → «Acerca de»).

## Créditos

- **[Strudel](https://strudel.cc)** (`@strudel/web`, AGPL-3.0-or-later): el motor de patrones y de audio. Gracias al proyecto Strudel y a TidalCycles, de donde viene.
- **[uzu-drumkit](https://github.com/tidalcycles/uzu-drumkit)** (Unlicense; Switch Angel, Mot4i), **[la TR-808 de Michael Fischer](https://github.com/tidalcycles/sounds-tr808-fischer)** (CC0), **[Boochi44](https://github.com/Boochi44/free-drum-samples)** (CC0) y **Karoryfer Samples** ([guitarras](https://github.com/sfzinstruments/karoryfer.black-and-green-guitars), [baterías](https://github.com/sfzinstruments/karoryfer.big-rusty-drums); CC0): los samples. Detalle en [`public/samples/CREDITS.md`](public/samples/CREDITS.md).
- **[Meyda](https://meyda.js.org)** (MIT): extracción de características de audio.
- **[lamejs](https://github.com/shijinyu/lamejs)** (`@breezystack/lamejs`, LGPL-3.0): codificador de MP3, que solo se carga al guardar audio.
- **Inter** y **JetBrains Mono** (SIL Open Font License 1.1): las tipografías.
- Nuxt, Vue, Tailwind y el resto de dependencias, con sus respectivas licencias (ver `package.json`).
