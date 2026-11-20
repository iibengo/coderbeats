# Spec 053 · Korobeiniki en techno, con arreglo propio (corta)

## Por qué
Ion pidió rehacer «la canción de Tetris» con la receta del Lacrimosa, **con arreglo propio y que no se parezca al original** (2026-11-20). La melodía es **Korobeiniki**, una canción popular rusa del siglo XIX (dominio público). El arreglo de Tetris (Nintendo, 1989) **tiene derechos**: no se copia ni se nombra. Solo se usa la melodía popular.

## Qué es
Se **reemplaza** el remix `korobeiniki-techno` (mismo id, para que lo guardado siga abriendo): estilo `techno2` (el techno actual; `techno` es solo para lo ya guardado), kit `electro`, Do menor, 132 bpm.
- **8 partes, 64 compases ≈ 1 min 56 s:** Intro 4 · Estrofa 8 · Subida 4 · Drop 16 · Break 8 · Puente 4 · Drop 2 16 · Final 4 (las vueltas solo pueden ser 1, 2, 4, 8, 16 o 32).
- **Lo propio (`app/lib/korobeiniki.ts`):** el tema **no va de seguido**: gancho de dos compases y aire (intro, puente, final), tema **picado** (staccato: techno, no ligado) en la estrofa y el drop, segunda frase **ligada** en la subida y el break, y en el drop 2 **las dos frases mezcladas**. El **bajo late a contratiempo** (pasos 2, 6, 10 y 14, entre los bombos) sobre Do – Do – La♭ – Si♭; los **acordes son stabs sincopados** (pasos 6 y 14). Ritmo: bombo a cuatro, caja en el 4 y el charles del estilo, con la subida, el riser y el puente en casi silencio como el Lacrimosa.
- Fuerza por parte (0 / 0,35 / 0,6 / 1) para que el drop dé un salto. El fondo del estilo va apagado (el bajo y los acordes son los nuestros).

## Principios
1 ✔ nada cambia en la pantalla · 2 ✔ todo en Do menor natural (test) y al compás · 3 ✔ no toca el motor · 4 ✔ se actúa con las mismas partes · 5 ✔ 4 capas como mucho por parte · 6 ✔ igual que los demás remixes · 7 ✔ misma receta que el Lacrimosa · 8 ✔ **se quita** la versión antigua de 5 partes y 1 min; no se añade ninguna.

## Derechos
Melodía popular (dominio público), escrita como notas, sin grabaciones ni arreglos modernos. El arreglo (bajo, acordes, ritmo, fraseo, forma) es de coderbeats. No se llama «Tetris». Las notas son **de memoria** (`unverified`): revisar con una partitura de dominio público.

## Decisiones a revisar
- `techno2` y no `techno` (el viejo está marcado `legacy`).
- Los stabs y el bajo son sencillos a propósito; si suena soso, se añade un arpegio.
- Si el gancho de 2 compases y aire se queda corto como intro.
- **Sin oír.** Ni el picado del tema, ni el bajo a contratiempo con el `sub`, ni el salto del drop.
