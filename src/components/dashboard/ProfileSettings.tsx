import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { getSupabaseSafe } from "../../lib/supabase";
import { showToast } from "../ui/Toast";

export default function ProfileSettings() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Worker fields
  const [isAvailable, setIsAvailable] = useState(false);
  const [dailyRate, setDailyRate] = useState<number | "">("");
  const [experience, setExperience] = useState<number | "">("");
  const [about, setAbout] = useState("");

  // Base user fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    async function loadProfile() {
      if (!user) return;
      const supabase = getSupabaseSafe();
      if (!supabase) return;

      try {
        setFullName(user.fullName || "");
        setPhone(user.phone || "");

        if (user.role === "worker") {
          const { data, error } = await supabase
            .from("worker_profiles")
            .select("is_available, daily_rate_npr, experience_yrs, about")
            .eq("user_id", user.id)
            .single();

          if (error) {
            // Depending on RLS this might fail if not registered or no policies
            console.error("Worker profile fetch error:", error);
          } else if (data) {
            const workerProfile = data as any;
            setIsAvailable(Boolean(workerProfile.is_available));
            setDailyRate(workerProfile.daily_rate_npr || "");
            setExperience(workerProfile.experience_yrs || "");
            setAbout(workerProfile.about || "");
          }
        }
      } catch (err: any) {
        console.error("Failed to load profile:", err.message);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    const supabase = getSupabaseSafe();
    if (!supabase) return;
    const supabaseAny = supabase as any;

    setSaving(true);
    try {
      // 1. Update users table
      const { error: userError } = await supabaseAny
        .from("users")
        .update({
          full_name: fullName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (userError) throw userError;

      // 2. Update worker profile if applicable
      if (user.role === "worker") {
        const { error: workerError } = await supabaseAny
          .from("worker_profiles")
          .update({
            is_available: isAvailable,
            daily_rate_npr: dailyRate === "" ? null : Number(dailyRate),
            experience_yrs: experience === "" ? 0 : Number(experience),
            about: about,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);

        if (workerError) throw workerError;
      }

      showToast("Profile saved successfully!", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to save profile", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="section loading-center">
        <div className="spinner" />
        <span style={{ marginTop: 12 }}>Loading profile...</span>
      </div>
    );
  }

  return (
    <div className="section animate-in">
      <div className="page-header">
        <h1 className="page-title">Profile Settings</h1>
        <p className="page-desc">Manage your account and availability.</p>
      </div>

      <div className="card" style={{ maxWidth: 600, margin: "0 auto 32px" }}>
        {/* Account Basic Info */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
            Personal Info
          </h3>
          <div className="form-group">
            <label className="label">Full Name</label>
            <input
              className="input"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="label">Phone / Identity</label>
            <input
              className="input"
              type="text"
              value={phone || user?.phone || "Unknown"}
              disabled
              style={{
                background: "var(--terrain-100)",
                cursor: "not-allowed",
              }}
            />
            <span
              style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}
            >
              Identity identifier cannot be changed.
            </span>
          </div>
        </div>

        {/* Worker Only Info */}
        {user?.role === "worker" && (
          <>
            <hr
              style={{
                border: "none",
                borderTop: "1px solid var(--terrain-200)",
                margin: "24px 0",
              }}
            />
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
                Worker Details
              </h3>

              <div className="form-group">
                <label
                  className="checkbox-label"
                  style={{
                    padding: "12px",
                    background: isAvailable
                      ? "var(--green-50)"
                      : "var(--terrain-100)",
                    borderRadius: 8,
                    border: "1px solid",
                    borderColor: isAvailable
                      ? "var(--green-500)"
                      : "var(--terrain-200)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isAvailable}
                    onChange={(e) => setIsAvailable(e.target.checked)}
                  />
                  <div>
                    <strong
                      style={{
                        display: "block",
                        color: isAvailable ? "var(--green-600)" : "inherit",
                      }}
                    >
                      Currently Available for Work
                    </strong>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      Turn this off if you are fully booked or on leave.
                    </span>
                  </div>
                </label>
              </div>

              <div className="form-group">
                <label className="label">Daily Rate (NPR)</label>
                <input
                  className="input"
                  type="number"
                  value={dailyRate}
                  onChange={(e) =>
                    setDailyRate(e.target.value ? Number(e.target.value) : "")
                  }
                />
              </div>

              <div className="form-group">
                <label className="label">Experience (Years)</label>
                <input
                  className="input"
                  type="number"
                  value={experience}
                  onChange={(e) =>
                    setExperience(e.target.value ? Number(e.target.value) : "")
                  }
                />
              </div>

              <div className="form-group">
                <label className="label">About Me</label>
                <textarea
                  className="input"
                  rows={4}
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  placeholder="Describe your skills and experience..."
                />
              </div>
            </div>
          </>
        )}

        <div className="form-row" style={{ marginTop: 32 }}>
          <button
            className="btn btn-outline"
            onClick={signOut}
            style={{
              color: "var(--crimson-700)",
              borderColor: "var(--crimson-700)",
            }}
          >
            Log Out
          </button>
          <button
            className="btn btn-crimson"
            onClick={handleSave}
            disabled={saving}
            style={{ minWidth: 120 }}
          >
            {saving ? (
              <span
                className="spinner"
                style={{ width: 18, height: 18, borderWidth: 2 }}
              />
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
