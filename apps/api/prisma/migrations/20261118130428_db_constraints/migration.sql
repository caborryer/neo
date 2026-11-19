-- Restricciones de integridad que Prisma no expresa en schema.prisma.
-- Se aplican con una migración propia (ver README, "Base de datos").
-- NOTA: este SQL aún no se ha ejecutado contra un PostgreSQL real; correr `npm run db:migrate`
-- y revisar el resultado antes de darlo por bueno.

-- §1.4 y §7.3: existe una sola Coach.
CREATE UNIQUE INDEX "User_single_coach" ON "User" ("role") WHERE "role" = 'COACH';

-- §7.3: la Coach no tiene coachId; cada usuaria debe tenerlo.
ALTER TABLE "User" ADD CONSTRAINT "User_coach_link_check" CHECK (
  ("role" = 'COACH' AND "coachId" IS NULL) OR ("role" = 'USER' AND "coachId" IS NOT NULL)
);

-- §7.7: solo un plan activo por usuaria para una misma fecha (períodos sin solapamiento).
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "NutritionPlanAssignment" ADD CONSTRAINT "NutritionPlanAssignment_no_overlap"
  EXCLUDE USING gist (
    "userId" WITH =,
    daterange("startDate", "endDate", '[]') WITH &&
  ) WHERE ("status" = 'ACTIVE');

-- §7.6: calificación de 1 a 5 y porcentaje parcial de 1 a 99.
ALTER TABLE "WorkoutFeedback" ADD CONSTRAINT "WorkoutFeedback_rating_check" CHECK ("feelingRating" BETWEEN 1 AND 5);
ALTER TABLE "WorkoutFeedback" ADD CONSTRAINT "WorkoutFeedback_pct_check" CHECK ("completionPercentage" IS NULL OR "completionPercentage" BETWEEN 1 AND 99);
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_pct_check" CHECK ("completionPercentage" IS NULL OR "completionPercentage" BETWEEN 0 AND 100);
