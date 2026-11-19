**NEO**

Especificación maestra funcional, técnica y de diseño UI/UX

*Versión 3.0 · 17 de noviembre de 2026*

| **Atributo**      | **Definición**                                                                            |
|-------------------|-------------------------------------------------------------------------------------------|
| Tipo de documento | Documento maestro de arquitectura de software, diseño UI/UX y requerimientos funcionales. |
| Producto          | Plataforma web de entrenamiento, nutrición y acompañamiento personalizado.                |
| Audiencias        | Una Coach y múltiples usuarias.                                                           |
| Estado            | Especificación consolidada; las decisiones operativas pendientes se identifican al final. |

Propósito: servir como referencia para el diseño, desarrollo, pruebas y despliegue de Neo.

# 1. Definición general del producto

## 1.1. ¿Qué es Neo?

Neo es una plataforma web de entrenamiento físico, nutrición y acompañamiento personalizado. Conecta a una Coach con sus usuarias para administrar entrenamientos, asignar planes nutricionales, realizar seguimiento de actividades, registrar alimentación y medir resultados.

- Aplicación de usuaria: enfocada en entrenamiento, nutrición, motivación y seguimiento personal.

- Panel administrativo de Coach: enfocado en gestión de usuarias, asignaciones, seguimiento, contenido y estadísticas.

## 1.2. Decisiones de producto confirmadas

| **Decisión**  | **Definición**                                                                         |
|---------------|----------------------------------------------------------------------------------------|
| Aplicación    | Web responsive; acceso mediante navegador.                                             |
| Coaches       | Una Coach.                                                                             |
| Usuarias      | Múltiples usuarias.                                                                    |
| Relación      | Cada usuaria pertenece a una sola Coach.                                               |
| Membresías    | Sin pagos, suscripciones ni renovaciones automáticas.                                  |
| Acceso        | Gestionado manualmente por la Coach.                                                   |
| Videos        | YouTube no listado inicialmente; privado como alternativa sujeta a permisos de Google. |
| Nutrición     | Planes alimenticios creados y asignados por la Coach.                                  |
| Frontend      | React + TypeScript + Vite + Tailwind CSS.                                              |
| Backend       | NestJS modular.                                                                        |
| Base de datos | PostgreSQL + Prisma.                                                                   |

## 1.3. Consideración web, no nativa

- No se desarrollará con React Native ni Flutter.

- No se crearán aplicaciones independientes para iOS y Android.

- No se requiere publicación en App Store o Google Play.

- Las usuarias ingresan mediante una URL.

- La interfaz será responsive; usuaria mobile-first y panel Coach desktop-first.

- Una PWA puede evaluarse posteriormente, pero no forma parte del MVP.

## 1.4. Roles

```ts
export enum UserRole {
  COACH = "COACH",
  USER = "USER"
}
```


### Coach

- Crear usuarias y administrar accesos.

- Crear entrenamientos y asignar rutinas.

- Crear y asignar planes nutricionales.

- Revisar diarios alimenticios y dejar observaciones.

- Crear retos y administrar contenido.

- Consultar estadísticas y acompañar a las usuarias.

### Usuaria

- Consultar dashboard, calendario y entrenamientos asignados.

- Ejecutar rutinas y registrar sesiones.

- Enviar retroalimentación.

- Consultar planes nutricionales y registrar comidas.

- Participar en retos y consultar progreso.

- Administrar su perfil y preferencias.

No existirá un rol para administrar múltiples Coaches ni un registro público de Coaches.

# 2. Inventario de pantallas

## 2.1. Aplicación de usuaria

## U01. Inicio / Dashboard

Componentes:

- Header con logo Neo y avatar.

- Saludo personalizado y mensaje motivacional.

- Tarjeta de progreso semanal: entrenamientos completados/meta.

- Barra de progreso.

- Tarjeta del entrenamiento del día con miniatura, nombre, duración y nivel.

- Botón Comenzar entrenamiento.

- Confirmación de sesión completada.

- Bottom navigation: Inicio, Entrenamientos, Nutrición, Retos y Perfil.

Información dinámica:

- Nombre, avatar, entrenamientos completados, meta semanal, progreso, próximo entrenamiento, duración, nivel, estado, resumen nutricional y retos activos.

Acciones:

- Comenzar entrenamiento abre el detalle.

- Progreso abre calendario.

- Nutrición abre el plan.

- Retos abre retos.

- Perfil abre configuración.

## U02. Calendario de entrenamientos

Componentes:

- Header y selector de mes.

- Navegación entre meses.

- Calendario semanal y día seleccionado.

- Lista de rutinas con miniatura, duración, nivel y estado.

Información dinámica:

- Fecha, hora opcional, clase, duración, nivel, imagen y estado.

Acciones:

- Cambiar mes, seleccionar día, consultar rutinas, abrir detalle e historial.

## U03. Detalle de entrenamiento

Componentes:

- Header, nombre, duración, nivel y favorito.

- Reproductor YouTube.

- Pestañas Descripción, Tips y Técnica.

- Materiales, instrucciones y botón Marcar como completada.

Información dinámica:

- Full Body, 50–60 minutos, nivel intermedio, materiales y descripción.

Acciones:

- Reproducir video, consultar información y registrar finalización.

## U04. Formulario post-entrenamiento

Componentes:

- Selector de finalización, rating de 1 a 5, descripción, pregunta sobre alimentación previa y botón Guardar.

Información dinámica:

- Completaste la sesión: Sí/No/Parcial; cómo te sentiste; si comió antes; qué comió; motivo si no completó.

Acciones:

- Si es parcial, solicitar porcentaje; si no completó, solicitar motivo. Guardar asociado a la sesión e impedir duplicados.

## U05. Nutrición

Componentes:

- Pestañas Mi plan, Diario de alimentación y Horarios/recordatorios.

- Día seleccionado, comidas, horarios, alimentos, cantidades y recomendaciones.

Información dinámica:

- Plan, vigencia, desayuno, media mañana, almuerzo, merienda, cena y alimentos.

Acciones:

- Consultar el plan en modo solo lectura y navegar por días.

## U06. Diario de alimentación

Componentes:

- Selector de fecha, calendario semanal, tarjetas por comida, foto, descripción, estado y acciones Guardar/Enviar a Coach.

Información dinámica:

- Desayuno, media mañana, almuerzo, merienda, cena, fotografía y descripción.

Acciones:

- Registrar lo realmente consumido aunque difiera del plan; guardar borrador o enviar.

## U07. Retos

Componentes:

- Banner principal, retos secundarios, fechas, objetivo, progreso y estado de participación.

Información dinámica:

- ABS September, Leg Week, Core Challenge y Consistency como ejemplos ilustrativos.

Acciones:

- Consultar reto, inscribirse y consultar progreso.

## U08. Perfil

Componentes:

- Avatar, datos personales, zona horaria, objetivos, preferencias, horarios, notificaciones, cambio de contraseña y cierre de sesión.

Información dinámica:

