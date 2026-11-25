<p align="center"><img src="public/icon-192.png" alt="coderbeats" width="96"></p>

# coderbeats

**English** · [Español](README.es.md)

An instrument to *play*, not a production tool. coderbeats turns your taps (and, optionally, your voice) into music that always sounds good, built on [Strudel](https://strudel.cc). No music knowledge needed, phone first, everything runs in your browser.

Inspired by Incredibox, Magic Piano, Groove Pizza and Song Maker. The code it shows, pasted into strudel.cc, sounds the same.

> Status: personal project in progress. It is developed with the help of AI, and every decision is written down in [`specs/`](specs/) (in Spanish).

## The two parts

- **Lab** (`/lab`, also what `/` opens): small screens, each one a way to play, with no microphone. Layers (with a DJ inside), Magic Piano, Choir, Rhythm circle and Remixes. A remix is something you *perform* here.
- **Studio** (`/estudio`; shared links `/#…` open here): the advanced app, for **creating and editing remixes** (parts, layers, drums, melody with the Organ).

A remix is one object with two faces: you edit it in the Studio and perform it in the Lab. Up to 8 parts, 4 layers per part, 1 to 2 minutes.

## Features

- **Always in tune and in time**: locked scale, everything on the beat, only sounds that fit the style (hip hop, house, drum and bass, dembow, techno, drill).
- **Remixes** of public-domain melodies (Mozart, Beethoven, Grieg, Gregorian chant, Russian folk tunes…) with arrangements written for coderbeats.
- **Save and share**: a link (the song lives in the URL fragment and never reaches a server), a video, or an MP3 of the remix.
- **Code = sound**: you can see the Strudel code behind what you hear.
- **PWA**: installable, works offline.
- **Languages**: Spanish, English and Basque (picked from the browser, selectable in «About»).

## Run it

You need Node.js and npm.

```bash
npm install          # install dependencies (and prepare Nuxt)
npm run dev          # dev server at http://localhost:3000
npm run dev:phone    # same, over HTTPS so a phone can use the microphone
npm test             # unit tests (Vitest)
npm run typecheck
npm run build        # production build (.output/); `npm run preview` to try it
```

Stack: [Nuxt](https://nuxt.com) 4, Vue 3, Tailwind, Web Audio and [Strudel](https://strudel.cc) (`@strudel/web`). There is no backend: the audio engine needs the browser, so the app routes are client-rendered.

## How it is organised

- `app/lib/`: pure logic with no DOM, tested in `tests/unit/`.
- `app/composables/`: the audio engine (`useAudioEngine.ts`) and the app state.
- `app/components/lab/`: the Lab screens. `app/components/`: the Studio.
- `specs/`: the specifications, one per feature, plus [`specs/ESTADO.md`](specs/ESTADO.md) (what is done and what to test) and the project principles ([`PRINCIPIOS.md`](specs/PRINCIPIOS.md), [`DISENO.md`](specs/DISENO.md)). **They are written in Spanish.**
- `tests/unit/` (Vitest) and `tests/browser/` (headless Chrome scripts, run by hand).
- `tools/conversor/`: the notes-to-song converter, its guide, examples and the `cancionero` agent instructions.
- `public/samples/`: the samples, with their licences in [`CREDITS.md`](public/samples/CREDITS.md).

## Write your own pieces with an AI assistant (Claude Code / opencode)

> **Only public-domain or original music** goes in this repo: no themes from films, games or modern songs. The agent is **new and not yet tested at length with real users**: treat it as an experiment.

`tools/conversor/` is a small command-line tool that turns a plain-text song (melody, bass, chords, style) into a `.json` file you can import in the app (**Studio → My songs → ⋯ → Import**). It is separate from the app but kept in sync with it: a test (`tests/unit/conversor.test.ts`) fails if the app gains a style or a synth and the converter does not.

```bash
# write mis-canciones/my-song.txt (start from tools/conversor/ejemplos/), then:
node tools/conversor/notas-a-json.mjs mis-canciones/my-song.txt            # → my-song.json
node tools/conversor/notas-a-json.mjs mis-canciones/my-song.txt --estilo drill
```

- **Examples** (`tools/conversor/ejemplos/`): Ode to Joy (public domain) and three original pieces (minimal techno, dub techno, drill).
- **Guide** ([`tools/conversor/guia.md`](tools/conversor/guia.md), in Spanish): the format, the rules that keep a song from sounding choppy, the styles and synths, and how a long song is shaped (the Lacrimosa in drill is the model).
- **Agent `cancionero`** (`.claude/agents/` for Claude Code, `.opencode/agent/` for opencode): open the repo in Claude Code or opencode and ask for a song. It is written for non-technical people: one question at a time, simple language, it writes the `.txt`, converts it, tells you how to import it, and can improve the converter **only if you say yes** (and with the test passing).
- **Where yours live:** Your songs live in `mis-canciones/`, which git ignores, and are never uploaded anywhere.

> The agent has not been tested in a real session yet, and the opencode agent file is written from memory: tell us if it does not work.

## Privacy

No accounts, no analytics, no server of our own. Audio is analysed in your browser and never leaves your device. Your songs, calibration and preferences are stored in your browser (`localStorage` / IndexedDB). A share link carries only the song data. Songs are never uploaded anywhere.

## Contributing

Issues and ideas are welcome. Before a big change, look at `specs/` (each feature has its own). A change is accepted when `npm test`, `npm run typecheck` and `npm run build` all pass.

Music rules: only samples with a clear licence (CC0, Unlicense or similar), and only melodies in the **public domain**, written as notes. No recordings, no modern arrangements, no copyrighted themes.

## Licence

coderbeats is free software under the **GNU Affero General Public License v3.0 or later** (AGPL-3.0-or-later). See [`LICENSE`](LICENSE). If you offer a modified version as a network service, the AGPL requires you to offer its users the corresponding source code.

The notice and credits are also in the app («⋯» → «About»).

## Credits

- **[Strudel](https://strudel.cc)** (`@strudel/web`, AGPL-3.0-or-later): the pattern and audio engine. Thanks to the Strudel project and to TidalCycles, where it comes from.
- **[uzu-drumkit](https://github.com/tidalcycles/uzu-drumkit)** (Unlicense; Switch Angel, Mot4i), **[Michael Fischer's TR-808](https://github.com/tidalcycles/sounds-tr808-fischer)** (CC0), **[Boochi44](https://github.com/Boochi44/free-drum-samples)** (CC0) and **Karoryfer Samples** ([guitars](https://github.com/sfzinstruments/karoryfer.black-and-green-guitars), [drums](https://github.com/sfzinstruments/karoryfer.big-rusty-drums); CC0): the samples. Details in [`public/samples/CREDITS.md`](public/samples/CREDITS.md).
- **[Meyda](https://meyda.js.org)** (MIT): audio feature extraction.
- **[lamejs](https://github.com/shijinyu/lamejs)** (`@breezystack/lamejs`, LGPL-3.0): MP3 encoder, loaded only when you save audio.
- **Inter** and **JetBrains Mono** (SIL Open Font License 1.1): the typefaces.
- Nuxt, Vue, Tailwind and the other dependencies, under their own licences (see `package.json`).
