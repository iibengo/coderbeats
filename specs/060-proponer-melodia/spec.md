# Spec 060 · «Proponer una melodía» en la parte, y la melodía fantasma apagada por defecto (corta)

## Por qué
La melodía sugerida (spec 012) sonaba sola, en fantasma, en cuanto había un ritmo, y venía encendida. Quien no conoce la app no sabe de dónde sale ni cómo pararla; rompe el principio 4 (la app nunca toca sola sin que se note el gesto). Ion propuso (2026-11-25) llevarla a «Parte» como una capa que se pueda editar.

## Qué cambia
- **«Sugerencias» apagado por defecto** (`useAudioEngine.ts`, `usePrefs.ts`). Quien ya lo tenga guardado conserva su valor. Se enciende en ajustes («⋯» → «Sugerencias»).
- **«Proponer una melodía»** en la capa de melodía de «Parte» (`PartPanel.vue`), solo mientras está vacía: genera la melodía con `suggestMelody` a partir del ritmo de la parte, el estilo y el tempo, y la **añade como capa normal** (`commitMelody`): suena, se edita con el Órgano, se silencia o se borra. Sin ritmo en la parte, dice que primero hace falta uno. La secuencia es la fija de siempre (`suggestSeeds`).
- **«editar» recoge la fantasma:** si suena una melodía sugerida y la parte aún no tiene capa de melodía, al pulsar «editar» pasa a ser la capa y el Órgano la enseña (antes salía vacío; Ion, 2026-11-25).
- Motor: `proposeMelody(next?)`, junto a `commitMelody`. No toca el reloj.

## Principios
1 ✔ un botón, una cosa · 2 ✔ escala y estilo del estilo · 3 ✔ suena en el siguiente compás · 4 ✔ nunca sola: se pide · 5 ✔ una capa, dentro del límite de 4 · 6 ✔ · 7 ⚠ precedente: «melodía sugerida» de Song Maker/GarageBand; sin probar con alguien que no conozca la app · 8 ✔ la fantasma deja de sonar sola (no se borra su código).

## Decisiones a revisar
- Falta «otra melodía» (`proposeMelody(true)` ya existe, sin botón): con la capa creada, el botón desaparece.
- La melodía fantasma sigue existiendo en el motor, apagada.

## No comprobado
Solo con navegador sin pantalla (la capa aparece con 18 notas). **No oído y no visto en un iPhone.**