- Nombre, correo, foto, preferencias y configuración.

Acciones:

- Editar información permitida y gestionar seguridad.

### Estados de entrenamiento

```prisma
enum WorkoutAssignmentStatus {
  SCHEDULED = "SCHEDULED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  PARTIAL = "PARTIAL",
  SKIPPED = "SKIPPED",
  CANCELLED = "CANCELLED"
}
```


Los días de descanso se modelan como eventos de calendario, no como entrenamientos completados.

### Estados del diario

```prisma
enum MealLogStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  REVIEWED = "REVIEWED",
  NEEDS_CHANGES = "NEEDS_CHANGES"
}
```


## 2.2. Panel administrativo de Coach

## C01. Dashboard

Componentes:

- KPI de usuarias activas, entrenamientos realizados, pendientes y metas cumplidas.

- Gráfico de adherencia, meta semanal, resumen nutricional y usuarias en riesgo.

- Filtro temporal.

Acciones / comportamiento:

- Los indicadores deben provenir de datos reales; los números del mockup son ilustrativos.

## C02. Gestión de usuarias

Componentes:

- Buscador, filtros y tabla con avatar, nombre, correo, fecha de registro, acceso, entrenamientos, meta semanal y acciones.

Acciones / comportamiento:

- Crear, editar, activar, suspender, desactivar, reactivar, consultar perfil, progreso, planes y registros.

## C03. Calendario Coach

Componentes:

- Calendario mensual, selector de fecha, formulario de clase y detalle de asignaciones.

Acciones / comportamiento:

- Crear, editar, asignar, programar, reprogramar y cancelar.

## C04. Gestión de contenido

Componentes:

- Filtros y tarjetas con imagen, categoría, título, fecha y estado.

Acciones / comportamiento:

- Crear, editar, publicar, despublicar y eliminar. Categorías: recetas, nutrición, tips, técnica y videos.

## C05. Estadísticas

Componentes:

- Selector de período, entrenamientos, metas, alimentación, usuarias activas, pendientes, riesgo, gráficos y adherencia.

Acciones / comportamiento:

- Consultar estadísticas globales e individuales.

## C06. Constructor de planes nutricionales

Componentes:

- Listado, creación y edición de planes; días, comidas, alimentos, cantidades, recomendaciones, versiones y asignaciones.

Acciones / comportamiento:

- Crear borradores, reutilizar plantillas, publicar versiones y asignar planes.

## C07. Seguimiento nutricional

Componentes:

- Lista de registros, filtros por usuaria y fecha, foto, descripción, plan relacionado, estado y comentarios.

Acciones / comportamiento:

- Revisar registros, dejar observaciones y solicitar aclaraciones.

## C08. Retos

Componentes:

- Gestión de retos, objetivos, fechas y participantes.

Acciones / comportamiento:

- Crear, publicar y consultar progreso.

## C09. Mensajes

Componentes:

- Listado de conversaciones, mensajes individuales y estado de lectura.

Acciones / comportamiento:

- Comunicación individual; alcance exacto pendiente de decisión.

## C10. Configuración

Componentes:

- Datos de Coach, preferencias, horarios, seguridad y notificaciones.

Acciones / comportamiento:

- Actualizar configuración.

# 3. Sistema de diseño (Design System)

## 3.1. Identidad visual

La identidad debe transmitir bienestar, motivación, cercanía, profesionalismo, energía y simplicidad. Mantener rosa suave, verde, azul petróleo y fondos claros.

## 3.2. Paleta de colores

| **Token**    | **HEX aproximado** | **Uso**                         |
|--------------|--------------------|---------------------------------|
| Primary      | \#E4798D           | Botones y acciones principales. |
| Primary Dark | \#D95770           | Hover y énfasis.                |
| Secondary    | \#1C796A           | Progreso y estados positivos.   |
| Dark         | \#283C43           | Títulos y navegación.           |
| Background   | \#FCF8F7           | Fondo general.                  |
| Surface      | \#FFFFFF           | Tarjetas y superficies.         |
| Border       | \#DEDEDE           | Bordes.                         |
| Muted        | \#64747A           | Texto secundario.               |
| Pink Light   | \#F8DDE2           | Fondos destacados.              |
| Green Light  | \#E8F3EF           | Fondos positivos.               |
| Warning      | \#F2B84B           | Advertencias.                   |
| Neutral      | \#F4F5F5           | Superficies neutras.            |

No depender únicamente del color para representar estados; acompañar con texto o iconos.

## 3.3. Tipografía

| **Elemento**      | **Tamaño** | **Peso**     |
|-------------------|------------|--------------|
| H1                | 28–32 px   | Bold 700     |
| H2                | 22–24 px   | Semibold 600 |
| H3                | 18–20 px   | Semibold 600 |
| Título de tarjeta | 15–16 px   | Semibold 600 |
| Texto general     | 14 px      | Regular 400  |
| Texto secundario  | 12 px      | Regular 400  |
| Caption           | 11 px      | Regular 400  |
| Botones           | 14 px      | Semibold 600 |

Tipografía recomendada: Inter. Títulos alineados a la izquierda y jerarquías consistentes.

## 3.4. Espaciado

| **Token**  | **Valor** |
|------------|-----------|
| spacing-1  | 4 px      |
| spacing-2  | 8 px      |
| spacing-3  | 12 px     |
| spacing-4  | 16 px     |
| spacing-5  | 20 px     |
| spacing-6  | 24 px     |
| spacing-8  | 32 px     |
| spacing-10 | 40 px     |
| spacing-12 | 48 px     |

## 3.5. Bordes y sombras

| **Elemento**       | **Valor** |
|--------------------|-----------|
| Tarjetas           | 12–16 px  |
| Botones            | 10–12 px  |
| Inputs             | 8–10 px   |
| Modales            | 16 px     |
| Avatar             | 50%       |
| Padding móvil      | 16–20 px  |
| Padding escritorio | 24–32 px  |

```css
box-shadow: 0 2px 8px rgba(40, 60, 67, 0.06);
```


## 3.6. Responsive

| **Dispositivo** | **Ancho**     | **Layout**          |
|-----------------|---------------|---------------------|
| Móvil pequeño   | 320–374 px    | Una columna         |
| Móvil           | 375–767 px    | Una columna         |
| Tablet          | 768–1023 px   | Una o dos columnas  |
| Laptop          | 1024–1439 px  | Escritorio          |
| Desktop         | 1440 px o más | Escritorio completo |

- Usuaria: mobile-first; navegación inferior en móvil y navegación lateral/superior en escritorio.

- Coach: desktop-first; sidebar en escritorio, colapsable en tablet y drawer en móvil.

- Tarjetas de ancho completo en móvil, formularios verticales y reproductor adaptable.

## 3.7. Iconografía

