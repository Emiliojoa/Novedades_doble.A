# Pagos — Novedades Doble A

## Funcionamiento

El cliente elige efectivo o transferencia en el carrito. El valor inicial de efectivo
es 3%; el alias inicial de transferencia es `emilio.joa.mp`. Ambos se editan desde
**Administración → Configuración de pagos** (`/admin/pagos`).

Los importes se guardan en centavos enteros. El descuento se calcula con `BigInt`
y redondeo al centavo más cercano, con mitades hacia arriba. La base conserva el
subtotal, porcentaje, descuento, total y alias de cada compra. El servidor valida
precios, stock y condiciones vigentes, sin aceptar totales calculados por el cliente
como fuente de verdad. Si cambian las condiciones mientras el cliente confirma,
se exige revisar la compra antes de continuar.

`total` sigue siendo el total final del pedido; no se agregó un `total_amount`
duplicado. Los pedidos anteriores conservan sus importes y aparecen como históricos,
sin inventar un método ni una aprobación de pago.

El estado del pago es independiente del estado del pedido. Efectivo comienza en
`PENDING_PAYMENT`; transferencia comienza en `PENDING_VERIFICATION`. Solamente un
administrador puede aprobar. Rechazar una transferencia exige un motivo y habilita
el reenvío por su propietario. Se conservan los comprobantes rechazados y todas las
revisiones. No se aprueban pagos de pedidos cancelados. Cancelar un pedido no implica
reembolso automático: el sistema no mueve dinero ni se conecta a una pasarela.

Cada checkout lleva una clave UUID única por cliente y una huella de los datos.
La reserva de stock, el pedido, sus líneas, el vínculo al comprobante, la auditoría
y el vaciado del carrito se hacen en una sola transacción. Reintentar una clave ya
procesada devuelve el mismo pedido. El navegador conserva una confirmación pendiente
en `sessionStorage`, por cuenta, para recuperarla incluso si se perdió la respuesta
y el carrito ya quedó vacío.

## Comprobantes privados

En producción los archivos se guardan en Supabase Storage, nunca en el disco temporal
de Render ni en el bucket público de productos. El backend crea el bucket privado
si no existe y rechaza uno que esté configurado como público. No hay URLs públicas
ni claves de Storage en React. La API entrega el archivo después de verificar la
sesión y la propiedad del pedido o el rol ADMIN. Las respuestas privadas no se cachean.

Se validan el tamaño, la extensión, el MIME declarado y las firmas de PNG/JPEG/PDF
(incluido el marcador final de PDF). El límite inicial es 5 MB. Hay límite de
frecuencia en las cargas. Un archivo recién subido es un borrador propiedad del
usuario; el pedido solo puede vincular un borrador de esa cuenta que no se haya usado.
Reemplazar o quitar un archivo antes de confirmar elimina el borrador anterior.
Los borradores abandonados al cerrar la pestaña permanecen privados; no se elimina
automáticamente ningún comprobante asociado a pedidos.

En desarrollo y pruebas con SQLite, sin Supabase, el contenido se conserva en la
propia base SQLite. No se usa esta alternativa en producción. Respaldar PostgreSQL
y el bucket privado en producción; respaldar el archivo SQLite si se usa localmente.

