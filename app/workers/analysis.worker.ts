/// <reference lib="webworker" />
// Worker de análisis en vivo: recibe el audio del micro directamente del AudioWorklet
// (MessagePort transferido) y devuelve golpes clasificados al hilo principal.
import { KnnClassifier } from '../lib/classifier'
import { EchoGate } from '../lib/echoGate'
import { extractFeatures } from '../lib/features'
import { StreamingOnsetDetector, type StreamOnset } from '../lib/streamingOnsets'
import { relativeVolume, volumeRefs, type VolumeRefs } from '../lib/volume'
import { FEATURE_SPAN, type FromWorker, type ToWorker } from '../lib/workerProtocol'

declare const self: DedicatedWorkerGlobalScope

let sampleRate = 48000
let classifier: KnnClassifier | null = null
/** volumen de referencia de tu calibración (E4.0) */
let refs: VolumeRefs = {}
let detector: StreamingOnsetDetector | null = null
let gate: EchoGate | null = null
let firstFrame: number | null = null
let expectedFrame = 0
let queue: StreamOnset[] = []

const post = (m: FromWorker) => self.postMessage(m)

function processQueue() {
  if (!detector || firstFrame === null) return
  const received = detector.received
  while (queue.length && received >= queue[0]!.sample + FEATURE_SPAN) {
    const o = queue.shift()!
    const time = (firstFrame + o.sample) / sampleRate
    const decisionMs = ((received - o.sample) / sampleRate) * 1000
    if (gate?.isEcho(time, o.strength)) {
      post({ type: 'echo', time, strength: o.strength })
      continue
    }
    const features = extractFeatures(detector.slice(o.sample, FEATURE_SPAN), sampleRate, 0)
    const c = classifier?.classify(features)
    const instrument = c?.instrument ?? 'unknown'
    post({
      type: 'hit',
      time,
      instrument,
      confidence: c?.confidence ?? 0,
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
  queue.push(...detector.push(data))
  processQueue()
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
      detector = new StreamingOnsetDetector(sampleRate, { minGap: m.minGap })
      gate = m.echo ? new EchoGate(m.echo) : null
      firstFrame = null
      queue = []
      break
    case 'stop':
      detector = null
      queue = []
      break
    case 'output':
      if (gate) for (const t of m.times) gate.addOutput(t)
      break
  }
}
