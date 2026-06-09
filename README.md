# Panel FEFO — CD1500

Dashboard para análisis FEFO (First Expired First Out) de inventario en Centro Liquidador.

## Funcionalidades

- Carga diaria de CSV de inventario
- Análisis comparativo entre snapshots
- Detección de incumplimientos FEFO con área de ubicación
- Seguimiento de lotes críticos por vencimiento
- Detección de nuevos ingresos críticos
- Persistencia local (localStorage)

## Estructura del CSV esperado

Separador: `;`  
Columnas (posición): Centro, Área, SKU, Descripción, Estado, Perfil, Fecha Vencimiento, Días Vencimiento, Cajas

Áreas excluidas automáticamente: `AREA STAGE DESPACHO`, `AREA STAGE RECEPCION`

## Desarrollo local

```bash
npm install
npm run dev
```

## Deploy en Vercel (desde GitHub)

1. Sube esta carpeta a un repositorio GitHub
2. Entra a [vercel.com](https://vercel.com) → New Project
3. Importa el repositorio
4. Vercel detecta Vite automáticamente → Deploy
5. URL pública lista en ~1 minuto

## Notas

- Los snapshots se guardan en `localStorage` del navegador
- El análisis FEFO compara siempre el último snapshot vs el anterior
- El nombre del archivo CSV debe incluir la fecha en formato `DD-MM` (ej: `Base_datos_06-06.csv`)
