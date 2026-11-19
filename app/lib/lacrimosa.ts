/**
 * El Lacrimosa de Mozart (Requiem K. 626, 1791; dominio público), las voces de los **18 primeros compases de 12/8** (Larghetto, Re menor) como notas: violín I, violín II, viola, contrabajo y soprano.
 *
 * **De dónde salen:** del MIDI «K626 Requiem 07 Lacrimosa» (secuenciado por D. Viens, 1997; BitMidi). El archivo no se incluye: aquí solo están los números de nota de una obra de dominio público.
 * **Contrastado con la partitura** de Breitkopf & Härtel (IMSLP n.º 26746, escaneada; espejo en Wikimedia Commons), midiendo la posición de cada cabeza contra el pentagrama: las 16 notas del violín I de los
 * compases 1–2 y el soprano de los compases 3–5 coinciden. **El resto no se ha contrastado** (es la secuencia tal cual).
 *
 * **Formato:** cada nota es `corchea:duración:midi`, con la corchea contada desde el principio (un compás de 12/8 = 12 corcheas) y la duración en corcheas. Una corchea de 12/8 dura 8/3 de paso cuando
 * un compás de 12/8 son 2 de 4/4 a medio tiempo (32 pasos): los tercios de paso que el formato de la spec 028 §3 ya admite.
 */
import type { Note } from './publicTunes'

/** pasos que dura una corchea de 12/8 (un compás de 12/8 = 32 pasos) */
export const EIGHTH = 8 / 3
/** pasos por compás de 12/8 */
export const BAR128 = 32

/** «corchea:duración:midi …» → notas con su posición en pasos */
export function parseEighths(text: string): Note[] {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => {
      const [e, d, m] = tok.split(':').map(Number)
      if (!Number.isInteger(e) || !Number.isInteger(d) || !Number.isInteger(m) || d! < 1) throw new Error(`nota mal escrita: ${tok}`)
      return [e! * EIGHTH, d! * EIGHTH, m!] as const
    })
}

/** Las notas de los compases de 12/8 `from` a `to` (el primero es el 0; `to` no entra), con la posición contada desde `from`; lo que sobrepasa el final se recorta. */
export function lacSlice(notes: readonly Note[], from: number, to: number): Note[] {
  const a = from * BAR128
  const b = to * BAR128
  const out: Note[] = []
  for (const [p, d, m] of notes) {
    if (p < a - 1e-9 || p >= b - 1e-9) continue
    out.push([p - a, Math.min(d, b - p), m] as const)
  }
  return out
}

