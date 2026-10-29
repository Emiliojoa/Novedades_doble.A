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

Vite envía `/api` y `/uploads` a Express. Abrir la URL que indique Vite: normalmente **localhost:5173**; si está ocupado, puede usar 5174. En desarrollo se admiten exclusivamente los hosts locales `localhost`, `127.0.0.1` y `[::1]` en los puertos 5173–5183, además de `APP_ORIGIN`. En producción solo se admite el origen exacto configurado en `APP_ORIGIN`. Para otros orígenes, actualizar esa variable; si cambia el puerto de la API, ajustar también el proxy Vite.

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

Ejecuta los archivos de `server/migrations/` en orden: `001_initial.sql` crea el esquema privado **`store`** con usuarios, sesiones, categorías, productos, carritos, pedidos, detalles y solicitudes 3D; `002_single_admin.sql` limita la base a un único ADMIN. Son repetibles y no borran cuentas ni tablas existentes. También pueden ejecutarse en ese orden desde el SQL Editor de Supabase. Se revocan permisos a `anon`/`authenticated` y se habilita RLS; Express accede por su conexión privada.

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

Ingresar por `/login` y abrir `/admin`. El comando crea el **único ADMIN** si aún no existe. Si se vuelve a ejecutar, rechaza la creación sin modificar la cuenta ni la contraseña existentes. La base también impide un segundo ADMIN mediante un índice único, incluso ante ejecuciones simultáneas. El comando **no** eleva cuentas existentes; usar un email que no esté registrado como cliente. Después de ejecutarlo, quitar `ADMIN_PASSWORD` del archivo. No hay contraseña predeterminada ni credenciales incluidas en el código. El registro público siempre crea `CLIENT`.

## Primer uso

1. Crear el administrador.
2. Crear categorías y subcategorías desde el panel.
3. Cargar productos reales, imágenes, precios y stock. Marcar **Destacado en inicio** cuando corresponda.
4. Los visitantes pueden explorar; para agregar al carrito deben registrarse/iniciar sesión.
5. Confirmar el carrito genera un pedido vinculado al cliente y descuenta stock de forma transaccional.
6. El administrador revisa los datos del cliente y avanza el estado: pendiente → confirmado → en preparación → listo → entregado. Cancelar repone stock una sola vez.
7. Las solicitudes 3D se revisan desde **Solicitudes 3D**; muestran email y referencia del cliente para coordinar presupuesto.

El catálogo arranca vacío: no hay productos ficticios en producción. Los gráficos del inicio son ilustraciones decorativas, no productos anunciados con precio.

## Contexto de sesión y acceso administrativo

Se mantiene el diseño existente, sus colores y la tipografía Poppins. La configuración de pagos conserva la vista de `/admin/pagos`; utiliza `GET/PUT /api/admin/payment-settings`, con alias y descuento reales. El checkout sigue consultando `/api/payment-settings` y cada pedido conserva sus condiciones originales.

`AuthProvider` es el contexto único de sesión: obtiene el usuario de `/api/auth/me`, comparte consultas simultáneas y descarta respuestas anteriores al logout o a un nuevo login. Revalida al recuperar el foco de la ventana. Una respuesta 401 de una sesión protegida limpia el contexto y el contador del carrito. Los roles no se leen de localStorage ni se modifican desde los formularios: incluso al editar el perfil actual se consulta nuevamente al servidor.

`Protected` espera la comprobación del servidor antes de mostrar cada ruta protegida. Un visitante va al login y un CLIENT que escribe `/admin`, `/admin/pagos` u otra ruta administrativa vuelve a su perfil sin cargar el contenido del panel. El ADMIN ingresa directamente al panel y puede cerrar sesión desde la cabecera con los estilos de botones existentes.

El control del navegador no reemplaza los permisos: todo el prefijo `/api/admin` pasa por autenticación y comprobación de rol en Express, incluso para rutas nuevas. Las escrituras de catálogo fuera de ese prefijo también conservan su protección. La modificación de pagos comprueba ADMIN tanto en el endpoint como en el servicio. Los clientes reciben 403 aunque falsifiquen encabezados de rol o datos del navegador; las sesiones ausentes o revocadas reciben 401.

