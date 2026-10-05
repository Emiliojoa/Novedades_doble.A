# Novedades Doble A

Tienda mayorista/minorista con React, Vite, React Router y API Express en JavaScript. Base PostgreSQL en Supabase, carga de imágenes en Supabase Storage y panel administrativo independiente.

## Ejecutar en desarrollo

Requiere Node **22.22 o superior** y npm. Desde la raíz:

```powershell
npm install
npm run dev
```

- Tienda: http://localhost:5173
- Administración: http://localhost:5173/admin
- API: http://127.0.0.1:3001/api

Vite envía `/api` y `/uploads` a Express. Abrir la tienda con **localhost:5173**, que coincide con el origen permitido predeterminado. Si cambiás el puerto/origen, actualizá `APP_ORIGIN` en `server/.env` y el proxy Vite.

## Variables de entorno y Supabase

La configuración está en **`server/.env`**, ignorado por Git. El `.env` proporcionado se conserva. Como referencia existe `server/.env.example`; no copiarlo encima de tus credenciales.

| Variable               | Uso                                                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`         | Conexión PostgreSQL de Supabase, preferentemente **Session pooler**, puerto 5432. Codificar caracteres especiales de la contraseña como URL. |
| `DATABASE_PROVIDER`    | `postgres` por defecto cuando hay credenciales Supabase; `sqlite` para desarrollo aislado.                                                   |
| `SUPABASE_URL`         | URL del proyecto; usada por Storage.                                                                                                         |
| `SUPABASE_SECRET_KEY`  | Exclusiva del servidor para cargar imágenes. También se acepta `API_KEY_SUPABASE`.                                                           |
| `APP_ORIGIN`           | `http://localhost:5173` en desarrollo; URL HTTPS pública en producción.                                                                      |
| `API_PORT`, `API_HOST` | Puerto y dirección de escucha Express, por defecto 3001 y 127.0.0.1.                                                                         |
| `NODE_ENV`             | `development` o `production`.                                                                                                                |
| `DATABASE_CA_PATH`     | Opcional: certificado CA alternativo. Se incluye la CA pública Supabase y se verifica TLS/hostname.                                          |

`SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_JWKS_URL` no son necesarias para este diseño: React consume Express y las sesiones se gestionan en el backend. Ninguna clave secreta debe usar el prefijo `VITE_`.

## Base de datos

```powershell
npm run db:migrate
```

Ejecuta `server/migrations/001_initial.sql`, creando el esquema privado **`store`** con usuarios, sesiones, categorías, productos, carritos, pedidos, detalles y solicitudes 3D. Es repetible y no borra tablas existentes. También puede ejecutarse desde el SQL Editor de Supabase. Se revocan permisos a `anon`/`authenticated` y se habilita RLS; Express accede por su conexión privada.

En este entorno, la migración ya fue aplicada a la base configurada y se verificó el flujo PostgreSQL con una transacción que se revirtió al terminar. Las tablas previas de `public` permanecen intactas. Para ver las nuevas tablas en el dashboard, seleccionar el esquema **store**.

Las imágenes se guardan en el bucket público `doble-a-products`, creado al subir la primera imagen. Solo el backend autorizado como ADMIN realiza cargas. Se admiten PNG, JPEG y WebP de hasta 5 MB. La URL pública sirve para mostrar imágenes; la clave de Storage permanece en el servidor.

Alternativa local: `DATABASE_PROVIDER=sqlite` y `DATABASE_PATH=./data/store.db`. La base se crea automáticamente. No cambiar de proveedor esperando una copia automática de datos: son bases independientes. Las pruebas usan exclusivamente una base SQLite en memoria.

## Crear el primer administrador

Agregar en `server/.env`, con valores propios:

```dotenv
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_FIRST_NAME=
ADMIN_LAST_NAME=
```

La contraseña debe tener al menos 12 caracteres. Luego:

