<script setup lang="ts">
// Medidor de la salida (spec 047): el pico y el nivel medio de lo que sale, en dBFS, para no pasarse. Solo funciona mientras está a la vista (se conecta al abrirse y se suelta al cerrarse).
const engine = useAudioEngine()
const { t } = useI18n()
const peak = ref(-90)
const rms = ref(-90)
const hold = ref(-90) // el pico máximo de hace un momento (1,5 s)
let timer: ReturnType<typeof setInterval> | undefined
let holdAt = 0
onMounted(() => {
  if (!engine.meterOn()) return
  timer = setInterval(() => {
    const r = engine.readMeter()
    if (!r) return
    peak.value = r.peakDb
    rms.value = r.rmsDb
    const now = performance.now()
    if (r.peakDb >= hold.value || now - holdAt > 1500) {
      hold.value = r.peakDb
      holdAt = now
    }
  }, 80)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  engine.meterOff()
})
const pct = (db: number) => `${Math.round(Math.max(0, Math.min(1, (db + 48) / 48)) * 100)}%`
/** verde hasta −6 dB, ámbar hasta el techo (−1 dB) y rojo a partir de ahí */
const color = (db: number) => (db >= -1 ? '#ff4d6d' : db >= -6 ? '#F5C97A' : '#7FD6C2')
const text = (db: number) => (db <= -80 ? '−∞' : db.toFixed(1))
</script>

<template>
  <div class="grid gap-1" data-meter :aria-label="t('settings.meter.label')">
    <div class="flex items-center justify-between text-xs">
      <span class="text-white/60">{{ t('settings.meter.label') }}</span>
      <span class="tabular-nums text-white/80" data-meter-text>{{ t('settings.meter.peak') }} {{ text(hold) }} dB · {{ t('settings.meter.rms') }} {{ text(rms) }} dB</span>
    </div>
    <div class="relative h-2 overflow-hidden rounded-full bg-white/10" role="meter" aria-valuemin="-48" aria-valuemax="0" :aria-valuenow="Math.round(peak)">
      <div class="absolute inset-y-0 left-0 rounded-full" :style="{ width: pct(rms), background: 'rgba(255,255,255,.35)' }" />
      <div class="absolute inset-y-0 left-0 rounded-full opacity-90" :style="{ width: pct(peak), background: color(peak), height: '40%', top: '30%' }" />
      <div class="absolute inset-y-0 w-px bg-white/70" :style="{ left: pct(hold) }" />
      <div class="absolute inset-y-0 w-px bg-white/30" :style="{ left: pct(-1) }" />
    </div>
    <p v-if="hold >= -1" class="text-xs text-[#ff4d6d]" role="status">{{ t('settings.meter.hot') }}</p>
  </div>
</template>
