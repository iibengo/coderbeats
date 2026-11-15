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
