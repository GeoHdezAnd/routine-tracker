import { Navigate, Outlet } from "react-router";
import { useAuth } from "../lib/auth";
import { BottomNav } from "./BottomNav";

export function ProtectedLayout() {
  const { token } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="pb-16">
      <Outlet />
      <BottomNav />
    </div>
  );
}
