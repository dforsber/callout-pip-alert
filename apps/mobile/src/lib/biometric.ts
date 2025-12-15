import { checkStatus, authenticate, BiometryType } from "@tauri-apps/plugin-biometric";
import { LazyStore } from "@tauri-apps/plugin-store";

const BIOMETRIC_ENABLED_KEY = "biometric-enabled";
const STORED_EMAIL_KEY = "stored-email";
const STORED_REFRESH_TOKEN_KEY = "stored-refresh-token";

// Check if running in Tauri native environment
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

let store: LazyStore | null = null;
function getStore(): LazyStore {
  if (!store) {
    store = new LazyStore("secure-auth.json");
  }
  return store;
}

export interface BiometricStatus {
  available: boolean;
  biometryType: BiometryType;
  errorMessage?: string;
}

export async function checkBiometricAvailability(): Promise<BiometricStatus> {
  if (!isTauri()) {
    return {
      available: false,
      biometryType: BiometryType.None,
      errorMessage: "Not in native environment",
    };
  }

  try {
    const status = await checkStatus();
    return {
      available: status.isAvailable,
      biometryType: status.biometryType,
      errorMessage: status.error,
    };
  } catch (error) {
    console.warn("Biometric check failed:", error);
    return {
      available: false,
      biometryType: BiometryType.None,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function authenticateWithBiometric(reason: string): Promise<boolean> {
  if (!isTauri()) return false;

  try {
    await authenticate(reason, {
      allowDeviceCredential: true,
      cancelTitle: "Use Password",
      fallbackTitle: "Use Password",
    });
    return true;
  } catch {
    return false;
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  if (!isTauri()) return false;

  try {
    const enabled = await getStore().get<boolean>(BIOMETRIC_ENABLED_KEY);
    return enabled === true;
  } catch {
    return false;
  }
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  if (!isTauri()) return;

  try {
    const s = getStore();
    await s.set(BIOMETRIC_ENABLED_KEY, enabled);
    await s.save();
  } catch (e) {
    console.warn("Failed to set biometric enabled:", e);
  }
}

export async function storeCredentials(email: string, refreshToken: string): Promise<void> {
  if (!isTauri()) return;

  try {
    const s = getStore();
    await s.set(STORED_EMAIL_KEY, email);
    await s.set(STORED_REFRESH_TOKEN_KEY, refreshToken);
    await s.save();
  } catch (e) {
    console.warn("Failed to store credentials:", e);
  }
}

export async function getStoredCredentials(): Promise<{ email: string; refreshToken: string } | null> {
  if (!isTauri()) return null;

  try {
    const s = getStore();
    const email = await s.get<string>(STORED_EMAIL_KEY);
    const refreshToken = await s.get<string>(STORED_REFRESH_TOKEN_KEY);

    if (email && refreshToken) {
      return { email, refreshToken };
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearStoredCredentials(): Promise<void> {
  if (!isTauri()) return;

  try {
    const s = getStore();
    await s.delete(STORED_EMAIL_KEY);
    await s.delete(STORED_REFRESH_TOKEN_KEY);
    await s.save();
  } catch (e) {
    console.warn("Failed to clear credentials:", e);
  }
}

export async function hasStoredCredentials(): Promise<boolean> {
  const credentials = await getStoredCredentials();
  return credentials !== null;
}

export function getBiometryTypeName(type: BiometryType): string {
  switch (type) {
    case BiometryType.FaceID:
      return "Face ID";
    case BiometryType.TouchID:
      return "Touch ID";
    case BiometryType.Iris:
      return "Iris";
    default:
      return "Biometrics";
  }
}
