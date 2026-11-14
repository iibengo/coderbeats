# Créditos de los samples

Todos los samples de la app tienen **licencia clara** (spec 010). Cada archivo de `public/samples/<kit>/` figura aquí con su
origen; un test lo comprueba. Los kits `909` y `acoustic` venían de `tidal-drum-machines` (ritchse), que **no declara
licencia**, y se **retiraron** (fase 1): el 909 lo sustituye «Electrónico» y el acústico ya no está.

## Sonido por defecto (sin `.bank()`), como en strudel.cc · kit «Electrónico»

Del repositorio **uzu-drumkit** de tidalcycles (licencia **Unlicense**, dominio público), el kit de batería por defecto de
strudel.cc: https://github.com/tidalcycles/uzu-drumkit. Los samples son de **Switch Angel** y **Mot4i** (los nombra el
README del repositorio; el LICENSE cubre todo el repo); los `misc`, de Switch Angel y Ludens.

| Archivo | Origen (`strudel.json` de uzu-drumkit) | Índice en strudel.cc |
|---|---|---|
| `electro/bd.wav` | `bd/10_bd_switchangel.wav` | `s("bd").n(0)` |
| `electro/sd.wav` | `sd/11_sd_switchangel_3.wav` | `s("sd").n(1)` |
| `electro/hh.wav` | `hh/13_hh_switchangel.wav` | `s("hh").n(3)` |
| `default/oh.wav` | `oh/10_oh_switchangel.wav` | `s("oh").n(0)` |

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

## Kit «Vinilo» · Boochi44 (CC0)

Del repositorio **Boochi44/free-drum-samples**, kit «03 Soulful Vintage» (**CC0 1.0**; 808 bajados de calidad y *bitcrushed*):
https://github.com/Boochi44/free-drum-samples. La misma carpeta se publica como repositorio propio para strudel.cc
(`kits/coderbeats-kits/`, ver su README).

| Archivo | Origen (`drum-samples/03-soulful-vintage/…`) |
|---|---|
| `vinyl/bd.wav` | `kicks/vintage-kick-02.wav` |
| `vinyl/sd.wav` | `snares/vintage-snare-02.wav` |
| `vinyl/hh.wav` | `hi-hats/hi-hat-closed-01.wav` |
