import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { authAPI } from "../api";
import type { Me } from "../types";

interface AuthGuardProps {
  children: (user: Me) => ReactNode;
  onForbidden: () => void;
}

export default function AuthGuard({ children, onForbidden }: AuthGuardProps) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      // DEV MODE si besoin
      const DEV_MODE = false;
      if (DEV_MODE) {
        setUser({ id: 1, email: "dev@local", username: "dev", role: "admin" });
        setLoading(false);
        return;
      }

      try {
        const me = await authAPI.me();
        setUser(me);
      } catch (e) {
        onForbidden();
      } finally {
        setLoading(false);
      }
    };

    check();
  }, [onForbidden]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;
  return <>{children(user)}</>;
}
