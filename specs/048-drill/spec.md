# Spec 048 · Drill como estilo (corta)

## Por qué
Hay una moda de versiones «classical drill» (melodías clásicas sobre un ritmo de drill). Para que el Laboratorio y el Estudio puedan sonar así falta el estilo. Se añade **uno más** (de 6 a 7), siguiendo el precedente de la spec 032 (reggaetón). El tema es el **Lacrimosa de Mozart** (Requiem, 1791, dominio público), copiado de una partitura (ver «El Lacrimosa»).

## Qué es
- **Drill (UK), 140 bpm, re menor, kit 808.** Medio tiempo: **la caja cae solo en el tiempo 3** (paso 8), bombo escaso y desplazado (pasos 0, 6 y 11), platillo **roto** (golpes y huecos, sin corcheas seguidas).
- **Bajo 808 grave** (sine, largo): re – si♭ – sol – la, un golpe largo y otro corto a contratiempo por compás. **Acordes** Dm – B♭ – Gm – Am, stabs cortos y oscuros.
- Escala de re menor natural (re mi fa sol la si♭ do). Todo dentro de ella: no puede sonar mal.
- Su demo, su plantilla de canción (Intro 4 · Entra 4 · Subida 4 · Drop 8 · Final 4), sus rótulos de capa, su densidad de melodía y las melodías de dominio público que le pegan (Habanera, Himno de la alegría, Sinfonía n.º 40).
- **No cambia nada de lo guardado:** es un id nuevo (`drill`). Una versión anterior que reciba una canción drill no la abre (no la borra), como con cualquier estilo desconocido.

## Cumple PRINCIPIOS.md
1 ✔ una pantalla, una cosa (es un estilo más en la lista) · 2 ✔ escala de re menor y acordes del estilo · 3 ✔ nada cambia en la respuesta · 4 ✔ la persona sigue tocando · 5 ⚠ 7 estilos en la lista; se acepta porque suena distinto · 6 ✔ no cambia · 7 ✔ precedente: la moda «classical drill» (vídeos y listas) y la spec 032 · 8 ⚠ se añade un estilo; no se quita ninguno.

## El Lacrimosa (remix `lacrimosa-drill`)
- **Corrección (2026-11-19):** la primera versión usó un MIDI de Wikimedia Commons que **no era el principio**, sino el **final** del Lacrimosa (los compases con las trompas de basset y el violín en registro agudo); las notas del «suspiro» estaban mal. Se rehizo entera.
- **Fuente de las notas:** el MIDI «K626 Requiem 07 Lacrimosa» (secuenciado por D. Viens, 1997; BitMidi), que trae todas las voces. El archivo **no está en el repo**: `app/lib/lacrimosa.ts` solo lleva los números de nota de cinco voces (violín I, violín II, viola, contrabajo y soprano) de los 18 primeros compases de 12/8.
- **Contrastado con la partitura** de Breitkopf & Härtel (IMSLP n.º 26746; IMSLP pide captcha, así que se usó el espejo de Wikimedia Commons, sin saltar ninguna protección), midiendo la posición de cada cabeza contra el pentagrama: las **16 notas del violín I de los compases 1–2** y el **soprano de los compases 3–5** coinciden. **El resto no está contrastado** (es la secuencia tal cual).
- **12/8 → 4/4:** un compás de 12/8 son 2 de 4/4 a 140 bpm (medio tiempo); una corchea de 12/8 dura 8/3 de paso (tercios de paso, spec 028 §3).
- **Arreglo, como un tema de techno minimal** (pedido de Ion): no se toca la melodía entera de seguido; se juega con **cuatro trozos** de 2 compases de 12/8 (un loop de 4 compases cada uno, con su bajo y sus acordes): el **gancho** (el «suspiro» de los violines: abre y cierra), **el tema** («La-cry-mo-sa»: vuelve en cada drop, 8 compases), **la escalera** (el break) y **la subida** (soprano cromático: **cambia la melodía antes del drop**). Partes: Intro 4 · Estrofa 4 · Subida 4 · Drop 8 · Break 4 · Puente 4 · Drop 2 8 · Final 4 = 40 compases ≈ 1 min 8 s.
- **Sonido más preciso:** tema con `lead` (ataque inmediato), acordes con `keys` y bajo con `sub` (el 808); se quitó el `pad` de ataque lento y mucha reverb, que emborronaba las notas de 0,29 s. El fondo del estilo va apagado: la armonía es la de Mozart.

## Batería drill, redobles y 808 (hecho)
- **Batería como en los vídeos** (`DRILL` en `labRemixes.ts`, 4 compases): bombo desplazado, **caja solo en el tiempo 3** con un redoble al final del compás 4, y un **charles en chorro**: semicorcheas seguidas que se paran (la demo del estilo lo lleva también), con **ráfagas de tresillos** en los huecos (3, 6, 3 y 9 golpes).
- **Redobles de tresillos:** sinte de muestra `hat` (el charles del kit 808, CC0, ya registrado con el kit; sin archivo nuevo). La batería sigue a una casilla por paso, así que los tresillos van como loop aparte, igual que la percusión del minimal (spec 045). Comprobado evaluando el código Strudel: cada golpe cae en su doceavo de paso.
- **808 que se desliza:** (1) el del fondo del estilo: `BassNote.slide` → `penv` con la misma estructura que el patrón de notas; (2) el sinte `sub` (808 de seno) de los loops de melodía: cada nota **pegada a la anterior** parte de la altura de la anterior (`subSlide`, `penv`, 0,15 s). Los demás estilos y sintes, código idéntico (tests).
- **808 más agudo** (49–73 Hz) en el fondo del estilo: `d1`, `bb0` y `a0` (22–37 Hz) no se oyen en un móvil.

## Sin hacer (apuntado)
- Los redobles de tresillos solo van en el remix Lacrimosa; el drill «a secas» del Círculo de ritmo lleva el chorro de semicorcheas, sin tresillos.
- Contrastar con la partitura el resto de compases (del 5 en adelante y las demás voces) y ampliar el remix a más compases.
- **Sin oír.** Ni el ritmo, ni los tresillos, ni el deslizamiento (¿portamento o «bloop»?), ni el nivel del charles `hat` (gain 0,5) ni del 808 `sub`, ni si el arreglo suena «a minimal».
