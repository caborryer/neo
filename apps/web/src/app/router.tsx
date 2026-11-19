import { Navigate, createBrowserRouter, type RouteObject } from 'react-router-dom';
import { UserLayout } from './layouts/UserLayout';
import { CoachLayout } from './layouts/CoachLayout';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { coachRoutes, userRoutes } from './routes';
import { UserRole } from '@neo/shared-types';
import { PublicOnly, RequireRole } from '@/features/auth/RouteGuards';
import { LoginPage } from '@/features/auth/LoginPage';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage';
import { UsersListPage } from '@/features/users/UsersListPage';
import { CreateUserPage } from '@/features/users/CreateUserPage';
import { UserDetailPage } from '@/features/users/UserDetailPage';
import { WorkoutsListPage } from '@/features/workouts/WorkoutsListPage';
import { WorkoutFormPage } from '@/features/workouts/WorkoutFormPage';
import { CoachCalendarPage } from '@/features/calendar/CoachCalendarPage';
import { UserCalendarPage } from '@/features/calendar/UserCalendarPage';
import { UserWorkoutsPage } from '@/features/workouts/UserWorkoutsPage';
import { WorkoutDetailPage } from '@/features/workouts/WorkoutDetailPage';
import { FeedbackPage } from '@/features/workouts/FeedbackPage';
import { PlansListPage } from '@/features/nutrition/PlansListPage';
import { PlanEditorPage } from '@/features/nutrition/PlanEditorPage';
import { PlanDetailPage } from '@/features/nutrition/PlanDetailPage';
import { PlanAssignmentsPage } from '@/features/nutrition/PlanAssignmentsPage';
import { MyPlanPage } from '@/features/nutrition/MyPlanPage';
import { DiaryPage } from '@/features/food-diary/DiaryPage';
import { FoodReviewsPage } from '@/features/food-diary/FoodReviewsPage';
import { UserDashboardPage } from '@/features/statistics/UserDashboardPage';
import { CoachDashboardPage } from '@/features/statistics/CoachDashboardPage';
import { SettingsPage } from '@/features/statistics/SettingsPage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { SchedulesPage } from '@/features/nutrition/SchedulesPage';

const page = (title: string, spec: string) => <PlaceholderPage title={title} spec={spec} />;
const rel = (path: string, base: string) => path.slice(base.length + 1);

const userChildren: RouteObject[] = [
  { index: true, element: <Navigate to={userRoutes.dashboard} replace /> },
  { path: rel(userRoutes.dashboard, '/app'), element: <UserDashboardPage /> },
  { path: rel(userRoutes.calendar, '/app'), element: <UserCalendarPage /> },
  { path: rel(userRoutes.workouts, '/app'), element: <UserWorkoutsPage /> },
  { path: rel(userRoutes.workout(), '/app'), element: <WorkoutDetailPage /> },
  { path: rel(userRoutes.workoutFeedback(), '/app'), element: <FeedbackPage /> },
  { path: rel(userRoutes.nutrition, '/app'), element: <Navigate to={userRoutes.nutritionPlan} replace /> },
  { path: rel(userRoutes.nutritionPlan, '/app'), element: <MyPlanPage /> },
  { path: rel(userRoutes.nutritionDiary, '/app'), element: <DiaryPage /> },
  { path: rel(userRoutes.nutritionSchedules, '/app'), element: <SchedulesPage /> },
  { path: rel(userRoutes.nutritionReminders, '/app'), element: <Navigate to={userRoutes.nutritionSchedules} replace /> },
  { path: rel(userRoutes.challenges, '/app'), element: page('Retos', 'U07 · HU-30 (posterior al MVP)') },
  { path: rel(userRoutes.challenge(), '/app'), element: page('Reto', 'U07 · HU-30 (posterior al MVP)') },
  { path: rel(userRoutes.profile, '/app'), element: <ProfilePage /> },
  { path: rel(userRoutes.notifications, '/app'), element: <NotificationsPage /> },
];

const coachChildren: RouteObject[] = [
  { index: true, element: <Navigate to={coachRoutes.dashboard} replace /> },
  { path: rel(coachRoutes.dashboard, '/coach'), element: <CoachDashboardPage /> },
  { path: rel(coachRoutes.users, '/coach'), element: <UsersListPage /> },
  { path: rel(coachRoutes.usersCreate, '/coach'), element: <CreateUserPage /> },
  // HU-08: vista 360 (resumen, alertas, seguimientos, entrenamientos, planes, datos, acceso e historial).
  { path: rel(coachRoutes.user(), '/coach'), element: <UserDetailPage /> },
  { path: rel(coachRoutes.calendar, '/coach'), element: <CoachCalendarPage /> },
  { path: rel(coachRoutes.workouts, '/coach'), element: <WorkoutsListPage /> },
  { path: rel(coachRoutes.workoutsCreate, '/coach'), element: <WorkoutFormPage /> },
  { path: rel(coachRoutes.workoutEdit(), '/coach'), element: <WorkoutFormPage /> },
  { path: rel(coachRoutes.nutritionPlans, '/coach'), element: <PlansListPage /> },
  { path: rel(coachRoutes.nutritionPlansCreate, '/coach'), element: <PlanEditorPage /> },
  { path: rel(coachRoutes.nutritionPlan(), '/coach'), element: <PlanDetailPage /> },
  { path: rel(coachRoutes.nutritionPlanEdit(), '/coach'), element: <PlanEditorPage /> },
  { path: rel(coachRoutes.nutritionPlanAssignments(), '/coach'), element: <PlanAssignmentsPage /> },
  { path: rel(coachRoutes.foodReviews, '/coach'), element: <FoodReviewsPage /> },
  { path: rel(coachRoutes.content, '/coach'), element: page('Contenido', 'C04 · HU-33 (posterior al MVP)') },
  { path: rel(coachRoutes.challenges, '/coach'), element: page('Retos', 'C08 · HU-29 (posterior al MVP)') },
  { path: rel(coachRoutes.statistics, '/coach'), element: page('Estadísticas', 'C05 · HU-31 (posterior al MVP)') },
  { path: rel(coachRoutes.messages, '/coach'), element: page('Mensajes', 'C09 · HU-32 (posterior al MVP)') },
  { path: rel(coachRoutes.settings, '/coach'), element: <SettingsPage /> },
  { path: rel(coachRoutes.notifications, '/coach'), element: <NotificationsPage /> },
];

export const routes: RouteObject[] = [
  { path: '/', element: <Navigate to={userRoutes.login} replace /> },
  {
    element: <PublicOnly />,
    children: [
      { path: userRoutes.login, element: <LoginPage /> },
      { path: userRoutes.forgotPassword, element: <ForgotPasswordPage /> },
    ],
  },
  // Sin PublicOnly: el enlace de invitación/recuperación debe funcionar aunque haya otra sesión abierta.
  { path: userRoutes.resetPassword, element: <ResetPasswordPage /> },
  { element: <RequireRole role={UserRole.USER} />, children: [{ path: userRoutes.root, element: <UserLayout />, children: userChildren }] },
  { element: <RequireRole role={UserRole.COACH} />, children: [{ path: coachRoutes.root, element: <CoachLayout />, children: coachChildren }] },
  { path: '*', element: <NotFoundPage /> },
];

export const router = createBrowserRouter(routes);
