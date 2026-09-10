# Ritmo BYS

Tablero de ritmo mensual: cómo va el mes en curso contra **el mismo día** de cada
mes del año, en ventas, leads y agendamientos.

**Sitio:** https://sebasstiangarcia22-cpu.github.io/ritmo-bys/

Meta mensual: **$100.000.000**

## Archivos

| | |
|---|---|
| `index.html` | El tablero. Sin dependencias ni build. |
| `data.js` | Los datos. Lo reescribe la Action. |
| `apps-script/Code.gs` | Lee la hoja y expone el JSON que consume la Action. |

## Actualización automática

Lunes a sábado a las **12:00 de Colombia** (`cron 0 17 * * 1-6` en UTC).

```
Google Sheet ──▶ Apps Script (/exec?format=json) ──▶ GitHub Action ──▶ data.js ──▶ Pages
```

Si los datos no cambiaron no hace commit; si la hoja no responde, falla en vez de
publicar un tablero a medias. Para correrlo ya: Actions › *Actualizar tablero BYS* › Run workflow.

## Particularidades de esta hoja

A diferencia de la de Rivera, **cada mes es una pestaña** y el mes se deduce del
**nombre de la pestaña**, no de una celda. Es a propósito: dentro de las hojas hay
encabezados mal copiados (dos pestañas distintas dicen "marzo 2026" en su cabecera).

- Se leen solo las pestañas cuyo nombre contiene un mes. `Reporte semanal Overview`
  y `OVERVIEW GENERAL 2026` se ignoran solas.
- El ancla de cada bloque es la celda `Ventas`; las columnas de día terminan
  donde empieza `Acumulado mes`, que queda excluida.
- Filas usadas: `Acumulado Total` (ya viene acumulada), `Total Leads` y
  `Total agendamientos`.
- Los `$ -` llegan como `0`. En un acumulado eso es imposible, así que un `0`
  después de un valor positivo se trata como día sin cargar y se arrastra el
  anterior. Los ceros del arranque del mes sí son reales.

## Pendiente de revisar

**Junio arranca en $20.269.000 el día 1.** En una serie acumulada que reinicia
cada mes eso no cuadra: parece un arrastre del mes anterior en la hoja. No lo
corregí porque no sé si es un error o un ingreso real de ese día. Vale la pena
confirmarlo.

## Puesta en marcha

1. [script.google.com](https://script.google.com) → proyecto nuevo → pegar `apps-script/Code.gs`.
2. Correr la función `probar` y revisar el registro.
3. **Implementar › Nueva implementación › Aplicación web** —
   *Ejecutar como: Yo* · *Acceso: cualquier usuario con el vínculo*.
4. Guardar la URL `/exec` como secret `RIVERA_ENDPOINT` en
   Settings › Secrets and variables › Actions.
