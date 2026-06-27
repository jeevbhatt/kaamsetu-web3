/**
 * Admin console — CRUD over users, worker profiles, and hire records.
 * Route is guarded by requireAdmin (role='admin') in the router, and every
 * write is additionally enforced by the admin_all_* RLS policies, so a
 * non-admin who reached this page could not actually mutate anything.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUIStore } from "../store";
import { Button, Card, CardContent, Badge } from "../components/ui";
import { Users, Briefcase, ClipboardList, Trash2, ShieldCheck, RefreshCw } from "lucide-react";
import { getSupabaseClient } from "../lib";
import { useToast } from "../components/ToastContainer";

type Tab = "users" | "workers" | "hires";

type AdminUser = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
};

type AdminWorker = {
  id: string;
  user_id: string;
  is_approved: boolean;
  is_available: boolean;
  total_hires: number | null;
  daily_rate_npr: number | null;
  users?: { full_name: string | null; phone: string | null } | null;
};

type AdminHire = {
  id: string;
  worker_id: string;
  hirer_id: string;
  status: string;
  agreed_rate_npr: number | null;
  hired_at: string;
};

export default function AdminPage() {
  const { locale } = useUIStore();
  const isNepali = locale === "ne";
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("users");

  const supabase = () => getSupabaseClient();

  // ── Queries ──────────────────────────────────────────────────────────
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async (): Promise<AdminUser[]> => {
      const { data, error } = await supabase()
        .from("users")
        .select("id, full_name, phone, role, is_verified, is_active, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as AdminUser[];
    },
  });

  const workersQuery = useQuery({
    queryKey: ["admin", "workers"],
    queryFn: async (): Promise<AdminWorker[]> => {
      const { data, error } = await supabase()
        .from("worker_profiles")
        .select(
          "id, user_id, is_approved, is_available, total_hires, daily_rate_npr, users(full_name, phone)",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as AdminWorker[];
    },
    enabled: tab === "workers",
  });

  const hiresQuery = useQuery({
    queryKey: ["admin", "hires"],
    queryFn: async (): Promise<AdminHire[]> => {
      const { data, error } = await supabase()
        .from("hire_records")
        .select("id, worker_id, hirer_id, status, agreed_rate_npr, hired_at")
        .order("hired_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as AdminHire[];
    },
    enabled: tab === "hires",
  });

  // ── Mutations ────────────────────────────────────────────────────────
  const runMutation = (key: string[]) => ({
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key });
      toast.success(isNepali ? "अपडेट भयो" : "Updated", "");
    },
    onError: (error: unknown) =>
      toast.error(
        isNepali ? "त्रुटि" : "Error",
        error instanceof Error ? error.message : "Failed",
      ),
  });

  const updateUser = useMutation({
    mutationFn: async (vars: { id: string; patch: Partial<AdminUser> }) => {
      const { error } = await (supabase() as any)
        .from("users")
        .update({ ...vars.patch, updated_at: new Date().toISOString() })
        .eq("id", vars.id);
      if (error) throw error;
    },
    ...runMutation(["admin", "users"]),
  });

  const setWorkerApproval = useMutation({
    mutationFn: async (vars: { id: string; approved: boolean }) => {
      const { error } = await (supabase() as any)
        .from("worker_profiles")
        .update({ is_approved: vars.approved, updated_at: new Date().toISOString() })
        .eq("id", vars.id);
      if (error) throw error;
    },
    ...runMutation(["admin", "workers"]),
  });

  const deleteWorker = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase().from("worker_profiles").delete().eq("id", id);
      if (error) throw error;
    },
    ...runMutation(["admin", "workers"]),
  });

  const deleteHire = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase().from("hire_records").delete().eq("id", id);
      if (error) throw error;
    },
    ...runMutation(["admin", "hires"]),
  });

  const tabs: { key: Tab; label: string; labelNp: string; icon: typeof Users }[] = [
    { key: "users", label: "Users", labelNp: "प्रयोगकर्ता", icon: Users },
    { key: "workers", label: "Workers", labelNp: "कामदार", icon: Briefcase },
    { key: "hires", label: "Hires", labelNp: "भाडा", icon: ClipboardList },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-mountain-900 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-crimson-700" />
          {isNepali ? "एडमिन कन्सोल" : "Admin Console"}
        </h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void qc.invalidateQueries({ queryKey: ["admin"] });
          }}
        >
          <RefreshCw className="w-4 h-4 mr-1.5" />
          {isNepali ? "ताजा गर्नुहोस्" : "Refresh"}
        </Button>
      </div>

      <div className="flex gap-2 border-b border-terrain-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "text-crimson-700 border-b-2 border-crimson-700"
                : "text-terrain-500 hover:text-mountain-900"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {isNepali ? t.labelNp : t.label}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {usersQuery.isLoading ? (
              <p className="p-6 text-sm text-terrain-500">Loading…</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-terrain-50 text-left text-xs text-terrain-500">
                  <tr>
                    <th className="px-4 py-2">{isNepali ? "नाम" : "Name"}</th>
                    <th className="px-4 py-2">{isNepali ? "फोन" : "Phone"}</th>
                    <th className="px-4 py-2">{isNepali ? "भूमिका" : "Role"}</th>
                    <th className="px-4 py-2">{isNepali ? "स्थिति" : "Status"}</th>
                    <th className="px-4 py-2 text-right">{isNepali ? "कार्य" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-terrain-100">
                  {(usersQuery.data ?? []).map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-2 font-medium text-mountain-900">
                        {u.full_name || "—"}
                      </td>
                      <td className="px-4 py-2 text-terrain-500">{u.phone || "—"}</td>
                      <td className="px-4 py-2">
                        <select
                          value={u.role}
                          onChange={(e) =>
                            updateUser.mutate({ id: u.id, patch: { role: e.target.value } })
                          }
                          className="rounded border border-terrain-300 px-2 py-1 text-xs"
                        >
                          <option value="hirer">hirer</option>
                          <option value="worker">worker</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          {u.is_verified && (
                            <Badge variant="success" className="text-[10px]">
                              {isNepali ? "प्रमाणित" : "Verified"}
                            </Badge>
                          )}
                          <Badge
                            variant={u.is_active ? "secondary" : "destructive"}
                            className="text-[10px]"
                          >
                            {u.is_active ? (isNepali ? "सक्रिय" : "Active") : (isNepali ? "निष्क्रिय" : "Inactive")}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateUser.mutate({
                                id: u.id,
                                patch: { is_verified: !u.is_verified },
                              })
                            }
                          >
                            {u.is_verified ? (isNepali ? "अप्रमाणित" : "Unverify") : (isNepali ? "प्रमाणित" : "Verify")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className={u.is_active ? "text-red-600" : ""}
                            onClick={() =>
                              updateUser.mutate({
                                id: u.id,
                                patch: { is_active: !u.is_active },
                              })
                            }
                          >
                            {u.is_active ? (isNepali ? "निष्क्रिय" : "Deactivate") : (isNepali ? "सक्रिय" : "Activate")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "workers" && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {workersQuery.isLoading ? (
              <p className="p-6 text-sm text-terrain-500">Loading…</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-terrain-50 text-left text-xs text-terrain-500">
                  <tr>
                    <th className="px-4 py-2">{isNepali ? "नाम" : "Name"}</th>
                    <th className="px-4 py-2">{isNepali ? "दर" : "Rate"}</th>
                    <th className="px-4 py-2">{isNepali ? "भाडा" : "Hires"}</th>
                    <th className="px-4 py-2">{isNepali ? "स्वीकृत" : "Approved"}</th>
                    <th className="px-4 py-2 text-right">{isNepali ? "कार्य" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-terrain-100">
                  {(workersQuery.data ?? []).map((w) => (
                    <tr key={w.id}>
                      <td className="px-4 py-2 font-medium text-mountain-900">
                        {w.users?.full_name || w.user_id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-2 text-terrain-500">
                        {w.daily_rate_npr ? `रु ${w.daily_rate_npr}` : "—"}
                      </td>
                      <td className="px-4 py-2 text-terrain-500">{w.total_hires ?? 0}</td>
                      <td className="px-4 py-2">
                        <Badge variant={w.is_approved ? "success" : "secondary"} className="text-[10px]">
                          {w.is_approved ? (isNepali ? "स्वीकृत" : "Approved") : (isNepali ? "पेन्डिङ" : "Pending")}
                        </Badge>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setWorkerApproval.mutate({ id: w.id, approved: !w.is_approved })
                            }
                          >
                            {w.is_approved ? (isNepali ? "रद्द" : "Revoke") : (isNepali ? "स्वीकृत" : "Approve")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            onClick={() => {
                              if (window.confirm(isNepali ? "मेटाउने?" : "Delete this worker profile?"))
                                deleteWorker.mutate(w.id);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "hires" && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {hiresQuery.isLoading ? (
              <p className="p-6 text-sm text-terrain-500">Loading…</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-terrain-50 text-left text-xs text-terrain-500">
                  <tr>
                    <th className="px-4 py-2">{isNepali ? "मिति" : "Date"}</th>
                    <th className="px-4 py-2">{isNepali ? "स्थिति" : "Status"}</th>
                    <th className="px-4 py-2">{isNepali ? "दर" : "Rate"}</th>
                    <th className="px-4 py-2 text-right">{isNepali ? "कार्य" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-terrain-100">
                  {(hiresQuery.data ?? []).map((h) => (
                    <tr key={h.id}>
                      <td className="px-4 py-2 text-terrain-500">
                        {new Date(h.hired_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant="secondary" className="text-[10px]">{h.status}</Badge>
                      </td>
                      <td className="px-4 py-2 text-terrain-500">
                        {h.agreed_rate_npr ? `रु ${h.agreed_rate_npr}` : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            onClick={() => {
                              if (window.confirm(isNepali ? "मेटाउने?" : "Delete this hire record?"))
                                deleteHire.mutate(h.id);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
