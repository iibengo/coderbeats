// «Acerca de» (licencia y créditos). Los datos viven aquí para poder comprobarlos con tests
// contra package.json, LICENSE y public/samples/CREDITS.md.

export const LICENSE_ID = 'AGPL-3.0-or-later'
export const LICENSE_NAME = 'GNU Affero General Public License v3.0 o posterior'
export const LICENSE_URL = 'https://www.gnu.org/licenses/agpl-3.0.html'
/** AGPL §13: quien usa la app por red tiene derecho al código fuente correspondiente. */
export const SOURCE_URL = 'https://github.com/iibengo/coderbeats'

export interface Credit {
  name: string
  what: string
  license: string
  url: string
}

export const CREDITS: Credit[] = [
  { name: 'Strudel', what: 'el motor de patrones y de audio (superdough). coderbeats genera y evalúa código Strudel.', license: 'AGPL-3.0-or-later', url: 'https://strudel.cc' },
  { name: 'TidalCycles', what: 'de donde viene Strudel y su manera de escribir patrones.', license: 'GPL-3.0', url: 'https://tidalcycles.org' },
  { name: 'Meyda', what: 'análisis del sonido de tu voz.', license: 'MIT', url: 'https://meyda.js.org' },
  { name: 'uzu-drumkit', what: 'kit «Electrónico» (Switch Angel y Mot4i).', license: 'Unlicense', url: 'https://github.com/tidalcycles/uzu-drumkit' },
  { name: 'Michael Fischer (TECHNOPOLIS)', what: 'kit «808», grabado de una TR-808 real.', license: 'CC0 1.0', url: 'https://github.com/tidalcycles/sounds-tr808-fischer' },
  { name: 'Boochi44', what: 'kit «Vinilo» (free-drum-samples).', license: 'CC0 1.0', url: 'https://github.com/Boochi44/free-drum-samples' },
  { name: 'Karoryfer Samples (Black And Green Guitars)', what: 'guitarra (Hofner Club, notas sueltas).', license: 'CC0 1.0', url: 'https://github.com/sfzinstruments/karoryfer.black-and-green-guitars' },
  { name: 'Karoryfer Samples (Big Rusty Drums)', what: 'kit «Batería» (batería acústica: bombo, caja y charles).', license: 'CC0 1.0', url: 'https://github.com/sfzinstruments/karoryfer.big-rusty-drums' },
  { name: 'Nuxt, Vue y Tailwind CSS', what: 'la base de la app.', license: 'MIT', url: 'https://nuxt.com' },
]
