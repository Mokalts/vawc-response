import React, { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "../components/Sidebar";
import api from "../api/api";


// ─── SVG Icons ────────────────────────────────────────────────────────────────
const IconUserSolid = ({ size = 22, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.8"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);
const IconWarning = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="12" y1="9" x2="12" y2="13" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="12" y1="17" x2="12.01" y2="17" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const initials  = (a) => [a.first_name, a.last_name].filter(Boolean).map(n => n[0]).join("").toUpperCase() || "?";
const daysLeft  = (d)  => { if (!d) return 0; return Math.max(0, 30 - Math.floor((Date.now() - new Date(d).getTime()) / 86400000)); };
const fmtDate   = (iso) => { if (!iso) return "-"; return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }); };

// ─── Password helpers ─────────────────────────────────────────────────────────
const validatePassword = (pw) => {
  if (!pw || pw.length < 8)                                  return "At least 8 characters.";
  if (!/[A-Z]/.test(pw))                                    return "One uppercase letter required.";
  if (!/[0-9]/.test(pw))                                    return "One number required.";
  if (!/[!@#$%^&*(),.?":{}|<>_-]/.test(pw))                return "One special character required.";
  return null;
};
const getStrength = (pw) => {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[!@#$%^&*(),.?":{}|<>_-]/.test(pw)) s++;
  return s;
};
const STRENGTH_COLORS = ["", "#9B4DAB", "#F0A500", "#1FA87A", "#0A5A42"];
const STRENGTH_LABELS = ["", "Weak", "Fair", "Good", "Strong"];

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
  @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  .adm-row { transition: background 0.12s ease; }
  .adm-row:hover td { background: #F8FAFC !important; }
  .adm-row td { transition: background 0.12s ease; }
  .adm-action { transition: all 0.15s ease !important; }
  .adm-action:hover { border-color: #9B4DAB !important; color: #7B2D8B !important; background: #F3E5F5 !important; transform: translateY(-1px); }
  .adm-action.danger:hover { border-color: #EF4444 !important; color: #991B1B !important; background: #FEF2F2 !important; }
  .adm-action.success:hover { border-color: #10B981 !important; color: #065F46 !important; background: #ECFDF5 !important; }
  .adm-primary-btn { transition: all 0.15s ease !important; }
  .adm-primary-btn:hover { background: #7B2D8B !important; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(123,45,139,0.3) !important; }
  .adm-accordion-chevron { transition: transform 0.2s ease; }
  @media (max-width: 1024px) {
    .adm-table-wrap { overflow-x: auto; }
    .adm-actions-cell { min-width: 180px; }
  }
  @media (max-width: 768px) {
    .adm-header { flex-direction: column !important; align-items: flex-start !important; }
    .adm-table-wrap table { min-width: 640px; }
  }
`;

// ─── Input Field ──────────────────────────────────────────────────────────────
const Field = ({ label, name, type = "text", half, required = true, value, onChange }) => (
  <div style={{ gridColumn: half ? "span 1" : "span 2" }}>
    <label style={S.fieldLabel}>{label}{required ? " *" : " (optional)"}</label>
    <input
      type={type} name={name} value={value} onChange={onChange}
      style={S.fieldInput}
      onFocus={e => { e.target.style.borderColor = "#9B4DAB"; e.target.style.background = "#fff"; }}
      onBlur={e  => { e.target.style.borderColor = "#E2E8F0"; e.target.style.background = "#F8FAFC"; }}
    />
  </div>
);

// ─── Confirm Modal ────────────────────────────────────────────────────────────
const ConfirmModal = ({ title, message, confirmLabel, danger, onConfirm, onClose, loading }) => (
  <div style={S.modalBackdrop} onClick={onClose}>
    <div style={S.confirmModal} onClick={e => e.stopPropagation()}>
      <h3 style={S.modalTitle}>{title}</h3>
      <p style={S.modalMsg}>{message}</p>
      <div style={S.modalFooter}>
        <button onClick={onClose} style={S.cancelBtn}>Cancel</button>
        <button
          onClick={onConfirm} disabled={loading}
          style={{ ...S.confirmBtn, background: danger ? "#EF4444" : "#9B4DAB", opacity: loading ? 0.7 : 1 }}
        >
          {loading && <span style={S.spinner} />}
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

// ─── Create Admin Modal ───────────────────────────────────────────────────────
const CreateAdminModal = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({ first_name: "", middle_name: "", last_name: "", username: "", password: "", email: "", phone_number: "" });
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [pwError,  setPwError]  = useState(null);
  const [showPass, setShowPass] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    setError(null);
    if (name === "password") setPwError(validatePassword(value));
  };

  const handleSubmit = async () => {
    for (const f of ["first_name", "last_name", "username", "password", "email", "phone_number"]) {
      if (!form[f]?.trim()) { setError(`${f.replace(/_/g, " ")} is required.`); return; }
    }
    const pwErr = validatePassword(form.password);
    if (pwErr) { setPwError(pwErr); setError(pwErr); return; }
    setLoading(true); setError(null);
    try {
      const res = await api.post("/admin/auth/create-account", { ...form, position: "Admin" });
      onCreated(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create account.");
    } finally { setLoading(false); }
  };

  const strength = getStrength(form.password);

  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={{ ...S.createModal }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={S.createModalHeader}>
          <div>
            <h3 style={S.modalTitle}>Create Admin Account</h3>
            <p style={S.modalSub}>New admin will enroll their face on first login</p>
          </div>
          <button onClick={onClose} style={S.closeBtn}>
            <svg width="16" height="16" fill="none" viewBox="0 0 20 20"><path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* Form grid */}
        <div style={S.formGrid}>
          <Field label="First Name"   name="first_name"   half value={form.first_name}   onChange={handleChange} />
          <Field label="Last Name"    name="last_name"    half value={form.last_name}    onChange={handleChange} />
          <Field label="Middle Name"  name="middle_name"       required={false} value={form.middle_name} onChange={handleChange} />
          <Field label="Username"     name="username"     half value={form.username}     onChange={handleChange} />
          <Field label="Email"        name="email"        type="email" value={form.email} onChange={handleChange} />
          <Field label="Phone Number" name="phone_number" half value={form.phone_number} onChange={handleChange} />

          {/* Password */}
          <div style={{ gridColumn: "span 2" }}>
            <label style={S.fieldLabel}>Password *</label>
            <div style={S.pwWrap}>
              <input
                type={showPass ? "text" : "password"} name="password" value={form.password} onChange={handleChange}
                style={{ ...S.fieldInput, border: "none", flex: 1, marginBottom: 0 }}
                onFocus={e => e.target.style.outline = "none"}
              />
              <button type="button" onClick={() => setShowPass(v => !v)} style={S.eyeBtn}>
                {showPass
                  ? <svg width="16" height="16" fill="none" viewBox="0 0 20 20"><path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" stroke="currentColor" strokeWidth={1.6} /><circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth={1.6} /><path d="M3 3l14 14" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" /></svg>
                  : <svg width="16" height="16" fill="none" viewBox="0 0 20 20"><path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" stroke="currentColor" strokeWidth={1.6} /><circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth={1.6} /></svg>
                }
              </button>
            </div>

            {form.password.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", gap: 4, marginBottom: 5 }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{ flex: 1, height: 3, borderRadius: 4, backgroundColor: i <= strength ? STRENGTH_COLORS[strength] : "#E2E8F0", transition: "background-color 0.2s" }} />
                  ))}
                </div>
                <p style={{ fontSize: 11, color: STRENGTH_COLORS[strength], margin: "0 0 6px", fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>{STRENGTH_LABELS[strength]}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {[
                    { test: form.password.length >= 8,                         label: "At least 8 characters" },
                    { test: /[A-Z]/.test(form.password),                       label: "One uppercase letter" },
                    { test: /[0-9]/.test(form.password),                       label: "One number" },
                    { test: /[!@#$%^&*(),.?":{}|<>_-]/.test(form.password),   label: "One special character" },
                  ].map(({ test, label }) => (
                    <p key={label} style={{ fontSize: 11, margin: 0, color: test ? "#059669" : "#94A3B8", display: "flex", alignItems: "center", gap: 5, fontFamily: "'DM Sans', sans-serif" }}>
                      <span>{test ? "✓" : "○"}</span> {label}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Position locked */}
          <div style={{ gridColumn: "span 2" }}>
            <label style={S.fieldLabel}>Position</label>
            <div style={{ padding: "10px 12px", borderRadius: 4, border: "1.5px solid #E2E8F0", background: "#F1F5F9", fontSize: 13.5, color: "#64748B", fontFamily: "'DM Sans', sans-serif" }}>Admin</div>
          </div>

          {error && (
            <div style={{ gridColumn: "span 2", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 4, padding: "10px 14px", fontSize: 12.5, color: "#991B1B", fontFamily: "'DM Sans', sans-serif" }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={S.createModalFooter}>
          <button onClick={onClose} style={S.cancelBtn}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="adm-primary-btn"
            style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "#9B4DAB", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center", gap: 7, fontFamily: "'DM Sans', sans-serif" }}>
            {loading && <span style={S.spinner} />}
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const SkeletonRow = () => (
  <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
    {[44, 160, 110, 90, 80, 80, 130].map((w, i) => (
      <td key={i} style={{ padding: "14px 16px" }}>
        {i === 0
          ? <div style={{ width: 38, height: 38, borderRadius: 4, background: "#E2E8F0" }} />
          : <div style={{ height: 12, width: w, borderRadius: 4, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
        }
      </td>
    ))}
  </tr>
);

// ─── Badges ───────────────────────────────────────────────────────────────────
const ActiveBadge = ({ active }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 4, fontSize: 11.5, fontWeight: 600, background: active ? "#ECFDF5" : "#F1F5F9", color: active ? "#065F46" : "#64748B", fontFamily: "'DM Sans', sans-serif" }}>
    <span style={{ width: 8, height: 8, borderRadius: '50%', background: active ? "#10B981" : "#94A3B8" }} />
    {active ? "Active" : "Inactive"}
  </span>
);
const FaceBadge = ({ enrolled }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 4, fontSize: 11.5, fontWeight: 600, background: enrolled ? "#F3E5F5" : "#FFFBEB", color: enrolled ? "#7B2D8B" : "#92400E", fontFamily: "'DM Sans', sans-serif" }}>
    <span style={{ width: 8, height: 8, borderRadius: '50%', background: enrolled ? "#9B4DAB" : "#F59E0B" }} />
    {enrolled ? "Enrolled" : "Not Enrolled"}
  </span>
);

// ─── Action Button ────────────────────────────────────────────────────────────
const ActionBtn = ({ label, variant = "default", onClick }) => (
  <button
    className={`adm-action${variant === "danger" ? " danger" : variant === "success" ? " success" : ""}`}
    onClick={onClick}
    style={{
      padding: "5px 12px", borderRadius: 4, border: "1.5px solid #E2E8F0",
      background: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer",
      whiteSpace: "nowrap", color: "#374151", fontFamily: "'DM Sans', sans-serif",
    }}
  >
    {label}
  </button>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AdminManagement() {
  const [admins,        setAdmins]        = useState([]);
  const [deletedAdmins, setDeletedAdmins] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [showCreate,    setShowCreate]    = useState(false);
  const [showDeleted,   setShowDeleted]   = useState(false);
  const [toast,         setToast]         = useState(null);
  const [confirm,       setConfirm]       = useState(null);
  const [search,        setSearch]        = useState("");

  // ── Victim management (super admin only) ───────────────────────────
  const [tab,             setTab]             = useState("admins"); // 'admins' | 'victims' | 'unverified' | 'deleted-victims'
  const [victims,         setVictims]         = useState([]);
  const [unverifiedUsers, setUnverifiedUsers] = useState([]);
  const [deletedVictims,  setDeletedVictims]  = useState([]);
  const [victimsLoading,  setVictimsLoading]  = useState(false);
  const [editingVictim,   setEditingVictim]   = useState(null);  // {id, ...} when modal open
  const [resettingPw,     setResettingPw]     = useState(null);  // {id, first_name, last_name} when modal open
  const [resettingAdminPw, setResettingAdminPw] = useState(null); // admin whose password is being reset

  const fetchVictimData = useCallback(async () => {
    setVictimsLoading(true);
    try {
      const [vRes, uRes, dRes] = await Promise.all([
        api.get("/admin/users"),
        api.get("/admin/users/unverified"),
        api.get("/admin/users/deleted"),
      ]);
      setVictims(vRes.data); setUnverifiedUsers(uRes.data); setDeletedVictims(dRes.data);
    } catch (err) {
      // Silent fail - non-super-admins get 403, just hide the tabs
    } finally {
      setVictimsLoading(false);
    }
  }, []);

  useEffect(() => { fetchVictimData(); }, [fetchVictimData]);

  // Helper: filter by current search across name/email/phone
  const filterByVictimSearch = (list) => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(u => {
      const hay = [u.first_name, u.middle_name, u.last_name, u.email, u.phone_number, u.address]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  };

  const visibleVictims         = filterByVictimSearch(victims);
  const visibleUnverified      = filterByVictimSearch(unverifiedUsers);
  const visibleDeletedVictims  = filterByVictimSearch(deletedVictims);

  // ── Victim actions ──────────────────────────────────────────────────
  const handleArchiveVictim = async (u) => {
    if (!window.confirm(`Archive ${u.first_name} ${u.last_name}'s account? It can be recovered within 30 days.`)) return;
    try {
      await api.patch(`/admin/users/${u.id}/archive`);
      setVictims(p => p.filter(x => x.id !== u.id));
      setUnverifiedUsers(p => p.filter(x => x.id !== u.id));
      setDeletedVictims(p => [{ ...u, is_deleted: true, deleted_at: new Date().toISOString() }, ...p]);
      showToast(`${u.first_name}'s account archived.`);
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to archive.", false);
    }
  };

  const handleRecoverVictim = async (u) => {
    try {
      await api.patch(`/admin/users/${u.id}/recover`);
      setDeletedVictims(p => p.filter(x => x.id !== u.id));
      const restored = { ...u, is_deleted: false, deleted_at: null };
      if (u.is_verified) setVictims(p => [restored, ...p]);
      else setUnverifiedUsers(p => [restored, ...p]);
      showToast(`${u.first_name}'s account recovered.`);
    } catch (err) {
      showToast(err.response?.data?.detail || "Recovery failed.", false);
    }
  };

  // TEMPORARY: permanently delete an archived victim account (Super Admin).
  const handleForceDeleteVictim = async (u) => {
    if (!window.confirm(`Permanently delete ${u.first_name} ${u.last_name}'s account and ALL their data (cases, reports)?\n\nThis CANNOT be undone.`)) return;
    try {
      await api.delete(`/admin/users/${u.id}/force`);
      setDeletedVictims(p => p.filter(x => x.id !== u.id));
      showToast(`${u.first_name}'s account permanently deleted.`);
    } catch (err) {
      showToast(err.response?.data?.detail || "Force delete failed.", false);
    }
  };

  const handleCleanupUnverified = async () => {
    if (!window.confirm("Permanently delete ALL unverified accounts older than 90 days? This cannot be undone.")) return;
    try {
      const res = await api.delete("/admin/users/cleanup-unverified");
      showToast(res.data.message || "Cleanup complete.");
      fetchVictimData();
    } catch (err) {
      showToast(err.response?.data?.detail || "Cleanup failed.", false);
    }
  };

  // Filter active admins by search query (name / email / username / employee_id)
  const visibleAdmins = (() => {
    const q = search.trim().toLowerCase();
    if (!q) return admins;
    return admins.filter(a => {
      const haystack = [
        a.first_name, a.middle_name, a.last_name,
        a.email, a.username, a.employee_id, a.position,
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  })();

  const showToast = (msg, success = true) => { setToast({ msg, success }); setTimeout(() => setToast(null), 3500); };

  const fetchAdmins = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [ar, dr] = await Promise.all([api.get("/admin/auth/admins"), api.get("/admin/auth/admins/deleted")]);
      setAdmins(ar.data); setDeletedAdmins(dr.data);
    } catch (err) { setError(err.response?.data?.detail || "Failed to load admins."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  const confirmMap = {
    deactivate: { title: "Deactivate Account", msg: (a) => `${a.first_name} ${a.last_name} will no longer be able to log in.`,                                              label: "Deactivate", danger: false },
    reactivate: { title: "Reactivate Account", msg: (a) => `${a.first_name} ${a.last_name} will be able to log in again.`,                                                  label: "Reactivate", danger: false },
    reset:      { title: "Reset Face Data",    msg: (a) => `This clears ${a.first_name}'s face enrollment. They must re-enroll on next login.`,                              label: "Reset Face", danger: false },
    delete:     { title: "Delete Account",     msg: (a) => `${a.first_name} ${a.last_name}'s account will be soft-deleted. Recoverable within 30 days.`,                    label: "Delete",     danger: true  },
    recover:    { title: "Recover Account",    msg: (a) => `Restore ${a.first_name} ${a.last_name}'s account? They can log in again after this.`,                            label: "Recover",    danger: false },
  };

  const executeConfirm = async () => {
    if (!confirm) return;
    setConfirm(c => ({ ...c, loading: true }));
    const { type, admin } = confirm;
    try {
      if (type === "deactivate") {
        await api.patch(`/admin/auth/admins/${admin.id}/deactivate`);
        setAdmins(p => p.map(a => a.id === admin.id ? { ...a, is_active: false } : a));
        showToast(`${admin.first_name}'s account deactivated.`);
      } else if (type === "reactivate") {
        await api.patch(`/admin/auth/admins/${admin.id}/reactivate`);
        setAdmins(p => p.map(a => a.id === admin.id ? { ...a, is_active: true } : a));
        showToast(`${admin.first_name}'s account reactivated.`);
      } else if (type === "reset") {
        await api.patch(`/admin/auth/admins/${admin.id}/reset-face`);
        setAdmins(p => p.map(a => a.id === admin.id ? { ...a, is_face_enrolled: false } : a));
        showToast(`Face data reset for ${admin.first_name}.`);
      } else if (type === "delete") {
        await api.delete(`/admin/auth/admins/${admin.id}`);
        const deleted = admins.find(a => a.id === admin.id);
        setAdmins(p => p.filter(a => a.id !== admin.id));
        if (deleted) setDeletedAdmins(p => [{ ...deleted, is_deleted: true, deleted_at: new Date().toISOString() }, ...p]);
        showToast(`${admin.first_name}'s account deleted. Recoverable for 30 days.`);
      } else if (type === "recover") {
        await api.patch(`/admin/auth/admins/${admin.id}/recover`);
        const recovered = deletedAdmins.find(a => a.id === admin.id);
        setDeletedAdmins(p => p.filter(a => a.id !== admin.id));
        if (recovered) setAdmins(p => [{ ...recovered, is_deleted: false, deleted_at: null, is_active: true }, ...p]);
        showToast(`${admin.first_name}'s account recovered.`);
      }
      setConfirm(null);
    } catch (err) {
      setConfirm(c => ({ ...c, loading: false }));
      showToast(err.response?.data?.detail || "Action failed.", false);
    }
  };

  return (
    <AdminLayout title="Admin Management" breadcrumbs={["Admin Management"]}>
      <style>{CSS}</style>

      <div style={S.wrap}>

        {/* Header */}
        <div style={S.header} className="adm-header">
          <div>
            <p style={S.headerSub}>
              {tab === "admins" && (loading ? "Loading…" : search ? `${visibleAdmins.length} of ${admins.length} matching "${search}"` : `${admins.length} admin account${admins.length !== 1 ? "s" : ""}`)}
              {tab === "victims" && (victimsLoading ? "Loading…" : `${visibleVictims.length} verified victim${visibleVictims.length !== 1 ? "s" : ""}`)}
              {tab === "unverified" && (victimsLoading ? "Loading…" : `${visibleUnverified.length} unverified account${visibleUnverified.length !== 1 ? "s" : ""}`)}
              {tab === "deleted-victims" && (victimsLoading ? "Loading…" : `${visibleDeletedVictims.length} deleted victim${visibleDeletedVictims.length !== 1 ? "s" : ""}`)}
            </p>
          </div>
          {tab === "admins" && (
            <button className="adm-primary-btn" onClick={() => setShowCreate(true)} style={S.newBtn}>
              <svg width="13" height="13" fill="none" viewBox="0 0 20 20"><path d="M10 4v12M4 10h12" stroke="#fff" strokeWidth={2} strokeLinecap="round" /></svg>
              New Admin
            </button>
          )}
          {tab === "unverified" && (
            <button onClick={handleCleanupUnverified}
              style={{ padding: "10px 16px", borderRadius: 8, border: "1.5px solid #FECACA", background: "#FEF2F2", color: "#991B1B", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", display: "inline-flex", alignItems: "center", gap: 7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Purge accounts older than 90 days
            </button>
          )}
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4, marginBottom: 14, borderBottom: "1.5px solid #E2E8F0", flexWrap: "wrap" }}>
          {[
            { key: "admins",          label: "Admins",            count: admins.length },
            { key: "victims",         label: "Victims",            count: victims.length },
            { key: "unverified",      label: "Unverified",         count: unverifiedUsers.length },
            { key: "deleted-victims", label: "Deleted Victims",    count: deletedVictims.length },
          ].map(t => {
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => { setTab(t.key); setSearch(""); }}
                style={{
                  padding: "10px 16px",
                  marginBottom: -1.5,
                  borderRadius: "8px 8px 0 0",
                  border: "none",
                  borderBottom: active ? "2.5px solid #7B2D8B" : "2.5px solid transparent",
                  background: "transparent",
                  color: active ? "#7B2D8B" : "#64748B",
                  fontSize: 13.5, fontWeight: active ? 700 : 600,
                  cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}>
                {t.label}
                {t.count > 0 && (
                  <span style={{ minWidth: 18, padding: "0 6px", height: 18, borderRadius: 9, background: active ? "#7B2D8B" : "#E2E8F0", color: active ? "#fff" : "#475569", fontSize: 10.5, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    {t.count > 99 ? "99+" : t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search + toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
              <circle cx="9" cy="9" r="6" stroke="#94A3B8" strokeWidth="1.8" />
              <path d="M13.5 13.5L17 17" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder={tab === "admins" ? "Search by name, email, username, or employee ID" : "Search by name, email, phone, or address"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", fontSize: 13.5, color: "#0F172A", fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" }}
              onFocus={(e) => e.target.style.borderColor = "#7B2D8B"}
              onBlur={(e) => e.target.style.borderColor = "#E2E8F0"}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 22, height: 22, borderRadius: "50%", border: "none", background: "#E2E8F0", color: "#475569", cursor: "pointer", fontSize: 14, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif" }}>×</button>
            )}
          </div>
          {tab === "admins" && <button
            onClick={() => setShowDeleted(v => !v)}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: showDeleted ? "1.5px solid #C45E10" : "1.5px solid #E2E8F0",
              background: showDeleted ? "#FFF3E0" : "#fff",
              color: showDeleted ? "#C45E10" : "#475569",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              fontFamily: "'DM Sans',sans-serif",
              display: "inline-flex", alignItems: "center", gap: 7,
              transition: "all 0.15s ease",
              whiteSpace: "nowrap",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Recently Deleted
            {deletedAdmins.length > 0 && (
              <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: showDeleted ? "#C45E10" : "#94A3B8", color: "#fff", fontSize: 10.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                {deletedAdmins.length}
              </span>
            )}
          </button>}
        </div>

        {/* Recently Deleted panel - admins tab only */}
        {tab === "admins" && showDeleted && (
          <div style={{ background: "#FFF3E0", border: "1.5px solid #FFCC99", borderRadius: 0, marginBottom: 16, animation: "slideDown 0.2s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid #FFCC99", background: "#FFE4CC" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="#C45E10" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: "#C45E10", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'DM Sans',sans-serif" }}>
                Recently Deleted ({deletedAdmins.length})
              </p>
              <p style={{ margin: "0 0 0 auto", fontSize: 11.5, color: "#9A3412", fontFamily: "'DM Sans',sans-serif" }}>
                Recoverable within 30 days of deletion.
              </p>
            </div>
            <div style={{ padding: deletedAdmins.length === 0 ? "20px 16px" : 0 }}>
              {deletedAdmins.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: "#9A3412", textAlign: "center", fontFamily: "'DM Sans',sans-serif" }}>
                  No deleted admins. Deleted accounts will appear here for 30 days.
                </p>
              ) : (
                deletedAdmins.map((a, i) => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: i === 0 ? "none" : "1px solid #FFE4CC", background: "#fff" }}>
                    <div style={{ ...S.avatar, background: "#E2E8F0", color: "#94A3B8" }}>{initials(a)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: "0 0 2px", fontSize: 13.5, fontWeight: 700, color: "#0F172A", fontFamily: "'DM Sans',sans-serif" }}>
                        {[a.first_name, a.middle_name, a.last_name].filter(Boolean).join(" ")}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: "#64748B", fontFamily: "'DM Sans',sans-serif" }}>
                        {a.email} · {a.employee_id}
                      </p>
                    </div>
                    <div style={{ textAlign: "right", marginRight: 8 }}>
                      <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'DM Sans',sans-serif" }}>Deleted</p>
                      <p style={{ margin: "1px 0 0", fontSize: 12.5, fontWeight: 700, color: daysLeft(a.deleted_at) <= 7 ? "#C62828" : "#C45E10", fontFamily: "'DM Sans',sans-serif" }}>
                        {daysLeft(a.deleted_at)} day{daysLeft(a.deleted_at) === 1 ? "" : "s"} left
                      </p>
                    </div>
                    <button className="adm-action success" onClick={() => setConfirm({ type: "recover", admin: a, loading: false })}
                      style={{ padding: "7px 14px", borderRadius: 8, border: "1.5px solid #A7F3D0", background: "#ECFDF5", color: "#065F46", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", whiteSpace: "nowrap" }}>
                      Recover
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={S.errorBanner}>
            <IconWarning size={16} color="#991B1B" />
            <span style={S.errorText}>{error}</span>
            <button onClick={fetchAdmins} style={S.retryBtn}>Retry</button>
          </div>
        )}

        {/* Active Admins Table - only on Admins tab */}
        {tab === "admins" && (
        <div style={S.tableCard}>
          <div className="adm-table-wrap" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
              <thead>
                <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  {["", "Name & Email", "Username", "Employee ID", "Status", "Face 2FA", "Actions"].map((h, i) => (
                    <th key={i} style={{ ...S.th, textAlign: i === 6 ? "right" : "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                ) : visibleAdmins.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div style={S.emptyState}>
                        <div style={S.emptyIcon}><IconUserSolid size={22} color="#94A3B8" /></div>
                        <p style={S.emptyTitle}>{search ? "No matches" : "No admin accounts yet"}</p>
                        <p style={S.emptySub}>{search ? `No admins match "${search}". Try a different search.` : "Create the first admin account to get started"}</p>
                        {search ? (
                          <button onClick={() => setSearch("")} style={{ ...S.newBtn, marginTop: 16, background: "#475569" }}>Clear Search</button>
                        ) : (
                          <button onClick={() => setShowCreate(true)} style={{ ...S.newBtn, marginTop: 16 }}>Create Admin</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  visibleAdmins.map((a) => (
                    <tr key={a.id} className="adm-row" style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "12px 16px", width: 52 }}>
                        <div style={{ ...S.avatar, background: a.is_active ? "linear-gradient(135deg,#E1BEE7,#7B2D8B)" : "#E2E8F0", color: a.is_active ? "#fff" : "#94A3B8" }}>
                          {initials(a)}
                        </div>
                      </td>
                      <td style={S.td}>
                        <p style={S.adminName}>{[a.first_name, a.middle_name, a.last_name].filter(Boolean).join(" ")}</p>
                        <p style={S.adminEmail}>{a.email}</p>
                      </td>
                      <td style={S.td}>
                        <span style={S.monoTag}>{a.username}</span>
                      </td>
                      <td style={{ ...S.td, color: "#64748B" }}>{a.employee_id}</td>
                      <td style={S.td}><ActiveBadge active={a.is_active} /></td>
                      <td style={S.td}><FaceBadge enrolled={a.is_face_enrolled} /></td>
                      <td style={{ ...S.td, textAlign: "right" }} className="adm-actions-cell">
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          {a.is_active
                            ? <ActionBtn label="Deactivate" onClick={() => setConfirm({ type: "deactivate", admin: a, loading: false })} />
                            : <ActionBtn label="Reactivate" variant="success" onClick={() => setConfirm({ type: "reactivate", admin: a, loading: false })} />
                          }
                          {a.is_face_enrolled && (
                            <ActionBtn label="Reset Face" onClick={() => setConfirm({ type: "reset", admin: a, loading: false })} />
                          )}
                          {!a.is_super_admin && (
                            <ActionBtn label="Reset Password" onClick={() => setResettingAdminPw(a)} />
                          )}
                          <ActionBtn label="Delete" variant="danger" onClick={() => setConfirm({ type: "delete", admin: a, loading: false })} />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {/* ─── VICTIMS tab ────────────────────────────────────────────── */}
        {tab === "victims" && (
          <div style={S.tableCard}>
            <div className="adm-table-wrap" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
                <thead>
                  <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                    {["", "Full Name & Email", "Phone", "Address", "Minor", "Actions"].map((h, i) => (
                      <th key={i} style={{ ...S.th, textAlign: i === 5 ? "right" : "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {victimsLoading ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
                  : visibleVictims.length === 0 ? (
                    <tr><td colSpan={6}>
                      <div style={S.emptyState}>
                        <div style={S.emptyIcon}><IconUserSolid size={22} color="#94A3B8" /></div>
                        <p style={S.emptyTitle}>{search ? "No matches" : "No verified victims yet"}</p>
                        <p style={S.emptySub}>{search ? `No victims match "${search}".` : "Verified accounts will appear here as victims complete signup."}</p>
                      </div>
                    </td></tr>
                  ) : (
                    visibleVictims.map(u => (
                      <tr key={u.id} className="adm-row" style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "12px 16px", width: 52 }}>
                          <div style={{ ...S.avatar, background: "linear-gradient(135deg,#FFE4CC,#F47920)", color: "#fff" }}>
                            {initials(u)}
                          </div>
                        </td>
                        <td style={S.td}>
                          <p style={S.adminName}>{[u.first_name, u.middle_name, u.last_name].filter(Boolean).join(" ")}</p>
                          <p style={S.adminEmail}>{u.email}</p>
                        </td>
                        <td style={{ ...S.td, color: "#475569", fontFamily: "monospace" }}>{u.phone_number || "-"}</td>
                        <td style={{ ...S.td, color: "#64748B", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.address || "-"}</td>
                        <td style={S.td}>{u.is_minor ? <span style={{ fontSize: 11.5, fontWeight: 700, color: "#92400E", background: "#FEF3C7", padding: "3px 9px", borderRadius: 9999 }}>Minor</span> : <span style={{ color: "#CBD5E1" }}>-</span>}</td>
                        <td style={{ ...S.td, textAlign: "right" }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                            <ActionBtn label="Edit"    onClick={() => setEditingVictim(u)} />
                            <ActionBtn label="Reset Password" onClick={() => setResettingPw(u)} />
                            <ActionBtn label="Archive" variant="danger" onClick={() => handleArchiveVictim(u)} />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── UNVERIFIED tab ─────────────────────────────────────────── */}
        {tab === "unverified" && (
          <div style={S.tableCard}>
            <div style={{ padding: "12px 16px", background: "#FFFBEB", borderBottom: "1px solid #FDE68A", display: "flex", alignItems: "center", gap: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#92400E" strokeWidth="1.8" /><path d="M12 8v4M12 16h.01" stroke="#92400E" strokeWidth="2" strokeLinecap="round" /></svg>
              <p style={{ margin: 0, fontSize: 12.5, color: "#7C2D12", fontFamily: "'DM Sans',sans-serif" }}>
                These accounts never completed email/OTP verification - they cannot log in. Archive them to clean up your DB, or use the purge button to bulk-delete ones older than 90 days.
              </p>
            </div>
            <div className="adm-table-wrap" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                <thead>
                  <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                    {["", "Name & Email", "Phone", "Signed Up", "Actions"].map((h, i) => (
                      <th key={i} style={{ ...S.th, textAlign: i === 4 ? "right" : "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {victimsLoading ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
                  : visibleUnverified.length === 0 ? (
                    <tr><td colSpan={5}>
                      <div style={S.emptyState}>
                        <div style={S.emptyIcon}><IconUserSolid size={22} color="#94A3B8" /></div>
                        <p style={S.emptyTitle}>{search ? "No matches" : "No unverified accounts"}</p>
                        <p style={S.emptySub}>{search ? `No unverified accounts match "${search}".` : "All signed-up accounts have completed verification. ✨"}</p>
                      </div>
                    </td></tr>
                  ) : (
                    visibleUnverified.map(u => {
                      const ageDays = u.created_at ? Math.floor((Date.now() - new Date(u.created_at).getTime()) / 86400000) : 0;
                      return (
                        <tr key={u.id} className="adm-row" style={{ borderBottom: "1px solid #F1F5F9" }}>
                          <td style={{ padding: "12px 16px", width: 52 }}>
                            <div style={{ ...S.avatar, background: "#E2E8F0", color: "#94A3B8" }}>{initials(u)}</div>
                          </td>
                          <td style={S.td}>
                            <p style={S.adminName}>{[u.first_name, u.middle_name, u.last_name].filter(Boolean).join(" ")}</p>
                            <p style={S.adminEmail}>{u.email}</p>
                          </td>
                          <td style={{ ...S.td, color: "#475569", fontFamily: "monospace" }}>{u.phone_number || "-"}</td>
                          <td style={S.td}>
                            <p style={{ margin: 0, fontSize: 13, color: "#0F172A" }}>{fmtDate(u.created_at)}</p>
                            <p style={{ margin: 0, fontSize: 11.5, color: ageDays >= 90 ? "#C62828" : "#94A3B8" }}>
                              {ageDays} day{ageDays === 1 ? "" : "s"} ago{ageDays >= 90 ? " - eligible for purge" : ""}
                            </p>
                          </td>
                          <td style={{ ...S.td, textAlign: "right" }}>
                            <ActionBtn label="Archive" variant="danger" onClick={() => handleArchiveVictim(u)} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── DELETED VICTIMS tab ────────────────────────────────────── */}
        {tab === "deleted-victims" && (
          <div style={S.tableCard}>
            <div style={{ padding: "12px 16px", background: "#FFF3E0", borderBottom: "1px solid #FFCC99", display: "flex", alignItems: "center", gap: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="#C45E10" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <p style={{ margin: 0, fontSize: 12.5, color: "#7C2D12", fontFamily: "'DM Sans',sans-serif" }}>
                Archived victim accounts. Recoverable within 30 days of deletion.
              </p>
            </div>
            <div className="adm-table-wrap" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                <thead>
                  <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                    {["", "Name & Email", "Phone", "Deleted", "Days Left", "Actions"].map((h, i) => (
                      <th key={i} style={{ ...S.th, textAlign: i === 5 ? "right" : "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {victimsLoading ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
                  : visibleDeletedVictims.length === 0 ? (
                    <tr><td colSpan={6}>
                      <div style={S.emptyState}>
                        <div style={S.emptyIcon}><IconUserSolid size={22} color="#94A3B8" /></div>
                        <p style={S.emptyTitle}>{search ? "No matches" : "No recently deleted victims"}</p>
                        <p style={S.emptySub}>{search ? `No deleted victims match "${search}".` : "Archived accounts will appear here for 30 days."}</p>
                      </div>
                    </td></tr>
                  ) : (
                    visibleDeletedVictims.map(u => {
                      const daysLft = daysLeft(u.deleted_at);
                      return (
                        <tr key={u.id} className="adm-row" style={{ borderBottom: "1px solid #F1F5F9" }}>
                          <td style={{ padding: "12px 16px", width: 52 }}>
                            <div style={{ ...S.avatar, background: "#E2E8F0", color: "#94A3B8" }}>{initials(u)}</div>
                          </td>
                          <td style={S.td}>
                            <p style={S.adminName}>{[u.first_name, u.middle_name, u.last_name].filter(Boolean).join(" ")}</p>
                            <p style={S.adminEmail}>{u.email}</p>
                          </td>
                          <td style={{ ...S.td, color: "#475569", fontFamily: "monospace" }}>{u.phone_number || "-"}</td>
                          <td style={{ ...S.td, color: "#475569" }}>{fmtDate(u.deleted_at)}</td>
                          <td style={S.td}>
                            <span style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 9999, fontSize: 11.5, fontWeight: 700, color: daysLft <= 7 ? "#C62828" : "#C45E10", background: daysLft <= 7 ? "#FEF2F2" : "#FFF3E0", border: `1.5px solid ${daysLft <= 7 ? "#FECACA" : "#FFCC99"}` }}>
                              {daysLft} day{daysLft === 1 ? "" : "s"} left
                            </span>
                          </td>
                          <td style={{ ...S.td, textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                              <ActionBtn label="Recover" variant="success" onClick={() => handleRecoverVictim(u)} />
                              <ActionBtn label="Force Delete" variant="danger" onClick={() => handleForceDeleteVictim(u)} />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recently Deleted */}
        {deletedAdmins.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <button
              onClick={() => setShowDeleted(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: "8px 0", marginBottom: 10 }}
            >
              <svg
                width="14" height="14" fill="none" viewBox="0 0 20 20"
                className="adm-accordion-chevron"
                style={{ transform: showDeleted ? "rotate(90deg)" : "rotate(0deg)" }}
              >
                <path d="M7.5 5l5 5-5 5" stroke="#94A3B8" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "#64748B", fontFamily: "'DM Sans', sans-serif" }}>
                Recently Deleted ({deletedAdmins.length})
              </span>
              <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'DM Sans', sans-serif" }}>
                - recoverable within 30 days
              </span>
            </button>

            {showDeleted && (
              <div style={{ ...S.tableCard, borderColor: "#FECACA", animation: "fadeUp 0.2s ease" }}>
                <div className="adm-table-wrap" style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 580 }}>
                    <thead>
                      <tr style={{ backgroundColor: "#FFF5F5", borderBottom: "1px solid #FECACA" }}>
                        {["", "Name", "Username", "Deleted On", "Days Left", ""].map((h, i) => (
                          <th key={i} style={{ ...S.th, textAlign: i === 5 ? "right" : "left", color: "#94A3B8" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {deletedAdmins.map((a) => {
                        const days = daysLeft(a.deleted_at);
                        return (
                          <tr key={a.id} style={{ borderBottom: "1px solid #FEF2F2" }}>
                            <td style={{ padding: "12px 16px", width: 52 }}>
                              <div style={{ ...S.avatar, background: "#E2E8F0", color: "#94A3B8" }}>{initials(a)}</div>
                            </td>
                            <td style={S.td}>
                              <p style={{ ...S.adminName, color: "#64748B" }}>{[a.first_name, a.middle_name, a.last_name].filter(Boolean).join(" ")}</p>
                              <p style={S.adminEmail}>{a.email}</p>
                            </td>
                            <td style={S.td}><span style={{ ...S.monoTag, color: "#94A3B8" }}>{a.username}</span></td>
                            <td style={{ ...S.td, color: "#94A3B8" }}>{fmtDate(a.deleted_at)}</td>
                            <td style={S.td}>
                              <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: days <= 5 ? "#FEF2F2" : "#FFFBEB", color: days <= 5 ? "#991B1B" : "#92400E", fontFamily: "'DM Sans', sans-serif" }}>
                                {days} day{days !== 1 ? "s" : ""} left
                              </span>
                            </td>
                            <td style={{ ...S.td, textAlign: "right" }}>
                              <ActionBtn label="Recover" variant="success" onClick={() => setConfirm({ type: "recover", admin: a, loading: false })} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ ...S.toast, borderColor: toast.success ? "#A7F3D0" : "#FECACA", color: toast.success ? "#065F46" : "#991B1B", animation: "slideDown 0.2s ease" }}>
          <span style={{ width: 20, height: 20, borderRadius: 4, background: toast.success ? "#D1FAE5" : "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {toast.success
              ? <svg width="10" height="10" fill="none" viewBox="0 0 20 20"><path d="M5 10l4 4 6-8" stroke="#10B981" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg>
              : <svg width="10" height="10" fill="none" viewBox="0 0 20 20"><path d="M15 5L5 15M5 5l10 10" stroke="#EF4444" strokeWidth={2} strokeLinecap="round" /></svg>
            }
          </span>
          {toast.msg}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateAdminModal
          onClose={() => setShowCreate(false)}
          onCreated={(newAdmin) => { setAdmins(p => [newAdmin, ...p]); setShowCreate(false); showToast(`Account created for ${newAdmin.first_name} ${newAdmin.last_name}.`); }}
        />
      )}
      {confirm && (
        <ConfirmModal
          title={confirmMap[confirm.type].title}
          message={confirmMap[confirm.type].msg(confirm.admin)}
          confirmLabel={confirmMap[confirm.type].label}
          danger={confirmMap[confirm.type].danger}
          loading={confirm.loading}
          onConfirm={executeConfirm}
          onClose={() => setConfirm(null)}
        />
      )}

      {editingVictim && (
        <EditVictimModal
          victim={editingVictim}
          onClose={() => setEditingVictim(null)}
          onSaved={(updated) => {
            setVictims(p => p.map(v => v.id === updated.id ? updated : v));
            setEditingVictim(null);
            showToast(`${updated.first_name}'s profile updated.`);
          }}
          onError={(msg) => showToast(msg, false)}
        />
      )}

      {resettingPw && (
        <ResetVictimPasswordModal
          victim={resettingPw}
          onClose={() => setResettingPw(null)}
          onDone={(msg) => { setResettingPw(null); showToast(msg); }}
          onError={(msg) => showToast(msg, false)}
        />
      )}

      {resettingAdminPw && (
        <ResetAdminPasswordModal
          admin={resettingAdminPw}
          onClose={() => setResettingAdminPw(null)}
          onDone={(msg) => { setResettingAdminPw(null); showToast(msg); }}
          onError={(msg) => showToast(msg, false)}
        />
      )}
    </AdminLayout>
  );
}

// ─── Edit Victim Modal ────────────────────────────────────────────────────────
function EditVictimModal({ victim, onClose, onSaved, onError }) {
  const [form, setForm] = useState({
    first_name:            victim.first_name || "",
    middle_name:           victim.middle_name || "",
    last_name:             victim.last_name || "",
    email:                 victim.email || "",
    phone_number:          victim.phone_number || "",
    address:               victim.address || "",
    sex:                   victim.sex || "",
    is_minor:              !!victim.is_minor,
    guardian_name:         victim.guardian_name || "",
    guardian_relationship: victim.guardian_relationship || "",
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm(p => ({ ...p, [k]: v }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.patch(`/admin/users/${victim.id}`, form);
      onSaved(res.data);
    } catch (err) {
      onError(err.response?.data?.detail || "Failed to save profile.");
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <form onSubmit={handleSubmit} style={{ background: "#fff", borderRadius: 12, maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto", padding: 24, fontFamily: "'DM Sans',sans-serif", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: "#0F172A" }}>Edit Victim Profile</h2>
        <p style={{ margin: "0 0 18px", fontSize: 12.5, color: "#64748B" }}>You're editing this account on behalf of <strong>{victim.first_name} {victim.last_name}</strong>. Changes save immediately.</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <FormField label="First Name *"><input required value={form.first_name} onChange={handleChange("first_name")} style={S2.input} /></FormField>
          <FormField label="Middle Name"><input value={form.middle_name} onChange={handleChange("middle_name")} style={S2.input} /></FormField>
          <FormField label="Last Name *"><input required value={form.last_name} onChange={handleChange("last_name")} style={S2.input} /></FormField>
          <FormField label="Sex">
            <select value={form.sex} onChange={handleChange("sex")} style={S2.input}>
              <option value="">-</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>
          </FormField>
          <FormField label="Email *"><input type="email" required value={form.email} onChange={handleChange("email")} style={S2.input} /></FormField>
          <FormField label="Phone *"><input required value={form.phone_number} onChange={handleChange("phone_number")} style={S2.input} /></FormField>
          <div style={{ gridColumn: "span 2" }}>
            <FormField label="Address"><input value={form.address} onChange={handleChange("address")} style={S2.input} /></FormField>
          </div>
          <div style={{ gridColumn: "span 2", display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" id="vc-isminor" checked={form.is_minor} onChange={handleChange("is_minor")} />
            <label htmlFor="vc-isminor" style={{ fontSize: 13, color: "#475569", cursor: "pointer" }}>This victim is a minor (under 18)</label>
          </div>
          {form.is_minor && (
            <>
              <FormField label="Guardian Name"><input value={form.guardian_name} onChange={handleChange("guardian_name")} style={S2.input} /></FormField>
              <FormField label="Relationship"><input value={form.guardian_relationship} onChange={handleChange("guardian_relationship")} placeholder="e.g., Mother, Aunt" style={S2.input} /></FormField>
            </>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          <button type="button" onClick={onClose} disabled={saving} style={S2.btnGhost}>Cancel</button>
          <button type="submit" disabled={saving} style={{ ...S2.btnPrimary, opacity: saving ? 0.7 : 1 }}>{saving ? "Saving…" : "Save Profile"}</button>
        </div>
      </form>
    </div>
  );
}

// ─── Reset Victim Password Modal ──────────────────────────────────────────────
function ResetVictimPasswordModal({ victim, onClose, onDone, onError }) {
  const [pw, setPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (pw !== confirmPw) { onError("Passwords do not match."); return; }
    const err = validatePassword(pw);
    if (err) { onError(err); return; }
    setSaving(true);
    try {
      const res = await api.patch(`/admin/users/${victim.id}/reset-password`, { new_password: pw });
      onDone(res.data.message || "Password reset.");
    } catch (e2) {
      onError(e2.response?.data?.detail || "Reset failed.");
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <form onSubmit={handleSubmit} style={{ background: "#fff", borderRadius: 12, maxWidth: 440, width: "100%", padding: 24, fontFamily: "'DM Sans',sans-serif", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: "#0F172A" }}>Reset Victim Password</h2>
        <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "#64748B" }}>
          You're setting a new password for <strong>{victim.first_name} {victim.last_name}</strong>. Share it with them securely (in person or by phone) - they should change it after their next login.
        </p>

        <FormField label="New Password *"><input type="text" required value={pw} onChange={e => setPw(e.target.value)} style={S2.input} placeholder="At least 8 chars, 1 uppercase, 1 number, 1 special" /></FormField>
        <FormField label="Confirm Password *"><input type="text" required value={confirmPw} onChange={e => setConfirmPw(e.target.value)} style={S2.input} /></FormField>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          <button type="button" onClick={onClose} disabled={saving} style={S2.btnGhost}>Cancel</button>
          <button type="submit" disabled={saving} style={{ ...S2.btnPrimary, opacity: saving ? 0.7 : 1 }}>{saving ? "Saving…" : "Reset Password"}</button>
        </div>
      </form>
    </div>
  );
}

// ─── Reset Admin Password Modal ───────────────────────────────────────────────
function ResetAdminPasswordModal({ admin, onClose, onDone, onError }) {
  const [pw, setPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (pw !== confirmPw) { onError("Passwords do not match."); return; }
    const err = validatePassword(pw);
    if (err) { onError(err); return; }
    setSaving(true);
    try {
      const res = await api.patch(`/admin/auth/admins/${admin.id}/reset-password`, { new_password: pw });
      onDone(res.data.message || "Password reset.");
    } catch (e2) {
      onError(e2.response?.data?.detail || "Reset failed.");
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <form onSubmit={handleSubmit} style={{ background: "#fff", borderRadius: 12, maxWidth: 440, width: "100%", padding: 24, fontFamily: "'DM Sans',sans-serif", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: "#0F172A" }}>Reset Admin Password</h2>
        <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "#64748B" }}>
          You're setting a new password for admin <strong>{admin.first_name} {admin.last_name}</strong> ({admin.username}). Share it with them securely - they should change it after their next login.
        </p>

        <FormField label="New Password *"><input type="text" required value={pw} onChange={e => setPw(e.target.value)} style={S2.input} placeholder="At least 8 chars, 1 uppercase, 1 number, 1 special" /></FormField>
        <FormField label="Confirm Password *"><input type="text" required value={confirmPw} onChange={e => setConfirmPw(e.target.value)} style={S2.input} /></FormField>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          <button type="button" onClick={onClose} disabled={saving} style={S2.btnGhost}>Cancel</button>
          <button type="submit" disabled={saving} style={{ ...S2.btnPrimary, opacity: saving ? 0.7 : 1 }}>{saving ? "Saving…" : "Reset Password"}</button>
        </div>
      </form>
    </div>
  );
}

const FormField = ({ label, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
    {children}
  </div>
);

const S2 = {
  input:      { width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 13.5, color: "#0F172A", fontFamily: "'DM Sans',sans-serif", outline: "none", marginBottom: 8 },
  btnGhost:   { padding: "9px 16px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" },
  btnPrimary: { padding: "9px 18px", borderRadius: 8, border: "none", background: "#7B2D8B", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" },
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  wrap:        { maxWidth: "1200px", fontFamily: "'DM Sans', sans-serif" },
  header:      { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" },
  headerSub:   { fontSize: 13, color: "#94A3B8", fontFamily: "'DM Sans', sans-serif" },
  newBtn:      { padding: "9px 18px", borderRadius: 4, border: "none", background: "#9B4DAB", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, boxShadow: "0 2px 8px rgba(123,45,139,0.2)", fontFamily: "'DM Sans', sans-serif" },

  errorBanner: { display: "flex", alignItems: "center", gap: 10, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 4, padding: "12px 16px", marginBottom: 16 },
  errorText:   { flex: 1, fontSize: 13, color: "#991B1B", fontFamily: "'DM Sans', sans-serif" },
  retryBtn:    { padding: "4px 12px", borderRadius: 4, border: "1px solid #FECACA", background: "#fff", color: "#991B1B", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },

  tableCard:   { background: "#fff", borderRadius: 0, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" },
  th:          { padding: "11px 16px", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.6px", whiteSpace: "nowrap", fontFamily: "'DM Sans', sans-serif" },
  td:          { padding: "13px 16px", fontSize: 13.5, fontFamily: "'DM Sans', sans-serif" },

  avatar:      { width: 38, height: 38, borderRadius: '50%', display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 },
  adminName:   { fontSize: 13.5, fontWeight: 600, color: "#0F172A", marginBottom: 2, fontFamily: "'DM Sans', sans-serif" },
  adminEmail:  { fontSize: 11.5, color: "#94A3B8", fontFamily: "'DM Sans', sans-serif" },
  monoTag:     { fontFamily: "monospace", fontSize: 12.5, color: "#475569", background: "#F1F5F9", padding: "2px 8px", borderRadius: 4},

  emptyState:  { textAlign: "center", padding: "56px 24px" },
  emptyIcon:   { width: 52, height: 52, borderRadius: 4, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 22 },
  emptyTitle:  { fontWeight: 600, color: "#0F172A", margin: "0 0 4px", fontFamily: "'DM Sans', sans-serif" },
  emptySub:    { color: "#94A3B8", fontSize: 13, margin: 0, fontFamily: "'DM Sans', sans-serif" },

  toast:       { position: "fixed", top: 20, right: 20, zIndex: 999, background: "#fff", borderRadius: 4, border: "1px solid", padding: "12px 18px", boxShadow: "0 8px 24px rgba(0,0,0,0.10)", display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" },

  // Modal
  modalBackdrop:     { position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  confirmModal:      { background: "#fff", borderRadius: 4, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", padding: 28, fontFamily: "'DM Sans', sans-serif" },
  createModal:       { background: "#fff", borderRadius: 4, width: "100%", maxWidth: 560, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", maxHeight: "90vh", overflowY: "auto", fontFamily: "'DM Sans', sans-serif" },
  createModalHeader: { padding: "20px 24px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between" },
  createModalFooter: { padding: "0 24px 24px", display: "flex", gap: 10, justifyContent: "flex-end" },
  modalTitle:        { margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "#0F172A", fontFamily: "'DM Sans', sans-serif" },
  modalSub:          { margin: 0, fontSize: 12.5, color: "#94A3B8", fontFamily: "'DM Sans', sans-serif" },
  modalMsg:          { margin: "0 0 20px", fontSize: 13.5, color: "#64748B", lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" },
  modalFooter:       { display: "flex", gap: 10, justifyContent: "flex-end" },
  cancelBtn:         { padding: "9px 18px", borderRadius: 4, border: "1.5px solid #E2E8F0", background: "#fff", color: "#374151", fontSize: 13.5, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  confirmBtn:        { padding: "9px 20px", borderRadius: 4, border: "none", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontFamily: "'DM Sans', sans-serif" },
  closeBtn:          { background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 4, display: "flex" },
  spinner:           { width: 13, height: 13, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: '50%', animation: "spin 0.7s linear infinite", display: "inline-block" },

  // Form
  formGrid:    { padding: "20px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  fieldLabel:  { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#94A3B8", marginBottom: 5, fontFamily: "'DM Sans', sans-serif" },
  fieldInput:  { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 4, border: "1.5px solid #E2E8F0", fontSize: 13.5, color: "#0F172A", background: "#F8FAFC", outline: "none", fontFamily: "'DM Sans', sans-serif", marginBottom: 0 },
  pwWrap:      { display: "flex", alignItems: "center", border: "1.5px solid #E2E8F0", borderRadius: 8, background: "#F8FAFC", overflow: "hidden" },
  eyeBtn:      { padding: "0 12px", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", display: "flex", alignItems: "center" },
};
