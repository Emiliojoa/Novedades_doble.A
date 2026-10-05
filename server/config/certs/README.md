# Certificado público de Supabase

`supabase-ca.crt` es una CA pública, no una clave privada.

Descargado de https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

Se usa junto a las CA de Node para verificar TLS y el hostname, según https://supabase.com/docs/guides/platform/ssl-enforcement.

Para sustituirlo cuando rote, descargar la CA desde Database Settings en Supabase y configurar `DATABASE_CA_PATH`. No deshabilitar la verificación del certificado para conexiones remotas.
