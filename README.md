# Pollo POS

Base de una app web para punto de venta avícola, lista para publicarse como PWA en GitHub Pages y sincronizar datos con Google Apps Script.

## Incluye

- Demo con acceso directo al sistema y estructura lista para roles de usuario.
- Punto de venta con botones grandes y categorías.
- Venta por kilo y por pieza.
- Lectura de código de barras por input tipo scanner.
- Integración base con báscula Torrey vía Web Serial con fallback manual.
- Impresión de ticket usando el diálogo del navegador.
- Apertura y cierre de caja con fondo inicial.
- Inventario, compras, gastos, clientes, mayoreo, fiados y reportes.
- Soporte offline con `localStorage` y `service worker`.
- Cola de sincronización para respaldo en la nube vía Apps Script.

## Estructura

- [index.html](/Users/albertovaliente/Documents/App de pollo/index.html)
- [styles.css](/Users/albertovaliente/Documents/App de pollo/styles.css)
- [app.js](/Users/albertovaliente/Documents/App de pollo/app.js)
- [sw.js](/Users/albertovaliente/Documents/App de pollo/sw.js)
- [appscript/Code.gs](/Users/albertovaliente/Documents/App de pollo/appscript/Code.gs)

## Despliegue en GitHub Pages

1. Sube este repositorio a GitHub.
2. En el repo, entra a `Settings > Pages`.
3. Publica desde la rama principal y la carpeta raíz.
4. Verifica que el sitio sirva `index.html` y `manifest.webmanifest`.

## Configurar Apps Script

1. Crea un proyecto nuevo en Google Apps Script.
2. Copia el contenido de [appscript/Code.gs](/Users/albertovaliente/Documents/App de pollo/appscript/Code.gs) y [appscript/appsscript.json](/Users/albertovaliente/Documents/App de pollo/appscript/appsscript.json).
3. Crea o vincula una hoja de cálculo.
4. Publica como `Web app` con acceso para tus usuarios.
5. Copia la URL publicada y pégala en `APP_SCRIPT_URL` dentro de [app.js](/Users/albertovaliente/Documents/App de pollo/app.js).

## Hojas esperadas en Sheets

- `sales`
- `products`
- `customers`
- `purchases`
- `expenses`
- `credits`
- `cash_movements`
- `inventory_movements`

El script las crea automáticamente si no existen.

## Notas de hardware

- La báscula Torrey puede integrarse si expone datos seriales. En navegadores compatibles se usa `Web Serial`.
- Si el modelo de báscula trabaja con protocolo distinto, habrá que ajustar el parser dentro de `getWeightFromScale`.
- El escáner de código de barras puede funcionar como teclado y escribir directo en el input de código.
- La impresión de ticket puede salir a impresora térmica configurada desde el sistema.

## Siguiente fase recomendada

1. Conectar autenticación real con Apps Script o Google Identity.
2. Sustituir `localStorage` por IndexedDB para mayor volumen de datos.
3. Crear catálogo maestro de productos y proveedores desde administración.
4. Afinar protocolo de la báscula Torrey exacta que usarás en tienda.
