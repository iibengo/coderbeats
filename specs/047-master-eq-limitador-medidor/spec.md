# Spec 047 · Master: EQ, limitador de pico y medidor

## Cómo estaba
`masterIn → saturador → compresor de pegamento (spec 010/042) → limitador (DynamicsCompressor −6 dB, ratio 20) → ganancia de −1 dB → salida`. Ese «limitador» es un compresor de ratio 20: **frena, pero no garantiza el techo** (un pico rápido puede pasar), y el «techo de −1 dB» era solo una ganancia fija. No había EQ.
## Qué cambia
1. **Limitador de pico de verdad** (`public/worklets/master-limiter.js`, siempre activo): lo último de la cadena, **techo −1 dBFS**, con mirada hacia delante de **1,5 ms** (el audio sale 1,5 ms retrasado y la ganancia se calcula con lo que viene: **ningún pico lo pasa, sin recortar**), suelta de 80 ms, estéreo enlazado. Por debajo del techo la ganancia es 1: sale **la misma señal exacta**. Si el worklet no carga, sigue la cadena de antes (la ganancia de −1 dB). El video exportado sale de después del limitador.
2. **EQ de salida** (`EQ_TECHNO`, **apagado por defecto**; Ajustes → Avanzado → «EQ techno», se guarda en `coderbeats:studio:v2` como `eq`): **paso alto a 30 Hz** (Q 0,707) y **realce de +2,5 dB centrado en 3,2 kHz** (Q 0,6: cubre de 2 a 5 kHz). Va **antes** del limitador (los realces los frena él). Apagado, solo pasa el camino «seco»: **la señal exacta de siempre** (seco y mojado en paralelo, con un fundido de 15 ms al cambiar).
3. **Medidor** (Ajustes → Avanzado, `MasterMeter.vue`): pico (con retención de 1,5 s), nivel medio y marcas en −6 y −1 dB (verde / ámbar / rojo); avisa cerca del techo. Solo está conectado mientras la hoja está abierta (un `AnalyserNode` leído cada 80 ms): sin coste el resto del tiempo.
## Lo que se ha medido (Chrome sin pantalla, no es oído)
- **EQ, con ruido blanco estable a la entrada:** encendido − apagado: **brillo 2–5 kHz +2,3 dB**, cuerpo 80–200 Hz +0,4 dB, **subgrave 10–25 Hz −8 dB**. Respuesta teórica de los biquads (test): −3 dB en 30 Hz, <1 dB de cambio a 50 Hz y +1,5 a +2,5 dB de 2 a 5 kHz.
- **Limitador:** el worklet solo, en un `AudioWorklet` real, con +9,5 dB a la entrada: pico de salida **−1,000 dBFS**; en la cadena entera, con +18 dB a la entrada, la salida llega a −3,5 dBFS (el compresor de antes ya frena casi todo; el de pico es la red de seguridad).
## Qué cambia en lo que suena
- **Limitador de pico (siempre):** solo si algo pasa de −1 dBFS; si no, la misma señal con **1,5 ms más de retraso** (no cambia la calibración del micro de forma apreciable: el de antes, un DynamicsCompressor, ya traía unos 6 ms y la prueba de eco mide la cadena entera).
- **EQ:** nada hasta que se enciende; encendido, afecta a todo lo que suena (Mis canciones, remixes, Laboratorio).
## Principios
2 ✔ (la red de seguridad contra el recorte) · 5 ✔ · 7 ⚠ sin probar con gente · 8 ✔. **Sin comprobar:** de oído (si +2,5 dB hacia 3 kHz es demasiado brillo con el kit Techno y el compresor techno encendidos; si cortar a 30 Hz se nota en el bombo), el medidor en el iPhone, el coste de CPU del limitador con mirada (barrido de 73 muestras por muestra: ~7 millones de operaciones por segundo estéreo, poco para un iPhone pero sin medir ahí).