Validación de esta mejora: 34 pruebas de backend y 8 escenarios completos con Chrome, incluyendo acceso por URL, rol falso en localStorage, revocación de sesión sin borrar la cookie del navegador, configuración de pagos, compras, usuarios y responsive. Compilación y lint aprobados. Las pruebas usan una base aislada, no Supabase productivo; el presupuesto de peticiones se reinicia entre escenarios únicamente en el servidor de pruebas, sin reducir los límites de producción. No se agregaron dependencias, migraciones ni cambios en CSS o fuentes.

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

Express sirve `client/dist` y la API desde el mismo origen. Configurar `NODE_ENV=production`, `APP_ORIGIN=https://tu-dominio`, y HTTPS en el reverse proxy. Las cookies son HttpOnly, SameSite=None y Secure en producción (Lax en desarrollo) y vencen a los siete días. En contenedores usar `API_HOST=0.0.0.0`. Si se utiliza un proxy, configurar `TRUST_PROXY_HOPS` con la cantidad exacta de proxies confiables para que el limitador de solicitudes use la IP correcta.

Guardar backups de PostgreSQL y Storage, y mantener las credenciales en el gestor de secretos del hosting. La base necesita las migraciones antes de iniciar.

## Alcance de la primera versión

Incluye tienda, categorías dinámicas, búsqueda y filtros, detalle, carrito autenticado, pedidos, historial, presupuestos 3D, dashboard, productos/stock, categorías, clientes y estados. El backend valida datos y roles; guarda hashes scrypt y sesiones revocables, nunca contraseñas en texto plano.

El pago y la entrega se coordinan con el local. No se integraron pasarela de pago, envíos, recuperación de contraseña por email, promociones, tarifas mayoristas, archivos STL/3MF ni cotización automática. El modelo reserva atributos mayoristas y mantiene responsabilidades separadas para ampliar estas funciones. Los datos públicos concretos del local (domicilio, horarios y teléfono comercial) deben completarse con información real antes de publicar.

Ver `ARCHITECTURE.md` para entidades, relaciones, rutas y endpoints.


## Render: frontend y backend separados

El frontend lee `VITE_API_URL` al compilar. En el servicio frontend configurar
`VITE_API_URL=https://novedades-doble-a-1.onrender.com` y volver a ejecutar el build.
En el backend configurar `APP_ORIGIN=https://novedades-doble-a.onrender.com` y
`NODE_ENV=production`. No agregar `/api` a las rutas de los componentes: el cliente
HTTP centralizado agrega ese prefijo. Sin `VITE_API_URL`, se conservan las rutas
relativas y el proxy local de Vite para `/api` y `/uploads`.

CORS permite credenciales exclusivamente desde el origen configurado. En producci?n
la cookie de sesi?n usa `SameSite=None; Secure` para los dominios separados (en local,
`SameSite=Lax`). Los navegadores que bloquean cookies de terceros pueden impedir la
sesi?n entre estos dominios; un proxy bajo el mismo origen evita esa restricci?n.


## Pagos en efectivo y transferencia

El carrito permite elegir efectivo con descuento configurable (3% inicial) o transferencia con comprobante privado obligatorio. Administración puede revisar pagos y cambiar el alias y descuento; el cliente consulta estados y reenvía comprobantes rechazados. Ver [PAYMENTS.md](PAYMENTS.md) para migraciones, endpoints, archivos, pruebas y configuración de Render/Supabase.
## Pago y fotos de productos

El carrito abre un modal en dos pasos. El total y las acciones permanecen visibles; los errores conservan el comprobante y la confirmacion recuperable evita pedidos duplicados.

Para habilitar la galeria en PostgreSQL/Supabase, ejecutar `npm run db:migrate` antes de desplegar el backend actualizado. La migracion `004_product_images.sql` agrega una columna sin modificar las fotos existentes. En SQLite la columna se agrega al iniciar. Cada producto admite hasta 8 fotos; la primera se usa como portada. Desde el administrador se pueden seleccionar varios archivos, agregar URLs HTTPS, cambiar la portada y quitar fotos de la galeria.