```powershell
npm run admin:create
```

Ingresar por `/login` y abrir `/admin`. El comando crea un ADMIN nuevo; **no** eleva cuentas existentes ni cambia sus contraseñas. Después de ejecutarlo, quitar `ADMIN_PASSWORD` del archivo. No hay contraseña predeterminada ni credenciales incluidas en el código. El registro público siempre crea `CLIENT`.

## Primer uso

1. Crear el administrador.
2. Crear categorías y subcategorías desde el panel.
3. Cargar productos reales, imágenes, precios y stock. Marcar **Destacado en inicio** cuando corresponda.
4. Los visitantes pueden explorar; para agregar al carrito deben registrarse/iniciar sesión.
5. Confirmar el carrito genera un pedido vinculado al cliente y descuenta stock de forma transaccional.
6. El administrador revisa los datos del cliente y avanza el estado: pendiente → confirmado → en preparación → listo → entregado. Cancelar repone stock una sola vez.
7. Las solicitudes 3D se revisan desde **Solicitudes 3D**; muestran email y referencia del cliente para coordinar presupuesto.

El catálogo arranca vacío: no hay productos ficticios en producción. Los gráficos del inicio son ilustraciones decorativas, no productos anunciados con precio.

## Comprobaciones

```powershell
npm test
npm run lint -w client
npm run build
npx playwright install chromium
npm run test:e2e
npm run db:check
```

`npm test` comprueba autenticación, permisos, aislamiento de carritos/pedidos, stock, precio histórico, cancelación y concurrencia. `test:e2e` inicia un servidor aislado y verifica el recorrido con navegador, además de capturas y overflow responsive. No escribe en Supabase. Las capturas quedan en `test-results/`.

Si ya tenés Edge instalado, podés usarlo sin descargar Chromium:

```powershell
$env:PLAYWRIGHT_CHANNEL='msedge'
npm run test:e2e
```

`db:check` verifica Supabase con datos temporales **dentro de una transacción revertida**: no conserva clientes, productos o pedidos de prueba (los contadores de secuencia pueden avanzar).

Se verificó también la carga y lectura pública en Supabase Storage, eliminando la imagen temporal al terminar. El bucket `doble-a-products` ya está preparado. Para repetir esa comprobación: `node --env-file=server/.env server/scripts/check-storage.js`.

## Producción

```powershell
npm run build
npm start
```

Express sirve `client/dist` y la API desde el mismo origen. Configurar `NODE_ENV=production`, `APP_ORIGIN=https://tu-dominio`, y HTTPS en el reverse proxy. Las cookies son HttpOnly, SameSite=Lax, Secure en producción y vencen a los siete días. En contenedores usar `API_HOST=0.0.0.0`. Si se utiliza un proxy, configurar `TRUST_PROXY_HOPS` con la cantidad exacta de proxies confiables para que el limitador de solicitudes use la IP correcta.

Guardar backups de PostgreSQL y Storage, y mantener las credenciales en el gestor de secretos del hosting. La base necesita las migraciones antes de iniciar.

## Alcance de la primera versión

Incluye tienda, categorías dinámicas, búsqueda y filtros, detalle, carrito autenticado, pedidos, historial, presupuestos 3D, dashboard, productos/stock, categorías, clientes y estados. El backend valida datos y roles; guarda hashes scrypt y sesiones revocables, nunca contraseñas en texto plano.

El pago y la entrega se coordinan con el local. No se integraron pasarela de pago, envíos, recuperación de contraseña por email, promociones, tarifas mayoristas, archivos STL/3MF ni cotización automática. El modelo reserva atributos mayoristas y mantiene responsabilidades separadas para ampliar estas funciones. Los datos públicos concretos del local (domicilio, horarios y teléfono comercial) deben completarse con información real antes de publicar.

Ver `ARCHITECTURE.md` para entidades, relaciones, rutas y endpoints.
