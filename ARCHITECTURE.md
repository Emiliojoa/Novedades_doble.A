# Novedades Doble A — primera versión

## Decisiones previas a la implementación

Frontend React + JavaScript + Vite + React Router. API REST Express en JavaScript, mismo origen en producción y proxy Vite en desarrollo. PostgreSQL en Supabase como base principal, con esquema privado `store` y acceso exclusivo desde Express; se conserva un adaptador SQLite para desarrollo aislado y pruebas. La capa de base de datos adapta parámetros y transacciones; los servicios mantienen las reglas de negocio. No se cargan productos o clientes simulados.

La selección de Supabase se incorporó al recibir las credenciales durante la implementación. Las tablas existentes en `public` quedan intactas. El frontend no recibe claves de Supabase. La secret key solo se utiliza en el servidor para Storage; la persistencia usa `DATABASE_URL`. La autenticación propia con sesiones opacas vive en `store.users`, no en Supabase Auth.

Dirección visual: tienda tecnológica clara, azul eléctrico, títulos de alto contraste y espacios amplios; administración compacta con navegación independiente.

## Entidades y relaciones

- User: nombre, apellido, email único, teléfono, hash de contraseña, rol CLIENT/ADMIN.
- Session: token aleatorio almacenado como hash, usuario, vencimiento. Varias sesiones por usuario.
- Category: nombre y parent_id opcional. Dos niveles, categorías y subcategorías.
- Product: nombre, descripción, precio en centavos, stock, mínimo, imagen, categoría, subcategoría, tipo PRODUCTO/IMPRESION_3D/PERSONALIZADO, activo, destacado, fechas. Campos opcionales de precio mayorista y mínimo mayorista reservados para ampliación.
- CartItem: usuario + producto únicos, cantidad; no existe carrito anónimo.
- Order: usuario, fecha, estado, total en centavos. OrderItem: producto, nombre y precio congelados, cantidad, subtotal.
- QuoteRequest: usuario, nombre de diseño, descripción, cantidad, referencia y estado; preparada para incorporar archivos y presupuesto.

Las transacciones verifican y descuentan stock al crear un pedido. Cancelar devuelve el stock una sola vez. La cancelación es terminal; entregado es terminal. Los productos se desactivan para preservar referencias e historial. No se admiten pedidos sin stock ni importes controlados por el cliente. Las mutaciones de catálogo/carrito/pedidos se serializan con un advisory lock transaccional PostgreSQL (y una cola en SQLite), una decisión simple apropiada para el volumen inicial; a mayor escala se puede sustituir por bloqueos por usuario/producto. Las lecturas siguen siendo concurrentes. Los importes se almacenan en centavos enteros.

## Rutas frontend

Públicas: /, /productos, /productos/:id, /categorias, /impresiones-3d, /login, /registro.
Autenticadas: /carrito, /perfil, /pedidos/:id.
ADMIN: /admin, /admin/productos, /admin/stock, /admin/categorias, /admin/pedidos, /admin/pedidos/:id, /admin/clientes, /admin/solicitudes.

## API

- POST /api/auth/register, /login, /logout; GET /api/auth/me.
- GET /api/products y /:id; POST /api/products, PUT/DELETE /api/products/:id (ADMIN).
- GET /api/categories; POST /api/categories, PUT/DELETE /api/categories/:id (ADMIN).
- GET/DELETE /api/cart; POST /api/cart/items; PUT/DELETE /api/cart/items/:id (autenticadas).
- POST/GET /api/orders; GET /api/orders/:id (propietario o ADMIN).
- GET /api/admin/stats, /products, /stock, /orders, /customers, /quotes; PATCH /api/admin/orders/:id/status, /quotes/:id/status.
- POST /api/uploads (ADMIN, imágenes PNG/JPEG/WebP verificadas, límite 5 MB).
- POST/GET /api/quotes (autenticadas).

## Autenticación y límites

Contraseñas con scrypt y sal individual; cookie de sesión HttpOnly, SameSite=Lax y Secure en producción, token aleatorio de 256 bits con hash en base de datos, vencimiento y revocación en logout. Control de origen contra CSRF en mutaciones, límites de intentos de acceso, Helmet, SQL parametrizado, validación Zod estricta, roles comprobados en el servidor. Registro no admite role. Sesión de siete días.

El primer ADMIN se crea mediante comando y variables de entorno, nunca desde registro público. No se incluyen credenciales ni catálogo de ejemplo. Pagos online, reglas mayoristas y carga de archivos STL/3MF son ampliaciones posteriores; esta versión registra pedidos y solicitudes de presupuesto, no cobros.