Referencia de almacenamiento: [buckets privados de Supabase](https://supabase.com/docs/guides/storage/buckets/fundamentals)
y [descargas autenticadas](https://supabase.com/docs/guides/storage/serving/downloads).

## Despliegue en Render

1. Publicar el código en la rama que siguen **ambos** servicios.
2. Ejecutar `npm run db:migrate` desde la raíz con las variables del backend, antes
   de poner la nueva versión en servicio. Este comando ejecuta también la migración
   aditiva e idempotente `server/migrations/003_payments.sql`.
3. Conservar `DATABASE_PROVIDER=postgres`, `DATABASE_URL`, `SUPABASE_URL` y
   `SUPABASE_SECRET_KEY` (clave secreta de servidor con permisos de Storage) en el
   backend. No copiar claves al frontend ni versionar `.env`.
4. Configurar en el backend:

   ```env
   NODE_ENV=production
   APP_ORIGIN=https://novedades-doble-a.onrender.com
   API_HOST=0.0.0.0
   API_PORT=10000
   PAYMENT_RECEIPTS_BUCKET=doble-a-payment-receipts
   PAYMENT_RECEIPT_MAX_MB=5
   ```

5. Configurar en el frontend, antes de su build:

   ```env
   VITE_API_URL=https://novedades-doble-a-1.onrender.com
   ```

6. Usar Node 22.22 o superior. Volver a compilar el frontend con `npm run build` y
   redesplegar ambos servicios. Mantener el proxy de Vite para el entorno local sin
   `VITE_API_URL`.
7. Verificar que el bucket sea privado, admita `image/jpeg`, `image/png` y
   `application/pdf`, y tenga el tamaño máximo elegido. Si el bucket ya existía,
   ajustar su límite y el límite global de Supabase al cambiar
   `PAYMENT_RECEIPT_MAX_MB`. No cambiar el nombre del bucket después de guardar
   comprobantes sin migrar también los objetos existentes.
8. Hacer una compra real controlada y verificar lectura del comprobante y sesión en
   los dominios publicados. Durante la puesta en marcha local se aplicó la migración
   `003` a la base Supabase configurada, con autorización del usuario, verificando
   que se conservaran productos, usuarios y pedidos. También se comprobó una carga
   temporal real en el bucket privado, su lectura autenticada y el bloqueo del acceso
   público; el archivo y su registro temporal se eliminaron al terminar.

CORS permite credenciales únicamente desde `APP_ORIGIN`; en producción la cookie
usa `SameSite=None; Secure`. Si el navegador bloquea cookies de terceros entre los
dos dominios `onrender.com`, se requiere un proxy bajo el mismo origen o dominios
propios del mismo sitio para que la sesión no dependa de esas cookies.

## Migraciones

`003_payments.sql` agrega columnas a `store.orders`, índices de pagos e idempotencia,
y las tablas `payment_settings`, `payment_receipts` y `payment_audit`. Las tablas
nuevas tienen RLS habilitado y no son accesibles por los roles `anon` ni
`authenticated`. Las fechas usan `TIMESTAMPTZ` en PostgreSQL. La actualización SQLite
equivalente se aplica al abrir la base y también conserva los datos anteriores.

## API

Todas las rutas siguientes llevan prefijo `/api` y requieren sesión:

| Método y ruta | Uso |
|---|---|
| `GET /payment-settings` | Alias, descuento y límite público para checkout |
| `PUT /admin/payment-settings` | Modificar alias y descuento; solo ADMIN |
| `POST /payment-receipts` | Multipart, campo `receipt`; devuelve el ID del borrador |
| `DELETE /payment-receipts/:receiptId` | Eliminar un borrador propio, sin pedido |
| `GET /payment-receipts/:receiptId` | Archivo privado de un pedido propio o acceso ADMIN |
| `GET /payment-receipts/:receiptId?download=1` | Descargar con disposición attachment |
| `POST /orders` | Checkout validado, con pago e idempotencia |
| `POST /orders/:id/receipts` | Reenvío por propietario de una transferencia rechazada |
| `PATCH /admin/orders/:id/payment` | Aprobar/rechazar, verificando el estado y comprobante revisado |
| `GET /admin/payments` | Lista paginada, filtros, búsqueda y contadores reales; solo ADMIN |

El nuevo checkout exige `payment_method`, `idempotency_key`, `expected_subtotal` y
`expected_total`; transferencia exige además `receipt_id` y `bank_alias`. Los campos
`expected_*` detectan cambios del carrito; el servidor recalcula siempre el importe.
La revisión exige `status`, `expected_status` y, para transferencias, `receipt_id`;
rechazar exige `reason`. Esto evita que una pestaña administrativa obsoleta apruebe
un comprobante diferente del que se revisó.

`GET /orders` y `GET /orders/:id` incluyen los datos de pago. El detalle agrega
comprobantes y auditoría, sin rutas de Storage ni contenido binario/base64.
`GET /admin/orders` mantiene su respuesta de lista para los consumidores existentes.
`GET /admin/payments` acepta `page`, `limit`, `search`, `status`, `payment_method` y
`payment_status`; devuelve `{ orders, total, page, limit, counters }`.

## Archivos

Nuevos:

- `shared/payments.js`: cálculos exactos y textos de estados/métodos.
- `server/migrations/003_payments.sql`: esquema PostgreSQL aditivo.
- `server/services/payments.js`: configuración, revisión, auditoría y filtros.
- `server/services/receipts.js`: validación y almacenamiento privado.
- `client/src/components/Payments.jsx`: selección, carga, resumen y etiquetas.
- `client/src/components/OrderPayment.jsx`: revisión y reenvío en detalle de pedido.
- `client/src/pages/PaymentAdmin.jsx`: listado filtrado y configuración.
- `client/src/payments.css`: estilos responsive acordes a la identidad existente.
- `server/tests/payments.test.js`, `receipt-storage.test.js`, `payment-persistence.test.js`.
- `tests/payments.spec.js`: recorrido completo en navegador.
- `client/.env.example` y este documento.

Modificados: `server/config/sqlite.js`, `models/schemas.js`, `routes/api.js`,
`services/orders.js`, `controllers/commerce.js`, `controllers/auth.js`,
`middleware/security.js`, `app.js`, `.env.example`, pruebas existentes;
`client/src/services/api.js`, `components/UI.jsx`, `pages/Cart.jsx`,
`pages/Account.jsx`, `pages/Admin.jsx`, `layouts/AdminLayout.jsx`, `App.jsx`,
`main.jsx`; y `README.md`. Incluyen la conexión entre dominios y CORS recuperados
de la rama con la corrección previa.

## Validación

- `npm run build`: compilación de producción.
- `npm test`: lógica y HTTP, permisos, redondeo, stock, idempotencia, snapshots,
  revisión, reenvío, filtros, almacenamiento privado simulado y persistencia SQLite
  entre procesos.
- `npm run lint -w client`: análisis estático del frontend.
- `PLAYWRIGHT_CHANNEL=msedge npm run test:e2e`: compra en efectivo y transferencia,
  cambio de método, comprobante obligatorio, vista previa y descarga, rechazo y
  reenvío, aprobación, configuración persistente y pantallas móvil/tablet/escritorio;
  además de los recorridos existentes de tienda, usuarios y solicitudes 3D.
- Migraciones `001`, `002`, `003` ejecutadas en PostgreSQL aislado con PGlite:
  preservación de pedidos históricos, reejecución de `003`, conservación de ajustes
  y RLS. Esto no sustituye la comprobación final contra Supabase publicado.