| **Función**   | **Lucide React** |
|---------------|------------------|
| Inicio        | House            |
| Entrenamiento | Dumbbell         |
| Nutrición     | Utensils         |
| Retos         | Trophy           |
| Perfil        | UserRound        |
| Calendario    | CalendarDays     |
| Favoritos     | Star             |
| Recordatorios | Bell             |
| Fotografía    | Camera           |
| Progreso      | TrendingUp       |
| Configuración | Settings         |
| Estadísticas  | ChartColumn      |
| Mensajes      | MessageCircle    |
| Completar     | CircleCheck      |

## 3.8. Variables CSS

```tsx
@import "tailwindcss";
@theme {
  --color-neo-primary: #E4798D;
  --color-neo-primary-dark: #D95770;
  --color-neo-green: #1C796A;
  --color-neo-dark: #283C43;
  --color-neo-background: #FCF8F7;
  --color-neo-surface: #FFFFFF;
  --color-neo-border: #DEDEDE;
  --color-neo-muted: #64747A;
  --color-neo-pink-light: #F8DDE2;
  --color-neo-green-light: #E8F3EF;
}
```


# 4. Requerimientos funcionales y reglas de negocio

## 4.1. Autenticación y acceso

```ts
export enum UserStatus {
  PENDING = "PENDING",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  INACTIVE = "INACTIVE"
}
```


| **Estado** | **Comportamiento**                    |
|------------|---------------------------------------|
| PENDING    | Cuenta creada, todavía no habilitada. |
| ACTIVE     | Acceso permitido, sujeto a vigencia.  |
| SUSPENDED  | Acceso temporalmente bloqueado.       |
| INACTIVE   | Acceso desactivado.                   |

- No hay pagos, suscripciones ni renovaciones automáticas.

- La Coach controla accesos; la usuaria no puede modificar su estado.

- Suspender no elimina información.

- Cambios de estado quedan registrados.

- La fecha de expiración es opcional; una cuenta vencida se bloquea aunque figure ACTIVE.

## 4.2. Entrenamientos

- La Coach crea una clase reutilizable, registra video y la publica.

- La Coach asigna la clase a una usuaria y programa una fecha.

- La usuaria consulta el calendario, reproduce el video, ejecuta y registra la sesión.

- La retroalimentación queda relacionada con una sesión.

- Una clase puede asignarse a múltiples usuarias.

- Una asignación puede generar varias sesiones si se permite repetir la rutina.

- Una asignación cancelada no cuenta como pendiente; descanso no cuenta como entrenamiento.

- El progreso se calcula en backend y los registros deben ser idempotentes.

## 4.3. Nutrición

- La Coach crea planes, días, comidas, alimentos y cantidades.

- Los planes pueden guardarse como borradores y reutilizarse como plantillas.

- Una usuaria puede tener múltiples asignaciones históricas, pero un único plan activo para una fecha dada.

- Cada asignación apunta a una versión específica e inmutable.

- Al reemplazar un plan se finaliza la asignación anterior.

- La usuaria consulta el plan en solo lectura.

- El diario registra el consumo real, incluso cuando difiere del plan.

- La Coach puede revisar registros y dejar observaciones.

## 4.4. Constructor nutricional: pasos

- Información general: nombre, descripción, observaciones y duración.

- Configuración de días: lunes a domingo o estructura configurable.

- Configuración de comidas: desayuno, snacks, almuerzo, cena y otras.

- Alimentos: nombre, cantidad, unidad y observaciones.

- Asignación: usuaria y vigencia.

- Publicación: confirmar versión y habilitar acceso.

## 4.5. Diario alimenticio

```ts
export enum MealType {
  BREAKFAST = "BREAKFAST",
  MORNING_SNACK = "MORNING_SNACK",
  LUNCH = "LUNCH",
  AFTERNOON_SNACK = "AFTERNOON_SNACK",
  DINNER = "DINNER",
  OTHER = "OTHER"
}
```


- Registrar comida, fecha, tipo, descripción y fotografía.

- Guardar borrador o enviar a Coach.

- Editar mientras el estado lo permita.

- Consultar comentarios de Coach.

- plannedMealId es opcional para permitir comidas fuera del plan.

## 4.6. Retos

- La Coach define nombre, descripción, objetivo, categoría y vigencia.

- Las actividades válidas alimentan el progreso.

- El progreso no se acepta arbitrariamente desde frontend.

- Una misma actividad no puede contabilizarse dos veces.

- Se conserva historial de participación.

## 4.7. Adherencia

Fórmula inicial:

```text
Adherencia = (entrenamientos completados / entrenamientos programados válidos) × 100
```


Ejemplo: 10 programados, 8 completados, 1 parcial y 1 omitido: adherencia completa 80%. Los parciales se presentan por separado. No incluir descansos ni asignaciones canceladas.

## 4.8. Usuarias en riesgo

| **Condición configurable**                    | **Indicador**          |
|-----------------------------------------------|------------------------|
| 7 días sin entrenar                           | Inactividad.           |
| 3 entrenamientos consecutivos pendientes      | Baja adherencia.       |
| Ausencia prolongada de registros alimenticios | Seguimiento pendiente. |
| Reducción importante de adherencia            | Alerta de seguimiento. |

Las alertas son indicadores de actividad, no diagnósticos médicos. Deben mostrar motivo y permitir registrar una acción de seguimiento.

## 4.9. Notificaciones

- Nuevo entrenamiento, cambio de horario, nuevo plan, reto, recordatorio de comida o entrenamiento, retroalimentación recibida y registro pendiente de revisión.

- MVP: notificaciones internas. Web Push y recordatorios programados pueden incorporarse después.

## 4.10. Estados generales

| **Estado**   | **Comportamiento**                 |
|--------------|------------------------------------|
| Loading      | Skeletons e indicadores.           |
| Empty        | Mensaje y acción recomendada.      |
| Error        | Mensaje y opción de reintentar.    |
| Success      | Confirmación de operación.         |
| Disabled     | Elemento no disponible.            |
| Unauthorized | Acceso denegado.                   |
| Validation   | Errores específicos de formulario. |

# 5. Requerimientos no funcionales

| **ID** | **Requerimiento**                        |
|--------|------------------------------------------|
| RNF-01 | Aplicación web responsive.               |
| RNF-02 | Compatibilidad con navegadores modernos. |
| RNF-03 | HTTPS obligatorio.                       |
| RNF-04 | Autenticación segura.                    |
| RNF-05 | Autorización en backend.                 |
| RNF-06 | Protección de datos personales.          |
| RNF-07 | Almacenamiento privado de imágenes.      |
| RNF-08 | Optimización de imágenes.                |
| RNF-09 | Manejo centralizado de errores.          |
| RNF-10 | Logging y monitoreo.                     |
| RNF-11 | Paginación.                              |
| RNF-12 | Validación de entradas.                  |
| RNF-13 | Auditoría.                               |
| RNF-14 | Accesibilidad.                           |
| RNF-15 | Copias de seguridad.                     |
| RNF-16 | Manejo de zonas horarias.                |
| RNF-17 | Integridad transaccional.                |
| RNF-18 | Versionamiento de planes.                |
| RNF-19 | Protección contra acceso horizontal.     |
| RNF-20 | Diseño adaptable a pantallas pequeñas.   |

