# Rediseño del dashboard desde la referencia Pinterest

- **Fecha:** 2 de octubre de 2026
- **Referencia:** clip de diseño entregado por el propietario en esta conversación
- **Fuente de datos:** `/api/public` de Sentinel; decisiones y planes de Jev

## Errores de información corregidos

- El API usa `position.qty` como **nocional en USDT**. El dashboard lo trataba como unidades
  del activo y multiplicaba la variación de precio directamente por esa cifra. Ahora calcula
  el P&L abierto con `nocional_usdt × variación_porcentual / 100` y considera LONG/SHORT.
- El dashboard muestra el total de posiciones abiertas como nocional, calcula el P&L no
  realizado solo cuando dispone de un precio vigente de Sentinel y muestra datos atrasados
  como tales.
- La entrada BTC de un trade figura como **100,00**, mientras que el ciclo original de Jev
  registró un precio alrededor de **84.663,21**. El dashboard detecta la diferencia al cruzar
  el ID del trade con el ID de ciclo. Marca el ledger para revisión, anota la fila afectada y
  oculta balance total, P&L acumulado, trayectoria y drawdown dependientes de ese historial.
  El capital inicial y el P&L abierto, calculado desde las posiciones y precios vivos, siguen
  visibles por separado. Ninguna posición ni registro persistido fue alterado.
- El aviso de posiciones por encima del máximo configurado se mantiene visible en el rail,
  el resumen y el área de riesgo.
- Los scores de ejecución aparecen como **heurísticos**, nunca como probabilidad calibrada.

## Interfaz

- Se sustituyó la composición terminal por el panel de referencia: rail lateral, barra
  superior con búsqueda, perfil, estado de actualización y tema, resumen de tres métricas,
  tarjeta de estado, hero espacial y actividad reciente.
- El hero combina la decisión actual de Jev con el precio de decisión, la hora del ciclo y el
  score de ejecución. Una ilustración SVG orbital reproduce el lenguaje del video sin cargar
  imágenes remotas.
- El tema claro/oscuro cambia con una transición circular, donde está soportada. El sistema
  conserva `prefers-reduced-motion`.
- Se mantienen balance/riesgo, posiciones, activos, calibración, mercado, salud, historial y
  ciclos. El menú lateral se colapsa en móvil.
- Se quitaron barras y sparkline de relleno que parecían series de datos.
- El feed sigue consultándose cada segundo con guardia de petición en curso, timeout,
  cancelación al pausar y suspensión cuando la pestaña queda oculta.

## Verificación local

- `node --check` pasa en `assets/app.js`.
- 91 IDs HTML; 73 referencias directas desde JavaScript; sin IDs duplicados ni referencias
  ausentes.
- En navegador local, la anomalía BTC se reproduce y queda marcada; el dashboard muestra
  balance/realizado/drawdown «No verificado» y P&L abierto **+0,09 USDT** en la muestra
  observada. El P&L abierto varía con los precios en vivo.
- Vista previa a 720 × 540: navegación lateral visible, igual que en el encuadre del video.
- Tema claro probado y leído con estilos calculados; tema oscuro inicial conservado.
