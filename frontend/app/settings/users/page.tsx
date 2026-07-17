"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken, UserOut } from "@/lib/api";

const ROLES: UserOut["role"][] = ["admin", "manager", "member"];

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<UserOut["role"]>("member");

  function load() {
    api
      .listUsers()
      .then(setUsers)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load users"));
  }

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    load();
  }, [router]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.register({
        username,
        password,
        email: email || undefined,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        role,
      });
      setUsername("");
      setPassword("");
      setEmail("");
      setFirstName("");
      setLastName("");
      setRole("member");
      setShowAdd(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create user");
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(u: UserOut, newRole: UserOut["role"]) {
    try {
      await api.updateUser(u.id, { role: newRole });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update role");
    }
  }

  async function handleToggleActive(u: UserOut) {
    try {
      await api.updateUser(u.id, { is_active: !u.is_active });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update status");
    }
  }

  async function handleDelete(u: UserOut) {
    if (!confirm(`Delete user "${u.username}"?`)) return;
    try {
      await api.deleteUser(u.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete user");
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pt-safe pb-10 md:px-8 md:py-10">
      <header className="mb-6 flex items-center justify-between pt-6 md:pt-0">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-soft">Settings</p>
          <h1 className="font-display text-2xl font-extrabold text-navy-dark md:text-3xl">👥 Manage Users</h1>
        </div>
        <button
          onClick={() => setShowAdd((s) => !s)}
          className="focus-ring rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
        >
          {showAdd ? "Cancel" : "+ Add User"}
        </button>
      </header>

      {showAdd && (
        <form onSubmit={handleAdd} className="mb-6 grid grid-cols-1 gap-3 rounded-xl bg-white p-4 shadow-card md:grid-cols-2">
          <input
            className="focus-ring rounded-lg border border-border bg-bg px-3 py-2 text-ink"
            placeholder="Username *"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            className="focus-ring rounded-lg border border-border bg-bg px-3 py-2 text-ink"
            placeholder="Password *"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            className="focus-ring rounded-lg border border-border bg-bg px-3 py-2 text-ink"
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <input
            className="focus-ring rounded-lg border border-border bg-bg px-3 py-2 text-ink"
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
          <input
            className="focus-ring rounded-lg border border-border bg-bg px-3 py-2 text-ink"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select
            className="focus-ring rounded-lg border border-border bg-bg px-3 py-2 text-ink"
            value={role}
            onChange={(e) => setRole(e.target.value as UserOut["role"])}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="focus-ring rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
            >
              {saving ? "Creating…" : "Create User"}
            </button>
          </div>
        </form>
      )}

      {error && <p className="mb-3 text-sm font-medium text-danger">{error}</p>}
      {!users && !error && <p className="text-ink-soft">Loading…</p>}

      {users && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-ink-soft">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Username</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-semibold text-ink">
                    {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}`.trim() : "—"}
                  </td>
                  <td className="px-4 py-3">{u.username}</td>
                  <td className="px-4 py-3 text-ink-soft">{u.email || "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{u.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u, e.target.value as UserOut["role"])}
                      className="focus-ring rounded-lg border border-border bg-bg px-2 py-1 text-xs font-semibold uppercase"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(u)}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        u.is_active ? "bg-emerald-100 text-emerald-700" : "bg-danger-soft text-danger"
                      }`}
                    >
                      {u.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(u)}
                      className="focus-ring rounded-lg px-3 py-1.5 text-sm font-semibold text-danger hover:bg-danger-soft"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}