const VLN1 = [
  '1:1:73 2:1:74 4:1:81 5:1:82 7:1:74 8:1:73 10:1:84 11:1:82 13:1:81 14:1:86 16:1:82 17:1:79 19:1:76 20:1:77 22:1:81 23:1:73 25:1:73 26:1:74 28:1:81 '+
  '29:1:82 31:1:74 32:1:73 34:1:82 35:1:81 37:1:73 38:1:74 40:1:81 41:1:82 43:1:74 44:1:73 46:1:82 47:1:81 49:1:62 50:1:57 52:1:64 53:1:57 55:1:65 '+
  '56:1:62 58:1:67 59:1:60 61:1:69 62:1:65 64:1:71 65:1:64 67:1:72 68:1:69 70:1:74 71:1:67 73:1:75 74:1:72 76:1:76 77:1:72 79:1:77 80:1:72 82:1:78 '+
  '83:1:69 85:1:79 86:1:71 88:1:80 89:1:70 91:1:81 92:1:69 94:1:69 95:1:57 97:1:64 98:1:57 100:1:70 101:1:69 103:1:62 104:1:57 106:1:77 107:1:74 109:1:67 '+
  '110:1:58 112:1:74 113:1:76 115:1:69 116:1:57 118:1:73 119:1:74 121:1:75 122:1:63 124:1:79 125:1:75 127:1:75 128:1:65 130:1:74 131:1:70 133:1:74 '+
  '134:1:62 136:1:77 137:1:76 139:1:76 140:1:65 142:1:74 143:1:80 145:1:80 146:1:68 148:1:79 149:1:77 151:1:77 152:1:67 154:1:76 155:1:82 157:1:82 '+
  '158:1:70 160:1:81 161:1:79 163:1:79 164:1:69 166:1:77 167:1:86 169:1:65 170:1:71 172:1:65 173:1:72 175:1:65 176:1:74 178:1:65 179:1:74 181:1:65 '+
  '182:1:74 184:1:65 185:1:72 187:1:65 188:1:71 190:1:65 191:1:71 193:1:67 194:1:71 196:1:67 197:1:72 199:1:64 200:1:74 202:1:72 203:1:77 205:1:74 '+
  '206:1:77 208:1:86 209:1:83 211:1:84 212:1:81 214:1:82 215:1:79'
].join('')
const VLN2 = [
  '0:2:65 3:2:69 6:2:67 9:2:73 12:2:74 15:2:64 18:2:62 21:2:67 24:2:65 27:2:69 30:2:67 33:2:73 36:2:74 39:2:69 42:2:67 45:2:73 48:2:62 51:2:61 54:2:62 '+
  '57:2:64 60:2:65 63:2:59 66:2:64 69:2:67 72:2:67 75:2:67 78:2:65 81:2:69 84:2:67 87:2:74 90:2:74 93:2:73 96:2:67 99:2:67 102:2:65 105:2:65 108:2:67 '+
  '111:2:61 114:2:62 117:2:65 120:2:70 123:2:70 126:2:70 129:2:70 132:2:69 135:2:69 137:1:67 138:2:65 141:2:70 143:1:68 144:2:68 147:2:67 150:2:67 '+
  '153:2:67 156:2:64 159:2:69 161:1:67 162:2:67 165:2:65 168:2:68 171:2:68 174:2:68 177:2:68 180:2:68 183:2:68 186:2:68 189:2:68 192:2:67 195:2:67 '+
  '198:2:67 201:2:60 204:2:62 207:2:65 210:2:57 213:2:58'
].join('')
const VLA = [
  '0:2:62 3:2:65 6:2:64 9:2:67 12:2:65 15:2:55 18:2:57 21:2:57 24:2:62 27:2:65 30:2:64 33:2:67 36:2:65 39:2:65 42:2:64 45:1:67 48:2:53 51:2:57 54:2:57 '+
  '57:2:60 60:2:60 63:2:56 66:2:57 69:2:59 72:2:60 75:2:60 78:2:60 81:2:63 84:2:62 87:2:65 90:2:65 93:2:64 96:2:64 99:2:61 102:2:57 105:2:62 108:2:58 '+
  '111:2:57 114:2:57 117:2:62 120:2:63 123:2:63 126:2:65 129:2:65 132:2:65 135:2:62 137:1:64 138:2:62 141:2:65 144:2:65 147:2:62 150:2:60 153:2:60 '+
  '156:2:67 159:2:64 162:2:64 165:2:62 168:2:65 171:2:65 174:2:65 177:2:65 180:2:65 183:2:65 186:2:65 189:2:65 192:2:65 195:2:64 198:2:64 201:2:65 '+
  '204:2:58 207:2:62 210:2:60 213:2:52'
].join('')
const CB = [
  '24:2:38 27:2:41 30:2:40 33:2:33 36:2:38 39:2:41 42:2:40 45:2:33 48:2:38 51:2:33 54:2:38 57:2:36 60:2:41 63:2:40 66:2:33 69:2:31 72:2:36 75:2:46 '+
  '78:2:45 81:2:48 84:2:47 87:2:46 90:2:45 93:2:33 96:3:37 99:3:33 102:3:38 105:3:33 108:2:40 111:2:33 114:2:41 117:2:33 120:2:43 123:2:31 126:2:32 '+
  '129:2:44 132:2:45 135:2:33 138:2:34 141:2:46 144:2:47 147:2:35 150:2:36 153:2:48 156:2:49 159:2:37 162:2:38 165:2:50 168:2:50 171:2:48 174:2:47 '+
  '177:2:47 180:2:47 183:2:48 186:2:49 189:2:49 192:2:50 195:2:48 198:2:46 201:2:45 204:2:34 207:2:38 210:2:36 213:2:36'
].join('')
const SOP = [
  '24:4:69 28:1:77 29:1:74 30:3:74 33:1:73 36:4:69 40:1:77 41:1:74 42:3:74 45:1:73 48:1:62 51:1:64 54:1:65 57:1:67 60:1:69 63:1:71 66:1:72 69:1:74 '+
  '72:3:75 75:3:76 78:3:77 81:3:78 84:3:79 87:3:80 90:3:81 93:1:69 96:4:69 100:1:70 101:1:69 102:4:69 106:1:77 107:1:74 108:4:73 112:1:74 113:1:76 '+
  '114:3:76 117:2:74 120:4:75 124:1:79 125:1:75 126:3:75 129:1:74 132:4:74 136:1:77 137:1:76 138:3:76 141:1:74 144:4:74 148:1:79 149:1:77 150:3:77 '+
  '153:2:76 156:5:76 161:1:69 162:3:69 165:2:69 168:3:71 171:3:72 174:3:74 177:3:74 180:3:74 183:3:72 186:3:71 189:3:71 192:3:71 195:3:72 198:3:74 '+
  '201:2:72 203:1:77 204:4:77 208:1:74 209:1:71 210:4:72 214:1:70 215:1:67'
].join('')

export const LAC = {
  /** violín I: el «suspiro» de los compases 1–2 y después las corcheas que corren */
  vln1: parseEighths(VLN1),
  vln2: parseEighths(VLN2),
  viola: parseEighths(VLA),
  /** contrabajo: la línea del bajo, un golpe por pulso (de 31 a 50: de 49 a 147 Hz) */
  bajo: parseEighths(CB),
  /** soprano: «La-cry-mo-sa di-es il-la…» (entra en el compás 3) */
  soprano: parseEighths(SOP),
} as const
