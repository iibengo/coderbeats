# 009 · El wowo en el motor (`wowPlan`)

> Estado: **implementado y probado en los tests** (2026-11-14). Falta probarlo de oído en el navegador y el móvil.
> Parte de: 008 §5 (filtro por vuelta, `Cell.lpf`), 008 §9 (segundo remix y `Cell.wow`), 002 §17 (variantes de sonido).

## 1. Idea

Que una célula suene **como en strudel.cc**: con el filtro por vuelta y el wowo (resonancia + envolvente, `lpq`/`lpenv`)
**abriéndose en cada golpe**. En el código mostrado ya es Strudel puro; en el motor no podía serlo y esta spec cuenta cómo
se hace.

## 2. El problema

El filtro de una célula va **después de su `stack`** (`.lpf("<…>")` + `.filterHaps(...)`), y dentro de los haps de un
`stack`:

1. el `lpenv` **no se interpola**: los haps "abrirían" el filtro, uno por golpe, no la vuelta (con la célula ya
   enmascarada por el `filterHaps`, el arranque de la envolvente se queda en cada golpe y el filtro salta);
2. `filterHaps` saca el hap **sin color** en un `stack`: no se puede usar el color para llegar a un `ctx` propio de la
   célula y, aunque se llegara, el filtro de un `ctx` no se puede programar después (el `lpf` ya se aplicó).

## 3. Cómo se hace

**En el código del motor** (`songCode` con `'engine'`):

- los haps de una célula con wowo llevan `color("w<id>")` (`cellTail`): el color es el **id de la célula** (el bus);
- la canción lleva una línea de plan (en un comentario: el motor no deja llamar a funciones que no son de Strudel) y, delante,
  el **preludio** `lib/wowPrelude.ts` con `wowPlan` (ver §4).

**En el motor** (`useAudioEngine`):

1. **Al evaluar** (`reevaluate` y el arranque) se concatena el preludio y se deja en `globalThis.__cbWowo` la función de
   enganche. El código de siempre no llama a `wowPlan`, así que no se engancha nada.
2. **`wowPlan(plan, marks)`** calcula los compases en los que cambia el filtro de cada célula (la primera vuelta de cada
   tramo y cada vez que el `lpf` cambia respecto de la última vuelta de esa célula; la misma cuenta que `cellLpf`, con
   el compás global del arrange del motor), llama a `__cbWowo(cambios)` y borra la función.
3. **La compuerta** (`mountWowo`): por cada célula con wowo, un `BiquadFilterNode` **en serie en su bus**
   (`controller.getBus(id)`), que alimenta la salida de superdough (la que ya pasa por el limitador maestro). Arranca
   abierto y, cada 120 ms, va programando los cambios que caen en los próximos compases (el reloj: `cps` del scheduler
   y el compás global del pulso), con el `lpf` de la vuelta y la envolvente (`lpa` → `value · 2^lpenv` → `lpd` →
   `value`), y la resonancia (`Q`). Entre cambio y cambio, el nodo no se toca.
4. **Al parar** se desmontan las compuertas (el bus vuelve a ir directo) y se olvida el enganche.

## 4. Límites y decisiones

- **Como mucho 4 células con wowo** por canción (los cuatro colores `w0`…`w3`, el de su orden en la lista de células).
- **Los buses `w<id>` son extra** en la salida: no entran en los orbits ni en el `djf` de la pantalla; el limitador
  maestro sí.
- **El bajo y los acordes del fondo no llevan wowo** (son de su propio orbit); **el wowo solo lo lleva la melodía de la célula**: el bombo, la caja y los platillos van por fuera (008 §10).
- **Grupos en paralelo:** solo cuentan las células de la canción en la línea de tiempo del wowo (§9 del remix). Un grupo
  con wowo queda para cuando se sepa cuándo lo enciende la canción.
- **Copiar a strudel.cc** lleva el wowo del código mostrado (Strudel puro); el código del motor no se copia.

## 5. Cómo se comprueba

- `tests/unit/wowo.test.ts`: el preludio no engancha sin el motor; con el motor le pasa los compases de cambio de cada
  célula (primera vuelta y cambios de `lpf`); el código del remix con el preludio delante evalúa sin error.
- `tests/unit/techno.test.ts`: el plan del motor (bus, controles y `lpf` por vuelta) y la marca por compás.
- `tests/unit/cellLpf.test.ts`: sin wowo el motor sigue con el `lpf` de la célula y el `filterHaps` de siempre.
- **Pendiente:** escucharlo en la app (Chrome y móvil) abriendo el remix «Dies Irae» y comprobando que el barrido va
  en el tiempo de cada vuelta y no en los golpes.
