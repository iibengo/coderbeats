# Spec 026 · «Zoom infinito» para ver una canción (propuesta, sin programar)

Leído antes de escribirla: `docs/investigacion-instrumentos.md`, `PRINCIPIOS.md`, `DISENO.md`. Reutiliza ideas que ya existen en el Estudio (`lib/aro/transition.ts`: cámara que viaja entre células; `lib/aro/colony.ts`: profundidad y zoom) pero **no** su código de dibujo: el Laboratorio dibuja en un lienzo 2D simple (`LabStage`).

## 1. La idea
Cada **parte** del remix es una **gota** (círculo). Dentro de la gota que suena se ve, **pequeña, la siguiente**; dentro de esa, más tenue, la siguiente (máx. 3 niveles). Al pulsar una parte (o la gota pequeña) la cámara **se zambulle** en ella: la pequeña crece hasta ser la grande, la que había se desvanece por fuera y aparece una nueva pequeña dentro. **La última parte contiene a la primera**: al zambullirte en ella vuelves al principio (muñecas rusas / Zoomquilt).

## 2. Dónde
- **Remixes del Laboratorio (principal):** el escenario muestra la gota de la parte que suena (con sus capas como ahora) y, en el centro, la gota pequeña de la siguiente. Los botones de las partes se quedan (acceso directo a cualquiera); pulsar una = zambullirse en ella. Si no es la siguiente, el zoom atraviesa las intermedias **en un solo movimiento** (≤ 1 compás).
- **Vídeo («Mi vídeo»):** como el vídeo graba el lienzo, **el zoom sale solo en el vídeo**: se ve la estructura del remix como un viaje. No hay que programar nada aparte.
- **Estudio:** la **lista de partes se queda** (para editar hay que ver todas a la vez). Como mucho, el zoom como **transición corta (≈ 400 ms) al entrar a editar una parte** desde ✎ Parte; nunca como navegación.

## 3. Cómo se mueve
- **Sincronizado con el compás:** el movimiento **empieza al tocar** (respuesta inmediata) y **termina justo en la línea de compás** en la que entra la parte (como ya entra el sonido). Duración = lo que falte hasta esa línea (entre ≈ 0,3 y 1 compás; si falta menos de 0,3 s, se alarga al compás siguiente solo para la imagen, no para el sonido).
- Interpolación: escala exponencial (la cámara «cae» a velocidad percibida constante), `k = e^(t·ln R)` con R = radio exterior / radio de la gota pequeña (≈ 4).
- La aguja (una) siempre en la gota grande; al zambullirse se «hereda» su fase para que no salte.

## 4. Dibujo y color (DISENO.md)
- Las partes **no tienen color**: contorno blanco, opacidad por nivel (1 · .45 · .2); la que suena, brillante; la que va a entrar parpadea (ya hecho).
- Capas: sus círculos de instrumento (color propio) solo en la gota que suena. Las gotas anidadas son **solo contorno** (sin relleno) para no competir.
- **Texto ≥ 11 px reales** (`fontPx`): solo se escribe el nombre de la parte que suena y de la siguiente (a tamaño normal, **fuera** de la gota pequeña, no escalado con ella). Las gotas del 2.º y 3.er nivel no llevan texto.
- Zona de toque: la gota pequeña mide ≈ 150 unidades de lienzo ≈ **80 px reales** (≥ 44) → es tocable. Los niveles 2–3 son decorativos (no tocables).

## 5. Rendimiento (iPhone) y movimiento reducido
- Solo **círculos y trazos** (sin sombras, sin desenfoques, sin imágenes), como mucho **4 círculos + 3 anillos** por frame; sin asignar objetos en el bucle; un solo `requestAnimationFrame` (ya lo hay).
- **Vigilante:** el Laboratorio no tiene frameGovernor; se añade uno mínimo: si el p95 pasa de 14 ms, baja a 2 niveles y luego a 1 (sin anidar), como `lib/frameGovernor.ts`.
- **Movimiento reducido** (`prefers-reduced-motion`): **sin zoom**; al cambiar de parte, **fundido de 160 ms** entre la gota que se va y la que entra (como ya hace `transitionAt(reduced)`); las gotas anidadas se ven **quietas** (sin respirar).
- El vídeo con movimiento reducido sale con fundidos, no con zoom (se respeta la preferencia de quien graba).

## 6. Cumple PRINCIPIOS.md
1. **Una pantalla, una cosa:** ⚠ el escenario ya muestra capas; añadir gotas anidadas es más. Mitigación: nivel 1 y 2 solo contorno; si en pruebas lía, **las capas pasan a puntos en el borde de la gota** (variante B).
2. **No puede sonar mal:** no cambia el sonido. ✔
3. **Respuesta inmediata:** el zoom **arranca al tocar** y aterriza en la línea de compás. ✔
4. **Se siente tuyo:** zambullirse es **decisión tuya** (nada avanza solo). En el vídeo se reproduce lo que tú hiciste. ✔
5. **Pocas cosas a la vez:** ⚠ máx. 3 niveles, los viejos se desvanecen; 1 nivel con el vigilante. 
6. **Compartir:** gana mucho (el vídeo es un viaje por la estructura). ✔
7. **Precedente:** ⚠ **débil.** Zoomquilt / vídeos de zoom infinito y los fractales prueban el *efecto visual* (virales), pero **no hay una app musical conocida que navegue así**: hay que probarlo **con alguien que no conozca la app** antes de darlo por bueno (como pide el principio).
8. **Quitar antes de añadir:** ⚠ añade. Compensa si **sustituye** el «mapa de células/colonia» del Estudio (ya escondido) y si en el Laboratorio **sustituye el círculo central y el nombre de la parte** (que hoy ocupan ese sitio). Si no, no entra.

## 7. Fases (cada una, un commit, tras tu visto bueno)
1. **Geometría pura y tests** (`lib/zoomStack.ts`): posiciones, escala y opacidad por nivel; cierre de la última a la primera; interpolación exponencial; vigilante (niveles). Sin tocar pantallas.
2. **Prototipo en Remixes** detrás de un interruptor «Zoom» (apagado por defecto), con movimiento reducido y fundido.
3. **Medir en iPhone** (fps, p95) y probar con alguien nuevo. Si no cumple, se descarta.
4. **Vídeo:** comprobar que sale tal cual (no requiere código) y la variante con movimiento reducido.
5. **Estudio:** transición corta al entrar a editar (solo si 3 sale bien).

## 8. Riesgos
- Que el zoom **marée** o **tape** los círculos de capas (sobre todo con 8 partes): se prueba la variante B.
- Rendimiento en iPhone antiguo con el vídeo grabando a la vez (copia de lienzo por frame): sin probar hasta tenerlo en un móvil.
- El «bucle infinito» exige que la última parte «contenga» a la primera: con remixes de 1 parte se ve una sola gota (sin zoom).