# 6. Arquitectura de software

## 6.1. Stack tecnológico

| **Capa**      | **Tecnología**      | **Uso**                   |
|---------------|---------------------|---------------------------|
| Frontend      | React + TypeScript  | Interfaz web.             |
| Build         | Vite                | Compilación y desarrollo. |
| CSS           | Tailwind CSS        | Estilos.                  |
| Componentes   | shadcn/ui           | Componentes accesibles.   |
| Iconos        | Lucide React        | Iconografía.              |
| Routing       | React Router        | Navegación.               |
| Server state  | TanStack Query      | Datos remotos.            |
| Formularios   | React Hook Form     | Gestión de formularios.   |
| Validación    | Zod                 | Validación.               |
| Backend       | NestJS              | API y lógica.             |
| Base de datos | PostgreSQL          | Persistencia.             |
| ORM           | Prisma              | Acceso a datos.           |
| Video         | YouTube             | Reproducción.             |
| Archivos      | S3 compatible       | Almacenamiento privado.   |
| Gráficos      | Recharts            | Analítica.                |
| Testing       | Vitest + Playwright | Pruebas.                  |
| Contenedores  | Docker              | Desarrollo y despliegue.  |

## 6.2. Estilo arquitectónico

Monolito modular. No se recomiendan microservicios en esta etapa: existe una sola Coach, los módulos comparten información, el volumen inicial será controlado y se requiere consistencia transaccional. Cada dominio mantiene módulos, servicios, controladores y DTOs propios.

## 6.3. Diagrama lógico

```text
Navegador Usuaria ─┐
                    ├── React + TypeScript ── NestJS REST API
Navegador Coach ────┘                         │
                                              ├── Auth
                                              ├── Users / Access
                                              ├── Workouts
                                              ├── Nutrition
                                              ├── Challenges
                                              ├── Content
                                              ├── Statistics
                                              └── Notifications
                                                     │
                                                     ├── PostgreSQL
                                                     ├── YouTube
                                                     └── Object Storage privado
```


## 6.4. Estructura del proyecto

```text
neo/
├── apps/
│   ├── web/
│   │   └── src/
│   │       ├── app/ (router, providers, layouts)
│   │       ├── features/
│   │       │   ├── auth/
│   │       │   ├── dashboard/
│   │       │   ├── users/
│   │       │   ├── access-management/
│   │       │   ├── workouts/
│   │       │   ├── calendar/
│   │       │   ├── nutrition/
│   │       │   ├── food-diary/
│   │       │   ├── challenges/
│   │       │   ├── content/
│   │       │   ├── statistics/
│   │       │   ├── notifications/
│   │       │   └── profile/
│   │       ├── components/
│   │       ├── hooks/
│   │       ├── services/
│   │       ├── types/
│   │       ├── utils/
│   │       └── styles/
│   └── api/
│       ├── src/
│       │   ├── auth/
│       │   ├── users/
│       │   ├── access-management/
│       │   ├── workouts/
│       │   ├── workout-assignments/
│       │   ├── workout-sessions/
│       │   ├── workout-feedback/
│       │   ├── nutrition/
│       │   ├── challenges/
│       │   ├── content/
│       │   ├── statistics/
│       │   ├── notifications/
│       │   ├── storage/
│       │   ├── common/
│       │   ├── database/
│       │   └── main.ts
│       └── prisma/
│           ├── schema.prisma
│           └── migrations/
├── packages/
│   ├── shared-types/
│   ├── validation/
│   └── config/
├── docker-compose.yml
├── package.json
├── .env.example
└── README.md
```


### Responsabilidades por capa

- Frontend: renderizar interfaces, navegación, validación visual, consultas a API, estado visual y feedback.

- Backend: reglas de negocio, autenticación, autorización, validación, transacciones, persistencia y archivos.

- Base de datos: integridad, relaciones, historial y consistencia.

# 7. Modelo de datos y base de datos

## 7.1. Dominios y entidades

| **Dominio**    | **Entidades**                                                                                                        |
|----------------|----------------------------------------------------------------------------------------------------------------------|
| Usuarios       | User                                                                                                                 |
| Accesos        | UserAccessEvent                                                                                                      |
| Autenticación  | RefreshSession, PasswordResetToken                                                                                   |
| Entrenamientos | Workout, WorkoutAssignment, WorkoutSession, WorkoutFeedback                                                          |
| Nutrición      | NutritionPlan, NutritionPlanVersion, NutritionPlanDay, NutritionPlanMeal, NutritionPlanFood, NutritionPlanAssignment |
| Diario         | MealLog, FoodSchedule                                                                                                |
| Retos          | Challenge, ChallengeParticipant, ChallengeActivity                                                                   |
| Contenido      | Content                                                                                                              |
| Archivos       | MediaAsset                                                                                                           |
| Notificaciones | Notification                                                                                                         |
| Auditoría      | AuditLog                                                                                                             |

## 7.2. Diagrama entidad-relación resumido

```text
User (Coach) 1 ── N User (usuarias)
User 1 ── N UserAccessEvent
Workout 1 ── N WorkoutAssignment
User 1 ── N WorkoutAssignment
WorkoutAssignment 1 ── N WorkoutSession
WorkoutSession 1 ── 0..1 WorkoutFeedback
NutritionPlan 1 ── N NutritionPlanVersion
NutritionPlanVersion 1 ── N NutritionPlanDay
NutritionPlanDay 1 ── N NutritionPlanMeal
NutritionPlanMeal 1 ── N NutritionPlanFood
NutritionPlanVersion 1 ── N NutritionPlanAssignment
User 1 ── N NutritionPlanAssignment
User 1 ── N MealLog
Challenge 1 ── N ChallengeParticipant
ChallengeParticipant 1 ── N ChallengeActivity
User 1 ── N Notification
User 1 ── N MediaAsset
```


## 7.3. User

```prisma
enum UserRole { COACH USER }
enum UserStatus { PENDING ACTIVE SUSPENDED INACTIVE }
model User {
  id              String     @id @default(uuid())
  firstName       String
  lastName        String
  email           String     @unique
  passwordHash    String
  role            UserRole
  status          UserStatus @default(PENDING)
  coachId         String?
  coach           User?      @relation("CoachUsers", fields: [coachId], references: [id])
  clients         User[]     @relation("CoachUsers")
  timezone        String     @default("America/Bogota")
  avatarAssetId   String?
  accessExpiresAt DateTime?
  activatedAt     DateTime?
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
  @@index([coachId])
  @@index([role, status])
}
```


- La Coach no tiene coachId; cada usuaria debe tenerlo.

- El backend verifica que coachId corresponda a la Coach única.

- La unicidad de Coach se refuerza en PostgreSQL con índice único parcial o mecanismo equivalente.

- No se permite cambiar Coach desde interfaz de usuaria.

## 7.4. UserAccessEvent

