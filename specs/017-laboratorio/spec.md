# 017 · Laboratorio (la nueva entrada de coderbeats)

Estado: en curso. Sustituye a la spec 016 (portada), que queda **pausada** (código y spec intactos, fuera del arranque).

## 1. Por qué
La app creció demasiado: pasan muchas cosas a la vez y la premisa «no puedes sonar mal» no se cumple. El prototipo `docs/laboratorio-prototipo.html` (Capas · Piano mágico · Coro · Círculo de ritmo) lo hace bien porque **cada pantalla hace una sola cosa**.

## 2. Qué es
- Al abrir coderbeats (`/`) se entra al **Laboratorio** (`/lab`). Sin micro, sin células, sin guardado.
- Cuatro pantallas, una cosa cada una, con el motor (Strudel), los estilos y los kits de siempre:
  1. **Capas**: base que suena; tocas los círculos para encender/apagar bombo, caja, platillo, bajo, acordes, melodía. Empieza con bombo+caja+platillo. Dentro, un panel **DJ** (filtro/eco con el dedo, platillo, subida, drop).
  2. **Piano mágico**: cada toque, la siguiente nota de una melodía de la biblioteca que **encaja con el estilo**; tú marcas el ritmo.
  3. **Coro**: arrastras una voz (arriba agudo, abajo grave) y otras dos **armonizan** dentro de la escala del estilo; el lado = brillo.
  4. **Círculo de ritmo**: tocas los anillos para poner/quitar golpes; cada instrumento forma su figura. Dentro, modo **Ruedas**: arrastrar alrededor de un anillo cambia cuántos golpes tiene (reparto euclídeo; «exacto» = polirritmo, 3 contra 4).
- **Mando** (Gamepad API): entrada opcional en Capas, Piano y Círculo.
- Todas: fondo negro, colores de la paleta, **aguja girando** con el compás, **una onda en cada toque**, selector de estilo, ▶/■ que **para todo**, y una frase de cómo se toca.
- Que todo encaje: las melodías salen de `tunesFor(estilo)` (nada fuera de la escala del estilo); la base es la demo del estilo; sin capas de más (Coro y Piano solo llevan lo mínimo).

## 3. El Estudio
- La app actual pasa a llamarse **Estudio**, en `/estudio`, **congelada** (nada nuevo): Mis canciones, células, grupos, Jugar/Componer, dembow, remixes, demos, Escenario, voz, Previsualizar y vídeo siguen igual.
- Se llega con un botón discreto «Estudio» en el menú del Laboratorio. Los enlaces compartidos (`/#…`) siguen abriendo el Estudio.
- Lo guardado no se toca. La preferencia `coderbeats:ui:v1` **se lee tal cual y no se reescribe**: el arranque ya no depende de ella (siempre Laboratorio).
- Etiqueta de git `estudio-v1` marca el estado anterior.

## 4. Motor y interfaz
`app/engine/index.ts` es la **frontera**: lo reutilizable (audio, estilos, kits, melodías, biblioteca/guardado, vídeo, compartir). El Laboratorio solo importa de ahí. Un test impide que el Laboratorio importe componentes del Estudio. (No se movieron archivos: se fija la frontera por contrato para no arriesgar el motor.)

## 5. Notas al probar `/lab` (antes de este cambio)
- El audio solo arranca con un gesto: el menú lo da (un toque abre la pantalla).
- `/lab` no puede renderizarse en servidor (el motor usa el navegador): `routeRules` lo marca.
- Todo lo que suena está sin probar de oído (platillo/subida del DJ, armonías del Coro).

## 6. Pendiente / fuera
Probar de oído y en iPhone; vídeo y guardado desde el Laboratorio (más adelante, por la frontera del motor).
