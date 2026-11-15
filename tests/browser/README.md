# Pruebas con el navegador (a mano, no entran en `npm test`)

Chrome sin pantalla con un micro de mentira (un pitido): comprueban la interfaz de verdad, **sin audio que se pueda oír**.

```
npm i --no-save puppeteer-core      # (no es dependencia del proyecto)
npx nuxt dev --port 3999 &          # el servidor de desarrollo
node tests/browser/piloto.mjs       # (el resto, igual)
```

`lib.mjs` abre la app con una calibración de mentira guardada en un perfil limpio (no toca tu navegador) y deja `window.__engine` (solo en desarrollo) para mirar el estado.
Ojo: el pitido del micro de mentira se clasifica como «bombo» y puede colar algún golpe de más en las pruebas de los loops.
