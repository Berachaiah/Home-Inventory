"use client";

import { useEffect, useState } from "react";
import { api, getToken, UserOut } from "@/lib/api";

export function useCurrentUser() {
  const [user, setUser] = useState<UserOut | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return {
    user,
    loading,
    isManager: user?.role === "manager" || user?.role === "admin",
    isAdmin: user?.role === "admin",
  };
}
