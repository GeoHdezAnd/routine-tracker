import { createBrowserRouter } from "react-router";
import type { RouteObject } from "react-router";
import { ProtectedLayout } from "./components/ProtectedLayout";
import { LoginPage } from "./pages/Login";
import { RegisterPage } from "./pages/Register";
import { RoutinesPage } from "./pages/Routines";
import { RoutineDetailPage } from "./pages/RoutineDetail";
import { ExercisesPage } from "./pages/Exercises";
import { SessionsPage } from "./pages/Sessions";
import { SessionDetailPage } from "./pages/SessionDetail";

export const routes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  {
    element: <ProtectedLayout />,
    children: [
      { path: "/", element: <RoutinesPage /> },
      { path: "/routines", element: <RoutinesPage /> },
      { path: "/routines/:id", element: <RoutineDetailPage /> },
      { path: "/exercises", element: <ExercisesPage /> },
      { path: "/sessions", element: <SessionsPage /> },
      { path: "/sessions/:id", element: <SessionDetailPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
