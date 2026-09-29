# Registro de supuestos / notas (regla: nada se cambia en silencio)

## 2026-09-28 — Implementación inicial (secciones 1–6)
- **Falta `design/reference.png`.** Se implementó la paleta de §3.2 tal cual (valores muestreados
  del documento), **sin verificación por cuentagotos** porque la imagen no está en el repo.
  Pendiente: cuando llegue la imagen, corregir tokens con muestreo real (Pillow/colorthief) y
  anotar aquí cada delta.
- **Documento truncado en §6.2.** No se ejecutaron §7 (licencias), §9 (fases con criterios de
  aceptación) ni §11 (presupuesto de rendimiento) porque no venían. §7 se *sí* aplicó en su
  intención (registro de licencias en `ASSETS.md`), pero **sin el protocolo paso a paso** original.
- **D1 modo oscuro (`?frame=dark`)**: implementado. Por defecto rosa `#FFDFE0`.
- **D3 semántica**: implementado. Pérdida `#FF8A94` **siempre con signo − y ▼**; ganancia
  `#5FD08A` con + y ▲. Nunca se comunica P/L solo por color.
- **D2 estructura**: Resumen replica la composición de 3 columnas; el resto son vistas dentro del
  mismo shell con enrutado por hash (deep links intactos: `#loopTitle #market #health #positions #trades #cycles`).
- **D5 arte 3D del hero**: **implementado con un modelo CC0 real** (`crystal-big.glb`, Quaternius vía
  Poly Pizza, CC0 1.0) renderizado con three.js teñido granate + luz coral/violeta, carga perezosa
  y **fallback al emblema SVG propio** si no hay WebGL. Ya no está pendiente como bloque: sí
  integrable con licencia limpia.
- **D4 tipografía**: **resuelto** con Poppins + Inter autoalojados (OFL 1.1). `Poppins` para UI,
  `InterVar` con `tabular-nums` para cifras (precios, P&L, tablas). Atribución OFL en `ASSETS.md`.
- **Squircle**: aproximado con `border-radius` grande + `overflow:hidden`. Un squircle real
  (superelipse) no es posible con CSS puro; si la comparación con la referencia lo exige, usar
  `clip-path` con `path()` o SVG.

## 2026-09-28 — Búsqueda e integración de recursos
- 3 subagentes de investigación (3D, fuentes, texturas). Resultado y decisión en `ASSETS.md`.
- **Hallazgo de licencia crítico**: Quaternius pasó a "QAL"; los packs pre-2026 son **CC0** y
  Poly Pizza lo acredita por archivo. Descargados y verificados (HTTP 200 + magic bytes).
- **Texturas Kenney (CC0) descartadas**: 15 MB cada pack; el grano/glow se generan por código
  (cero licencia, cero peso).
- **OpenGameArt wallpaper**: licencia NO verificada → descartado.
- **Perf**: three.js pesa 1.27 MB (perezoso). **§11 no se recibió**, así que el presupuesto
  exacto no se puede comprobar. Marcado como pendiente de confirmación.
