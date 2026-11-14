# Créditos de los samples

Todos los samples vienen del repositorio **tidal-drum-machines** de ritchse (geikha):
https://github.com/ritchse/tidal-drum-machines

> **Estado (spec 010, fase 0):** el repositorio **no declara licencia**. Los kits `909` y `acoustic` de abajo **no tienen
> licencia clara** y se sustituyen en las fases 1 y 2 de la spec 010 (el 909 por uzu-drumkit; el acústico se retira). El
> **kit 808 sí es de licencia clara**: ver el apartado siguiente.

| Archivo | Origen (`machines/…`) |
|---|---|
| `909/bd.wav` | `RolandTR909/rolandtr909-bd/Bassdrum-01.wav` |
| `909/sd.wav` | `RolandTR909/rolandtr909-sd/sd01.wav` |
| `909/hh.wav` | `RolandTR909/rolandtr909-hh/hh01.wav` |
| `808/bd.wav` | `RolandTR808/rolandtr808-bd/BD0010.WAV` |
| `808/sd.wav` | `RolandTR808/rolandtr808-sd/SD0010.WAV` |
| `808/hh.wav` | `RolandTR808/rolandtr808-hh/CH.WAV` |
| `acoustic/bd.wav` | `AkaiMPC60/akaimpc60-bd/0 Bassdrum.wav` |
| `acoustic/sd.wav` | `AkaiMPC60/akaimpc60-sd/Snare 1.wav` |
| `acoustic/hh.wav` | `AkaiMPC60/akaimpc60-hh/Closed Hat.wav` |

## Sonido por defecto (sin `.bank()`), como en strudel.cc

Del repositorio **uzu-drumkit** de tidalcycles (licencia **Unlicense**, dominio público):
https://github.com/tidalcycles/uzu-drumkit

| Archivo | Origen |
|---|---|
| `default/oh.wav` | `oh/10_oh_switchangel.wav` (índice 0 de `oh` en strudel.cc) |

## Kit 808 · Michael Fischer (CC0)

Los tres archivos de `808/` son **idénticos byte a byte** (mismo SHA-256, comprobado el 2026-11-14) a los del set de
**Michael Fischer (TECHNOPOLIS)**, grabado de un Roland TR-808 real, publicado como **CC0 1.0** (dominio público):
https://github.com/tidalcycles/sounds-tr808-fischer

| Archivo | Origen en ese repositorio | SHA-256 (16 primeros) |
|---|---|---|
| `808/bd.wav` | `bd8/BD0010.WAV` | `2929f825db405543` |
| `808/sd.wav` | `sd8/SD0010.WAV` | `117e5a78df3ffa07` |
| `808/hh.wav` | `ch8/CH.WAV` | `c9f30ff2b4d73b03` |

No hace falta atribución (CC0); se menciona por cortesía. «808» y «Roland» son marcas de sus dueños y solo se usan para describir el sonido.
