# Neo — Auditoría de seguridad (OWASP Top 10)

Revisión del código de la API y la web (noviembre 2026). Alcance: inyección, control de acceso, exposición de datos y validación de entradas. No incluye pruebas de intrusión dinámicas ni revisión de la infraestructura real del servidor.

## Lo que se verificó y está bien
| Área | Resultado |
|---|---|
| Inyección SQL | La única consulta cruda (`$queryRaw` en `/health`) es una constante sin entradas. El resto usa Prisma (parametrizado). El orden del listado usa lista blanca. |
| Inyección de comandos / NoSQL | No hay `exec`, `eval` ni NoSQL. |
| XSS | Sin `dangerouslySetInnerHTML`; el texto de los artículos se muestra como texto. El correo escapa HTML. CSP estricta en Caddy. |
| IDOR | Los recursos de otra usuaria responden 404 (comidas, entrenamientos, sesiones, notificaciones, fotos, retos). Las asignaciones de fotos y comidas verifican propiedad. |
| Escalada de privilegios | Guards globales (límite → CSRF → sesión → rol). `Roles` en cada controlador de Coach. Esquemas `strict` impiden enviar `role`, `status`, etc. |
| Sesión | JWT en cookies HttpOnly + SameSite, refresh con rotación y detección de reutilización, suspensión inmediata, tokens guardados solo como hash. |
| Secretos | La API se niega a arrancar en producción con secretos de ejemplo. `.env` está en `.gitignore`. Postgres y la API no exponen puertos al exterior. |

## Hallazgos y correcciones aplicadas
| # | Gravedad | Hallazgo | Corrección |
|---|---|---|---|
| 1 | **Media** | Las fotos subidas conservaban el EXIF (GPS, modelo del teléfono, fecha). Una foto de comida podía revelar el domicilio de la usuaria, y la miniatura de un contenido publicado la ven todas. | `storage/image-sanitizer.ts`: re-codifica con `sharp` (sin metadatos, orientación aplicada, máx. 2048 px, rechaza imágenes corruptas y bombas de descompresión; destruye contenido oculto tras la imagen). |
| 2 | **Media** | Fuerza bruta distribuida: el límite de intentos era solo por IP; un atacante que rota IP podía probar contraseñas contra una cuenta. | `auth/login-attempt-limiter.ts`: 10 fallos en 15 min por cuenta → 429. Cuenta también los correos inexistentes. |
| 3 | **Media** | La subida leía el archivo completo en memoria antes de validar su tamaño (agotamiento de memoria sin el proxy). | `FileInterceptor` con `limits` (25 MB, 1 archivo, 0 campos). |
| 4 | **Baja** | Enumeración de correos por tiempo en `forgot-password`: tardaba más si el correo existía (envío del mensaje). | La tarea corre en segundo plano; la respuesta es siempre inmediata e igual. |
| 5 | **Baja** | Política de contraseñas débil (mínimo 8, sin lista de contraseñas comunes). | Mínimo 10 y bloqueo de contraseñas triviales (`passwordSchema`). |
| 6 | **Baja** | `login` y `change-password` sin máximo de largo: entradas enormes cuestan CPU en argon2. | Máximo 128 caracteres. |
| 7 | **Baja** | JWT sin algoritmo fijado al verificar. | `algorithms: ['HS256']` al firmar y verificar. |
| 8 | **Baja** | Los logs de error de correo guardaban el correo completo (dato personal). | Se enmascara (`a***@dominio.com`). |

## Riesgos conocidos que NO se cambiaron
- **Dependencias (`npm audit`: 4 altas)**: cadena `prisma → @prisma/config → deepmerge-ts / effect` (ReDoS y agotamiento de pila al procesar configuraciones). Afecta al CLI de Prisma usado en migraciones, no a peticiones de usuarias. Se corrige actualizando Prisma; conviene hacerlo en una fase aparte con pruebas. Revisa `npm audit` periódicamente (Dependabot en GitHub).
- **Coach única**: los endpoints de Coach ven a todas las usuarias (`role: USER`), no solo las de su `coachId`. Correcto para una sola Coach; si se agregan más, hay que filtrar por `coachId` (IDOR horizontal entre Coaches).
- **Límites de tasa en memoria**: sirven con una sola instancia de la API. Con varias instancias se necesita un almacén compartido (Redis).
- **CSP con `style-src 'unsafe-inline'`**: necesario para estilos en línea de la UI; el riesgo es bajo porque `script-src` es `'self'`.
- **Ley 1581 de 2012 (Colombia)**: hay datos de salud. Falta una política de tratamiento de datos revisada por un abogado, y definir retención y borrado de cuentas y fotos.
- **Sin 2FA** para la Coach (cuenta con acceso a todos los datos). Recomendado a futuro.
- Las fotos se guardan sin cifrar a nivel de aplicación (cifrado de disco del proveedor sí aplica).

## Antes de lanzar
1. `npm audit` y actualizar lo que se pueda.
2. Probar la restauración de un backup.
3. SMTP real con SPF/DKIM; acceso al servidor solo por llave SSH.
4. Prueba de intrusión externa o al menos un escaneo (OWASP ZAP) contra un entorno de pruebas.

## Mensajería (HU-32)

- **Control de acceso:** la usuaria nunca envía un identificador de hilo; el servidor usa su sesión, así que no existe IDOR posible. La Coach solo abre hilos de usuarias activas (otro id → 404).
- **XSS:** el cuerpo se guarda como texto plano y React lo escapa; hay test que lo comprueba.
- **Abuso:** límite de 20 envíos por minuto por cliente, 2000 caracteres por mensaje, un solo aviso por hilo mientras no se lea.
- **Privacidad:** el contenido de los mensajes no se escribe en el log de auditoría ni en los logs de la aplicación.
