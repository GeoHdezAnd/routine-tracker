import { Navigate, Outlet } from "react-router";
import { useAuth } from "../lib/auth";
import { BottomNav } from "./BottomNav";

export function ProtectedLayout() {
  const { token } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div>
      <Outlet />
      <BottomNav />
    </div>
  );
}
