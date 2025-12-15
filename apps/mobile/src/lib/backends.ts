// Cloud Backend Configuration Management

export interface CloudBackend {
  id: string;
  name: string;
  apiUrl: string;
  region: string;
  userPoolId: string;
  userPoolClientId: string;
  createdAt: number;
}

const BACKENDS_STORAGE_KEY = "cw-alarms-backends";
const ACTIVE_BACKEND_KEY = "cw-alarms-active-backend";

export function getBackends(): CloudBackend[] {
  try {
    const stored = localStorage.getItem(BACKENDS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveBackends(backends: CloudBackend[]): void {
  localStorage.setItem(BACKENDS_STORAGE_KEY, JSON.stringify(backends));
}

export function addBackend(backend: Omit<CloudBackend, "id" | "createdAt">): CloudBackend {
  const backends = getBackends();
  const newBackend: CloudBackend = {
    ...backend,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  backends.push(newBackend);
  saveBackends(backends);

  // If this is the first backend, make it active
  if (backends.length === 1) {
    setActiveBackendId(newBackend.id);
  }

  return newBackend;
}

export function updateBackend(id: string, updates: Partial<Omit<CloudBackend, "id" | "createdAt">>): void {
  const backends = getBackends();
  const index = backends.findIndex((b) => b.id === id);
  if (index !== -1) {
    backends[index] = { ...backends[index], ...updates };
    saveBackends(backends);
  }
}

export function deleteBackend(id: string): void {
  const backends = getBackends().filter((b) => b.id !== id);
  saveBackends(backends);

  // If deleted backend was active, switch to first available
  if (getActiveBackendId() === id) {
    setActiveBackendId(backends[0]?.id || null);
  }
}

export function getActiveBackendId(): string | null {
  return localStorage.getItem(ACTIVE_BACKEND_KEY);
}

export function setActiveBackendId(id: string | null): void {
  if (id) {
    localStorage.setItem(ACTIVE_BACKEND_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_BACKEND_KEY);
  }
}

export function getActiveBackend(): CloudBackend | null {
  const activeId = getActiveBackendId();
  if (!activeId) return null;
  return getBackends().find((b) => b.id === activeId) || null;
}

// Initialize with env backend if no backends exist
export function initializeDefaultBackend(): void {
  const backends = getBackends();
  if (backends.length === 0) {
    const apiUrl = import.meta.env.VITE_API_URL;
    const userPoolId = import.meta.env.VITE_USER_POOL_ID || import.meta.env.VITE_COGNITO_USER_POOL_ID;
    const userPoolClientId = import.meta.env.VITE_USER_POOL_CLIENT_ID || import.meta.env.VITE_COGNITO_CLIENT_ID;
    const region = import.meta.env.VITE_AWS_REGION || import.meta.env.VITE_COGNITO_REGION || "eu-west-1";

    if (apiUrl && userPoolId && userPoolClientId) {
      addBackend({
        name: "Default",
        apiUrl,
        region,
        userPoolId,
        userPoolClientId,
      });
    }
  }
}
