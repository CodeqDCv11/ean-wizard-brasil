import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  hasAccess: boolean;
  accessExpiresAt: Date | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshAccess: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [accessExpiresAt, setAccessExpiresAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const checkUserAccess = async (userId: string) => {
    try {
      // Check if user is admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      const userIsAdmin = !!roleData;
      setIsAdmin(userIsAdmin);

      if (userIsAdmin) {
        setHasAccess(true);
        setAccessExpiresAt(null);
        return;
      }

      // Check user access expiration
      const { data: accessData } = await supabase
        .from("user_access")
        .select("expires_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (accessData && new Date(accessData.expires_at) > new Date()) {
        setHasAccess(true);
        setAccessExpiresAt(new Date(accessData.expires_at));
      } else {
        setHasAccess(false);
        setAccessExpiresAt(accessData ? new Date(accessData.expires_at) : null);
      }
    } catch (error) {
      console.error("Error checking user access:", error);
      setIsAdmin(false);
      setHasAccess(false);
    }
  };

  const refreshAccess = async () => {
    if (user) {
      await checkUserAccess(user.id);
    }
  };

  useEffect(() => {
    // Set up auth state listener BEFORE checking session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Use setTimeout to avoid Supabase client deadlock
          setTimeout(() => checkUserAccess(newSession.user.id), 0);
        } else {
          setIsAdmin(false);
          setHasAccess(false);
          setAccessExpiresAt(null);
        }
        setLoading(false);
      }
    );

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        checkUserAccess(initialSession.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAdmin,
        hasAccess,
        accessExpiresAt,
        loading,
        signIn,
        signUp,
        signOut,
        refreshAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
