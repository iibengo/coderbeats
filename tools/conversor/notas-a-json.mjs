#!/usr/bin/env node
// Convierte una canción escrita como texto en un .json para «Importar» en Mis canciones de coderbeats.
// Uso:  node notas-a-json.mjs mi-cancion.txt [salida.json]     (mira ejemplos/ejemplo-melodia.txt)
// «filtro-solo-sintes: si»: el filtro solo afecta a los sintes (bombo, caja y charle limpios).
// «percu:» + «rim 4 12», «click 2.5 6.5», «shaker 3 7 11 15»: percusión en pasos concretos (también fuera de tiempo).
// Minimal (por parte): «compases: 32» (el loop se repite), «filtro: 400 500 …» (Hz por compás), «entra: c17» + notas / «sale: c25» (un tono nuevo), «charle: no».
// Sidechain: «sidechain: si | no | auto» (auto, por defecto = sí en techno y house): el bombo empuja el bajo y los acordes, no la melodía.
// Escala: «escala: sol menor» (o Gm, La mayor…); si falta, se deduce de los acordes y se imprime. El chequeo avisa de las notas que se salen.
// Sonido de la melodía: «sinte: guitarra» (o guitarra-sucia, para el estribillo; guitarra-grabada = la Hofner grabada), en toda la canción o dentro de una parte.
// Adornos de techno (riser, crash, impacto…): sección «efectos:» dentro de una parte (mira ejemplos/ejemplo-melodia.txt y guia.md).
// Solo datos; no sube nada a ningún sitio. Vive en tools/conversor/ del repositorio (solo música de dominio público u original).
import { readFileSync, writeFileSync } from 'node:fs'
import { readSync } from 'node:fs'

