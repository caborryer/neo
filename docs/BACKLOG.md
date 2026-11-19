# Neo — Backlog del MVP

Detalle completo (criterios Gherkin, casos borde) en el documento de Claude: <https://claude.ai/artifact/GbqRKkmc34XxKMMpJWtBW1>. Este archivo es el índice de trabajo; actualiza el estado aquí al avanzar.

**Plazo del MVP:** mié 18 nov – mar 1 dic 2026 (10 días hábiles). **Prioridad:** Alta (MVP) · Media (si hay holgura) · Baja (posterior).

## Fases

| Fase | Contenido | Sprint | Días-persona |
| --- | --- | --- | --- |
| 0 | Estructura base y UI | 1 | 3 |
| 1 | Autenticación, usuarias y acceso | 1 | 6 |
| 2 | Entrenamientos, calendario y sesiones | 1 | 8 |
| 3 | Nutrición y diario alimenticio | 2 | 8 |
| 4 | Dashboards, adherencia y notificaciones | 2 | 5 |
| 5 | Pruebas, pulido y despliegue | 2 | 4 |

## Historias

| ID | Título | Pantalla | Prioridad | Fase | Estado |
| --- | --- | --- | --- | --- | --- |
| HU-01 | Iniciar y cerrar sesión | — | Alta | 1 | Hecha (Fase 1) |
| HU-02 | Invitación, activación y recuperación de contraseña | — | Alta | 1 | Hecha (Fase 1) |
| HU-03 | Control de acceso por rol, estado y vigencia | — | Alta | 1 | Hecha (Fase 1) |
| HU-04 | Shell responsive, navegación y estados de UI | — | Alta | 0 | Hecha |
| HU-05 | Crear usuaria | C02 | Alta | 1 | Hecha (Fase 1) |
| HU-06 | Listar, buscar y filtrar usuarias | C02 | Alta | 1 | Hecha (Fase 1) |
| HU-07 | Gestionar acceso (activar, suspender, desactivar, reactivar) | C02 | Alta | 1 | Hecha (Fase 1) |
| HU-08 | Vista 360 de una usuaria | C02 | Media | 4 | Hecha (Fase 4) |
| HU-09 | Crear y publicar clases con video de YouTube | C03/C04 | Alta | 2 | Hecha (Fase 2) |
| HU-10 | Asignar, reprogramar y cancelar entrenamientos | C03 | Alta | 2 | Hecha (Fase 2) |
| HU-11 | Constructor de planes nutricionales | C06 | Alta | 3 | Hecha (Fase 3) |
| HU-12 | Versionar, publicar y asignar planes | C06 | Alta | 3 | Hecha (Fase 3) |
| HU-13 | Revisar el diario alimenticio | C07 | Alta | 3 | Hecha (Fase 3) |
| HU-14 | Dashboard de la Coach | C01 | Alta | 4 | Hecha (Fase 4) |
| HU-15 | Configuración de la Coach | C10 | Baja | 4 | Hecha (Fase 4) |
| HU-16 | Dashboard de inicio de la usuaria | U01 | Alta | 4 | Hecha (Fase 4) |
| HU-17 | Calendario de entrenamientos | U02 | Alta | 2 | Hecha (Fase 2) |
| HU-18 | Detalle del entrenamiento y reproductor | U03 | Alta | 2 | Hecha (Fase 2) |
| HU-19 | Ejecutar y completar la sesión | U03 | Alta | 2 | Hecha (Fase 2) |
| HU-20 | Formulario post-entrenamiento | U04 | Alta | 2 | Hecha (Fase 2) |
| HU-21 | Consultar mi plan nutricional | U05 | Alta | 3 | Hecha (Fase 3) |
| HU-22 | Registrar el diario alimenticio con foto | U06 | Alta | 3 | Hecha (Fase 3) |
| HU-23 | Horarios y recordatorios de comida | U05 | Media | 4 | Hecha (Fase 4) |
| HU-24 | Perfil y preferencias | U08 | Media | 4 | Hecha (Fase 4) |
| HU-25 | Notificaciones internas | — | Media | 4 | Hecha (Fase 4) |
| HU-26 | Cálculo de adherencia | — | Alta | 4 | Hecha (Fase 4) |
| HU-27 | Alertas de usuarias en riesgo | C01 | Media | 4 | Hecha (Fase 4) |
| HU-28 | Auditoría, privacidad y consentimiento | — | Alta | 1 | Hecha (auditoría en Fase 1; consentimiento en Fase 4) |
| HU-29 | Retos: gestión de la Coach | C08 | Baja | Posterior | Fuera del MVP |
| HU-30 | Retos: participación de la usuaria | U07 | Baja | Posterior | Fuera del MVP |
| HU-31 | Estadísticas avanzadas | C05 | Baja | Posterior | Fuera del MVP |
| HU-32 | Mensajería individual | C09 | Baja | Posterior | Fuera del MVP |
| HU-33 | Gestión de contenido | C04 | Baja | Posterior | Fuera del MVP |

## Línea de corte (si hay atraso)

1. Gráficos del dashboard de la Coach (quedan solo KPIs).
2. HU-08 limitada a Resumen, Entrenamientos y Acceso.
3. HU-25 solo contador y lista simple.
4. HU-24 sin foto ni preferencias.
5. HU-23 y HU-15.

No se recortan: autenticación, autorización, versionado de planes ni la prueba E2E.
