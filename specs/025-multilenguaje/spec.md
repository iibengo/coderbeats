# Spec 025 · Multilenguaje (español base, inglés y euskera)

## 1. Qué
Todos los textos de la app salen de archivos de idioma con `@nuxtjs/i18n`. **Español base**, **inglés** y **euskera**. El idioma sale del navegador (`navigator.languages`: `es*` → es, `en*` → en, `eu*` → eu; si no, español) y se puede cambiar con un selector en **Ajustes → Acerca de** (y en el inicio, junto a «Acerca de»). La elección la recuerda el módulo en una **cookie propia** (`coderbeats_lang`, solo el código de idioma); nunca toca lo guardado (`localStorage`/IndexedDB).

## 2. Reglas
- **No se traduce:** el código Strudel (lo mostrado, copiado y generado), los nombres de notas (`do re mi`/`C D E` — se muestran como hasta ahora), los nombres propios (Strudel, coderbeats, Beethoven…), los ids y las claves guardadas.
- **Las claves** son del tipo `lab.capas.frase`, `estudio.parte.editar`; el español es la fuente y el inglés y el euskera se completan a partir de él; si falta una clave, **cae al español** (nunca se ve una clave).
- **Plurales y variables** con la sintaxis de vue-i18n (`{n} partes`, `no caben más capas ({n})`).
- **Sin rutas por idioma** (`strategy: 'no_prefix'`): la app es una SPA sin SEO; `/lab` y `/estudio` no cambian.
- El `lang` de `<html>` sigue al idioma. Los textos de los **lienzos** (`fillText`) también salen de los archivos.
- **Calidad:** el inglés lo escribo yo; el **euskera es una traducción mía sin revisar por una persona hablante: hay que revisarla** antes de darla por buena.

## 3. Cumple PRINCIPIOS.md
1–8: no cambia lo que hace la app; solo en qué idioma habla. 3 (respuesta inmediata): el cambio de idioma es inmediato y sin recargar. 5 (pocas cosas): un selector de tres opciones escondido en «Acerca de». 8 (quitar antes de añadir): se reutilizan los textos de la auditoría (vocabulario único) en vez de traducir los viejos.
`DISENO.md`: los textos nuevos más largos (euskera, inglés) no deben pasar de 11 px reales ni romper los botones: etiquetas cortas y `truncate` donde haga falta.

## 4. Plan por fases
1. Infraestructura: módulo, tres archivos, detección, selector, `lang`. **(hecho)**
2. Textos del Laboratorio (menú, marco, las 5 pantallas, remix).
3. Textos del Estudio: inicio, Editar parte, Batería, Órgano, Mis remixes, Ajustes esenciales, avisos de la barra.
4. El resto (Ajustes avanzados, calibración, guía, vídeo, piloto, Acerca de, avisos del motor): por tandas; hasta migrarse, siguen en español (el español es el respaldo).
5. Un test que comprueba que las tres lenguas tienen las mismas claves y las mismas variables.

## 5. Decisiones a revisar
- Cobertura: ver `ESTADO.md` (qué porcentaje está migrado y qué falta).
- Las frases del motor (`say(...)`) y las confirmaciones viven en `composables`/`lib`: se migran con `useNuxtApp().$i18n.t` o pasando el texto desde el componente.

## 6. Hecho (2026-11-16)
- `@nuxtjs/i18n` 10 con `strategy: 'no_prefix'`, `defaultLocale: 'es'`, respaldo al español (`i18n/i18n.config.ts`), detección por `navigator.languages` (es/en/eu; otro → es), `<html lang>` siguiendo al idioma, selector `LangSwitch` en el menú del Laboratorio, en el inicio y en «Acerca de». Archivos: `i18n/locales/{es,en,eu}.json`; test `tests/unit/i18n.test.ts` (mismas claves y variables en las tres).
- **Migrado a archivos de idioma:** menú del Laboratorio, marco (`LabShell`), Capas (con DJ), Piano mágico, Coro, Círculo de ritmo, Remixes (botones, avisos y textos del lienzo), pantalla de inicio, panel «Editar parte», **Batería, Órgano, y la cabecera y los remixes de serie de «Mis remixes»**, selector.
- **Todavía en español** (tandas siguientes; el español sirve de respaldo, no hay claves a la vista): lista y filas de Mis remixes, Ajustes y sus avanzados, calibración, vídeo, piloto, guía/tutorial, avisos y confirmaciones del motor, «Acerca de» (texto), nombres de las partes de un remix (Intro, Subida, Drop…) y los textos de `Studio.vue` / `VisualStage.vue`. Estimación: ≈ 45 % de los textos migrados (los del Laboratorio y la entrada).
- **Euskera sin revisar por una persona hablante:** términos elegidos por mí (bonboa, danborra, platera, baxua, geruzak = capas, zatia = parte); hay que revisarlo.
- Los guiones de navegador fijan `--lang=es-ES` para que sigan viendo español.