```prisma
model UserAccessEvent {
  id             String     @id @default(uuid())
  userId         String
  changedById    String
  previousStatus UserStatus?
  newStatus      UserStatus
  reason         String?
  createdAt      DateTime   @default(now())
  @@index([userId, createdAt])
}
```


La actualización del estado y la creación del evento deben ejecutarse en una misma transacción.

## 7.5. Workout

```json
{
  "id": "workout-001",
  "title": "Full Body",
  "description": "Rutina completa para activar todo el cuerpo.",
  "durationMinutes": 55,
  "difficulty": "INTERMEDIATE",
  "category": "FULL_BODY",
  "videoProvider": "YOUTUBE",
  "videoId": "abc123xyz",
  "videoVisibility": "UNLISTED",
  "thumbnailAssetId": "asset-001",
  "equipment": ["Mat de yoga", "Botella de agua"],
  "tips": ["Mantén la espalda recta", "Controla la respiración"],
  "isPublished": true,
  "createdById": "coach-001"
}
```

```prisma
enum VideoProvider { YOUTUBE }
enum VideoVisibility { UNLISTED PRIVATE }
model Workout {
  id               String   @id @default(uuid())
  title            String
  description      String?
  durationMinutes  Int
  difficulty       String
  category         String
  videoProvider    VideoProvider @default(YOUTUBE)
  videoId          String
  videoVisibility  VideoVisibility @default(UNLISTED)
  thumbnailAssetId String?
  equipment        Json?
  tips             Json?
  isPublished      Boolean  @default(false)
  createdById      String
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  assignments      WorkoutAssignment[]
  @@index([isPublished])
}
```


## 7.6. WorkoutAssignment, WorkoutSession y WorkoutFeedback

```json
// WorkoutAssignment
{
  "id": "assignment-001",
  "workoutId": "workout-001",
  "userId": "user-001",
  "scheduledDate": "2026-11-18",
  "status": "SCHEDULED",
  "assignedById": "coach-001"
}
```

```json
// WorkoutSession
{
  "id": "session-001",
  "assignmentId": "assignment-001",
  "startedAt": "2026-11-18T11:00:00Z",
  "completedAt": "2026-11-18T11:52:00Z",
  "status": "COMPLETED",
  "completionPercentage": 100,
  "durationMinutes": 52
}
```

```json
// WorkoutFeedback
{
  "id": "feedback-001",
  "sessionId": "session-001",
  "completed": "YES",
  "feelingRating": 4,
  "feelingDescription": "Me sentí con mucha energía.",
  "ateBeforeWorkout": true,
  "preWorkoutMeal": "Yogur griego, avena y banana"
}
```


- Una clase puede tener múltiples asignaciones.

- Cada asignación pertenece a una usuaria.

- Una asignación puede generar varias sesiones si se permiten repeticiones.

- Cada sesión tiene como máximo una retroalimentación.

- Definir política de repetición antes de imponer unicidad.

- Usar idempotencia para evitar duplicados por reintentos HTTP.

## 7.7. Planes nutricionales y versionamiento

Separar plan lógico, versión, días, comidas, alimentos y asignación. Una versión asignada es inmutable para conservar el historial.

### NutritionPlan

```json
{
  "id": "plan-001",
  "name": "Plan nutricional personalizado",
  "description": "Plan de alimentación semanal",
  "createdById": "coach-001",
  "isTemplate": false,
  "isActive": true
}
```


### NutritionPlanVersion

```json
{
  "id": "version-001",
  "planId": "plan-001",
  "versionNumber": 1,
  "notes": "Primera versión"
}
```


### NutritionPlanDay

```json
{
  "id": "day-001",
  "versionId": "version-001",
  "dayNumber": 1,
  "dayName": "MONDAY"
}
```


### NutritionPlanMeal

```json
{
  "id": "meal-001",
  "dayId": "day-001",
  "mealType": "BREAKFAST",
  "title": "Desayuno",
  "scheduledTime": "07:00",
  "instructions": "Consumir según indicaciones."
}
```


### NutritionPlanFood

```json
{
  "id": "food-001",
  "mealId": "meal-001",
  "name": "Avena",
  "quantity": 50,
  "unit": "GRAMS",
  "notes": null
}
```


### NutritionPlanAssignment

```json
{
  "id": "plan-assignment-001",
  "userId": "user-001",
  "versionId": "version-001",
  "assignedById": "coach-001",
  "startDate": "2026-11-17",
  "endDate": null,
  "status": "ACTIVE"
}
```


- Una usuaria puede tener múltiples asignaciones históricas.

- Cada asignación apunta a una versión específica.

- Solo un plan activo por usuaria para una misma fecha.

- Al reemplazar un plan, finalizar la asignación anterior.

- No eliminar versiones utilizadas históricamente.

- Aplicar exclusion constraint de períodos en PostgreSQL o validación transaccional equivalente.

- Respetar la zona horaria de la usuaria.

## 7.8. MealLog y FoodSchedule

```json
// MealLog
{
  "id": "meal-log-001",
  "userId": "user-001",
  "plannedMealId": "meal-001",
  "mealType": "BREAKFAST",
  "description": "Avena con banano y frutos rojos.",
  "imageAssetId": "asset-001",
  "consumedAt": "2026-11-17T07:15:00Z",
  "status": "SUBMITTED",
  "coachComment": null
}
```

```json
// FoodSchedule
{
  "id": "schedule-001",
  "userId": "user-001",
  "mealType": "BREAKFAST",
  "scheduledTime": "07:00",
  "reminderEnabled": true
}
```


plannedMealId es opcional. Los horarios configurados por la usuaria son independientes de los horarios sugeridos en el plan.

## 7.9. Retos

```json
// Challenge
{
  "id": "challenge-001",
  "name": "ABS SEPTEMBER",
  "description": "Completa 12 sesiones de abdomen.",
  "category": "ABS",
  "goal": 12,
  "goalUnit": "WORKOUT_SESSIONS",
  "startDate": "2026-09-01",
  "endDate": "2026-09-30",
  "isActive": true
}
```

```json
// ChallengeParticipant
{
  "id": "participant-001",
  "userId": "user-001",
  "challengeId": "challenge-001",
  "progress": 6,
  "status": "IN_PROGRESS"
}
```

```json
// ChallengeActivity
{
  "id": "activity-001",
  "participantId": "participant-001",
  "workoutSessionId": "session-001",
  "contribution": 1
}
```


ChallengeActivity permite identificar las actividades que aportan progreso y evitar contar dos veces una misma sesión.

## 7.10. Content, MediaAsset, Notification y AuditLog

```json
// Content
{
  "id": "content-001",
  "title": "Cómo mejorar tu postura",
  "description": "Consejos para mejorar tu postura.",
  "category": "TIPS",
  "type": "VIDEO",
  "thumbnailAssetId": "asset-001",
  "published": true,
  "createdById": "coach-001"
}
```

