import { describe, expect, it } from 'vitest';
import {
  createAssignmentSchema,
  createFeedbackSchema,
  createWorkoutSchema,
  extractYouTubeId,
  listAssignmentsQuerySchema,
  updateAssignmentSchema,
} from './index';

const UUID = '11111111-1111-4111-8111-111111111111';

describe('extractYouTubeId', () => {
  it.each([
    ['dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?si=abc', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('%s → %s', (input, id) => expect(extractYouTubeId(input)).toBe(id));

  it.each(['', 'corto', 'https://vimeo.com/123456789', 'https://evil.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=<script>', 'javascript:alert(1)'])(
    'rechaza %j',
    (input) => expect(extractYouTubeId(input)).toBeNull(),
  );
});

describe('createWorkoutSchema', () => {
  const ok = { title: 'Full Body', durationMinutes: 55, difficulty: 'INTERMEDIATE', category: 'FULL_BODY', video: 'https://youtu.be/dQw4w9WgXcQ' };
  it('normaliza el video a ID y aplica defaults', () => {
    const r = createWorkoutSchema.parse(ok);
    expect(r).toMatchObject({ video: 'dQw4w9WgXcQ', videoVisibility: 'UNLISTED', isPublished: false, equipment: [], tips: [] });
  });
  it('valida duración y video', () => {
    expect(createWorkoutSchema.safeParse({ ...ok, durationMinutes: 2 }).success).toBe(false);
    expect(createWorkoutSchema.safeParse({ ...ok, video: 'no-es-youtube' }).success).toBe(false);
  });
});

describe('asignaciones', () => {
  it('createAssignmentSchema exige usuarias y fecha real', () => {
    const base = { workoutId: UUID, userIds: [UUID], scheduledDate: '2026-11-20' };
    expect(createAssignmentSchema.safeParse(base).success).toBe(true);
    expect(createAssignmentSchema.safeParse({ ...base, userIds: [] }).success).toBe(false);
    expect(createAssignmentSchema.safeParse({ ...base, scheduledDate: '2026-02-30' }).success).toBe(false);
    expect(createAssignmentSchema.safeParse({ ...base, scheduledTime: '25:00' }).success).toBe(false);
    expect(createAssignmentSchema.safeParse({ ...base, scheduledTime: '07:30' }).success).toBe(true);
  });
  it('updateAssignmentSchema: reprogramar o cancelar, no ambos ni vacío', () => {
    expect(updateAssignmentSchema.safeParse({}).success).toBe(false);
    expect(updateAssignmentSchema.safeParse({ status: 'CANCELLED' }).success).toBe(true);
    expect(updateAssignmentSchema.safeParse({ status: 'COMPLETED' }).success).toBe(false);
    expect(updateAssignmentSchema.safeParse({ status: 'CANCELLED', scheduledDate: '2026-11-20' }).success).toBe(false);
    expect(updateAssignmentSchema.safeParse({ scheduledDate: '2026-11-20', scheduledTime: null }).success).toBe(true);
  });
  it('listAssignmentsQuerySchema limita el rango a 92 días', () => {
    expect(listAssignmentsQuerySchema.safeParse({ from: '2026-11-01', to: '2026-11-30' }).success).toBe(true);
    expect(listAssignmentsQuerySchema.safeParse({ from: '2026-11-30', to: '2026-11-01' }).success).toBe(false);
    expect(listAssignmentsQuerySchema.safeParse({ from: '2026-01-01', to: '2026-12-31' }).success).toBe(false);
  });
});

describe('createFeedbackSchema (U04)', () => {
  const base = { feelingRating: 4, ateBeforeWorkout: false };
  it('Sí: solo requiere rating y alimentación', () => {
    expect(createFeedbackSchema.safeParse({ ...base, completed: 'YES' }).success).toBe(true);
  });
  it('Parcial exige porcentaje 1–99; No exige motivo', () => {
    expect(createFeedbackSchema.safeParse({ ...base, completed: 'PARTIAL' }).success).toBe(false);
    expect(createFeedbackSchema.safeParse({ ...base, completed: 'PARTIAL', completionPercentage: 100 }).success).toBe(false);
    expect(createFeedbackSchema.safeParse({ ...base, completed: 'PARTIAL', completionPercentage: 60 }).success).toBe(true);
    expect(createFeedbackSchema.safeParse({ ...base, completed: 'NO' }).success).toBe(false);
    expect(createFeedbackSchema.safeParse({ ...base, completed: 'NO', notCompletedReason: 'Me dolía la rodilla' }).success).toBe(true);
  });
  it('si comió antes, debe decir qué; rating entre 1 y 5', () => {
    expect(createFeedbackSchema.safeParse({ ...base, completed: 'YES', ateBeforeWorkout: true }).success).toBe(false);
    expect(createFeedbackSchema.safeParse({ ...base, completed: 'YES', ateBeforeWorkout: true, preWorkoutMeal: 'Avena' }).success).toBe(true);
    expect(createFeedbackSchema.safeParse({ ...base, completed: 'YES', feelingRating: 6 }).success).toBe(false);
    expect(createFeedbackSchema.safeParse({ ...base, completed: 'YES', feelingRating: 0 }).success).toBe(false);
  });
});
