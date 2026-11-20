/** Enumeraciones del dominio. Fuente: docs/ESPECIFICACION.md §2, §4, §7. */

export enum UserRole {
  COACH = 'COACH',
  USER = 'USER',
}

export enum UserStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  INACTIVE = 'INACTIVE',
}

export enum WorkoutAssignmentStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  PARTIAL = 'PARTIAL',
  SKIPPED = 'SKIPPED',
  CANCELLED = 'CANCELLED',
}

export enum MealLogStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  REVIEWED = 'REVIEWED',
  NEEDS_CHANGES = 'NEEDS_CHANGES',
}

export enum MealType {
  BREAKFAST = 'BREAKFAST',
  MORNING_SNACK = 'MORNING_SNACK',
  LUNCH = 'LUNCH',
  AFTERNOON_SNACK = 'AFTERNOON_SNACK',
  DINNER = 'DINNER',
  OTHER = 'OTHER',
}

export enum VideoProvider {
  YOUTUBE = 'YOUTUBE',
}

export enum VideoVisibility {
  UNLISTED = 'UNLISTED',
  PRIVATE = 'PRIVATE',
}

/** §7.6: "completed": "YES" en WorkoutFeedback (Sí / No / Parcial). */
export enum FeedbackCompletion {
  YES = 'YES',
  NO = 'NO',
  PARTIAL = 'PARTIAL',
}

/** Suposición: el spec muestra ACTIVE; ENDED se usa al reemplazar un plan (§4.3). */
export enum NutritionAssignmentStatus {
  ACTIVE = 'ACTIVE',
  ENDED = 'ENDED',
}

export enum DayOfWeek {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}

/** Suposición: el spec solo muestra GRAMS; las unidades se confirman con la Coach (Anexo A). */
export enum FoodUnit {
  GRAMS = 'GRAMS',
  MILLILITERS = 'MILLILITERS',
  UNITS = 'UNITS',
  CUPS = 'CUPS',
  TABLESPOONS = 'TABLESPOONS',
  TEASPOONS = 'TEASPOONS',
  SLICES = 'SLICES',
}

export enum ChallengeParticipantStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ABANDONED = 'ABANDONED',
}

export enum ChallengeGoalUnit {
  WORKOUT_SESSIONS = 'WORKOUT_SESSIONS',
}

export enum ContentCategory {
  RECIPES = 'RECIPES',
  NUTRITION = 'NUTRITION',
  TIPS = 'TIPS',
  TECHNIQUE = 'TECHNIQUE',
  VIDEOS = 'VIDEOS',
}

export enum ContentType {
  ARTICLE = 'ARTICLE',
  VIDEO = 'VIDEO',
}

export enum MediaVisibility {
  PRIVATE = 'PRIVATE',
}

export enum NotificationType {
  WORKOUT_ASSIGNED = 'WORKOUT_ASSIGNED',
  WORKOUT_RESCHEDULED = 'WORKOUT_RESCHEDULED',
  NUTRITION_PLAN_ASSIGNED = 'NUTRITION_PLAN_ASSIGNED',
  CHALLENGE_PUBLISHED = 'CHALLENGE_PUBLISHED',
  MEAL_REMINDER = 'MEAL_REMINDER',
  WORKOUT_REMINDER = 'WORKOUT_REMINDER',
  FEEDBACK_RECEIVED = 'FEEDBACK_RECEIVED',
  MEAL_LOG_PENDING_REVIEW = 'MEAL_LOG_PENDING_REVIEW',
  MEAL_LOG_REVIEWED = 'MEAL_LOG_REVIEWED',
  CHALLENGE_COMPLETED = 'CHALLENGE_COMPLETED',
  NEW_MESSAGE = 'NEW_MESSAGE',
}

/** Suposición (HU-02): reutiliza el mismo token para invitar y para restablecer contraseña. */
export enum PasswordTokenPurpose {
  INVITATION = 'INVITATION',
  RESET = 'RESET',
}

/** Suposición (HU-09): niveles y categorías de clase; el spec solo da ejemplos (INTERMEDIATE, FULL_BODY). */
export enum WorkoutDifficulty {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
}

export enum WorkoutCategory {
  FULL_BODY = 'FULL_BODY',
  UPPER_BODY = 'UPPER_BODY',
  LOWER_BODY = 'LOWER_BODY',
  CORE = 'CORE',
  CARDIO = 'CARDIO',
  YOGA = 'YOGA',
  STRETCHING = 'STRETCHING',
  OTHER = 'OTHER',
}