```json
// MediaAsset
{
  "id": "asset-001",
  "ownerId": "user-001",
  "fileName": "meal-photo.jpg",
  "mimeType": "image/jpeg",
  "storageKey": "private/meal-logs/meal-photo.jpg",
  "sizeBytes": 2500000,
  "visibility": "PRIVATE"
}
```

```json
// Notification
{
  "id": "notification-001",
  "userId": "user-001",
  "type": "WORKOUT_ASSIGNED",
  "title": "Nuevo entrenamiento",
  "message": "Tu Coach ha asignado una nueva rutina.",
  "readAt": null
}
```


- Las fotografías se guardan en bucket privado; PostgreSQL conserva metadatos y referencias.

- Auditoría registra actor, acción, recurso, ID, fecha y metadatos relevantes.

- No registrar contraseñas, tokens ni información sensible innecesaria.

# 8. API REST

Prefijo general: /api/v1. Usar controladores NestJS, DTOs, Guards y servicios de dominio.

## Autenticación

| **Método** | **Endpoint**          | **Función**            |
|------------|-----------------------|------------------------|
| POST       | /auth/login           | Iniciar sesión         |
| POST       | /auth/logout          | Cerrar sesión          |
| POST       | /auth/refresh         | Renovar sesión         |
| POST       | /auth/forgot-password | Recuperación           |
| POST       | /auth/reset-password  | Restablecer contraseña |
| GET        | /users/me             | Consultar perfil       |
| PATCH      | /users/me             | Actualizar perfil      |

## Usuarias y acceso

| **Método** | **Endpoint**                    | **Función**         |
|------------|---------------------------------|---------------------|
| POST       | /coach/users                    | Crear usuaria       |
| GET        | /coach/users                    | Listar usuarias     |
| GET        | /coach/users/:id                | Detalle             |
| PATCH      | /coach/users/:id                | Actualizar          |
| PATCH      | /coach/users/:id/access         | Modificar acceso    |
| GET        | /coach/users/:id/access-history | Historial de acceso |

## Entrenamientos

| **Método** | **Endpoint**                   | **Función**                  |
|------------|--------------------------------|------------------------------|
| POST       | /coach/workouts                | Crear clase                  |
| GET        | /workouts                      | Consultar clases autorizadas |
| GET        | /workouts/:id                  | Detalle                      |
| PATCH      | /coach/workouts/:id            | Editar                       |
| POST       | /coach/workout-assignments     | Asignar                      |
| GET        | /workout-assignments           | Calendario                   |
| PATCH      | /coach/workout-assignments/:id | Modificar asignación         |
| POST       | /workout-sessions              | Registrar sesión             |
| GET        | /workout-sessions              | Historial                    |
| POST       | /workout-sessions/:id/feedback | Enviar feedback              |

## Nutrición

| **Método** | **Endpoint**                           | **Función**        |
|------------|----------------------------------------|--------------------|
| POST       | /coach/nutrition-plans                 | Crear plan         |
| GET        | /coach/nutrition-plans                 | Listar             |
| GET        | /coach/nutrition-plans/:id             | Consultar          |
| POST       | /coach/nutrition-plans/:id/versions    | Crear versión      |
| POST       | /coach/nutrition-plans/:id/assignments | Asignar            |
| GET        | /coach/users/:id/nutrition-plans       | Historial          |
| GET        | /nutrition/my-plan                     | Plan activo        |
| GET        | /nutrition/my-plan/history             | Historial personal |
| GET        | /nutrition/my-plan/calendar            | Calendario         |
| GET        | /food-schedules                        | Horarios           |
| PUT        | /food-schedules/:id                    | Actualizar horario |

## Diario alimenticio

| **Método** | **Endpoint**                | **Función**                    |
|------------|-----------------------------|--------------------------------|
| POST       | /meal-logs                  | Crear registro                 |
| GET        | /meal-logs                  | Consultar registros            |
| PATCH      | /meal-logs/:id              | Editar                         |
| POST       | /meal-logs/:id/submit       | Enviar                         |
| GET        | /coach/users/:id/meal-logs  | Consultar registros de usuaria |
| POST       | /coach/meal-logs/:id/review | Revisar                        |

## Retos y contenido

| **Método** | **Endpoint**             | **Función**         |
|------------|--------------------------|---------------------|
| POST       | /coach/challenges        | Crear reto          |
| GET        | /challenges              | Consultar retos     |
| POST       | /challenges/:id/join     | Inscribirse         |
| GET        | /challenges/:id/progress | Progreso            |
| POST       | /coach/content           | Crear contenido     |
| PATCH      | /coach/content/:id       | Editar contenido    |
| GET        | /content                 | Consultar contenido |

## Estadísticas

| **Método** | **Endpoint**                | **Función**               |
|------------|-----------------------------|---------------------------|
| GET        | /dashboard                  | Dashboard usuaria         |
| GET        | /coach/dashboard            | Dashboard Coach           |
| GET        | /coach/statistics           | Estadísticas globales     |
| GET        | /coach/users/:id/statistics | Estadísticas individuales |

## Contrato de respuesta

```json
// Éxito
{
  "data": {
    "id": "uuid",
    "status": "ACTIVE"
  }
```

```text
}
```

```json
// Listado
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 0,
    "totalPages": 0
  }
```

```text
}
```

```json
// Error
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [
    {
      "field": "email",
      "message": "Invalid email"
    }
```

```text
  ]
}
```


Los listados deben admitir paginación, filtros y ordenamiento.

# 9. Integraciones externas

## 9.1. YouTube

La modalidad inicial será YouTube no listado. Un video no listado puede visualizarse por quien tenga el enlace; un video privado requiere autorización de cuentas específicas. Neo valida el acceso a la pantalla y a los datos, pero no puede impedir que un enlace no listado se comparta externamente.

- La Coach carga el video y configura visibilidad no listada.

- Registra el ID de YouTube en Neo y lo asocia a una clase.

- El backend valida que la usuaria tenga acceso a la asignación.

- El frontend presenta el reproductor.

- Si se requiere exclusividad real, evaluar proveedor con URLs firmadas, tokens y restricciones de reproducción.

```tsx
interface YouTubePlayerProps {
  videoId: string;
}
```

