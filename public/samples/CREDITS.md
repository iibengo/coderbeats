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

## Kit «Techno» · uzu-drumkit (Unlicense)

Del repositorio **uzu-drumkit** de tidalcycles (licencia **Unlicense**, dominio público; el `LICENSE` es el texto oficial, comprobado el 2026-11-18): https://github.com/tidalcycles/uzu-drumkit.
Autoría de los samples (la nombra el README del repositorio): **Switch Angel** (sonidos sintetizados y procesados con un compresor analógico estilo LA-76) y **Mot4i** (https://github.com/mot4i/garden).
Es la misma fuente del kit «Electrónico», con otras muestras. Solo suena en la app (el código mostrado usa los sonidos de strudel).

Cada archivo es **un solo golpe** del original, pasado a mono y **recortado** (cola con fundido de salida) y a 44,1 kHz y 16 bits, con el volumen subido hasta un pico de −1,5 dB; el charle es el mismo archivo del kit «Electrónico».

| Archivo | Origen (`uzu-drumkit`) | Recorte | SHA-256 (16 primeros) |
|---|---|---|---|
| `techno/bd.wav` | `bd/17_bd_switchangel.wav` (bombo gordo con cola) | 0,5 s | `6fc47ecaca2e1e01` |
| `techno/sd.wav` | `cp/10_cp_switchangel.wav` (la palmada hace de caja) | 0,4 s | `5578580a592b6981` |
| `techno/hh.wav` | `hh/13_hh_switchangel.wav` (idéntico a `electro/hh.wav`) | entero | `cb4eccc9840f14ff` |

## Kit «Batería» · Karoryfer Samples, Big Rusty Drums (CC0)

Batería acústica grabada, del repositorio **karoryfer.big-rusty-drums** de Karoryfer Samples, publicada como **CC0 1.0** (dominio
público): https://github.com/sfzinstruments/karoryfer.big-rusty-drums. El `LICENSE` del repositorio se comprobó a mano el 2026-11-18 y es
**idéntico, palabra por palabra, al texto legal oficial de CC0 1.0** (creativecommons.org); no hace falta atribución, se menciona por cortesía.

Cada archivo es **un solo golpe** del original (FLAC, mono, 44,1 kHz) **recortado** (cola con fundido de salida) y **subido de volumen**
hasta el pico de los otros kits, convertido a WAV de 16 bits. Es la única modificación (obra derivada permitida por CC0).

| Archivo | Origen (`Samples/…`) | Recorte | Pico | SHA-256 (16 primeros) |
|---|---|---|---|---|
| `drums/bd.wav` | `kick_24/kick/kick/k_vl10_rr1.flac` (bombo 24", micro cercano) | 0,5 s | −3,0 dB | `8707c705fe93e9a8` |
| `drums/sd.wav` | `snare_14/center/top/sn_center_vl5_rr1.flac` (caja 14", **golpe al centro**, micro de arriba) | 0,4 s | −2,5 dB | `959c3c18d2fe9ffd` |
| `drums/hh.wav` | `hihat_14/cl/cl/ht_cl_vl4_rr1.flac` (charles 14" cerrado, micro cercano) | 0,25 s | −5,0 dB | `8167214f70190028` |

## Guitarra · Karoryfer Samples, Black And Green Guitars, la **Hofner Club negra** (CC0)

Del repositorio **karoryfer.black-and-green-guitars** de Karoryfer Samples (guitarras de Brian Wood), publicado como **CC0 1.0**:
https://github.com/sfzinstruments/karoryfer.black-and-green-guitars. El `LICENSE` se comprobó a mano el 2026-11-18 y es **idéntico, palabra por
palabra, al texto oficial de CC0 1.0**; el `readme.txt` solo dice «Royalty-free for all commercial and non-commercial use» y no lo contradice.
Se usa en el sinte `guitarSample` (spec 036), nombre de muestra `hofner`: una guitarra eléctrica de caja hueca **limpia**.

Cada archivo es **una nota** (articulación `twang`, intensidad `mf`, primera toma) del original (WAV mono, 24 bits, 44,1 kHz): sin el silencio inicial,
**recortada a 0,5 s** con fundido de salida, a WAV de 16 bits y subida de volumen hasta un pico de −4 dB. El motor sube o baja la nota más cercana
(una cada 5 semitonos). Es la única modificación (obra derivada permitida por CC0).

| Archivo | Origen (`Samples/black/ord/…` del repositorio) | SHA-256 (16 primeros) |
|---|---|---|
| `guitar/e3.wav` | `Samples/black/ord/twang_e3_mf_rr1.wav` | 040eb5d0ef673c16 |
| `guitar/a3.wav` | `Samples/black/ord/twang_a3_mf_rr1.wav` | 748e117eea0de096 |
| `guitar/d4.wav` | `Samples/black/ord/twang_d4_mf_rr1.wav` | 4c86a92c21dc78f3 |
| `guitar/g4.wav` | `Samples/black/ord/twang_g4_mf_rr1.wav` | e2e506dbed661ef9 |
| `guitar/c5.wav` | `Samples/black/ord/twang_c5_mf_rr1.wav` | 2892f0ac3b974678 |
| `guitar/f5.wav` | `Samples/black/ord/twang_f5_mf_rr1.wav` | 915661a4b514241b |
| `guitar/a5.wav` | `Samples/black/ord/twang_a5_mf_rr1.wav` | 46279d66d5c8f14e |

## Kit «Vinilo» · Boochi44 (CC0)

Del repositorio **Boochi44/free-drum-samples**, kit «03 Soulful Vintage» (**CC0 1.0**; 808 bajados de calidad y *bitcrushed*):
https://github.com/Boochi44/free-drum-samples. La misma carpeta se publica como repositorio propio para strudel.cc
(`kits/coderbeats-kits/`, ver su README).

| Archivo | Origen (`drum-samples/03-soulful-vintage/…`) |
|---|---|
| `vinyl/bd.wav` | `kicks/vintage-kick-02.wav` |
| `vinyl/sd.wav` | `snares/vintage-snare-02.wav` |
| `vinyl/hh.wav` | `hi-hats/hi-hat-closed-01.wav` |
