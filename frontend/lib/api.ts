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
  me: () => request<UserOut>("/api/auth/me"),
  listUsers: () => request<UserOut[]>("/api/auth/users"),
  updateUser: (id: number, payload: Partial<{ role: string; is_active: boolean; first_name: string; last_name: string; phone: string }>) =>
    request<UserOut>(`/api/auth/users/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteUser: (id: number) => request<{ deleted: boolean }>(`/api/auth/users/${id}`, { method: "DELETE" }),
  register: (payload: { username: string; password: string; email?: string; first_name?: string; last_name?: string; role?: string }) =>
    request<UserOut>("/api/auth/register", { method: "POST", body: JSON.stringify(payload) }),

  // ---- Categories & Rooms ----
  listCategories: () => request<CategoryOut[]>("/api/catalog/categories"),
  createCategory: (payload: { name: string; description?: string }) =>
    request<CategoryOut>("/api/catalog/categories", { method: "POST", body: JSON.stringify(payload) }),
  deleteCategory: (id: number) => request<{ deleted: boolean } | void>(`/api/catalog/categories/${id}`, { method: "DELETE" }),

  listRooms: () => request<RoomOut[]>("/api/catalog/rooms"),
  createRoom: (payload: { name: string; description?: string }) =>
    request<RoomOut>("/api/catalog/rooms", { method: "POST", body: JSON.stringify(payload) }),
  deleteRoom: (id: number) => request<{ deleted: boolean } | void>(`/api/catalog/rooms/${id}`, { method: "DELETE" }),

  // ---- Items ----
  listItems: () => request<ItemOut[]>("/api/items"),
  getItem: (id: number) => request<ItemOut>(`/api/items/${id}`),
  createItem: (payload: Partial<ItemOut> & { name: string }) =>
    request<ItemOut>("/api/items", { method: "POST", body: JSON.stringify(payload) }),
  updateItem: (id: number, payload: Partial<ItemOut>) =>
    request<ItemOut>(`/api/items/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteItem: (id: number) => request<{ deleted: boolean } | void>(`/api/items/${id}`, { method: "DELETE" }),

  // ---- Batches ----
  listBatches: (itemId: number) => request<BatchOut[]>(`/api/items/${itemId}/batches`),
  createBatch: (payload: {
    item_id: number; purchase_date: string; expiry_date?: string | null;
    pack_quantity: number; units_per_pack: number; unit_price: number; notes?: string;
  }) => request<BatchOut>("/api/batches", { method: "POST", body: JSON.stringify(payload) }),
  updateBatch: (id: number, payload: {
    item_id: number; purchase_date: string; expiry_date?: string | null;
    pack_quantity: number; units_per_pack: number; unit_price: number; notes?: string;
  }) => request<BatchOut>(`/api/batches/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteBatch: (id: number) => request<{ deleted: boolean } | void>(`/api/batches/${id}`, { method: "DELETE" }),

  // ---- Withdrawals ----
  withdrawStock: (payload: { item_id: number; quantity: number; purpose?: string; notes?: string }) =>
    request<WithdrawalOut[]>("/api/withdrawals", { method: "POST", body: JSON.stringify(payload) }),
  listWithdrawals: (itemId?: number) =>
    request<WithdrawalLogOut[]>(`/api/withdrawals${itemId ? `?item_id=${itemId}` : ""}`),

  // ---- Restock plans ----
  listRestockPlans: () => request<RestockPlanOut[]>("/api/restock"),
  getRestockPlan: (id: number) => request<RestockPlanOut>(`/api/restock/${id}`),
  createRestockPlan: (payload: { name: string; notes?: string }) =>
    request<RestockPlanOut>("/api/restock", { method: "POST", body: JSON.stringify(payload) }),
  deleteRestockPlan: (id: number) => request<{ deleted: boolean }>(`/api/restock/${id}`, { method: "DELETE" }),
  addRestockPlanItem: (
    planId: number,
    payload: { item_id: number; packs_to_buy: number; units_per_pack?: number; estimated_price_per_pack?: number; notes?: string }
  ) => request<RestockPlanOut>(`/api/restock/${planId}/items`, { method: "POST", body: JSON.stringify(payload) }),
  deleteRestockPlanItem: (planItemId: number) =>
    request<{ deleted: boolean }>(`/api/restock/items/${planItemId}`, { method: "DELETE" }),
  markRestocked: (planItemId: number, actualPricePerPack: number, actualExpiryDate?: string) =>
    request<RestockPlanItemOut>(
      `/api/restock/items/${planItemId}/mark-restocked?actual_price_per_pack=${actualPricePerPack}` +
        (actualExpiryDate ? `&actual_expiry_date=${actualExpiryDate}` : ""),
      { method: "POST" }
    ),
  updateRestockPlanStatus: (planId: number, status: string) =>
    request<RestockPlanOut>(`/api/restock/${planId}/status?status=${status}`, { method: "PUT" }),

  // ---- Assistant ----
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

  // ---- Push ----
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

// ---------- Types ----------

export type UserOut = {
  id: number;
  username: string;
  email: string | null;
  first_name: string;
  last_name: string;
  phone: string;
  role: "admin" | "manager" | "member";
  is_active: boolean;
};

export type CategoryOut = { id: number; name: string; description: string };
export type RoomOut = { id: number; name: string; description: string };

export type ItemOut = {
  id: number;
  name: string;
  brand: string;
  category_id: number | null;
  room_id: number | null;
  unit_type: string;
  reorder_threshold: number;
  description: string;
  total_quantity: number | null;
  stock_status: "out" | "low" | "moderate" | "good" | null;
  earliest_expiry: string | null;
  expiry_status: "none" | "ok" | "warning" | "critical" | "expired" | null;
};

export type BatchOut = {
  id: number;
  item_id: number;
  purchase_date: string;
  expiry_date: string | null;
  pack_quantity: number;
  units_per_pack: number;
  unit_price: number;
  notes: string;
  is_active: boolean;
  total_units: number | null;
  remaining_units: number | null;
  total_cost: number | null;
  expiry_status: string | null;
};

export type WithdrawalOut = {
  id: number;
  batch_id: number;
  user_id: number | null;
  quantity_taken: number;
  quantity_remaining_after: number;
  purpose: string;
  notes: string;
  withdrawn_at: string;
};

export type WithdrawalLogOut = WithdrawalOut & { item_name: string; username: string };

export type RestockPlanItemOut = {
  id: number;
  plan_id: number;
  item_id: number;
  packs_to_buy: number;
  units_per_pack: number;
  estimated_price_per_pack: number;
  is_restocked: boolean;
  actual_price_per_pack: number;
  estimated_cost: number | null;
  actual_cost: number | null;
};

export type RestockPlanOut = {
  id: number;
  name: string;
  status: "draft" | "shopping" | "done";
  notes: string;
  created_at: string;
  total_estimated_cost: number | null;
  total_restocked_cost: number | null;
  items: RestockPlanItemOut[];
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