```tsx
export function YouTubePlayer({ videoId }: YouTubePlayerProps) {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl">
      <iframe
        className="h-full w-full"
        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`}
        title="Neo Workout"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  );
}
```


## 9.2. Almacenamiento de imágenes

- Usar almacenamiento compatible con S3 y bucket privado.

- Flujo: solicitar autorización, validar archivo, generar URL prefirmada, subir desde navegador y registrar MediaAsset.

- Formatos iniciales: JPG, PNG y WebP.

- Validar MIME real, tamaño máximo configurable y nombre aleatorio.

## 9.3. Notificaciones

- MVP: centro interno de notificaciones.

- Evolución: Web Push, recordatorios programados y alertas.

# 10. Seguridad y protección de datos

## 10.1. Autenticación

- Access tokens de corta duración y refresh tokens rotativos.

- Cookies HttpOnly y Secure en producción, con SameSite adecuado.

- Hash de contraseñas con Argon2id o bcrypt correctamente configurado.

- Enlaces temporales para recuperación.

- Rate limiting e invalidación de sesiones.

- No almacenar tokens permanentes en localStorage.

## 10.2. Autorización

- Validar rol, estado, identidad, relación Coach-usuaria, asignación del recurso y vigencia.

- El backend es la autoridad de permisos; ocultar opciones en frontend no sustituye la autorización.

- Proteger contra acceso horizontal mediante cambio de IDs.

## 10.3. Protección y privacidad

- HTTPS, buckets privados, URLs temporales, validación de archivos, auditoría, backups y logs sin datos sensibles.

- Proteger contra fuerza bruta y CSRF cuando se utilicen cookies.

- Definir política de privacidad, consentimiento, autorización para fotografías, conservación y eliminación.

- Considerar normativa aplicable en Colombia, incluida Ley 1581 de 2012 cuando corresponda.

# 11. Navegación y rutas

## 11.1. Rutas de usuaria

```text
/login
/forgot-password
/reset-password
/app
  /dashboard
  /calendar
  /workouts
  /workouts/:id
  /workouts/:id/feedback
  /nutrition
  /nutrition/my-plan
  /nutrition/diary
  /nutrition/schedules
  /nutrition/reminders
  /challenges
  /challenges/:id
  /profile
  /notifications
```


## 11.2. Rutas Coach

```text
/coach
  /dashboard
  /users
  /users/create
  /users/:id
  /users/:id/overview
  /users/:id/workouts
  /users/:id/nutrition
  /users/:id/diary
  /users/:id/access
  /users/:id/statistics
  /calendar
  /workouts
  /workouts/create
  /workouts/:id/edit
  /nutrition-plans
  /nutrition-plans/create
  /nutrition-plans/:id
  /nutrition-plans/:id/edit
  /nutrition-plans/:id/assignments
  /food-reviews
  /content
  /content/create
  /content/:id/edit
  /challenges
  /statistics
  /messages
  /settings
