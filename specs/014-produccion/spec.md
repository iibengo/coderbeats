# 014 · Producción: que las canciones parezcan hechas en un estudio

> Estado: **idea apuntada para más adelante** (2026-11-15). No se programa nada hasta que se apruebe.
> Parte de: 008 (remixes), 010 (mejores sonidos y cadena maestra «cálida»), 012 (sugerencias), 013 (exportar vídeo).

## 1. Idea

Hoy las canciones suenan a «máquina bien montada»: estructura clara, pero casi todo al mismo nivel, con la misma cadena y repitiendo loops. Esta spec reúne lo que separa eso de una producción profesional, **ordenado por efecto sobre coste**.

**Límite real:** no se puede oír desde el desarrollo. Todo lo de mezcla y masterización se ajusta **de oído, en ciclos cortos** (un cambio pequeño → tu opinión: «el bajo tapa el bombo», «el drop no pega»). Cada fase deja un valor por defecto prudente y un sitio donde afinarlo.

## 2. Lo que ya hay

Cadena maestra (saturador → compresor de pegamento → limitador → techo), sidechain del bombo sobre el fondo, riser, crash e impacto (`boom`), filtro por vuelta (`lpf`) y «wowo», variaciones y plantilla de canción (012).

## 3. Fases (de más a menos efecto por coste)

1. **Humanización y variación** (solo datos; no toca el audio)
   - Swing suave (retraso del 2.º, 4.º… paso) y **variación de volumen** en los golpes; micro-desfases de unos pocos ms.
   - Reglas de variación en las plantillas: fill de caja cada 4 compases, hat abierto cada 2, cambio de nota del bajo cada 8.
   - Que ningún bloque de 8 compases suene idéntico: la «segunda vuelta» cambia algo.
2. **Automatización** (parámetros que cambian en el tiempo)
   - Filtro, volumen, panorama y resonancia por compases (hoy solo el filtro, por vuelta).
   - El gancho entra o sale con una rampa, no de golpe.
3. **Transiciones** (lo que une las secciones)
   - Barrido de ruido hacia arriba (**uplifter**) y hacia abajo (**downlifter**), impacto grave en cada drop, **silencio de una corchea** antes de caer, redoble de caja y *reverse crash*.
4. **Espacio por capa**
   - Reverb corta en la caja, larga en los acordes, delay en el gancho; todo **automatizado**: se retira justo antes del drop y vuelve al caer.
   - Hoy el espacio es un solo control global.
5. **Mezcla por capa**
   - **Panorama estéreo:** bombo y bajo al centro; hats y percusión a los lados.
   - **Ecualizador por capa** (quitar graves a hats y acordes para dejar sitio al bombo y al bajo) y **compresor por capa**.
   - Ajuste fino del sidechain (profundidad y recuperación).
6. **Diseño de sonido**
   - Bombo y bajo **por capas** (cuerpo grave + golpe + sub), gancho con más carácter (varios osciladores, detune, filtro con movimiento), más percusión (clap, ride, shaker).
7. **Armonía y desarrollo**
   - Progresiones con más color, **cambio de acorde o de tonalidad en el drop final**, un gancho que evoluciona (variaciones del motivo) en vez de repetirse igual.
8. **Masterización**
   - Medir el volumen final (**LUFS**, objetivo ~ −14 en redes), mejor limitador, comprobar el estéreo y el pico verdadero; ideal para **«Exportar vídeo»** (013), donde el volumen importa.
9. **Referencia A/B** (herramienta de oído)
   - Poder comparar la canción con una pista de referencia al mismo volumen para ajustar el equilibrio.

## 4. Riesgos

| Riesgo | Mitigación |
|---|---|
| Sin oído, se puede empeorar el sonido | Un cambio por vez, valores prudentes, botón de «sin producción» (A/B) para comparar |
| CPU en el móvil (EQ, compresor y reverb por capa) | Empezar por lo que no gasta (fases 1–3, que son datos) y medir antes de las fases 4–5 |
| Romper «pegado en strudel.cc suena igual» (010) | Lo nuevo se expresa en Strudel donde se pueda (`pan`, `room`, `lpf`, `shape`, `delay`); lo que no, queda como mejora de la app |
| Las canciones guardadas suenan distinto al actualizar | Las mejoras son opcionales (por canción o interruptor) y las guardadas no cambian sin avisar |

