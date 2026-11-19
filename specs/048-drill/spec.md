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
- **Fuente:** partitura completa de Breitkopf & Härtel (IMSLP n.º 26746, escaneada; espejo en Wikimedia Commons, dominio público), página «7. Lacrymosa etc.». IMSLP pide verificación humana (captcha) para descargar, así que se usó el espejo de Commons. No se saltó ninguna protección.
- **Violín I (compases 1–2, el «suspiro»):** coincide **nota a nota** con el MIDI de Commons («Mozart's Lacrimosa full.mid») y con la imagen.
- **Canto (compases 3–4):** leído de la imagen midiendo la posición de cada cabeza contra el pentagrama (clave de do en primera): la4 larga, fa5, re5, re5 larga, do♯5; dos veces. El compás 5 (re4 mi4 fa4 sol4) **no se ha usado**: el último sol4 quedó dudoso por la lectura.
- **12/8 → 4/4:** un compás de 12/8 son 2 de 4/4 a 140 bpm (medio tiempo); una corchea de 12/8 dura 8/3 de paso (tercios de paso, spec 028 §3). Comprobado evaluando el código Strudel: las notas caen en 1/6, 2/6, 4/6, 5/6… de cada compás.
- **Estructura:** 7 partes (Intro 4 · Estrofa 4 · Subida 4 · Drop 8 · Break 4 · Drop 2 8 · Final 4): el suspiro (una octava más grave, para el sinte) en la intro y el drop, y el canto en la subida, el segundo drop y el final.

## Sin hacer (apuntado)
- **Hi-hats con tresillos y rolls:** la rejilla es de 16 pasos por compás; no está comprobado que el motor admita subdivisiones dentro de un paso. Hoy, platillo roto sin rolls.
- **808 con deslizamiento (portamento):** el `penv` de las variantes de melodía existe, pero no se ha probado en el bajo. Hoy, el 808 no se desliza.
- **Sin oír.** Ni el ritmo, ni el 808, ni los stabs se han oído ni visto en un móvil.
