<script setup lang="ts">
// «Acerca de»: licencia (AGPL) y créditos. Sin estado; lo usan los ajustes, la pantalla de inicio y el Laboratorio. Textos en i18n (`about.*`).
import { CREDITS, LICENSE_ID, LICENSE_NAME, LICENSE_URL, SOURCE_URL } from '~/lib/about'
const { t } = useI18n()
</script>

<template>
  <div class="grid gap-3 text-xs text-neutral-400">
    <LangSwitch compact />
    <p class="text-sm text-neutral-200">{{ t('about.intro') }}</p>
    <p>
      {{ t('about.licensePre') }} <a class="text-white underline underline-offset-4" :href="LICENSE_URL" target="_blank" rel="noopener">{{ LICENSE_NAME }}</a>
      ({{ LICENSE_ID }}). {{ t('about.licensePost') }}
    </p>
    <a
      class="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#F496BC]/50 px-4 py-3 text-sm text-[#F496BC]"
      :href="SOURCE_URL" target="_blank" rel="noopener" data-about-fork
    >
      {{ t('about.fork') }}
    </a>
    <p>
      <a class="text-white underline underline-offset-4" :href="SOURCE_URL" target="_blank" rel="noopener">{{ t('about.source') }}</a>
      · {{ t('about.sourcePost') }}
    </p>
    <h3 class="mt-1 text-neutral-200">{{ t('about.creditsTitle') }}</h3>
    <ul class="grid gap-2">
      <li v-for="c in CREDITS" :key="c.name">
        <a class="text-neutral-100 underline underline-offset-4" :href="c.url" target="_blank" rel="noopener">{{ c.name }}</a>
        <span class="text-neutral-500"> · {{ c.license }}</span><br />
        {{ t(`about.credits.${c.id}`) }}
      </li>
    </ul>
    <p class="text-neutral-400" data-about-share>{{ t('about.share') }}</p>
    <p class="text-neutral-500">{{ t('about.marks') }} <code>public/samples/CREDITS.md</code>.</p>
  </div>
</template>
