import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  CognitoUserPool,
  CognitoUser,
  CognitoUserAttribute,
  AuthenticationDetails,
  CognitoUserSession,
} from "amazon-cognito-identity-js";
import { LazyStore } from "@tauri-apps/plugin-store";

const CONFIG = {
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || "",
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID || "",
  region: import.meta.env.VITE_COGNITO_REGION || "eu-west-1",
};

const userPool = new CognitoUserPool({
  UserPoolId: CONFIG.userPoolId,
  ClientId: CONFIG.clientId,
});

interface AuthContextType {
  user: CognitoUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
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

  useEffect(() => {
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
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
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
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
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
  }, []);

  const confirmSignUp = useCallback(async (email: string, code: string) => {
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
  }, []);

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
