/// <reference lib="webworker" />
// Worker de análisis en vivo: recibe el audio del micro directamente del AudioWorklet
// (MessagePort transferido) y devuelve golpes clasificados al hilo principal.
import { KnnClassifier } from '../lib/classifier'
import { decideLane } from '../lib/lanes'
import type { Instrument } from '../lib/types'
import { EchoGate } from '../lib/echoGate'
import { extractFeatures } from '../lib/features'
import { LiveMelody, MELODY_DECISION_SEC } from '../lib/liveMelody'
import { StreamingOnsetDetector, type StreamOnset } from '../lib/streamingOnsets'
import { relativeVolume, volumeRefs, type VolumeRefs } from '../lib/volume'
import { FEATURE_SPAN, type FromWorker, type ToWorker } from '../lib/workerProtocol'

declare const self: DedicatedWorkerGlobalScope

let sampleRate = 48000
let classifier: KnnClassifier | null = null
/** carriles que graban (E4.2); por defecto, todos */
let armed: Set<Instrument> = new Set(['bd', 'sd', 'hh'])
/** volumen de referencia de tu calibración (E4.0) */
let refs: VolumeRefs = {}
let detector: StreamingOnsetDetector | null = null
let gate: EchoGate | null = null
let firstFrame: number | null = null
let expectedFrame = 0
let queue: StreamOnset[] = []
/** melodía con la voz (spec 002): altura en continuo y notas; null = apagada */
let live: LiveMelody | null = null
let melodyOn = false

const post = (m: FromWorker) => self.postMessage(m)

function processQueue() {
  if (!detector || firstFrame === null) return
  const received = detector.received
  // con melodía, un golpe espera a saber si cayó dentro de una nota (spec 002, §4.3)
  const waitSamples = live ? Math.max(FEATURE_SPAN, Math.round(MELODY_DECISION_SEC * sampleRate)) : FEATURE_SPAN
  while (queue.length && received >= queue[0]!.sample + waitSamples) {
    if (live && live.time < (firstFrame + queue[0]!.sample) / sampleRate + MELODY_DECISION_SEC) break
    const o = queue.shift()!
    const time = (firstFrame + o.sample) / sampleRate
    const decisionMs = ((received - o.sample) / sampleRate) * 1000
    if (live?.isMelodic(time)) {
      post({ type: 'absorbed', time })
      continue
    }
    if (gate?.isEcho(time, o.strength)) {
      post({ type: 'echo', time, strength: o.strength })
      continue
    }
    const features = extractFeatures(detector.slice(o.sample, FEATURE_SPAN), sampleRate, 0)
    const c = classifier?.classify(features)
    let instrument = c?.instrument ?? 'unknown'
    let confidence = c?.confidence ?? 0
    // carriles que graban (E4.2): lo de un carril apagado se ignora, salvo si duda con uno encendido
    if (c && instrument !== 'unknown') {
      const d = decideLane(instrument, c.scores, armed)
      if (d.kind === 'ignore') {
        post({ type: 'ignored', time, instrument, confidence, vol: relativeVolume(features.rms, instrument, refs) })
        continue
      }
      instrument = d.instrument
      confidence = d.confidence
    }
    post({
      type: 'hit',
      time,
      instrument,
      confidence,
      strength: o.strength,
      vol: relativeVolume(features.rms, instrument, refs),
      decisionMs,
    })
  }
  gate?.prune((firstFrame + received) / sampleRate)
}

function onChunk(frame: number, data: Float32Array) {
  if (!detector) return
  if (firstFrame === null) {
    firstFrame = frame
    expectedFrame = frame
  }
  // hueco en el stream (no debería pasar): rellena con silencio para no desalinear tiempos
  if (frame > expectedFrame) queue.push(...detector.push(new Float32Array(frame - expectedFrame)))
  expectedFrame = frame + data.length
  const onsets = detector.push(data)
  queue.push(...onsets)
  if (live) {
    for (const o of onsets) live.addOnset((firstFrame + o.sample) / sampleRate)
    live.push(frame, data)
    for (const n of live.scan()) post({ type: 'melodic', time: n.start, midi: n.midi })
  }
  processQueue()
}

function setMelody(on: boolean) {
  melodyOn = on
  if (on && !live) live = new LiveMelody(sampleRate)
  else if (!on) live = null
  else live?.reset()
}

self.onmessage = (e: MessageEvent) => {
  const m = e.data as ToWorker
  switch (m.type) {
    case 'init': {
      sampleRate = m.sampleRate
      classifier = m.samples.length ? new KnnClassifier(m.samples, m.norm) : null
      refs = volumeRefs(m.samples)
      const port = e.ports[0]
      if (port)
        port.onmessage = (ev: MessageEvent) => {
          const c = ev.data as { type: string; frame: number; data: Float32Array }
          if (c.type === 'chunk') onChunk(c.frame, c.data)
        }
      break
    }
    case 'calibration':
      classifier = m.samples.length ? new KnnClassifier(m.samples, m.norm) : null
      refs = volumeRefs(m.samples)
      break
    case 'start':
      setMelody(!!m.melody)
      detector = new StreamingOnsetDetector(sampleRate, { minGap: m.minGap })
      gate = m.echo ? new EchoGate(m.echo) : null
      firstFrame = null
      queue = []
      break
    case 'stop':
      detector = null
      queue = []
      break
    case 'lanes':
      armed = new Set(m.armed)
      break
    case 'melody':
      setMelody(m.on)
      break
    case 'notes':
      post({ type: 'notes', id: m.id, notes: live ? live.notesBetween(m.from, m.to) : [] })
      break
    case 'output':
      if (gate) for (const t of m.times) gate.addOutput(t)
      break
  }
}
