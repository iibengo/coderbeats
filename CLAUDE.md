# coderbeats: contexto y reglas para Claude Code

## Qué es

coderbeats es un **instrumento para jugar**, no una herramienta de producción. Convierte toques (y opcionalmente la voz) en música que siempre suena bien, sobre Strudel. Inspiración: Incredibox, Magic Piano, Groove Pizza, Song Maker.

- Stack: Nuxt 4 + TypeScript + Tailwind, sin backend (todo en el navegador, PWA).
- Motor de sonido: @strudel/web. Promesa: el código mostrado, pegado en strudel.cc, suena igual.
- Licencia: AGPL-3.0 (por Strudel). Créditos en `public/samples/CREDITS.md` y en «Acerca de» (`app/lib/about.ts`, con tests contra `package.json` y `LICENSE`).
- Estética: fondo negro, mínima, acento rosa #F496BC (más lila y azul de la paleta para instrumentos).
- Público: cualquiera, sin saber música. Móvil primero (iPhone/Safari), también escritorio.

## Las dos partes de la app

- **Laboratorio** (`/lab`, también lo que abre `/`): la entrada. Pantallas pequeñas, cada una una forma de tocar, sin micrófono y sin células: Capas (con el DJ dentro), Piano mágico, Coro, Círculo de ritmo (con las ruedas dentro) y Remixes. Aquí un remix se **actúa**. Mando de consola opcional.
- **Estudio** (`/estudio`; los enlaces compartidos `/#…` abren aquí): la app avanzada, enfocada en **crear y editar remixes** (partes, capas, batería, melodía con el Órgano). Lo que no sirva para eso se esconde en «Avanzado» (spec 020, en curso). La portada 016 está pausada (`/estudio?portada`).
- Un remix es **un único objeto con dos caras**: se edita en el Estudio y se actúa en el Laboratorio, con las mismas partes y sin versiones distintas. Máximo 8 partes, máximo 4 capas por parte, duración de 1 a 2 minutos (objetivo de las specs 019/020; en curso).
- Versiones guardadas: etiquetas de git `estudio-v1`, `estudio-v2` y `lab-v1`.

## Dónde está qué

- `app/lib/`: lógica **pura y sin DOM**, con tests en `tests/unit/` (los tests solo se recogen ahí).
- `app/composables/`: el motor (`useAudioEngine.ts`, un singleton muy grande: no partirlo sin supervisión), `useLab`, `useMyLayers`, `useLibrary`, `usePrefs`, `useVideoExport`…
- `app/engine/index.ts`: la **frontera del motor**; el Laboratorio no importa componentes del Estudio (lo comprueba `tests/unit/engineBoundary.test.ts`).
- `app/components/lab/`: pantallas del Laboratorio (`LabShell`, `LabStage`, `LabCapas`, `LabPiano`, `LabCoro`, `LabCirculo`, `LabRemix`, `LabDj`). `app/components/`: el Estudio (`Studio.vue`, `MelodyEditor.vue`, hojas…). `app/pages/`: `index.vue` (redirige), `lab/`, `estudio.vue`. Las rutas `/`, `/lab` y `/estudio` van con `ssr: false` (`nuxt.config.ts`): el motor necesita el navegador.
- Remixes: las melodías y arreglos del Estudio en `app/lib/remixes.ts`; la cara del Laboratorio en `app/lib/labRemixes.ts` y `remixParts.ts`.
- Specs: `specs/NNN-nombre/spec.md`, `specs/ESTADO.md` (lo hecho y qué probar), `specs/PRINCIPIOS.md`.

## Comandos

- `npm test` (vitest), `npm run typecheck`, `npm run build`, `npm run dev`, `npm run dev:phone` (https, para el iPhone).
- Comprobación antes de cada commit: `npx vitest run && npx nuxt typecheck && npx nuxt build`.
- Navegador de pruebas: guiones de Puppeteer en `tests/browser/` (`node tests/browser/<guion>.mjs`; usan `/usr/bin/google-chrome` sin pantalla y el puerto de `PORT`, por defecto 3999). Algunos exponen ganchos `window.__…` solo en desarrollo.

## Principios y diseño (obligatorios)

@specs/PRINCIPIOS.md
@specs/DISENO.md

`PRINCIPIOS.md` es la **constitución** del proyecto; `DISENO.md` son las reglas de diseño (paleta, tamaños de toque, aguja, ondas, movimiento reducido, rendimiento). Toda spec nueva tiene que explicar cómo cumple cada principio y avisar si alguno no se cumple antes de programar.

**Antes de escribir una spec nueva, lee `docs/investigacion-instrumentos.md` y, si es del Laboratorio, mira `docs/laboratorio-prototipo.html`.**

## Forma de trabajar (SDD)

- **Spec antes que código**, en `specs/NNN-nombre/spec.md`. Si el cambio es grande, resumir la spec y esperar el visto bueno.
- **Un commit por parte. Nunca hacer push** ni crear repositorios en GitHub sin permiso expreso.
- Antes de cada commit: tests, `nuxt typecheck` y `nuxt build` en verde.
- Si algo no está claro y no puedo preguntar, **decidir lo más simple** y apuntarlo en «Decisiones a revisar» de la spec.
- Saltar y apuntar lo arriesgado: lo que no se puede verificar sin oír o sin un iPhone, o lo que toque el reloj del motor de audio.
- Al terminar una tanda, actualizar `specs/ESTADO.md`: qué se ha hecho (con commits), decisiones a revisar y **qué probar en el móvil, en orden**.
- Ser honesto con lo no comprobado: decir siempre qué no se ha oído ni visto en un móvil.
- Pruebas con navegador: levantar un servidor propio en otro puerto (`NUXT_IGNORE_LOCK=1 npx nuxt dev --port 3999`, en segundo plano con `setsid`) y **no tocar el servidor del usuario** en el 3000. No usar `pkill -f` con patrones que casen con el propio comando.

## Datos y seguridad

- **No perder nunca lo guardado**: Mis canciones, calibración y preferencias (localStorage `coderbeats:*` e IndexedDB). Cualquier cambio de formato, compatible y con test.
- Todo lo que se carga (guardado, enlaces, importar) son **datos, nunca código**, con validación estricta y tests de inyección.
- Nada de claves, rutas del equipo ni datos personales en el repositorio. Las tomas de voz (`tests/fixtures/voice`) y `tem/` no se versionan. Las claves de datos propias del Laboratorio son `coderbeats:lab:v1` y `coderbeats:lab:take:v1`; `coderbeats:ui:v1` y la biblioteca se leen igual que siempre.

## Música y derechos

- Samples solo con licencia clara (CC0, Unlicense o similar), documentados en `public/samples/CREDITS.md`.
- Melodías solo de **dominio público** (compositor fallecido hace más de 70 años), escritas como notas: ni grabaciones ni arreglos modernos. Si algo no está verificado, marcarlo («notas de oído, revisar con la partitura»; hoy, el tema de Mozart).
- Estilos (ids): `hiphop90`, `house`, `dnb`, `dembow` y `techno`, cada uno con su escala, bajo y acordes (`app/lib/styles.ts`, `constants.ts`).

## Comunicación

- Responder en español, con frases cortas y claras, sin jerga innecesaria.
- Explicar qué probar con pasos concretos y en orden.