## 5. Cómo se comprobaría

Datos puros con tests (swing, variación, automatización como funciones de compás → valor); código Strudel evaluado en Node; y **de oído en el móvil** con la lista corta de qué escuchar en cada fase.

## 6. Preguntas abiertas

1. ¿Las mejoras se aplican a todas las canciones o con un interruptor «Producción»?
2. ¿Objetivo de volumen por defecto (−14 LUFS) o más fuerte?
3. ¿Se quiere un modo «A/B» para comparar con y sin producción?

## 7. Implementado (2026-11-16): fase 1

`lib/production.ts` (puro, con tests) y el interruptor **«Producción» en ⋯** (apagado por defecto: las canciones guardadas y compartidas **no cambian solas**; se guarda por dispositivo en los ajustes). Con él: **swing** (el paso impar, la semicorchea de contratiempo, se retrasa 0,16 de semicorchea con `.nudge()`) y **matices de volumen** (`.gain("…")` por paso: el bombo firme casi sin variar, la caja poco, el platillo más; tiempos fuertes más fuertes y contratiempos más suaves; variación fija por paso, repetible; siempre entre 0,6 y 1). Se expresa en Strudel normal, así que **el código mostrado suena igual en strudel.cc**. Valores prudentes (`DEFAULT_PRODUCTION`), a afinar de oído. **Sin oír.** Pendiente de la spec: reglas de variación en las plantillas, automatización por compás, transiciones, y las fases 4–9. Decisión simple: el swing y los matices son fijos (sin deslizadores todavía).

## 8. Implementado (2026-11-16): fases 1b y 3 (parcial), solo canciones nuevas
`convertToSong(song, style, { variation, transitions })` y, con el interruptor **«Producción»** encendido, «✦ Convertir en canción» las aplica (apagado = idéntico a antes; **nada guardado cambia**): **fill de caja** de 4 compases (el de `varyCell('fill')`) en Entra y Drop, **solo si ya hay loop de caja** (no nacen loops ni ids; el Drop conserva sus ids), y en la **Subida** un loop de melodía con el sinte `riser` (barrido de ruido en el último compás, pos 48–62) y un `impacto` de 1 paso en la pos 63 (justo antes de caer), solo si la subida no tiene ya melodía (monofonía). Tests puros y código evaluado en Node (el ruido `pink` suena). **Sin oír.**
**Saltado (a propósito):** hat abierto cada 2 y cambio de nota del bajo cada 8 (no hay dato de «abierto» ni el bajo es un loop; habría que tocar el motor), automatización por compás de volumen/filtro, downlifter, silencio antes de caer y impacto solo en el drop (un loop se repite en cada vuelta: sonaría cada 4 compases), y las reglas en los remixes nuevos (son datos fijos).

## 9. Implementado (2026-11-16): automatización de filtro y downlifter (con «Producción» encendido)
Con las transiciones (`transitions`) de «✦ Convertir en canción»: **la Intro y «Entra» abren el filtro** vuelta a vuelta (`lpf` por vuelta: 1400→6000 Hz y 4000→14000 Hz, la mitad de lo que ya hace la Subida) y el **Final** lleva un **downlifter** (sinte nuevo `downlifter`: ruido rosa con el filtro cayendo, en el primer paso del Final). Apagado = idéntico (test). **Sin probar de oído**: el `lpenv` negativo de superdough puede sonar distinto a lo esperado; ajustar en `SYNTH_SOUND.downlifter`.
**Saltado (apuntado):** hat abierto cada 2 (exige un campo nuevo en los golpes → formato guardado) y cambio de nota del bajo cada 8 (el bajo sale del fondo, no es un loop: toca el motor); **silencio antes de caer** (la Subida ya no lleva bombo; un silencio real exigiría automatizar volumen, que no existe por célula); **platillo/impacto solo al caer el drop** (un loop se repite en cada vuelta). Ninguno cambia el reloj del motor; los tres primeros piden un dato nuevo o el motor.
