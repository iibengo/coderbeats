# coderbeats

Un instrumento para jugar con la voz: haces beatbox (bum, pff, ts) y coderbeats lo convierte en batería que suena en bucle y en **código [Strudel](https://strudel.cc)** que puedes copiar y pegar. Todo corre en el navegador: el micrófono se analiza en el dispositivo y no se envía nada a ningún servidor.

- **Escucha continua**: graba frases de beatbox, las cuantiza al compás y las deja como loops (bombo, caja, platillo).
- **Dos modos** (spec 011): **Jugar** (por defecto: una gota, la voz y el dedo, con un primer minuto guiado) y **Componer** (el mapa de células, grupos y disparadores). Son dos vistas de la misma canción: cualquier demo o remix funciona en los dos.
- **Células y canción**: cada célula es un aro con sus loops, su bajo y sus acordes; varias células, una tras otra, forman una canción. Hay grupos que suenan en paralelo.
- **Fondo y efectos**: bajo y acordes por estilo (hip hop 90, house, drum and bass, dembow, techno), filtro, espacio y calor; el filtro de una célula puede barrer vuelta a vuelta (loops de canción y remixes) y hacer el **wowo** (resonancia y envolvente en cada golpe). La app lleva una cadena master «cálida» (saturación suave y compresión de pegamento) que **strudel.cc no tiene**: el código copiado suena algo más seco.
- **Código = sonido**: el código mostrado, pegado en strudel.cc, suena igual que en coderbeats.
- **Remixes**: canciones de demo de dominio público (el Himno de la alegría en dembow, el Dies Irae y la Sinfonía n.º 40 de Mozart en techno), con su atribución.
- **Mis canciones**: se guardan en el navegador (localStorage), en tu dispositivo.
- Funciona como PWA, pensada también para móvil.

Las especificaciones están en [`specs/`](specs/).

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

## Licencia

coderbeats es software libre bajo la **GNU Affero General Public License v3.0 o posterior** (AGPL-3.0-or-later). Mira el archivo [`LICENSE`](LICENSE). Si ofreces una versión modificada como servicio en red, la AGPL te obliga a ofrecer a sus usuarios el código fuente correspondiente.

## Créditos

- **[Strudel](https://strudel.cc)** (`@strudel/web`, AGPL-3.0-or-later): el motor de patrones y de audio. coderbeats genera y evalúa código Strudel; gracias al proyecto Strudel y a TidalCycles, de donde viene.
- **[Meyda](https://meyda.js.org)** (MIT): extracción de características de audio para clasificar los sonidos de la voz.
- **Samples**: ver [`public/samples/CREDITS.md`](public/samples/CREDITS.md) (tidal-drum-machines y uzu-drumkit, con sus licencias y condiciones).
- Nuxt, Vue, Tailwind y el resto de dependencias, con sus respectivas licencias (ver `package.json`).