```


Todas las rutas requieren autenticación y autorización. El backend siempre valida permisos.

# 12. Componentes reutilizables de frontend

| **Componente**       | **Responsabilidad** |
|----------------------|---------------------|
| AppButton            | Botones.            |
| AppCard              | Tarjetas.           |
| AppInput             | Inputs.             |
| AppSelect            | Selectores.         |
| AppModal             | Modales.            |
| AppBadge             | Estados.            |
| ProgressBar          | Progreso.           |
| StatCard             | Indicadores.        |
| UserAvatar           | Perfil.             |
| WorkoutCard          | Entrenamientos.     |
| WorkoutPlayer        | Reproductor.        |
| NutritionPlanCard    | Plan nutricional.   |
| NutritionPlanBuilder | Constructor.        |
| NutritionMealCard    | Comidas.            |
| MealCard             | Diario alimenticio. |
| ChallengeCard        | Retos.              |
| RatingStars          | Valoraciones.       |
| CalendarView         | Calendario.         |
| BottomNavigation     | Navegación móvil.   |
| Sidebar              | Navegación Coach.   |
| DataTable            | Tablas.             |
| ImageUploader        | Fotografías.        |
| EmptyState           | Estados vacíos.     |
| ErrorState           | Errores.            |
| SkeletonLoader       | Carga.              |
| ConfirmDialog        | Confirmaciones.     |

La lógica de negocio debe permanecer en servicios, hooks y módulos correspondientes, no dentro de componentes visuales.

```tsx
interface AppCardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}
```

```tsx
export function AppCard({ title, children, className = "" }: AppCardProps) {
  return (
    <section className={`rounded-2xl border border-[#DEDEDE] bg-white p-4 shadow-sm ${className}`}>
      {title && (
        <h3 className="mb-3 text-base font-semibold text-[#283C43]">
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}
```


# 13. Testing y calidad

## 13.1. Pruebas unitarias

- Frontend: validación de formularios, cálculo de progreso, estados, navegación y permisos visuales.

- Backend: servicios, validaciones, reglas de negocio, cálculos y transiciones.

- Herramientas: Vitest, Jest si se mantiene como runner backend y Testing Library.

## 13.2. Integración

- API y PostgreSQL.

- Asignaciones y relaciones.

- Transacciones.

- Gestión de accesos.

- Versionamiento.

- Carga de archivos.

- Autorización.

## 13.3. End-to-end

- Crear usuaria.

- Activar usuaria.

- Iniciar sesión.

- Asignar entrenamiento.

- Completar entrenamiento.

- Enviar retroalimentación.

- Crear y asignar plan nutricional.

- Registrar comida.

- Revisar registro.

- Suspender acceso y verificar bloqueo.

## 13.4. Matriz de permisos

| **Acción**                        | **Coach** | **Usuaria**    |
|-----------------------------------|-----------|----------------|
| Crear usuarias                    | Sí        | No             |
| Modificar accesos                 | Sí        | No             |
| Crear clases                      | Sí        | No             |
| Consultar clases                  | Sí        | Solo asignadas |
| Asignar entrenamientos            | Sí        | No             |
| Completar entrenamiento           | No        | Sí             |
| Crear planes nutricionales        | Sí        | No             |
| Asignar planes                    | Sí        | No             |
| Consultar plan                    | Sí        | Asignado       |
| Modificar plan                    | Sí        | No             |
| Registrar alimentación            | No        | Sí             |
| Revisar alimentación              | Sí        | No             |
| Crear retos                       | Sí        | No             |
| Participar en retos               | No        | Sí             |
| Consultar estadísticas globales   | Sí        | No             |
| Consultar estadísticas personales | Sí        | Propias        |

# 14. Roadmap de desarrollo

## E01 — Configuración e infraestructura

- Repositorio y monorepo.

- React, Vite y NestJS.

- PostgreSQL y Prisma.

- Docker, variables y ambientes.

## E02 — Autenticación y acceso

- Login, logout y refresh.

- Recuperación de contraseña.

- Roles, Guards y gestión manual.

- Auditoría.

## E03 — Gestión de usuarias

- Crear, editar y consultar.

- Buscar y filtrar.

- Perfil e historial.

## E04 — Dashboards

- Layouts.

- Indicadores.

- Progreso y resúmenes.

- Gráficos.

## E05 — Entrenamientos y calendario

- Clases.

- Asignaciones.

- Calendario.

- Programación e historial.

## E06 — Videos y retroalimentación

- YouTube.

- Reproductor.

- Sesiones.

- Formularios y feedback.

## E07 — Planes nutricionales

- Constructor.

- Días, comidas y alimentos.

- Versiones y asignaciones.

- Historial.

## E08 — Diario alimenticio

- Registros y fotografías.

- Horarios.

- Revisión y observaciones.

## E09 — Retos y motivación

- Retos.

- Inscripciones.

- Actividades y progreso.

- Reconocimientos.

## E10 — Estadísticas y seguimiento

- Adherencia.

- Métricas.

- Alertas.

- Reportes.

## E11 — Notificaciones y mensajería

- Notificaciones internas.

- Recordatorios.

- Mensajes y lectura.

## E12 — Seguridad, pruebas y despliegue

- Pruebas.

- Seguridad.

- Optimización.

- CI/CD, backups y producción.

## 14.1. Alcance del MVP

| **Módulo**             | **MVP**   | **Evolución**          |
|------------------------|-----------|------------------------|
| Autenticación          | Sí        | —                      |
| Gestión de usuarias    | Sí        | —                      |
| Acceso manual          | Sí        | —                      |
| Dashboard              | Sí        | Mejoras                |
| Entrenamientos         | Sí        | —                      |
| Calendario             | Sí        | Mejoras                |
| YouTube                | Sí        | Evaluar otro proveedor |
| Retroalimentación      | Sí        | —                      |
| Planes nutricionales   | Sí        | Mejoras                |
| Diario alimenticio     | Sí        | —                      |
| Revisión nutricional   | Sí        | —                      |
| Retos                  | Posterior | Sí                     |
| Estadísticas avanzadas | Posterior | Sí                     |
| Mensajería             | Posterior | Sí                     |
| Web Push               | Posterior | Sí                     |

El MVP debe permitir que la Coach gestione usuarias, asigne entrenamientos y planes nutricionales, y revise su actividad.

# 15. Criterios de aceptación generales

## Autenticación

- [ ] Existe una única cuenta Coach.

- [ ] No hay registro público de Coaches.

- [ ] La Coach puede crear usuarias.

- [ ] La Coach activa y suspende accesos.

- [ ] Cuentas inactivas no acceden a contenido protegido.

- [ ] Sesiones seguras y cambios auditados.

## Entrenamientos

- [ ] La Coach crea clases y asocia videos YouTube.

- [ ] Puede asignar clases.

- [ ] La usuaria consulta calendario y reproduce videos.

- [ ] Puede registrar sesiones y enviar retroalimentación.

- [ ] Se actualiza progreso y no hay duplicados.

## Nutrición

- [ ] La Coach crea planes, días, comidas, alimentos y cantidades.

- [ ] Puede crear versiones y asignar planes.

- [ ] La usuaria consulta planes e historial.

- [ ] La usuaria no modifica planes.

- [ ] Puede registrar comidas y fotografías.

- [ ] La Coach revisa y deja observaciones.

## Plataforma web

- [ ] Acceso mediante URL.

- [ ] Funciona en móvil y escritorio.

- [ ] No requiere instalación nativa.

- [ ] Diseño responsive.

- [ ] Estados de carga, error y vacío.

- [ ] Endpoints protegidos y archivos privados.

- [ ] Backups y logs.

# 16. Fuera del alcance inicial

- Multi-Coach.

- Multiempresa.

- Pasarelas de pago, suscripciones y facturación.

- Aplicaciones nativas.

- Integración con relojes inteligentes.

- Videollamadas.

- IA para crear planes nutricionales.

- Cálculo automático de dietas.

- DRM para videos.

- Integraciones externas de salud.

Si Neo crece, se podrá ampliar la arquitectura por módulos sin reemplazar todo el sistema.

# 17. Decisiones pendientes de confirmar

Estas decisiones no están aprobadas todavía y deben cerrarse antes de implementar los flujos correspondientes.

| **Tema**                     | **Opciones**                                                                                                                  | **Impacto técnico**                                               |
|------------------------------|-------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------|
| Creación de cuentas          | Invitación por correo con enlace temporal para crear contraseña; o contraseña temporal creada por Coach y cambio obligatorio. | Flujo de invitación, tokens, correo y onboarding.                 |
| Asignación de entrenamientos | Individual; plantillas semanales reutilizables; o ambas.                                                                      | Modelo de plantillas, calendario y generación de asignaciones.    |
| Estructura nutricional       | Planes semanales de 7 días; cantidad configurable de días; o ambas.                                                           | Modelo de días, plantillas y calendario de planes.                |
| Comunicación                 | Comentarios contextuales; mensajería privada; o ambos.                                                                        | Alcance de mensajes, conversaciones, notificaciones y moderación. |

## 17.1. Recomendaciones iniciales (no decisiones confirmadas)

- Invitación por correo con enlace temporal para crear contraseña.

- Ambas modalidades de asignación: individual y plantillas semanales.

- Planes de duración configurable, con plantilla semanal como opción habitual.

- Comenzar con comentarios contextuales; incorporar mensajería privada si es necesaria para el MVP.

# 18. Definición arquitectónica final

| **Elemento**     | **Decisión**                                                          |
|------------------|-----------------------------------------------------------------------|
| Frontend         | React + TypeScript + Vite + Tailwind CSS.                             |
| Backend          | NestJS modular.                                                       |
| Persistencia     | PostgreSQL + Prisma.                                                  |
| Multimedia       | YouTube + almacenamiento S3 privado.                                  |
| Modelo operativo | Una Coach, múltiples usuarias, una Coach por usuaria.                 |
| Acceso           | Gestionado manualmente; sin pagos ni suscripciones.                   |
| Producto         | Web responsive; no aplicación nativa.                                 |
| Módulos          | Entrenamientos, nutrición, diario, retos, seguimiento y estadísticas. |

# 19. Recomendación de implementación

- E01 — Infraestructura: configurar monorepo, React, NestJS, PostgreSQL, Prisma y Docker.

- E02 — Autenticación: implementar Coach única, roles, sesiones y gestión manual de acceso.

- E03 — Usuarias: perfiles, listados, filtros y administración.

- E04 — Layouts: construir Design System e interfaces principales.

- E05 y E06 — Entrenamientos: clases, calendario, YouTube, asignaciones y retroalimentación.

- E07 — Nutrición: modelo versionado y constructor de planes.

- E08 — Diario: fotografías, registros y revisiones.

- E09–E12 — Completar retos, estadísticas, notificaciones y producción.

La primera entrega técnica debería ser el esquema de base de datos definitivo y el backlog de desarrollo. No conviene construir pantallas aisladas sin definir las relaciones entre usuarias, entrenamientos, asignaciones y planes nutricionales.

# Anexo A. Consideraciones de implementación

- Definir políticas de borrado lógico y conservación histórica antes de implementar CRUD destructivos.

- Definir política de repetición de sesiones y comportamiento de asignaciones reprogramadas.

- Definir si las usuarias pueden editar registros alimenticios después de enviarlos y cómo se conserva el historial de revisión.

- Definir unidades de alimentos y si se requiere información nutricional cuantitativa (calorías/macros); no asumirlo en el MVP.

- Definir límites de archivos y cuotas de almacenamiento.

- Definir zona horaria por usuaria y cómo se calculan días, semanas y recordatorios.

- Las métricas del dashboard deben documentar fórmula, período, estados incluidos y exclusiones.

- Aplicar transacciones a cambios de estado, asignaciones de planes y operaciones que modifiquen historial.
