import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import {
  CognitoUserPool,
  CognitoUser,
  CognitoUserAttribute,
  AuthenticationDetails,
  CognitoUserSession,
} from "amazon-cognito-identity-js";
import { LazyStore } from "@tauri-apps/plugin-store";
import { getActiveBackend, initializeDefaultBackend } from "./backends";

function getCognitoConfig() {
  const backend = getActiveBackend();
  if (backend) {
    return {
      userPoolId: backend.userPoolId,
      clientId: backend.userPoolClientId,
      region: backend.region,
    };
  }
  // Fallback to env vars
  return {
    userPoolId: import.meta.env.VITE_USER_POOL_ID || import.meta.env.VITE_COGNITO_USER_POOL_ID || "",
    clientId: import.meta.env.VITE_USER_POOL_CLIENT_ID || import.meta.env.VITE_COGNITO_CLIENT_ID || "",
    region: import.meta.env.VITE_AWS_REGION || import.meta.env.VITE_COGNITO_REGION || "eu-west-1",
  };
}

function createUserPool() {
  const config = getCognitoConfig();
  if (!config.userPoolId || !config.clientId) {
    return null;
  }
  return new CognitoUserPool({
    UserPoolId: config.userPoolId,
    ClientId: config.clientId,
  });
}

interface AuthContextType {
  user: CognitoUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CognitoUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize default backend from env vars on first load
  useEffect(() => {
    initializeDefaultBackend();
  }, []);

  const userPool = useMemo(() => createUserPool(), []);
  const isConfigured = !!userPool;

  useEffect(() => {
    if (!userPool) {
      setIsLoading(false);
      return;
    }

    // Check for existing session
    const currentUser = userPool.getCurrentUser();
    if (currentUser) {
      currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session?.isValid()) {
          setUser(null);
        } else {
          setUser(currentUser);
        }
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, [userPool]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!userPool) {
      throw new Error("No backend configured. Please add a backend in Settings.");
    }

    return new Promise<void>((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      });

      const authDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      });

      cognitoUser.authenticateUser(authDetails, {
        onSuccess: async (session) => {
          setUser(cognitoUser);
          // Store tokens securely
          try {
            const store = new LazyStore("auth.json");
            await store.set("idToken", session.getIdToken().getJwtToken());
            await store.set("accessToken", session.getAccessToken().getJwtToken());
            await store.set("refreshToken", session.getRefreshToken().getToken());
            await store.save();
          } catch (e) {
            console.warn("Failed to store tokens:", e);
          }
          resolve();
        },
        onFailure: (err) => {
          reject(err);
        },
        newPasswordRequired: () => {
          reject(new Error("New password required"));
        },
      });
    });
  }, [userPool]);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    if (!userPool) {
      throw new Error("No backend configured. Please add a backend in Settings.");
    }

    return new Promise<void>((resolve, reject) => {
      const attributeList = [
        new CognitoUserAttribute({ Name: "name", Value: name }),
      ];
      userPool.signUp(
        email,
        password,
        attributeList,
        [],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }, [userPool]);

  const confirmSignUp = useCallback(async (email: string, code: string) => {
    if (!userPool) {
      throw new Error("No backend configured. Please add a backend in Settings.");
    }

    return new Promise<void>((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      });

      cognitoUser.confirmRegistration(code, true, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }, [userPool]);

  const signOut = useCallback(async () => {
    if (user) {
      user.signOut();
    }
    // Clear stored tokens
    try {
      const store = new LazyStore("auth.json");
      await store.clear();
      await store.save();
    } catch (e) {
      console.warn("Failed to clear tokens:", e);
    }
    setUser(null);
  }, [user]);

  const getToken = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!user) {
        resolve(null);
        return;
      }

      user.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session?.isValid()) {
          resolve(null);
        } else {
          resolve(session.getIdToken().getJwtToken());
        }
      });
    });
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isConfigured,
        signIn,
        signUp,
        confirmSignUp,
        signOut,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
