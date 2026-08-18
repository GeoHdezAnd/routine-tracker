import { createBrowserRouter } from "react-router";
import type { RouteObject } from "react-router";
import { ProtectedLayout } from "./components/ProtectedLayout";
import { LoginPage } from "./pages/Login/Login";
import { RegisterPage } from "./pages/Register/Register";
import { RoutinesPage } from "./pages/Routines/Routines";
import { RoutineDetailPage } from "./pages/RoutineDetail/RoutineDetail";
import { ExercisesPage } from "./pages/Exercises/Exercises";
import { SessionsPage } from "./pages/Sessions/Sessions";
import { SessionDetailPage } from "./pages/SessionDetail/SessionDetail";
import { DashboardPage } from "./pages/Dashboard/Dashboard";
import { ExerciseProgressPage } from "./pages/ExerciseProgress/ExerciseProgress";

export const routes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  {
    element: <ProtectedLayout />,
    children: [
      { path: "/", element: <DashboardPage /> },
      { path: "/routines", element: <RoutinesPage /> },
      { path: "/routines/:id", element: <RoutineDetailPage /> },
      { path: "/exercises", element: <ExercisesPage /> },
      { path: "/exercises/:id/progress", element: <ExerciseProgressPage /> },
      { path: "/sessions", element: <SessionsPage /> },
      { path: "/sessions/:id", element: <SessionDetailPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
