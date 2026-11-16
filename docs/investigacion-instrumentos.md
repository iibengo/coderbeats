# Investigación: formas fáciles de hacer música que ya han funcionado

Resumen de la investigación del 16/11/2026 que dio origen a `laboratorio-prototipo.html`. Las cifras vienen de webs oficiales, tiendas de apps o prensa; las que son autodeclaradas lo pone.

## Conclusiones

1. Lo que más funciona es **restringir para que todo suene bien** (escala bloqueada, loops al compás, sonidos que conviven) y que **cada gesto dé una respuesta de sonido e imagen al instante**.
2. La **sensación de autoría** separa el éxito del fracaso: la persona tiene que decidir algo (cuándo, qué capa, qué altura), aunque la app garantice que suene bien.
3. **Compartir** (enlace o vídeo) es lo que convierte un juguete en algo que la gente enseña.
4. Lo que fracasa: la app que toca sola sin que sientas que es tuyo, no poder guardar ni compartir, y mezclas que chocan entre sí.
5. Lección propia (de la app actual): aunque cada nota encaje, **si pasan demasiadas cosas a la vez, se lía**. Cada pantalla hace una sola cosa.

## Precedentes de cada instrumento del laboratorio

| Instrumento | Precedente | Evidencia | Qué copiar |
|---|---|---|---|
| Capas | Incredibox, Groovepad | Incredibox: más de 106 M de jugadores en la demo web y 3,3 M de descargas. Groovepad: más de 100 M de descargas | Capas al compás que nunca chocan, feedback visual, combos que desbloquean algo (un "modo secreto", como en el mod Sprunki) |
| Piano mágico | Magic Piano (Smule) | Más de 50 M de descargas en Google Play | El dedo decide *cuándo*, la app decide *qué nota*. Que el jugador controle de verdad el ritmo y la intensidad, con melodías muy reconocibles (lección de Wii Music) |
| Coro | Bebot, Blob Opera (Google) | Bebot lo usan músicos en directo; Blob Opera fue un éxito viral (cifras de usuarios autodeclaradas) | Escala bloqueada: nunca hay nota mala. Mueves una voz y las otras armonizan solas |
| Círculo de ritmo | Groove Pizza (NYU) | Usado en educación ("millones", según su creador, dato autodeclarado) | Cada instrumento forma un polígono; presets de formas por estilo; girar desplaza el ritmo |
| DJ | Pocket Operator (efectos punch-in) | Casi un millón de unidades (dato de la empresa) | Mejor como control dentro de Capas (mantener = efecto, soltar = drop) que como pantalla aparte |
| Ruedas euclidianas | Groove Pizzeria (tesis de NYU) | Evidencia débil para público general | Mejor como deslizador "número de golpes" dentro del Círculo |
| Mando de consola | Juegos de ritmo con mando | Débil como instrumento propio | Entrada opcional (Gamepad API) para otras pantallas |

## Lo que fracasó (para no repetirlo)

- **Wii Music**: poca sensación de control; unos 2,7 M de copias frente a unos 37 M de Mario Kart Wii.
- **Electroplankton**: muy bonito, pero sin guardar ni compartir; la novedad se agota.
- **Fuser** y **DropMix**: mezclas que chocaban y licencias; se retiraron.
- **Bloom**: al principio la gente toca sin parar y llena la pantalla; hay que limitar voces o hacer que se desvanezcan.

## Ideas probadas para añadir más adelante (sin micrófono)

- **Pantalla tipo Patatap**: tocar cualquier zona da un sonido y una forma animada; cambiar de paleta cambia el kit.
- **Cuadrícula tipo Song Maker** con el estado guardado en la URL para compartir sin servidor.
- **Tiras de acordes con autoplay** (como GarageBand): tocar un acorde lanza un patrón que encaja.

## Recomendación

Empezar por **Capas (con efectos de DJ dentro), Piano mágico, Coro y Círculo de ritmo**, con un botón de **compartir** (enlace o vídeo) desde el principio. Probar con personas que no sepan música antes de añadir nada.
