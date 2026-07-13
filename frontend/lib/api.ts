const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("akanbi_token");
}

export function setToken(token: string) {
  window.localStorage.setItem("akanbi_token", token);
}

export function clearToken() {
  window.localStorage.removeItem("akanbi_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.body && !(options.body instanceof URLSearchParams)
      ? { "Content-Type": "application/json" }
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  login: (username: string, password: string) => {
    const form = new URLSearchParams({ username, password });
    return request<{ access_token: string; token_type: string }>("/api/auth/token", {
      method: "POST",
      body: form,
    });
  },
  me: () => request<{ id: number; username: string; role: string; first_name: string; last_name: string }>("/api/auth/me"),

  listItems: () => request<ItemOut[]>("/api/items"),

  chat: (message: string, history: { role: string; content: string }[]) =>
    request<ChatResponse>("/api/assistant/chat", {
      method: "POST",
      body: JSON.stringify({ message, history }),
    }),
  executeAction: (action_type: string, params: Record<string, unknown>) =>
    request<{ executed: boolean }>("/api/assistant/execute", {
      method: "POST",
      body: JSON.stringify({ action_type, params }),
    }),

  getVapidPublicKey: () => request<{ public_key: string }>("/api/push/vapid-public-key"),
  subscribePush: (subscription: PushSubscriptionJSON) =>
    request<{ subscribed: boolean }>("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify(subscription),
    }),
  unsubscribePush: (endpoint: string) =>
    request<{ unsubscribed: boolean }>(`/api/push/unsubscribe?endpoint=${encodeURIComponent(endpoint)}`, {
      method: "DELETE",
    }),
  sendTestPush: () => request<{ sent: number }>("/api/push/test", { method: "POST" }),
};

export type ItemOut = {
  id: number;
  name: string;
  brand: string;
  unit_type: string;
  reorder_threshold: number;
  total_quantity: number | null;
  stock_status: "out" | "low" | "moderate" | "good" | null;
  expiry_status: "none" | "ok" | "warning" | "critical" | "expired" | null;
};

export type PendingAction = {
  action_type: string;
  description: string;
  params: Record<string, unknown>;
};

export type ChatResponse = {
  reply: string;
  pending_action: PendingAction | null;
};
