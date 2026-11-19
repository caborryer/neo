# Identidad de marca — neoTRAINING

Fuente: *Manual de imagen neoTRAINING* (por Masif). La app lo aplica así:

| Elemento | Manual | En la app |
| --- | --- | --- |
| Vino | #5C2946 (Pantone 5115 C) | `--color-neo-primary`: botones, enlaces, foco, títulos |
| Vino oscuro | derivado | `--color-neo-primary-dark`: hover |
| Coral | #F9B4A6 (Pantone 487 C) | `--color-neo-coral`: fondos y acentos; **el texto encima va en vino** (contraste 6,5:1), nunca blanco |
| Coral claro | tinte del coral | `--color-neo-pink-light`: chips, resaltados |
| Logotipo | neoTRAINING + figura geométrica | `apps/web/public/logo.svg` (vectorial, extraído del manual) y `<BrandLogo />` |
| Tipografía | Geogrotesque Medium/Bold, titulares en caja alta | `--font-sans` usa Geogrotesque si está disponible y cae a Inter; `h1` en mayúsculas |

Se mantuvieron fuera de la paleta de marca los colores **funcionales**: verde (éxito), amarillo (advertencia) y rojo (error), porque comunican estado.

## Pendientes
- **Geogrotesque** es de pago: con la licencia, agregar los `.woff2` a `apps/web/public/fonts/` y un `@font-face` en `styles/index.css`. Mientras tanto se usa Inter.
- Las tipografías del logotipo (Static Bold Italic y Tarzana Narrow Italic) ya van dentro del SVG; no hace falta instalarlas.
- Favicon e íconos: generados a partir del logo cuadrado apilado (blanco sobre vino) en `public/` (favicon, apple-touch-icon, icon-192/512).

## Reglas del manual a respetar
- Área de protección libre alrededor del logo: 4X por cada lado (X = alto de la «n»).
- Tamaño mínimo: alto del logo ≥ 15 % del alto de la pieza, o ancho ≥ 25 % del ancho en formatos horizontales.
- Usos no permitidos: fondos multicolor, cambiar colores, encerrarlo en círculos, deformarlo o recortar la figura geométrica.
- Sobre fondo vino o coral usar las versiones del manual (pág. 8); hoy la app solo lo muestra sobre fondo claro.
