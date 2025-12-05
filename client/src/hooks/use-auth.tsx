import { createContext, ReactNode, useContext } from "react";
import { useQuery, useMutation, UseMutationResult } from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ✅ Firebase imports
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase"; // make sure Firebase is initialized

// --- Types ---
type LoginData = Pick<InsertUser, "email" | "password">;

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
  loginWithGoogle: () => Promise<void>;
};

// --- Context setup ---
export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  // --- Get current user ---
  const { data: user, error, isLoading } = useQuery<SelectUser | null, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  // --- Login mutation ---
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Login successful",
        description: `Welcome back, ${user.firstName}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // --- Register mutation ---
  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Registration successful",
        description: `Welcome to LuggageLink, ${user.firstName}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // --- Logout mutation ---
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logged out successfully",
        description: "You have been logged out.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // --- ✅ Google Sign-In ---
  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      if (!result?.user) throw new Error("Google sign-in failed. No user found.");

      // 🔑 Get Firebase ID Token
      const idToken = await result.user.getIdToken(true);

      // 🔁 Send token to backend
      const res = await apiRequest("POST", "/api/login/google", { idToken });
      const dbUser = await res.json();

      // ✅ Update user in React Query cache
      queryClient.setQueryData(["/api/user"], dbUser);

      toast({
        title: "Google Sign-In Successful",
        description: `Welcome, ${dbUser.firstName || "User"}!`,
      });
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      toast({
        title: "Google Sign-In Failed",
        description: error.message || "Something went wrong during Google login.",
        variant: "destructive",
      });
    }
  };

  // --- Provider ---
  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        loginWithGoogle,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// --- Hook ---
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
