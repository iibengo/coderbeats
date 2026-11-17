# coderbeats-kits

Samples de batería de [coderbeats](https://github.com/iibengo/coderbeats) para que el **código que muestra la app suene igual
en [strudel.cc](https://strudel.cc)**. Todos son de dominio público (**CC0 1.0**, ver `LICENSE`).

```js
samples('github:iibengo/coderbeats-kits/v1')
s("bd ~ ~ ~ bd ~ ~ ~").bank("Vinyl")
```

## Kit `Drums` (batería acústica, etiqueta `v2`)

De [Karoryfer Samples · Big Rusty Drums](https://github.com/sfzinstruments/karoryfer.big-rusty-drums) (**CC0 1.0**): un golpe recortado de bombo, caja (al centro) y charles cerrado. Detalle en `public/samples/CREDITS.md` de coderbeats.

```js
samples('github:iibengo/coderbeats-kits/v2')
s("bd ~ sd ~").bank("Drums")
```

## Guitarra `hofner` (etiqueta `v2`)

7 notas sueltas (e3 a3 d4 g4 c5 f5 a5) de la Hofner Club de [Black And Green Guitars](https://github.com/sfzinstruments/karoryfer.black-and-green-guitars) (Karoryfer, **CC0 1.0**), recortadas a 0,5 s. Detalle y SHA en `public/samples/CREDITS.md` de coderbeats.

```js
samples('github:iibengo/coderbeats-kits/v2')
note("e3 a3 d4").s("hofner")
```

La etiqueta `v2` lleva `Vinyl`, `Drums` y `hofner`; la `v1` (solo `Vinyl`) no se mueve.

## Kit `Vinyl` (hip hop con sabor a vinilo)

Del kit «03 Soulful Vintage» de [Boochi44/free-drum-samples](https://github.com/Boochi44/free-drum-samples) (**CC0 1.0**): 808
bajados de calidad y *bitcrushed* para que suenen a SP-1200/MPC.

| Archivo | Origen (`drum-samples/03-soulful-vintage/…`) |
|---|---|
| `vinyl/bd.wav` | `kicks/vintage-kick-02.wav` |
| `vinyl/sd.wav` | `snares/vintage-snare-02.wav` |
| `vinyl/hh.wav` | `hi-hats/hi-hat-closed-01.wav` |

Las etiquetas (`v1`) no se mueven: lo que ya se copió a strudel.cc seguirá sonando igual.

> Esta carpeta vive dentro del repositorio de coderbeats (`kits/coderbeats-kits/`) y está pensada para publicarse **como su
> propio repositorio público** (`iibengo/coderbeats-kits`, etiqueta `v1`); la app lleva además una copia en `public/samples/vinyl/`.
