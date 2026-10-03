# ASSETS.md — registro de recursos y licencias (§7)

Los recursos tipográficos están **autoalojados** (sin CDN). Desde el rediseño v16, la escena
orbital se dibuja con SVG/CSS y three.js/GLB se conservan como alternativas locales, pero no se
cargan durante el uso del dashboard.

## Fuentes (OFL 1.1) — `assets/fonts/`
| Archivo | Origen | Licencia | Peso | Nota |
|---|---|---|---|---|
| `Poppins-400/500/600/700.woff2` | Google Fonts (Poppins v24, latin) | **OFL 1.1** | 7.7–8.0 KB c/u (≈31 KB) | `OFL-Poppins.txt` incluido |
| `Inter-var.woff2` | Google Fonts (Inter v20, variable) | **OFL 1.1** | 48.3 KB | Cifras tabulares (`tnum`); `OFL-Inter.txt` incluido |

> **Atribución OFL (obligatoria):** Poppins — Copyright 2020 The Poppins Project Authors
> (https://github.com/itfoundry/Poppins), bajo SIL Open Font License 1.1.
> Inter — Copyright 2020 The Inter Project Authors (https://github.com/rsms/inter),
> bajo SIL Open Font License 1.1. Seistribution **sin modificar** los archivos (ambos tienen
> Reserved Font Name: no renombrar builds modificados).

## Modelo 3D (CC0) — `assets/models/`
| Archivo | Origen | Licencia | Peso | Nota |
|---|---|---|---|---|
| `crystal-big.glb` | "Big Crystal", Quaternius vía [Poly Pizza](https://poly.pizza/m/pf5lzmgr2J) | **CC0 1.0** (public domain) | 32.8 KB | Conservado, no se carga en v16. Objeto abstracto, **sin personaje ni marca**. |
| `coin.glb` | "Coin", Quaternius vía [Poly Pizza](https://poly.pizza/m/QHZtj94fvh) | **CC0 1.0** | 13.5 KB | Alternativa conservada, no se carga en v16. |

> **Aviso de licencia:** Quaternius migró su licencia general a "QAL" (no retroactiva).
> Los packs **anteriores a 2026** son **CC0** y Poly Pizza registra estos archivos con
> insignia **CC0** + enlace a creativecommons.org/publicdomain/zero/1.0/ (evidencia por
> archivo). Uso previsto: producto web (no redistribuir el .glb como asset suelto).

## Librería 3D — `assets/vendor/three/`
| Archivo | Origen | Licencia | Peso | Nota |
|---|---|---|---|---|
| `three.module.js` | three.js r160 (jsDelivr, build oficial) | **MIT** | 1.27 MB | Conservada, no se carga en v16. |
| `GLTFLoader.js` | three.js r160 (examples/jsm) | **MIT** | 108 KB | Conservada, no se carga en v16. |

## Iconografía
SVG inline escritas a mano (trazo redondeado uniforme). Sin librería de iconos externa.

## Ilustración orbital
SVG inline y gradientes CSS, animados con `transform` y `stroke-dashoffset`. Sin imágenes
externas ni petición de red adicional.

---

### No se usó (licencia incompatible o prohibida por §2.1)
- ❌ Arte, logos o capturas de Valorant/Riot, Uncharted, Dishonored, Red Dead, Subway
  Surfers, Unravel, FIFA/EA, Dota, Rocket League, CS, Steam, Epic.
- ❌ Fotos de avatares/personas.
- ❌ Fuentes de stock sin licencia o "solo uso personal".
- ❌ CC-BY que exigen crédito visible → evitados (CC0/OFL eligen).

### Coste total de payload local
**Runtime v16:** fuentes ~79 KB más HTML/CSS/JS; three.js y modelos no se descargan. El peso
total de assets conservados no equivale al payload de la página.
