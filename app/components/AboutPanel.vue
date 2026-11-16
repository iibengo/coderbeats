<script setup lang="ts">
// «Acerca de»: licencia (AGPL) y créditos. Sin estado; lo usan los ajustes y la pantalla de inicio.
import { CREDITS, LICENSE_ID, LICENSE_NAME, LICENSE_URL, SOURCE_URL } from '~/lib/about'
</script>

<template>
  <div class="grid gap-3 text-xs text-neutral-400">
    <LangSwitch />
    <p class="text-sm text-neutral-200">coderbeats · tu beatbox convertido en batería y en código Strudel.</p>
    <p>
      Software libre bajo la <a class="text-white underline underline-offset-4" :href="LICENSE_URL" target="_blank" rel="noopener">{{ LICENSE_NAME }}</a>
      ({{ LICENSE_ID }}). Puedes usarlo, estudiarlo, modificarlo y compartirlo; si ofreces una versión modificada como servicio en red,
      debes ofrecer su código fuente a quien la use.
    </p>
    <p>
      <a class="text-white underline underline-offset-4" :href="SOURCE_URL" target="_blank" rel="noopener">Código fuente</a>
      · el código que generas con tu música es tuyo; tus grabaciones se quedan en tu dispositivo.
    </p>
    <h3 class="mt-1 text-neutral-200">Créditos</h3>
    <ul class="grid gap-2">
      <li v-for="c in CREDITS" :key="c.name">
        <a class="text-neutral-100 underline underline-offset-4" :href="c.url" target="_blank" rel="noopener">{{ c.name }}</a>
        <span class="text-neutral-500"> · {{ c.license }}</span><br />
        {{ c.what }}
      </li>
    </ul>
    <p class="text-neutral-500">«808» y «Roland» son marcas de sus dueños y solo describen el sonido. Detalle de cada sample en <code>public/samples/CREDITS.md</code>.</p>
  </div>
</template>
