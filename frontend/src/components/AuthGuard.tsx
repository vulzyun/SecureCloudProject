import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { authAPI } from "../api";
import type { User } from "../types";

interface AuthGuardProps {
  children: (user: User) => ReactNode;
  onForbidden: () => void;
}

export default function AuthGuard({ children, onForbidden }: AuthGuardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        // Toujours appeler l'API pour récupérer l'utilisateur réel
        const me = await authAPI.getCurrentUser();
        
        // Vérifier que la réponse contient bien les champs attendus
        if (!me || !me.username || !me.role) {
          console.error("Invalid user response:", me);
          onForbidden();
          return;
        }
        
        // Stocker l'utilisateur avec toutes les infos de l'API
        setUser({
          id: me.id,
          email: me.email,
          username: me.username,
          role: me.role,
          created_at: me.created_at,
          updated_at: me.updated_at
        });
      } catch (e) {
        console.error("Auth error:", e);
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
