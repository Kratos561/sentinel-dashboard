# Registro de supuestos / notas (regla: nada se cambia en silencio)

## 2026-09-28 — Implementación inicial (secciones 1–6)
- **Falta `design/reference.png`.** Se implementó la paleta de §3.2 tal cual (valores muestreados del documento),
  **sin verificación por cuentagotos** porque la imagen no está en el repo. Pendiente: cuando llegue la imagen,
  corregir tokens con muestreo real (Pillow/colorthief) y anotar aquí cada delta.
- **Documento truncado en §6.2.** No se ejecutaron §7 (licencias), §9 (fases) ni §11 (perf) por no estar presentes.
- **D1 modo oscuro (`?frame=dark`)**: implementado. Por defecto rosa `#FFDFE0` (fidelidad exacta pedida).
- **D3 semántica**: implementado. Pérdida = `#FF8A94` **siempre con signo `−` y ▼**; ganancia = `#5FD08A` con `+` y ▲.
  Nunca se comunica P/L solo por color.
- **D4 tipografía**: Poppins **no está disponible localmente** (no hay archivo de fuente en el repo y no se permite CDN).
  Fallback: `system-ui, 'Segoe UI', Roboto`. **Pendiente**: aportar `assets/fonts/Poppins-*.woff2` (OFL) para activarlo.
- **D2 estructura**: la pestaña Resumen replica la composición de 3 columnas; el resto de secciones siguen siendo
  vistas dentro del mismo shell con enrutado por hash (deep links intactos: `#loopTitle #market #health #positions #trades #cycles`).
- **D5 arte 3D del hero**: no se usa ningún asset de terceros. Se genera un **emblema SVG original** en el repo
  (cero licencia de terceros). Pendiente: si el dueño aporta el render de Blender, sustituir `assets/img/emblem.svg`.
- **§2.1**: no se ha descargado ningún recurso externo; `ASSETS.md` queda vacío salvo el emblema propio.
- **Squircle**: se aproximó con `border-radius` grande + `overflow:hidden`; un squircle real (superelipse) no es
  posible con CSS puro sin `clip-path`. Ajustar si la comparación con la referencia lo exige.
