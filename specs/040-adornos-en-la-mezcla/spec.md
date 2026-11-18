# Spec 040 · Los adornos no cuentan en el reparto del volumen

## Problema
`loopGains` (`app/lib/mix.ts`) reparte el volumen entre todos los loops activos con 1/√n. Una parte con 8 loops (bombo, caja, charle, redoble, melodía, bajo, acordes, riser) dejaba el bombo a 0,35, la caja a 0,32 y el charle a 0,18: añadir un adorno bajaba la base.
## Qué
- **Adorno** = los sintes `riser`, `crash`, `boom`, `impacto`, `downlifter` (los que ya trata `isFxLoop`; **no** el `pad` corto) **o** un loop con el campo opcional **`adorno: true`** (el redoble de caja, que es `sd` y no se distingue por el sinte). `isAdorno()` en `mix.ts`.
- **No cuentan en el reparto:** `active = loops.filter(!muted && !adorno)`. Su ganancia es **1** (suenan a su fuerza; no se les aplica ni el reparto ni el balance en dB), para que se oigan en el drop.
- **Campo `adorno?: boolean` en `FreeLoop`**, validado como los demás (`isFreeLoop`: solo booleano; la voz no lo lleva). Sin él, todo como hoy. El conversor (fuera del repo) marca el redoble con `adorno: true`.
- **Una canción sin adornos suena exactamente igual que antes:** test de ganancias idénticas al reparto anterior en todas las combinaciones de 1 a 8 loops con silenciados.
## Efecto en lo que ya hay (a revisar)
- Cualquier canción o remix con un loop de riser/crash/boom/impacto/downlifter sube su base (el reparto deja de contarlos) y esos adornos suenan a 1 en vez de ~0,3: es lo pedido, y es lo que cambia al oído.
- **Decisión a revisar:** los redobles de los remixes de serie (`RISER_ROLL`, `sd`) **no** se han marcado como adorno (solo se marca en los archivos que lo pidan); si se quiere el mismo trato, se marcan en `labRemixes.ts`/`remixes.ts`.
## Principios
2 ✔ (la base no se hunde) · 5 ✔ · 7 ⚠ sin probar con gente · 8 ✔. **Sin comprobar:** el volumen real (no se oye): el nivel de los adornos a 1 frente al bombo, en el móvil.
