/**
 * La latencia que usa el motor (spec 001 §17.5): la calibrada si hay y es usable; si no, 50 ms, o 180 ms si la salida parece Bluetooth (por el nombre de la salida o por la latencia
 * que informa el navegador). La comparten el Estudio y la portada (spec 016): sin ella los golpes del micro caerían tarde.
 */
import { fallbackLatencyMs } from '~/lib/defaultLatency'
import { usableLatencyMs } from '~/lib/latency'

export function useLatencyDefaults() {
  const engine = useAudioEngine()
  const calibration = useCalibration()
  const outputLabels = ref<string[]>([])
  async function readOutputs() {
    try {
      outputLabels.value = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audiooutput').map((d) => d.label)
    } catch {
      /* sin nombres: solo cuenta la latencia que informa el contexto */
    }
  }
  onMounted(() => {
    void readOutputs()
    navigator.mediaDevices?.addEventListener?.('devicechange', readOutputs)
  })
  onBeforeUnmount(() => navigator.mediaDevices?.removeEventListener?.('devicechange', readOutputs))
  watchEffect(() =>
    engine.setLatency(
      fallbackLatencyMs(usableLatencyMs(calibration.data.value?.latency?.ms), { outputLabels: outputLabels.value, reportedOutputMs: engine.reportedOutputMs.value }) / 1000,
      calibration.data.value?.latency?.ms,
    ),
  )
}
