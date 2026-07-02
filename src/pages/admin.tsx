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
import {
  Users,
  Briefcase,
  ClipboardList,
  Trash2,
  ShieldCheck,
  RefreshCw,
  LayoutDashboard,
  Search,
} from "lucide-react";
import { getSupabaseClient } from "../lib";
import { useToast } from "../components/ToastContainer";
import { useDebouncedValue } from "../hooks";

type Tab = "overview" | "users" | "workers" | "hires";

// PostgREST .or() treats commas/parens as syntax — strip them from user input.
const sanitizeSearch = (s: string) => s.replace(/[,()%]/g, "").trim();

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

const PAGE_SIZE = 25;

type PagedResult<T> = { rows: T[]; count: number };

export default function AdminPage() {
  const { locale } = useUIStore();
  const isNepali = locale === "ne";
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  // Each tab remembers its own page so switching tabs doesn't lose position.
  const [pages, setPages] = useState<Record<Tab, number>>({
    overview: 0,
    users: 0,
    workers: 0,
    hires: 0,
  });
  const setPage = (key: Tab, page: number) =>
    setPages((prev) => ({ ...prev, [key]: Math.max(0, page) }));
  const pageRange = (page: number) =>
    [page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1] as const;

  // Search + per-tab filters. Any change resets that tab to page 0.
  const [searchInput, setSearchInput] = useState("");
  const search = sanitizeSearch(useDebouncedValue(searchInput, 300));
  const [roleFilter, setRoleFilter] = useState("all");
  const [userStatusFilter, setUserStatusFilter] = useState("all");
  const [approvalFilter, setApprovalFilter] = useState("all");
  const [hireStatusFilter, setHireStatusFilter] = useState("all");
  const onSearchChange = (value: string) => {
    setSearchInput(value);
    setPages((prev) => ({ ...prev, users: 0, workers: 0, hires: 0 }));
  };
  const withPageReset =
    (key: Tab, setter: (v: string) => void) => (value: string) => {
      setter(value);
      setPage(key, 0);
    };

  const supabase = () => getSupabaseClient();

  // ── Overview stats (head-only count queries — cheap) ─────────────────
  const overviewQuery = useQuery({
    queryKey: ["admin", "overview"],
    enabled: tab === "overview",
    queryFn: async () => {
      const count = async (
        table: string,
        apply?: (q: any) => any,
      ): Promise<number> => {
        let q: any = supabase()
          .from(table)
          .select("id", { count: "exact", head: true });
        if (apply) q = apply(q);
        const { count: n, error } = await q;
        if (error) throw error;
        return n ?? 0;
      };
      const [
        totalUsers,
        totalWorkers,
        availableWorkers,
        totalHires,
        pendingHires,
        completedHires,
      ] = await Promise.all([
        count("users"),
        count("worker_profiles"),
        count("worker_profiles", (q) => q.eq("is_available", true)),
        count("hire_records"),
        count("hire_records", (q) => q.eq("status", "pending")),
        count("hire_records", (q) => q.eq("status", "completed")),
      ]);
      return {
        totalUsers,
        totalWorkers,
        availableWorkers,
        totalHires,
        pendingHires,
        completedHires,
      };
    },
  });

  // ── Queries (server-side pagination + search + filters) ──────────────
  const usersQuery = useQuery({
    queryKey: ["admin", "users", pages.users, search, roleFilter, userStatusFilter],
    enabled: tab === "users",
    queryFn: async (): Promise<PagedResult<AdminUser>> => {
      const [from, to] = pageRange(pages.users);
      let q = supabase()
        .from("users")
        .select("id, full_name, phone, role, is_verified, is_active, created_at", {
          count: "exact",
        });
      if (search) {
        q = q.or(
          `full_name.ilike.*${search}*,full_name_np.ilike.*${search}*,phone.ilike.*${search}*`,
        );
      }
      if (roleFilter !== "all") q = q.eq("role", roleFilter);
      if (userStatusFilter !== "all")
        q = q.eq("is_active", userStatusFilter === "active");
      const { data, error, count } = await q
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { rows: (data ?? []) as AdminUser[], count: count ?? 0 };
    },
    placeholderData: (prev) => prev,
  });

  const workersQuery = useQuery({
    queryKey: ["admin", "workers", pages.workers, search, approvalFilter],
    queryFn: async (): Promise<PagedResult<AdminWorker>> => {
      const [from, to] = pageRange(pages.workers);
      // users!inner lets the name/phone search filter on the joined table.
      let q = supabase()
        .from("worker_profiles")
        .select(
          "id, user_id, is_approved, is_available, total_hires, daily_rate_npr, users!inner(full_name, phone)",
          { count: "exact" },
        );
      if (search) {
        q = q.or(`full_name.ilike.*${search}*,phone.ilike.*${search}*`, {
          foreignTable: "users",
        });
      }
      if (approvalFilter !== "all")
        q = q.eq("is_approved", approvalFilter === "approved");
      const { data, error, count } = await q
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return {
        rows: (data ?? []) as unknown as AdminWorker[],
        count: count ?? 0,
      };
    },
    enabled: tab === "workers",
    placeholderData: (prev) => prev,
  });

  const hiresQuery = useQuery({
    queryKey: ["admin", "hires", pages.hires, hireStatusFilter],
    queryFn: async (): Promise<PagedResult<AdminHire>> => {
      const [from, to] = pageRange(pages.hires);
      let q = supabase()
        .from("hire_records")
        .select("id, worker_id, hirer_id, status, agreed_rate_npr, hired_at", {
          count: "exact",
        });
      if (hireStatusFilter !== "all") q = q.eq("status", hireStatusFilter);
      const { data, error, count } = await q
        .order("hired_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { rows: (data ?? []) as AdminHire[], count: count ?? 0 };
    },
    enabled: tab === "hires",
    placeholderData: (prev) => prev,
  });

  // Shared pager footer: "Showing X–Y of Z" + Prev/Next.
  const Pager = ({ tabKey, count }: { tabKey: Tab; count: number }) => {
    const page = pages[tabKey];
    const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
    const first = count === 0 ? 0 : page * PAGE_SIZE + 1;
    const last = Math.min(count, (page + 1) * PAGE_SIZE);
    return (
      <div className="flex items-center justify-between border-t border-terrain-100 px-4 py-2 text-xs text-terrain-500">
        <span>
          {isNepali
            ? `${count} मध्ये ${first}–${last}`
            : `Showing ${first}–${last} of ${count}`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage(tabKey, page - 1)}
          >
            {isNepali ? "अघिल्लो" : "Prev"}
          </Button>
          <span>
            {page + 1} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage(tabKey, page + 1)}
          >
            {isNepali ? "अर्को" : "Next"}
          </Button>
        </div>
      </div>
    );
  };

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
    { key: "overview", label: "Overview", labelNp: "अवलोकन", icon: LayoutDashboard },
    { key: "users", label: "Users", labelNp: "प्रयोगकर्ता", icon: Users },
    { key: "workers", label: "Workers", labelNp: "कामदार", icon: Briefcase },
    { key: "hires", label: "Hires", labelNp: "भाडा", icon: ClipboardList },
  ];

  const selectCls =
    "rounded-lg border border-terrain-300 bg-white px-2 py-1.5 text-sm text-mountain-900";

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

      {tab !== "overview" && (
        <div className="flex flex-wrap items-center gap-2">
          {tab !== "hires" && (
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-terrain-400" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={
                  isNepali ? "नाम वा फोन खोज्नुहोस्…" : "Search name or phone…"
                }
                className="w-full rounded-lg border border-terrain-300 bg-white py-1.5 pl-8 pr-3 text-sm text-mountain-900 placeholder:text-terrain-400"
                aria-label={isNepali ? "खोज्नुहोस्" : "Search"}
              />
            </div>
          )}
          {tab === "users" && (
            <>
              <select
                value={roleFilter}
                onChange={(e) => withPageReset("users", setRoleFilter)(e.target.value)}
                className={selectCls}
                aria-label={isNepali ? "भूमिका" : "Role"}
              >
                <option value="all">{isNepali ? "सबै भूमिका" : "All roles"}</option>
                <option value="hirer">hirer</option>
                <option value="worker">worker</option>
                <option value="admin">admin</option>
              </select>
              <select
                value={userStatusFilter}
                onChange={(e) =>
                  withPageReset("users", setUserStatusFilter)(e.target.value)
                }
                className={selectCls}
                aria-label={isNepali ? "स्थिति" : "Status"}
              >
                <option value="all">{isNepali ? "सबै स्थिति" : "All status"}</option>
                <option value="active">{isNepali ? "सक्रिय" : "Active"}</option>
                <option value="inactive">{isNepali ? "निष्क्रिय" : "Inactive"}</option>
              </select>
            </>
          )}
          {tab === "workers" && (
            <select
              value={approvalFilter}
              onChange={(e) =>
                withPageReset("workers", setApprovalFilter)(e.target.value)
              }
              className={selectCls}
              aria-label={isNepali ? "स्वीकृति" : "Approval"}
            >
              <option value="all">{isNepali ? "सबै" : "All"}</option>
              <option value="approved">{isNepali ? "स्वीकृत" : "Approved"}</option>
              <option value="pending">{isNepali ? "पेन्डिङ" : "Pending"}</option>
            </select>
          )}
          {tab === "hires" && (
            <select
              value={hireStatusFilter}
              onChange={(e) =>
                withPageReset("hires", setHireStatusFilter)(e.target.value)
              }
              className={selectCls}
              aria-label={isNepali ? "स्थिति" : "Status"}
            >
              <option value="all">{isNepali ? "सबै स्थिति" : "All status"}</option>
              <option value="pending">pending</option>
              <option value="accepted">accepted</option>
              <option value="rejected">rejected</option>
              <option value="completed">completed</option>
              <option value="cancelled">cancelled</option>
            </select>
          )}
        </div>
      )}

      {tab === "overview" && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {(
            [
              {
                label: isNepali ? "कुल प्रयोगकर्ता" : "Total users",
                value: overviewQuery.data?.totalUsers,
                color: "text-crimson-700",
              },
              {
                label: isNepali ? "कामदार प्रोफाइल" : "Worker profiles",
                value: overviewQuery.data?.totalWorkers,
                color: "text-mountain-900",
              },
              {
                label: isNepali ? "उपलब्ध कामदार" : "Available workers",
                value: overviewQuery.data?.availableWorkers,
                color: "text-green-700",
              },
              {
                label: isNepali ? "कुल भाडा" : "Total hires",
                value: overviewQuery.data?.totalHires,
                color: "text-mountain-900",
              },
              {
                label: isNepali ? "पेन्डिङ भाडा" : "Pending hires",
                value: overviewQuery.data?.pendingHires,
                color: "text-amber-600",
              },
              {
                label: isNepali ? "सम्पन्न भाडा" : "Completed hires",
                value: overviewQuery.data?.completedHires,
                color: "text-green-700",
              },
            ] as const
          ).map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <p className={`text-2xl font-bold ${stat.color}`}>
                  {overviewQuery.isLoading ? "…" : (stat.value ?? 0)}
                </p>
                <p className="mt-1 text-xs text-terrain-500">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
                  {(usersQuery.data?.rows ?? []).map((u) => (
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
            <Pager tabKey="users" count={usersQuery.data?.count ?? 0} />
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
                  {(workersQuery.data?.rows ?? []).map((w) => (
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
            <Pager tabKey="workers" count={workersQuery.data?.count ?? 0} />
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
                  {(hiresQuery.data?.rows ?? []).map((h) => (
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
            <Pager tabKey="hires" count={hiresQuery.data?.count ?? 0} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
