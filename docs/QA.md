# Neo — Lista de verificación manual (QA)

Ejecuta esta lista en el servidor de pruebas antes de cada entrega. Ningún flujo se ha probado en un navegador real durante el desarrollo; las pruebas automáticas usan base simulada, y la suite E2E cubre solo el recorrido de acceso.

## Automatizadas
| Qué | Comando |
| --- | --- |
| Unitarias/integración (API, web, validación) | `npm test` |
| Tipos | `npm run typecheck` |
| Compilación | `npm run build` |
| E2E (Playwright) | `npm run test:e2e` |

**E2E, requisitos:** Postgres y Mailpit levantados (`npm run infra:up`), una base desechable (`E2E_DATABASE_URL`, el nombre debe contener `e2e` o `test`; **se borra en cada corrida**) y migraciones commiteadas. Primera vez: `npx playwright install chromium`. Cubre: invitación → activación por correo → login → bloqueo a zona Coach → suspensión; rutas privadas, 401 sin sesión, CSRF, error genérico de login, cabeceras y cookies HttpOnly.

## Manual — Coach
- [ ] Login, logout, recuperar contraseña (llega correo, enlace de un solo uso).
- [ ] Crear usuaria, reenviar invitación, editar datos, suspender/reactivar/fecha de expiración.
- [ ] Crear ejercicios, entrenamientos, asignarlos a una usuaria; ver calendario.
- [ ] Crear plan nutricional y publicarlo; ver revisión de diario de comidas y comentar.
- [ ] Dashboard: adherencia, alertas de riesgo, seguimiento (marcar atendida), umbrales en ajustes.
- [ ] Vista 360 de una usuaria; historial de acceso.
- [ ] Notificaciones internas aparecen al recibir feedback/registro de comida.

## Manual — Usuaria
- [ ] Activar cuenta desde el correo; iniciar sesión; banner de consentimiento ("Acepto").
- [ ] Sin consentimiento no se puede subir foto (mensaje claro).
- [ ] Ver entrenamiento del día, marcar completado, enviar feedback (Sí/Parcial/No, sensación, comida previa).
- [ ] Mi plan nutricional, diario de comidas (borrador → enviar a la Coach), foto de comida.
- [ ] Perfil: editar datos, cambiar contraseña (cierra otras sesiones), horarios de comida, preferencias de recordatorio.
- [ ] Estadísticas y retos.

## Seguridad
- [ ] Usuaria no accede a `/coach/*` ni a recursos de otra usuaria (respuesta 404/403).
- [ ] Usuaria suspendida no puede entrar ni usar una sesión abierta.
- [ ] Fotos solo visibles para su dueña y la Coach (URL directa sin sesión → 401).
- [ ] La API en producción rechaza arrancar con secretos de ejemplo.

## Responsive y accesibilidad
- [ ] 360 px, 768 px y 1280 px sin desbordes; menú móvil funcional.
- [ ] Navegación solo con teclado; foco visible; modales atrapan el foco y cierran con Esc.
- [ ] Contraste legible; formularios con etiquetas y errores asociados.
- [ ] Probar en Chrome, Safari (iOS) y Firefox.

## Operación
- [ ] `/api/v1/health` responde con `database: up`.
- [ ] Backup manual y restauración probada en servidor de pruebas.
- [ ] Certificado HTTPS emitido y redirección http→https.