async function main() {

  const arg = process.argv.slice(2)
  const estiloCli = (() => {
    const i = arg.indexOf('--estilo')
    if (i < 0) return null
    const v = arg[i + 1]
    arg.splice(i, v === undefined ? 1 : 2)
    return v ?? null
  })()
  // tablas del conversor (arriba para que --capacidades las pueda contar); `house` y `techno` son los de antes («legacy»): suenan igual que house2/techno2
  // fuerza de cada golpe (0..1): el bombo manda, la caja medio, el charle flojo
  const ESTILOS = { hiphop90: 90, house: 124, house2: 124, dnb: 174, dembow: 120, reggaeton: 95, drill: 140, techno: 128, techno2: 132 }
  const DEMOS = {
    hiphop90: { bd: 'bd ~ ~ ~ ~ ~ ~ ~ bd ~ bd ~ ~ ~ ~ ~', sd: '~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~', hh: 'hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~' },
    house: { bd: 'bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~', sd: '~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~', hh: '~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~' },
    house2: { bd: 'bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~', sd: '~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~', hh: '~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~' },
    dnb: { bd: 'bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~', sd: '~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~', hh: 'hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~' },
    dembow: { bd: 'bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~', sd: '~ ~ ~ sd ~ ~ sd ~ ~ ~ ~ sd ~ ~ sd ~', hh: 'hh hh hh hh hh hh hh hh hh hh hh hh hh hh hh hh' },
  reggaeton: { bd: 'bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~', sd: '~ ~ ~ sd ~ ~ sd ~ ~ ~ ~ sd ~ ~ sd ~', hh: '~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~' },
    drill: { bd: 'bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ bd ~ ~ ~ ~', sd: '~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~', hh: '~ ~ hh hh ~ hh ~ hh ~ ~ hh ~ ~ hh ~ hh' },
    techno: { bd: 'bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~', sd: '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~', hh: '~ ~ hh ~ ~ hh hh ~ ~ ~ hh ~ ~ hh hh ~' },
    techno2: { bd: 'bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~', sd: '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~', hh: '~ ~ hh ~ ~ hh hh ~ ~ ~ hh ~ ~ hh hh ~' },
  }
  const SINTES = { dub: 'dub', acid: 'acid', lead: 'lead', piano: 'piano', pad: 'pad', guitar: 'guitar', guitarra: 'guitar', 'guitarra-limpia': 'guitar', guitarsample: 'guitarSample', 'guitarra-grabada': 'guitarSample', 'guitarra-real': 'guitarSample', guitardirty: 'guitarDirty', 'guitar-dirty': 'guitarDirty', 'guitarra-sucia': 'guitarDirty', guitarrasucia: 'guitarDirty', coro: 'coro', cuerdas: 'cuerdas', sub: 'sub', '808': 'sub', stabw: 'stabW', leadw: 'leadW' }
  const [entrada, salidaArg] = arg
  // --capacidades: lo que sabe este conversor, en JSON (la prueba de tests/unit/conversor.test.ts lo compara con la app: si la app cambia y esto no, falla)
  if (process.argv.includes('--capacidades')) {
    console.log(JSON.stringify({ estilos: ESTILOS, demos: DEMOS, sintes: [...new Set(Object.values(SINTES))].sort() }))
    process.exit(0)
  }
  if (!entrada) {
    console.log('Uso: node notas-a-json.mjs mi-cancion.txt [salida.json] [--estilo techno]   (mira ejemplos/ejemplo-melodia.txt)')
    console.log('  El estilo se pregunta si el texto no lo trae. Lista: ' + 'hiphop90, house2, dnb, dembow, reggaeton, drill, techno2 (y house/techno de antes)')
    process.exit(1)
  }
  const fallo = (m) => {
    console.error('✗ ' + m)
    process.exit(1)
  }

  // ── el texto ──
  const cfg = { nombre: 'Mi canción', estilo: '', tempo: '', kit: '808', ritmo: 'si', sinte: '', escala: '', sidechain: '' }
  const partes = [] // { nombre, melodia, bajo, acordes }
  let actual = null
  let campo = null
  const nueva = (nombre) => (actual = { nombre, melodia: '', bajo: '', acordes: '', efectos: '', sinte: '', bateria: '', redoble: '', charle: '', 'charle-abierto': '', filtro: '', 'filtro-solo-sintes': '', 'fuerza-charle': '', 'fuerza-clap': '', percu: '', compases: '', entra: '', sale: '' })
  for (const crudo of readFileSync(entrada, 'utf8').split(/\r?\n/)) {
    const linea = crudo.replace(/(^|\s)#.*/, '').trim()
    if (!linea) continue
    const m = /^(nombre|estilo|tempo|kit|ritmo|sidechain|escala|sinte|sonido|parte|melodia|melodía|bajo|acordes|efectos|efecto|bateria|batería|redoble|charle|charle-abierto|charleabierto|filtro-solo-sintes|fuerza-charle|fuerza-clap|filtro|percusion|percusión|percu|compases|entra|sale)\s*:\s*(.*)$/i.exec(linea)
    if (!m) {
      if (campo && actual) actual[campo] += ' ' + linea
      else fallo(`no entiendo la línea: «${linea}»`)
      continue
    }
    let k = m[1].toLowerCase().replace('í', 'i')
    if (k === 'parte') {
      partes.push(nueva(m[2].trim() || `Parte ${partes.length + 1}`))
      campo = null
    } else if (['filtro', 'filtro-solo-sintes', 'fuerza-charle', 'fuerza-clap', 'compases', 'sale'].includes(k)) {
      // minimal (spec 008 §5): `filtro:` Hz por compás · `compases:` lo que dura la parte (el loop se repite) · `sale:` cuándo deja de sonar el tono nuevo
      if (!actual) partes.push(nueva('Canción'))
      actual[k] = m[2].trim()
      campo = k === 'filtro' ? 'filtro' : null
    } else if (['melodia', 'bajo', 'acordes', 'efectos', 'efecto', 'entra', 'percu', 'percusion', 'percusión'].includes(k)) {
      if (!actual) partes.push(nueva('Canción'))
      campo = k === 'efecto' ? 'efectos' : k === 'percusion' || k === 'percusión' ? 'percu' : k
      k = campo
      actual[k] += ' ' + m[2]
    } else if (['bateria', 'redoble', 'charle', 'charle-abierto', 'charleabierto'].includes(k)) {
      const campoB = k === 'charleabierto' ? 'charle-abierto' : k === 'bateria' ? 'bateria' : k
      if (!actual) partes.push(nueva('Canción'))
      actual[campoB] = m[2].trim()
      campo = null
    } else if (k === 'sinte' || k === 'sonido') {
      // el sonido de la melodía: de toda la canción (antes de la primera parte) o solo de esta parte
      if (actual) actual.sinte = m[2].trim()
      else cfg.sinte = m[2].trim()
      campo = null
    } else {
      cfg[k] = m[2].trim()
      campo = null
    }
  }

  // Los estilos de la app (app/lib/constants.ts). `house` y `techno` son los de antes
  // («legacy»): suenan igual que house2/techno2, se aceptan para canciones antiguas.
  // fuerza de cada golpe (0..1): el bombo manda, la caja medio, el charle flojo
  const FUERZA_BATERIA = { bd: 0.95, sd: 0.8, hh: 0.6, redoble: 0.7 }
  // también vale el nombre que se ve en la app: «Hip hop 90», «Drum and bass», «Techno»…
  const NOMBRES = { 'hip hop 90': 'hiphop90', 'hip hop': 'hiphop90', reggaeton: 'reggaeton', regueton: 'reggaeton', house: 'house2', 'drum and bass': 'dnb', drum: 'dnb', dembow: 'dembow', techno: 'techno2' }
  const estiloDe = (v) => {
    const t = String(v ?? '').trim().toLowerCase()
    if (t in ESTILOS) return t
    return NOMBRES[t] ?? null
  }
  // el estilo: el del texto, el de --estilo o, si no hay, se pregunta
  const ELECCION = [
    ['hiphop90', 'Hip hop 90', 90],
    ['house2', 'House', 124],
    ['dnb', 'Drum and bass', 174],
    ['dembow', 'Dembow', 120],
    ['drill', 'Drill', 140],
    ['techno2', 'Techno', 132],
  ]
  if (!cfg.estilo && estiloCli) cfg.estilo = estiloCli
  if (!cfg.estilo) {
    if (!process.stdin.isTTY) process.stdout.write('(falta «estilo:» en el texto: elige uno)\n')
    // lectura sincrona de la entrada: vale con teclado y con una tuberia
    const linea = () => {
      const buf = Buffer.alloc(1)
      let out = ''
      for (;;) {
        let n = 0
        try { n = readSync(0, buf, 0, 1, null) } catch { n = 0 }
        if (!n || buf[0] === 10) break
        if (buf[0] !== 13) out += buf.toString('utf8')
      }
      return out
    }
    const pregunta = (q) => { process.stdout.write(q); return linea() }
    console.log('\n¿Qué estilo quieres?')
    ELECCION.forEach(([id, label, bpm], i) => console.log(`  ${i + 1}) ${label} · ${id} (${bpm} bpm)`))
    let elegido = null
    while (!elegido) {
      const r = pregunta('Elige un número (1-' + ELECCION.length + '): ').trim()
      const n = Number(r)
      elegido = Number.isInteger(n) && n >= 1 && n <= ELECCION.length ? ELECCION[n - 1][0] : estiloDe(r)
      if (!elegido) console.log('  No es una opción. Prueba con un número de la lista.')
    }
    cfg.estilo = elegido
  }
  cfg.estilo = estiloDe(cfg.estilo)
  if (!cfg.estilo) fallo(`estilo «${cfg.estilo}»: usa uno de ${Object.keys(ESTILOS).join(', ')} (o el nombre que sale en la app)`)
  // los tres kits de la app (app/lib/constants.ts)
  if (!['808', 'electro', 'vinyl', 'drums', 'techno'].includes(cfg.kit)) fallo(`kit «${cfg.kit}»: usa 808, electro, vinyl, drums o techno`)
  const tempo = cfg.tempo ? Number(cfg.tempo) : ESTILOS[cfg.estilo]
  if (!Number.isFinite(tempo) || tempo < 50 || tempo > 200) fallo(`tempo «${cfg.tempo}»: entre 50 y 200`)
  if (!partes.length) fallo('no hay música: escribe «melodia: C4:4 E4:4 …» (y, si quieres, «bajo:» y «acordes:»)')

  // ── las notas ──
  //   nota:      C4:4  F#3:2  Bb4:8     (negra = 4, corchea = 2, semicorchea = 1; tresillo de corcheas: 4/3)
  //   acorde:    [G3,Bb3,D4]:16        (varias notas a la vez)
  //   silencio:  r:4
  //   tresillo:  [E4 F#4 G4]           (tresillo de negra: tres notas separadas por espacios, una negra cada una)
  //              con duración: [E4:4 F#4:4 G4:4]:12   (las tres caben en lo que marques)
  //   Una nota puede cruzar la línea de compás (ligadura).
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
  /** [A B C] con espacios (no [A,B,C], que es un acorde): un tresillo. */
  const esTresillo = (n) => n.startsWith('[') && n.endsWith(']') && !n.includes(',') && n.trim().split(/\s+/).length > 1
  const dura = (t, tok) => {
    const m = /^(\d+)(?:\/(\d+))?$/.exec(t ?? '')
    const v = m ? Number(m[1]) / Number(m[2] ?? 1) : NaN
    if (!Number.isFinite(v) || v <= 0) fallo(`«${tok}»: la duración debe ser un número (4) o una fracción (4/3)`)
    return v
  }
  const midiDe = (n, tok) => {
    const m = /^([A-Ga-g])(#|b)?(\d)$/.exec(n)
    if (!m) fallo(`«${tok}»: la nota debe ser como C4, F#3 o Bb4`)
    const v = (Number(m[3]) + 1) * 12 + PC[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
    if (v < 24 || v > 96) fallo(`«${tok}» fuera de rango (de C1 a C7)`)
    return v
  }
  function leer(texto, donde) {
    const hits = []
    let pos = 0
    for (const tok of texto.replace(/\|/g, ' ').match(/\[[^\]]*\](?::\d+(?:\/\d+)?)?|\S+/g) ?? []) {
      const cerr = tok.lastIndexOf(']')
      const esT = esTresillo(tok)
      const conDur = cerr >= 0 && tok[cerr + 1] === ':'
      let corte
      if (esT) corte = conDur ? cerr : cerr + 1
      else corte = cerr >= 0 ? tok.lastIndexOf(':') : tok.indexOf(':')
      if (corte < 0) fallo(`${donde}: «${tok}» mal escrita (ejemplo: C4:4)`)
      const nombre = tok.slice(0, corte)
      const dur = esT && !conDur ? 12 : dura(tok.slice(corte + 1), `${donde}: ${tok}`)
      if (esTresillo(nombre)) {
        // [A B C]: tresillo. Sin duración por nota, cada una dura la mitad de lo que marca el grupo (3 → 1,5? no):
        // si el grupo trae :12, cada nota 4; sin duración tras la nota, se reparte: lo que marque el grupo / 3.
        const notas = nombre.slice(1, -1).trim().split(/\s+/)
        const propias = notas.every((n) => n.includes(':'))
        const paso = propias ? 0 : dur / notas.length
        let at = pos
        for (const n of notas) {
          const [nn, dd] = n.includes(':') ? [n.slice(0, n.lastIndexOf(':')), dura(n.slice(n.lastIndexOf(':') + 1), `${donde}: ${tok}`)] : [n, paso]
          hits.push({ pos: Math.round(at * 12) / 12, dur: Math.round(dd * 12) / 12, midi: midiDe(nn.trim(), `${donde}: ${tok}`) })
          at += dd
        }
        pos += propias ? notas.reduce((s, n) => s + dura(n.slice(n.lastIndexOf(':') + 1), n), 0) : dur
        continue
      }
      if (nombre !== 'r') {
        const notas = nombre.startsWith('[') && nombre.endsWith(']') ? nombre.slice(1, -1).split(',') : [nombre]
        for (const n of notas) hits.push({ pos: Math.round(pos * 12) / 12, dur: Math.round(dur * 12) / 12, midi: midiDe(n.trim(), `${donde}: ${tok}`) })
      }
      pos += dur
    }
    return { hits, pasos: pos }
  }

  // ── la canción: una sección = una parte (loops de 1, 2, 4, 8 o 16 compases) ──
  let loopId = 1
  const loop = (instrument, bars, hs, synth) => ({ id: loopId++, instrument, bars, phaseBar: 0, hits: hs, muted: false, bornAt: 0, fromTemplate: false, ...(synth ? { synth } : {}) })
  const patron = (p) => p.split(' ').flatMap((t, i) => (t === '~' ? [] : [{ pos: i, strength: 0.8 }]))
  const redondea = (n) => [1, 2, 4, 8, 16].find((x) => x >= n) ?? 0
  // ── chequeo: lo que hace que una canción suene a trozos (lecciones del 17/11/2026) ──
  // Compara el largo de cada sección con el loop que acabará siendo; avisa en vez de entregarla en silencio.
  const avisos = []
  function chequear(nombre, seccion, r, largo) {
    if (!r.hits.length) return
    const pasosLoop = largo * 16
    const suma = (x) => x.hits.reduce((n, h) => n + h.dur, 0)
    // 1) compases que no suman 16
    const malos = []
    // tiempo CUBIERTO de cada compás (no suma de duraciones: un acorde son notas a la vez)
    const cubierto = (c) => {
      const iv = r.hits.filter((h) => Math.floor(h.pos / 16) === c).map((h) => [h.pos - c * 16, Math.min(h.pos - c * 16 + h.dur, 16)]).sort((x, y) => x[0] - y[0])
      let fin = 0, s = 0
      for (const [a, b] of iv) { if (b <= fin) continue; s += b - Math.max(a, fin); fin = b }
      return s
    }
    const total = Math.max(1, Math.ceil(Math.max(...r.hits.map((h) => h.pos + h.dur), 1) / 16))
    const porCompas = {}
    for (let c = 0; c < total; c++) porCompas[c] = cubierto(c)
    // solo se pasa: quedarse corto puede ser un silencio puesto a propósito (el final de una frase)
    for (const [c, s] of Object.entries(porCompas)) if (s > 16 + 1e-6) malos.push(`compás ${Number(c) + 1} suma ${s.toFixed(2)}`)
    if (malos.length) avisos.push(`${nombre} · ${seccion}: ${malos.slice(0, 4).join(', ')}${malos.length > 4 ? '…' : ''} (se pasa de 16: todo lo que viene detrás va desfasado)`)
    // 2) compases vacíos dentro del loop
    const vacios = []
    // un compás vacío EN MEDIO es un hueco; el último puede ser el final de la frase
    for (let c = 0; c < Math.min(largo, total) - 1; c++) if (!porCompas[c]) vacios.push(c + 1)
    if (vacios.length) avisos.push(`${nombre} · ${seccion}: compases sin nada: ${vacios.join(', ')} (lo que no escribes es silencio)`)
    // 3) no llega al final del loop
    const fin = r.hits.reduce((m, h) => Math.max(m, h.pos + h.dur), 0)
    if (fin < pasosLoop - 1e-6) avisos.push(`${nombre} · ${seccion}: acaba en el paso ${fin} de ${pasosLoop} (la segunda mitad suena vacía)`)
  }

  // ── efectos (adornos): «sinte:compases  c1 c9» ──
  //   riser:1 c8      un riser de 1 compás que ocupa el compás 8 de la parte (sube y desemboca en el cambio de sección)
  //   crash:1 c1 c9   un crash en el compás 1 y otro en el 9
  //   impacto:1 c9    un golpe grave al caer (una vez en toda la canción)
  // Cada sinte es UN loop normal de la parte (como el bajo y los acordes), con la misma duración que la parte.
  const EFECTOS = { riser: 'riser', crash: 'crash', impacto: 'impacto', boom: 'boom', downlifter: 'downlifter', impact: 'impacto' }
  /** notas (pos, dur, midi) de un efecto que empieza en el compás `c` (1 = el primero de la parte) y dura `d` compases */
  function notasEfecto(sinte, c, d) {
    const pos = (c - 1) * 16
    // UNA nota larga: el sinte `riser` hace el barrido él solo. Con una nota por tiempo se
    // reinicia el barrido cuatro veces y suena a "piribiri" (comprobado).
    if (sinte === 'riser' || sinte === 'downlifter') return [{ pos, dur: 16 * d, midi: 60 }]
    if (sinte === 'impacto' || sinte === 'boom') return [{ pos, dur: Math.min(16 * d, 32), midi: 36 }]
    return [{ pos, dur: 16, midi: 60 }] // crash, downlifter: el ruido; la nota solo marca cuándo suena
  }
  function leerEfectos(texto, nombre) {
    const lista = [] // { sinte, dur, compases: [] }
    for (const tok of texto.trim().split(/\s+/).filter(Boolean)) {
      const mt = /^([a-zA-Z]+):(\d+)$/.exec(tok)
      const mc = /^[cC](\d+)$/.exec(tok)
      if (mt) {
        const sinte = EFECTOS[mt[1].toLowerCase()]
        if (!sinte) fallo(`${nombre} · efectos: «${mt[1]}» no es un efecto (usa ${Object.keys(EFECTOS).filter((k) => k !== 'impact').join(', ')})`)
        const dur = Number(mt[2])
        if (!(dur >= 1 && dur <= 8)) fallo(`${nombre} · efectos: «${tok}» dura de 1 a 8 compases (ejemplo: riser:1 c8)`)
        lista.push({ sinte, dur, compases: [] })
      } else if (mc) {
        if (!lista.length) fallo(`${nombre} · efectos: «${tok}» va después del efecto (ejemplo: riser:1 c8)`)
        if (Number(mc[1]) < 1) fallo(`${nombre} · efectos: «${tok}»: los compases empiezan en c1`)
        lista.at(-1).compases.push(Number(mc[1]))
      } else fallo(`${nombre} · efectos: no entiendo «${tok}» (ejemplo: «riser:1 c8» o «crash:1 c1 c9»)`)
    }
    for (const e of lista) if (!e.compases.length) fallo(`${nombre} · efectos: «${e.sinte}:${e.dur}» no dice en qué compás (ejemplo: ${e.sinte}:${e.dur} c1)`)
    return lista
  }
  let compasInicio = 0 // compás de la canción (desde 1) donde empieza la parte
  let impactos = 0
  const escucha = [] // dónde oír cada efecto, para decirlo al final

  // ── la escala de la canción (escala:) ──  «sol menor», «Gm», «La mayor», «F#m»… Si no está, se deduce de los acordes (o del bajo, o de la melodía).
  //   Va en el JSON como g.scale = { tonic: 0–11, mode: 'major'|'minor' } (opcional: sin él, todo igual). El chequeo avisa de las notas que se salen.
  const SOL = { do: 0, re: 2, mi: 4, fa: 5, sol: 7, la: 9, si: 11 }
  const LET = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }
  const MAYOR = [0, 2, 4, 5, 7, 9, 11]
  const MENOR = [0, 2, 3, 5, 7, 8, 10]
  const NOMBRE_NOTA = ['do', 'do♯', 're', 're♯', 'mi', 'fa', 'fa♯', 'sol', 'sol♯', 'la', 'la♯', 'si']
  const NOMBRE_BEMOL = ['do', 're♭', 're', 'mi♭', 'mi', 'fa', 'sol♭', 'sol', 'la♭', 'la', 'si♭', 'si']
  const pcs = (e) => (e.mode === 'major' ? MAYOR : MENOR).map((d) => (e.tonic + d) % 12)
  const nombreEscala = (e) => `${(e.mode === 'major' && e.tonic !== 1 && e.tonic !== 6 ? NOMBRE_BEMOL : NOMBRE_NOTA)[e.tonic]} ${e.mode === 'major' ? 'mayor' : 'menor'}`
  function leerEscala(texto) {
    const raw = String(texto).trim().replace(/\s+/g, ' ')
    if (!raw || raw.length > 40) return null
    let rest = raw
    let pc
    const sol = /^(do|re|mi|fa|sol|la|si)(?![a-z])/i.exec(rest)
    if (sol) { pc = SOL[sol[1].toLowerCase()]; rest = rest.slice(sol[0].length) }
    else { const l = /^([A-Ga-g])/.exec(rest); if (!l) return null; pc = LET[l[1].toLowerCase()]; rest = rest.slice(1) }
    const acc = /^\s*(#|♯|♭|b(?=m|\s|$)|sostenido|bemol)/i.exec(rest)
    if (acc) { const a = acc[1].toLowerCase(); pc += a === '#' || a === '♯' || a === 'sostenido' ? 1 : -1; rest = rest.slice(acc[0].length) }
    rest = rest.trim().toLowerCase()
    let mode = null
    if (rest === '') mode = 'major'
    else if (['m', 'min', 'minor', 'menor'].includes(rest)) mode = 'minor'
    else if (['maj', 'major', 'mayor'].includes(rest)) mode = 'major'
    if (!mode) return null
    if (/^[A-G][#♯♭b]?M$/.test(raw)) mode = 'major'
    return { tonic: ((pc % 12) + 12) % 12, mode }
  }
  /** la escala que deja menos peso fuera; si empatan (mayor y su relativa menor), la que tiene la tónica en el bajo del primer y del último acorde */
  function deducirEscala(notas, primero = [], ultimo = []) {
    const total = notas.reduce((a, n) => a + n.peso, 0)
    if (!notas.length || total <= 0) return null
    const grave = (c) => (c.length ? ((Math.min(...c) % 12) + 12) % 12 : null)
    const raices = [grave(primero), grave(ultimo)].filter((x) => x !== null)
    let mejor = null
    for (let tonic = 0; tonic < 12; tonic++)
      for (const mode of ['major', 'minor']) {
        const e = { tonic, mode }
        const dentro = pcs(e)
        const fuera = notas.reduce((a, n) => a + (dentro.includes(((n.midi % 12) + 12) % 12) ? 0 : n.peso), 0)
        const tonicas = raices.filter((r) => r === tonic).length
        if (!mejor || fuera < mejor.fuera - 1e-9 || (Math.abs(fuera - mejor.fuera) <= 1e-9 && tonicas > mejor.tonicas)) mejor = { e, fuera, tonicas }
      }
    return mejor.e
  }
  let escala = null
  let escalaDe = ''
  if (cfg.escala) {
    escala = leerEscala(cfg.escala)
    if (!escala) fallo(`escala «${cfg.escala}»: no la entiendo (ejemplos: sol menor, Gm, La mayor, F#m, si bemol mayor)`)
    escalaDe = 'la del texto'
  } else {
    const fuentes = [['acordes', 'los acordes'], ['bajo', 'el bajo'], ['melodia', 'la melodía (aproximada)']]
    for (const [campo, quien] of fuentes) {
      const hs = partes.flatMap((p) => leer(p[campo], `${p.nombre} · ${campo}`).hits)
      if (!hs.length) continue
      const grupo = (p) => { const h = leer(p[campo], '').hits; if (!h.length) return []; const t0 = h[0].pos; return h.filter((x) => x.pos === t0).map((x) => x.midi) }
      const prim = partes.find((p) => p[campo].trim())
      const ult = [...partes].reverse().find((p) => p[campo].trim())
      const hu = leer(ult[campo], '').hits
      const ultPos = hu.length ? Math.max(...hu.map((x) => x.pos)) : 0
      escala = deducirEscala(hs.map((h) => ({ midi: h.midi, peso: h.dur })), grupo(prim), hu.filter((x) => x.pos === ultPos).map((x) => x.midi))
      if (escala) { escalaDe = `deducida de ${quien}`; break }
    }
  }

  // ── el sonido de la melodía (sinte:) ──  lead (el de siempre) | guitarra | guitarra-sucia | piano | pad
  const sinteDe = (v, donde) => {
    const t = String(v ?? '').trim().toLowerCase().replace(/\s+/g, '-')
    if (!t) return null
    if (!(t in SINTES)) fallo(`${donde}: sinte «${v}»: usa lead, acid, dub, guitarra, guitarra-sucia, guitarra-grabada, piano, pad, coro, cuerdas, sub (el 808 grave), stabw o leadw`)
    return SINTES[t]
  }
  const sinteCancion = sinteDe(cfg.sinte, 'sinte')

  const cells = []
  const resumen = []
  for (const p of partes) {
    const m = leer(p.melodia, `${p.nombre} · melodía`)
    const b = leer(p.bajo, `${p.nombre} · bajo`)
    const a = leer(p.acordes, `${p.nombre} · acordes`)
    // el largo del loop lo marca DÓNDE EMPIEZAN las notas, no lo que dura la última:
    // una nota que cruza el final (ligadura) no debe estirar el loop a 8 compases
    const inicio = (r) => r.hits.reduce((mx, h) => Math.max(mx, h.pos), 0)
    // compases = el compás en el que EMPIEZA la última nota (una nota que empieza justo en la línea de un compás pertenece a ese compás, no al anterior)
    const compases = Math.max(1, Math.floor(Math.max(inicio(m), inicio(b), inicio(a)) / 16 + 1e-9) + 1)
    const largo = redondea(compases)
    if (!largo) fallo(`«${p.nombre}» dura ${compases} compases: como mucho 16 por parte (divídela con otro «parte:»)`)
    const total = largo * 16
    // una nota puede llegar más allá del final del loop (ligadura al repetir): no se recorta
    const mk = (h, synth, fuerza = 0.8) =>
      loop('mel', largo, h.filter((x) => x.pos < total).map((x) => ({ pos: x.pos, dur: x.dur, midi: x.midi, strength: fuerza })), synth)
    // efectos: reglas de sentido (fallo = no suena bien; aviso = revisa)
    const fx = leerEfectos(p.efectos, p.nombre)
    const esUltima = p === partes.at(-1)
    const porSinte = {}
    for (const e of fx) {
      for (const c of e.compases) {
        const donde = `${p.nombre} · ${e.sinte} en c${c}`
        const fin = c + e.dur - 1
        if (fin > largo) fallo(`${donde}: se sale del loop (la parte dura ${largo} ${largo === 1 ? 'compás' : 'compases'}; c${c} + ${e.dur} llega al ${fin})`)
        if (compasInicio + c === 1) fallo(`${donde}: nunca en el compás 1 de la canción (déjala empezar en seco o pon el efecto en otra parte)`)
        if (e.sinte === 'riser' || e.sinte === 'downlifter') {
          if (e.sinte === 'riser' && (fin !== largo || esUltima)) fallo(`${donde}: el riser solo va justo antes de un cambio de sección (que acabe en el último compás de la parte, c${largo}, y que haya otra parte detrás)`)
          if (e.sinte === 'downlifter' && c !== 1) avisos.push(`${donde}: el downlifter suele ir al empezar una sección (c1)`)
        }
        if (e.sinte === 'crash' && (c - 1) % 4 !== 0) avisos.push(`${donde}: el crash marca el principio de una sección o de una frase de 4 compases (c1, c5, c9…); en c${c} puede sonar fuera de sitio`)
        if ((e.sinte === 'impacto' || e.sinte === 'boom') && ++impactos > 1) avisos.push(`${donde}: ya hay un ${e.sinte} antes; el impacto va una sola vez en la canción`)
        if (c > compases) avisos.push(`${donde}: cae después de la música de la parte (${compases} ${compases === 1 ? 'compás' : 'compases'}); sonará sobre el silencio`)
        ;(porSinte[e.sinte] ??= []).push(c)
        const t = ((compasInicio + c - 1) * 240) / tempo
        escucha.push(`${e.sinte} → compás ${compasInicio + c} de la canción (${p.nombre}, c${c}${e.sinte === 'riser' && e.dur > 1 ? '–c' + fin : ''}), a los ${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`)
      }
    }
    for (const [sinte, cs] of Object.entries(porSinte)) {
      const nVeces = new Set(cs).size
      if (cs.length !== nVeces) avisos.push(`${p.nombre} · ${sinte}: el mismo compás está repetido (c${cs.join(', c')})`)
      if ((sinte === 'riser' || sinte === 'impacto' || sinte === 'boom') && nVeces > 1) avisos.push(`${p.nombre} · ${sinte} ×${nVeces} en la misma parte: suena en cada vuelta (c${[...new Set(cs)].join(', c')}); un ${sinte} suele ir una vez`)
      if (sinte === 'crash' && nVeces >= 4) avisos.push(`${p.nombre} · crash ×${nVeces}: se repite en cada vuelta; ¿de verdad quieres tantos?`)
    }
    const loops = []
    if (cfg.ritmo.toLowerCase() !== 'no') {
      // ── batería propia de la parte (si no se dice nada, la del estilo) ──
      //   charle: semicorcheas | corcheas | (vacío = el del estilo)
      //   redoble: c8  → redoble de caja de semicorcheas en el compás 8
      //   charle-abierto: c4 c12 → el charle abierto en esos tiempos
      // `fuerza-charle:` y `fuerza-clap:` (0 a 1): el charle y la palmada más o menos claros (por defecto 0,6 y 0,8)
      const fz = (campo, nombre) => { const t = String(p[campo] || '').trim(); if (!t) return null; const v = Number(t); if (!(v >= 0 && v <= 1)) fallo(`${p.nombre} · ${campo}: «${t}» tiene que estar entre 0 y 1`); return v }
      const F = { ...FUERZA_BATERIA, ...(fz('fuerza-charle') !== null ? { hh: fz('fuerza-charle') } : {}), ...(fz('fuerza-clap') !== null ? { sd: fz('fuerza-clap') } : {}) }
      // ── patrones de batería de club (buscados el 18/11/2026 en zynthion, plastic.audio,
      //    soundgen.ai y thesonicsecrets: coinciden). En pasos de 1 a 16:
      //      minimal: bombo 1,5,9,13 · clap 5,13 · charle 3,7,11,15 (contratiempos) · sin redoble
      //      dark:    igual pero SIN clap ("take the clap out entirely for a darker groove")
      //      techno:  bombo 4x4 · charle en semicorcheas · clap 5,13
      const PATRONES = {
        minimal: { bd: [0, 4, 8, 12], sd: [4, 12], hh: [2, 6, 10, 14] },
        dark: { bd: [0, 4, 8, 12], sd: [], hh: [2, 6, 10, 14] },
        techno: { bd: [0, 4, 8, 12], sd: [4, 12], hh: Array.from({ length: 16 }, (_, i) => i) },
        'four-on-the-floor': { bd: [0, 4, 8, 12], sd: [4, 12], hh: [2, 6, 10, 14] },
        // sin bombo (el silencio como gesto: quitarlo antes del drop): la palmada y el charle siguen
        'sin-bombo': { bd: [], sd: [4, 12], hh: [2, 6, 10, 14] },
      }
      const bat = (p.bateria || '').trim().toLowerCase()
      let bdPat, sdPat
      let hhPat
      if (PATRONES[bat]) {
        bdPat = PATRONES[bat].bd
        sdPat = PATRONES[bat].sd
        hhPat = PATRONES[bat].hh
      } else {
        bdPat = patron(DEMOS[cfg.estilo].bd).map((h) => h.pos)
        sdPat = patron(DEMOS[cfg.estilo].sd).map((h) => h.pos)
        hhPat = patron(DEMOS[cfg.estilo].hh).map((h) => h.pos)
        // y `charle:` puede cambiarlo a mano
        const hh = (p.charle || '').toLowerCase()
        if (hh === 'no' || hh === 'ninguno') hhPat = []
        else if (hh === 'semicorcheas' || hh === '16') hhPat = Array.from({ length: 16 }, (_, i) => i)
        else if (hh === 'corcheas' || hh === '8') hhPat = [0, 2, 4, 6, 8, 10, 12, 14]
      }
      const aPatron = (pasos) => pasos.map((pos) => ({ pos, strength: 0.8 }))
      if (bdPat.length) loops.push(loop('bd', 1, aPatron(bdPat)))
      if (sdPat.length) loops.push(loop('sd', 1, aPatron(sdPat)))
      const cerrado = aPatron(hhPat)
      const sinCharle = !hhPat.length
      // las fuerzas: el bombo fuerte, la caja medio, el charle más flojo (que no tape la melodía)
      const conFuerza = (l, f) => ({ ...l, hits: l.hits.map((h) => ({ ...h, strength: f })) })
      const idxSd = loops.findIndex((l) => l.instrument === 'sd')
      const idxBd = loops.findIndex((l) => l.instrument === 'bd')
      if (idxBd >= 0) loops[idxBd] = conFuerza(loops[idxBd], F.bd)
      if (idxSd >= 0) loops[idxSd] = conFuerza(loops[idxSd], F.sd)
      const abierto = (p['charle-abierto'] || '').trim()
      if (sinCharle) {
        // «charle: no»: sin charle en esta parte (con `filtro:` el filtro de la app también lo filtraría)
      } else if (abierto) {
        // charle abierto: quitar el charle cerrado de esos pasos y poner el abierto
        const pasos = [...abierto.replace(/c/gi, ' ').trim().split(/\s+/).filter(Boolean)].map((n) => Number(n) - 1).filter((n) => n >= 0 && n < 16)
        const hits = cerrado.filter((h) => !pasos.includes(h.pos)).map((h) => ({ ...h, strength: F.hh }))
        loops.push(loop('hh', 1, hits))
      } else {
        loops.push(conFuerza(loop('hh', 1, cerrado), F.hh))
      }
      const red = (p.redoble || '').trim().toLowerCase()
      if (red) {
        // redoble: de semicorcheas en el compás indicado (c8 = el 8 de la parte)
        const c = Number(red.replace(/^c/, ''))
        if (!Number.isInteger(c) || c < 1 || c > largo) fallo(`${p.nombre} · redoble: «${p.redoble}» no es un compás de esta parte (1 a ${largo})`)
        // el redoble es un loop de `largo` compases, con los golpes SOLO en el compás `c`
        // (un loop de 1 compás se repetiría en todas las vueltas)
        const hits = Array.from({ length: 16 }, (_, i) => ({ pos: (c - 1) * 16 + i, strength: F.redoble }))
        // `adorno: true`: es un golpe puntual y no una capa; no cuenta en el reparto del volumen (spec 040)
        loops.push({ ...loop('sd', largo, hits), adorno: true })
        console.log(`  redoble de caja en el compás ${c} de «${p.nombre}»`)
      }
    }
    const sinte = sinteDe(p.sinte, `${p.nombre} · sinte`) ?? sinteCancion ?? 'lead'
    if (m.hits.length) loops.push(mk(m.hits, sinte))
    if (b.hits.length) loops.push(mk(b.hits, 'bass', 0.9))
    if (a.hits.length) loops.push(mk(a.hits, 'keys', 0.7))
    // ── percusión del minimal (spec 045): «percu:» y debajo «rim 4 12», «click 2.5 6.5», «shaker 3 7 11 15»… un loop por sonido con su patrón propio ──
    //   pasos del 1 al 16 de cada compás (cualquiera, no solo 1 5 9 13); con decimales se cae fuera de tiempo (2.5 = a mitad de paso; 3.33 = un tercio); 17 a 32 = el segundo compás, etc.
    const PERC = { rim: 'rim', aro: 'rim', click: 'click', clic: 'click', cowbell: 'cowbell', cb: 'cowbell', clave: 'cowbell', tom: 'tom', shaker: 'shaker', sh: 'shaker' }
    const percLoops = []
    {
      let nombre = null
      const pasos = {}
      for (const tok of p.percu.trim().split(/\s+/).filter(Boolean)) {
        if (/^[a-záéíóúñ]+$/i.test(tok)) {
          nombre = PERC[tok.toLowerCase()]
          if (!nombre) fallo(`${p.nombre} · percu: «${tok}» no es un sonido (usa rim, click, cowbell, tom o shaker)`)
        } else if (/^\d+(\.\d+)?$/.test(tok)) {
          if (!nombre) fallo(`${p.nombre} · percu: «${tok}» va después del nombre del sonido (ejemplo: rim 4 12)`)
          const n = Number(tok)
          if (n < 1 || n >= 16 * 16 + 1) fallo(`${p.nombre} · percu: paso «${tok}» fuera de rango (del 1 al 16 en cada compás; 17 a 32 es el segundo compás…)`)
          ;(pasos[nombre] ??= []).push(Math.round((n - 1) * 12) / 12)
        } else fallo(`${p.nombre} · percu: no entiendo «${tok}» (ejemplo: «rim 4 12  shaker 3 7 11 15»)`)
      }
      for (const [nombre, ps] of Object.entries(pasos)) {
        const unicos = [...new Set(ps)].sort((a, b) => a - b)
        const bars = redondea(Math.max(1, Math.ceil((unicos.at(-1) + 1e-9) / 16)))
        if (!bars) fallo(`${p.nombre} · percu: ${nombre} llega más allá del compás 16`)
        percLoops.push(loop('mel', bars, unicos.map((pos) => ({ pos, dur: 1, midi: 36, strength: 0.7 })), nombre))
      }
    }
    loops.push(...percLoops)
    for (const [sinte, cs] of Object.entries(porSinte)) {
      const hs = []
      for (const e of fx.filter((x) => x.sinte === sinte)) for (const c of e.compases) hs.push(...notasEfecto(sinte, c, e.dur))
      loops.push(mk(hs.sort((a, b) => a.pos - b.pos), sinte, 0.8))
    }
    if (escala) {
      const dentro = pcs(escala)
      const porClase = (hs, que) => {
        const fuera = hs.filter((h) => !dentro.includes(h.midi % 12))
        if (!fuera.length) return
        const lista = [...new Set(fuera.map((h) => `${NOMBRE_NOTA[h.midi % 12]} (compás ${Math.floor(h.pos / 16) + 1})`))].slice(0, 5)
        avisos.push(`${p.nombre} · ${que}: ${fuera.length} ${fuera.length === 1 ? 'nota se sale' : 'notas se salen'} de ${nombreEscala(escala)}: ${lista.join(', ')}${new Set(fuera.map((h) => `${h.midi % 12}-${Math.floor(h.pos / 16)}`)).size > 5 ? '…' : ''} (¿error, o un sostenido a propósito?)`)
      }
      porClase(m.hits, 'melodía')
      porClase(b.hits, 'bajo')
    }
    chequear(p.nombre, 'melodía', m, largo)
    chequear(p.nombre, 'bajo', b, largo)
    chequear(p.nombre, 'acordes', a, largo)
    // ── minimal (spec 008 §5): `compases:` (la parte dura más que el loop: se repite), `filtro:` (Hz por compás) y `entra:` / `sale:` (un tono nuevo que entra y sale) ──
    const N = p.compases.trim() ? Number(p.compases.trim().replace(/^c/i, '')) : largo
    if (![1, 2, 4, 8, 16, 32].includes(N) || N < largo || N % largo) fallo(`${p.nombre} · compases: «${p.compases}»: tiene que ser 1, 2, 4, 8, 16 o 32 y un múltiplo de lo que dura el loop (${largo})`)
    const sol = String(p['filtro-solo-sintes'] || '').trim().toLowerCase()
    if (sol && !['si', 'sí', 'no'].includes(sol)) fallo(`${p.nombre} · filtro-solo-sintes: «${p['filtro-solo-sintes']}»: usa si o no`)
    const soloSintes = sol === 'si' || sol === 'sí'
    if (soloSintes && !p.filtro.trim()) fallo(`${p.nombre} · filtro-solo-sintes: sin «filtro:» no hace nada`)
    for (const pl of percLoops) if (pl.bars > N) avisos.push(`${p.nombre} · percu: un patrón de ${pl.bars} compases en una parte de ${N}: se corta`)
    const hz = p.filtro.trim() ? p.filtro.trim().split(/[\s,]+/).map(Number) : null
    if (hz && (hz.length > 32 || hz.some((v) => !Number.isFinite(v) || v < 60 || v > 20000))) fallo(`${p.nombre} · filtro: «${p.filtro}»: de 1 a 32 valores en Hz, entre 60 y 20000 (uno por compás; si faltan, vale el último)`)
    if (hz && hz.length > N) avisos.push(`${p.nombre} · filtro: ${hz.length} valores para ${N} compases: se usan los ${N} primeros`)
    if (hz && !soloSintes && loops.some((l) => l.instrument === 'hh')) avisos.push(`${p.nombre} · filtro: el filtro de la app afecta a TODA la parte (también al charle y al bombo, no solo a la melodía): con valores bajos el charle se apaga. Si quieres que no se pierda su brillo: «filtro-solo-sintes: si» (la batería va limpia) o quítalo en esta parte (charle: no)`)
    if (N > largo && (p.redoble.trim() || fx.length)) avisos.push(`${p.nombre} · la parte dura ${N} compases y el loop ${largo}: el redoble y los efectos se repiten en cada vuelta del loop (${N / largo} veces)`)
    // el tono nuevo: «entra: c17» + sus notas; «sale: c25» (opcional) lo quita
    let tono = null
    if (p.entra.trim()) {
      const [cab, ...resto] = p.entra.trim().split(/\s+/)
      const desde = /^c\d+$/i.test(cab) ? Number(cab.slice(1)) : NaN
      const hasta = p.sale.trim() ? Number(p.sale.trim().replace(/^c/i, '')) : N + 1
      if (!Number.isInteger(desde) || desde < 2 || desde > N) fallo(`${p.nombre} · entra: «${cab}»: un compás de la parte, del c2 al c${N} (ejemplo: entra: c17 y debajo sus notas)`)
      if (!Number.isInteger(hasta) || hasta <= desde || hasta > N + 1) fallo(`${p.nombre} · sale: «${p.sale}»: un compás después de entra (c${desde + 1} a c${N + 1})`)
      for (const [que, c] of [['entra', desde], ['sale', hasta]]) if (c <= N && (c - 1) % largo) fallo(`${p.nombre} · ${que}: c${c} no cae al principio de una vuelta del loop (que dura ${largo}: c1, c${1 + largo}, c${1 + 2 * largo}…): si no, el loop se cortaría a medias`)
      const t = leer(resto.join(' '), `${p.nombre} · entra`)
      if (!t.hits.length) fallo(`${p.nombre} · entra: sin notas (escribe las notas del tono nuevo debajo)`)
      const barsT = redondea(Math.max(1, Math.ceil(t.hits.reduce((mx, h) => Math.max(mx, h.pos), 0) / 16 - 1e-9) || 1))
      if (!barsT) fallo(`${p.nombre} · entra: el tono dura demasiado (como mucho 16 compases)`)
      tono = { desde, hasta, barsT, hits: t.hits }
    } else if (p.sale.trim()) fallo(`${p.nombre} · sale: sin «entra:» (sale quita el tono que entra)`)
    const segs = []
    if (!tono) segs.push({ from: 1, to: N + 1, tono: false })
    else {
      if (tono.desde > 1) segs.push({ from: 1, to: tono.desde, tono: false })
      segs.push({ from: tono.desde, to: tono.hasta, tono: true })
      if (tono.hasta <= N) segs.push({ from: tono.hasta, to: N + 1, tono: false })
    }
    const piezas = []
    for (const sg of segs) for (let f = sg.from, r = sg.to - sg.from; r > 0; ) { const t = [32, 16, 8, 4, 2, 1].find((x) => x <= r); piezas.push({ from: f, turns: t, tono: sg.tono }); f += t; r -= t }
    const clonar = (ls) => ls.map((l) => ({ ...l, id: loopId++ }))
    piezas.forEach((pz, k) => {
      const base = k === 0 ? loops : clonar(loops)
      const lps = pz.tono ? [...base, loop('mel', tono.barsT, tono.hits.filter((x) => x.pos < tono.barsT * 16).map((x) => ({ pos: x.pos, dur: x.dur, midi: x.midi, strength: 0.8 })), sinte)] : base
      const i = cells.length
      cells.push({ id: i + 1, name: (pz.tono ? `${p.nombre} + tono` : p.nombre).slice(0, 40), loops: lps, parts: { bass: false, chords: false }, turns: pz.turns, ...(hz ? { lpf: Array.from({ length: pz.turns }, (_, j) => hz[Math.min(pz.from - 1 + j, hz.length - 1)]) } : {}), ...(hz && soloSintes ? { lpfSoloSintes: true } : {}), at: { x: i * 3, y: Math.sin(i * 1.3) * 1.2, depth: [0, 0.4, 0.1, 0.6][i % 4] } })
    })
    if (tono) {
      const t0 = ((compasInicio + tono.desde - 1) * 240) / tempo
      escucha.push(`tono nuevo → entra en el compás ${compasInicio + tono.desde} de la canción (${p.nombre}, c${tono.desde}), a los ${Math.floor(t0 / 60)}:${String(Math.round(t0 % 60)).padStart(2, '0')}${tono.hasta <= N ? ` y sale en el compás ${compasInicio + tono.hasta}` : ''}`)
    }
    if (hz) escucha.push(`filtro → ${hz.length} valores desde el compás ${compasInicio + 1} de la canción (${p.nombre}): de ${hz[0]} a ${hz[Math.min(hz.length, N) - 1]} Hz${hz.length < N ? ` y se queda en ${hz.at(-1)} hasta el c${N}` : ''}`)
    compasInicio += N
    resumen.push(`${p.nombre} (${N} compases${N > largo ? ` = loop de ${largo} ×${N / largo}` : ''}${hz ? ', filtro' : ''}${tono ? ', tono nuevo' : ''}${percLoops.length ? ', percusión (' + percLoops.map((l) => l.synth).join('+') + ')' : ''}${m.hits.length ? ', melodía' + (sinte !== 'lead' ? ' (' + sinte + ')' : '') : ''}${b.hits.length ? ', bajo' : ''}${a.hits.length ? ', acordes' : ''}${fx.length ? ', efectos' : ''})`)
  }
  if (cells.length > 16) fallo(`demasiadas partes (${cells.length}): como mucho 16`)
  // ── sidechain (spec 041): el bombo «empuja» el bajo y los acordes (la melodía no se toca). `sidechain: si | no | auto`; auto (por defecto) = sí en techno y house, nada en el resto ──
  const scTexto = String(cfg.sidechain || 'auto').trim().toLowerCase()
  if (!['si', 'sí', 'no', 'auto'].includes(scTexto)) fallo(`sidechain «${cfg.sidechain}»: usa si, no o auto`)
  const sidechain = scTexto === 'no' ? 'no' : scTexto === 'auto' ? (['techno', 'techno2', 'house', 'house2'].includes(cfg.estilo) ? 'si' : null) : 'si'
  const song = { version: 1, cells, order: cells.map((c) => c.id), groups: [], nextGroupId: 1, bpm: tempo === ESTILOS[cfg.estilo] ? null : tempo, nextCellId: cells.length + 1, nextLoopId: loopId, ...(escala ? { scale: escala } : {}), ...(sidechain ? { sidechain } : {}) }
  const archivo = { v: 1, n: cfg.nombre.slice(0, 60), s: cfg.estilo, k: cfg.kit, b: 'manual', f: { filter: 1, space: 0, warmth: 0.5 }, g: song }
  const salida = salidaArg || entrada.replace(/\.[^.]+$/, '') + '.json'
  writeFileSync(salida, JSON.stringify(archivo))
  console.log(`✓ ${salida}: «${archivo.n}», ${cfg.estilo} a ${tempo} bpm.`)
  console.log('  Partes: ' + resumen.join(' · '))
  console.log(sidechain === 'si' ? `  Sidechain: sí (el bombo empuja el bajo y los acordes${scTexto === 'auto' ? '; automático en ' + cfg.estilo : ''}).` : sidechain === 'no' ? '  Sidechain: no.' : '  Sidechain: ninguno (solo es automático en techno y house; «sidechain: si» lo activa).')
  if (sidechain === 'si' && cfg.ritmo.toLowerCase() === 'no') console.log('  ⚠ «ritmo: no»: sin bombo, el sidechain no hace nada.')
  console.log(escala ? `  Escala: ${nombreEscala(escala)} (${escalaDe}).` : '  Escala: ninguna (no hay notas de donde deducirla; añade «escala: sol menor»).')
  if (escucha.length) {
    console.log('\n  Efectos (dónde escucharlos):')
    for (const e of escucha) console.log('    · ' + e)
  }
  console.log('  Impórtala en la app: Mis canciones → ⋯ Copia y archivos → ⬆ Importar → elige este archivo.')
  if (avisos.length) {
    console.log('\n  ⚠ Revisa esto (es lo que hace que suene a trozos):')
    for (const a of avisos) console.log('    · ' + a)
  }

}

void main()
