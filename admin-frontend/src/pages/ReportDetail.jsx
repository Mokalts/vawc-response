import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "../components/Sidebar";
import { confirmDialog } from "../components/ConfirmDialog";
import api from "../api/api";

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
  @keyframes spin      { to{transform:rotate(360deg)} }
  @keyframes shimmer   { 0%{background-position:-200% 0}100%{background-position:200% 0} }
  @keyframes slideDown { from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)} }
  .rd-btn { transition:all 0.15s ease !important; }
  .rd-btn:hover { transform:translateY(-1px); box-shadow:0 4px 12px rgba(0,0,0,0.12); }
  .rd-status-opt { transition:all 0.12s ease !important; }
  .rd-status-opt:hover { border-color:currentColor !important; }
  .rd-map:hover { border-color:#9B4DAB !important; color:#7B2D8B !important; background:#F3E5F5 !important; }
  .rd-map { transition:all 0.15s ease !important; }
  .msg-log-body::-webkit-scrollbar { width:7px; }
  .msg-log-body::-webkit-scrollbar-track { background:#F5F0F7; border-radius:9999px; }
  .msg-log-body::-webkit-scrollbar-thumb { background:#D9C2E0; border-radius:9999px; }
  .msg-log-body::-webkit-scrollbar-thumb:hover { background:#9B4DAB; }
`;

const STATUS_CONFIG = {
  submitted: { label: "Submitted", color: "#BE185D", bg: "#FDF2F8", dot: "#EC4899" },
  awaiting_onsite_visit: { label: "Awaiting Onsite Visit", color: "#D97706", bg: "#FFFBEB", dot: "#F59E0B" },
  under_process: { label: "Under Process", color: "#0E7490", bg: "#ECFEFF", dot: "#06B6D4" },
  summon_issued: { label: "Summon Letter Issued", color: "#C45E10", bg: "#FFF3E0", dot: "#F47920" },
  summon_acknowledged: { label: "Summon Acknowledged", color: "#9B4DAB", bg: "#F3E5F5", dot: "#9B4DAB" },
  resolved: { label: "Resolved", color: "#059669", bg: "#ECFDF5", dot: "#10B981" },
  referred_to_police: { label: "Referred to Authorities", color: "#DC2626", bg: "#FEF2F2", dot: "#EF4444" },
};
const sCfg = (s) => STATUS_CONFIG[s] || { label: s || "Unknown", color: "#64748B", bg: "#F1F5F9", dot: "#CBD5E1" };
const ALL_STATUSES = Object.keys(STATUS_CONFIG).filter(s => s !== 'submitted');

const TIMELINE_STEPS = ["submitted", "awaiting_onsite_visit", "under_process", "summon_issued", "summon_acknowledged"];
const INCIDENT_TYPES = ["Physical Abuse", "Sexual Abuse", "Psychological Abuse", "Economic Abuse", "Other"];

const fmt = (d) => !d ? "-" : new Date(d).toLocaleString("en-PH", { month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtDate = (d) => !d ? "-" : new Date(d).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
const age = (dob) => !dob ? null : Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));

const IcoUser = ({ size = 16, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.8" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth="1.8" strokeLinecap="round" /></svg>);
const IcoClip = ({ size = 16, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoPin = ({ size = 16, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="10" r="3" stroke={color} strokeWidth="1.8" /></svg>);
const IcoWarn = ({ size = 16, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><line x1="12" y1="9" x2="12" y2="13" stroke={color} strokeWidth="1.8" strokeLinecap="round" /><line x1="12" y1="17" x2="12.01" y2="17" stroke={color} strokeWidth="2.5" strokeLinecap="round" /></svg>);
const IcoCheck = ({ size = 16, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoShield = ({ size = 16, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoPrint = ({ size = 16, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><rect x="6" y="14" width="12" height="8" rx="1" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoTrash = ({ size = 16, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoCal = ({ size = 16, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth="1.8" /><path d="M16 2v4M8 2v4M3 10h18" stroke={color} strokeWidth="1.8" strokeLinecap="round" /></svg>);
const IcoGuardian = ({ size = 16, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><circle cx="9" cy="7" r="4" stroke={color} strokeWidth="1.8" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>);

const Spinner = ({ size = 14, color = "#fff" }) => (
  <span style={{ width: size, height: size, border: `2px solid rgba(255,255,255,0.3)`, borderTopColor: color, borderRadius: '50%', animation: "spin 0.7s linear infinite", display: "inline-block", flexShrink: 0 }} />
);

const Card = ({ title, icon, children, style = {}, headerRight }) => (
  <div style={{ background: "#fff", borderRadius: 0, border: "1px solid #E2E8F0", overflow: "hidden", fontFamily: "'DM Sans',sans-serif", boxShadow: "0 1px 3px rgba(15,23,42,0.05)", ...style }}>
    {title && (
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FAFAFA" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 3, height: 16, borderRadius: 4, backgroundColor: "#9B4DAB" }} />
          {icon && <span style={{ display: "flex" }}>{icon}</span>}
          <h3 style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#0F172A", fontFamily: "'DM Sans',sans-serif", textTransform: "uppercase", letterSpacing: "0.5px" }}>{title}</h3>
        </div>
        {headerRight}
      </div>
    )}
    <div style={{ padding: 20 }}>{children}</div>
  </div>
);

const InfoRow = ({ label, value, mono, muted }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
    <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#94A3B8", fontFamily: "'DM Sans',sans-serif" }}>{label}</span>
    <span style={{ fontSize: 13.5, color: muted ? "#94A3B8" : "#0F172A", fontWeight: 500, fontStyle: muted ? "italic" : "normal", fontFamily: mono ? "monospace" : "'DM Sans',sans-serif" }}>{value || "-"}</span>
  </div>
);

const M = {
  backdrop: { position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { background: "#fff", borderRadius: 16, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", padding: 28, fontFamily: "'DM Sans',sans-serif" },
  title: { margin: 0, fontSize: 16, fontWeight: 700, color: "#0F172A", fontFamily: "'DM Sans',sans-serif" },
  sub: { margin: "3px 0 0", fontSize: 12.5, color: "#94A3B8", fontFamily: "'DM Sans',sans-serif" },
  closeBtn: { background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 4, display: "flex" },
  cancelBtn: { padding: "8px 18px", borderRadius: 10, border: "1.5px solid #E2E8F0", background: "#fff", color: "#374151", fontSize: 13.5, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" },
  saveBtn: { padding: "8px 20px", borderRadius: 10, border: "none", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontFamily: "'DM Sans',sans-serif" },
};

const CloseX = ({ onClick }) => (
  <button onClick={onClick} style={M.closeBtn}>
    <svg width="16" height="16" fill="none" viewBox="0 0 20 20"><path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" /></svg>
  </button>
);

const StatusModal = ({ current, onClose, onSave, saving }) => {
  const [selected, setSelected] = useState(current);
  const currentIdx = ALL_STATUSES.indexOf(current);
  return (
    <div style={M.backdrop} onClick={onClose}>
      <div style={{ ...M.modal, maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div><p style={M.title}>Update Case Status</p><p style={M.sub}>Select the new status for this case</p></div>
          <CloseX onClick={onClose} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
          {ALL_STATUSES.map((s, i) => {
            const cfg = sCfg(s), isActive = s === selected, isPast = i < currentIdx && s !== selected;
            return (
              <div key={s} className="rd-status-opt" onClick={() => setSelected(s)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 4, cursor: "pointer", border: `1.5px solid ${isActive ? cfg.dot : "#F1F5F9"}`, background: isActive ? cfg.bg : "#fff", opacity: isPast ? 0.4 : 1 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: isActive ? 600 : 500, color: isActive ? cfg.color : "#374151", fontFamily: "'DM Sans',sans-serif" }}>{cfg.label}</span>
                {isActive && <IcoCheck size={15} color={cfg.dot} />}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={M.cancelBtn}>Cancel</button>
          <button onClick={() => onSave(selected)} disabled={saving || selected === current}
            style={{ ...M.saveBtn, background: selected === current ? "#E2E8F0" : "#9B4DAB", color: selected === current ? "#94A3B8" : "#fff", cursor: selected === current ? "not-allowed" : "pointer" }}>
            {saving ? <><Spinner /><span>Saving…</span></> : "Save Status"}
          </button>
        </div>
      </div>
    </div>
  );
};

const ConfirmModal = ({ title, message, confirmLabel, danger, onConfirm, onClose, loading }) => (
  <div style={M.backdrop} onClick={onClose}>
    <div style={{ ...M.modal, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
      <p style={{ ...M.title, margin: "0 0 8px" }}>{title}</p>
      <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "#64748B", lineHeight: 1.6, fontFamily: "'DM Sans',sans-serif" }}>{message}</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button onClick={onClose} style={M.cancelBtn}>Cancel</button>
        <button onClick={onConfirm} disabled={loading} style={{ ...M.saveBtn, background: danger ? "#EF4444" : "#9B4DAB", opacity: loading ? 0.7 : 1 }}>
          {loading && <Spinner />}{confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

const DELETE_REASONS = [
  { id: "duplicate", label: "Duplicate case" },
  { id: "error", label: "Filed in error" },
  { id: "insufficient", label: "Insufficient information" },
  { id: "jurisdiction", label: "Outside jurisdiction" },
  { id: "other", label: "Other" },
];

const DeleteModal = ({ caseId, onClose, onConfirm, loading }) => {
  const [reason, setReason] = useState("");
  const [otherText, setOtherText] = useState("");
  const [err, setErr] = useState("");
  const submit = () => {
    if (!reason) { setErr("Please select a reason."); return; }
    if (reason === "other" && !otherText.trim()) { setErr("Please describe your reason."); return; }
    const label = reason === "other" ? otherText.trim() : DELETE_REASONS.find(r => r.id === reason)?.label;
    onConfirm(label);
  };
  return (
    <div style={M.backdrop} onClick={!loading ? onClose : undefined}>
      <div style={{ ...M.modal, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div><p style={M.title}>Delete Case</p><p style={M.sub}>Case #{caseId} will be moved to Recently Deleted</p></div>
          <CloseX onClick={onClose} />
        </div>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#374151", fontFamily: "'DM Sans',sans-serif" }}>Why are you deleting this case?</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
          {DELETE_REASONS.map(r => (
            <label key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 4, cursor: "pointer", border: `1.5px solid ${reason === r.id ? "#FECACA" : "#F1F5F9"}`, background: reason === r.id ? "#FEF2F2" : "#fff" }}>
              <input type="radio" name="del-reason" value={r.id} checked={reason === r.id} onChange={() => { setReason(r.id); setErr(""); }} style={{ accentColor: "#EF4444" }} />
              <span style={{ fontSize: 13.5, color: reason === r.id ? "#991B1B" : "#374151", fontWeight: reason === r.id ? 600 : 400, fontFamily: "'DM Sans',sans-serif" }}>{r.label}</span>
            </label>
          ))}
          {reason === "other" && <textarea placeholder="Describe your reason…" value={otherText} onChange={e => setOtherText(e.target.value)} maxLength={300}
            style={{ width: "100%", boxSizing: "border-box", minHeight: 72, resize: "vertical", border: "1.5px solid #E2E8F0", borderRadius: 4, padding: "10px 12px", fontSize: 13.5, fontFamily: "'DM Sans',sans-serif", color: "#0F172A", outline: "none", marginTop: 4 }} />}
          {err && <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#EF4444", fontFamily: "'DM Sans',sans-serif" }}>{err}</p>}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={M.cancelBtn} disabled={loading}>Cancel</button>
          <button onClick={submit} disabled={loading} style={{ ...M.saveBtn, background: "#EF4444", opacity: loading ? 0.7 : 1 }}>
            {loading && <Spinner />} {loading ? "Deleting…" : "Delete Case"}
          </button>
        </div>
      </div>
    </div>
  );
};

const CaseTimeline = ({ cas, onUpdateStatus, onReferToPolice }) => {
  const isReferred = cas.status === "referred_to_police";
  const isResolved = cas.status === "resolved";
  const isDeleted = cas.is_deleted;
  const currentIdx = TIMELINE_STEPS.indexOf(cas.status);
  const canQuickRefer = cas.status === "awaiting_onsite_visit" && !isDeleted;
  return (
    <Card title="Case Timeline" icon={<IcoCheck size={16} color="#9B4DAB" />}>
      <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 4 }}>
        {TIMELINE_STEPS.map((s, i) => {
          const cfg = sCfg(s), isDone = isReferred ? false : i < currentIdx, isCurrent = !isReferred && i === currentIdx;
          return (
            <div key={s} style={{ display: "flex", gap: 12, paddingBottom: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${isCurrent ? cfg.dot : isDone ? cfg.dot : "#E2E8F0"}`, background: isCurrent ? cfg.dot : isDone ? cfg.bg : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {isDone && !isCurrent && <svg width="9" height="9" fill="none" viewBox="0 0 20 20"><path d="M5 10l4 4 6-8" stroke={cfg.dot} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  {isCurrent && <div style={{ width: 7, height: 7, borderRadius: '50%', background: "#fff" }} />}
                </div>
                {i < TIMELINE_STEPS.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 14, background: isDone ? cfg.dot : "#E2E8F0", marginTop: 3 }} />}
              </div>
              <div style={{ paddingTop: 2 }}>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: isCurrent ? 700 : isDone ? 500 : 400, color: isCurrent ? cfg.color : isDone ? "#374151" : "#94A3B8", fontFamily: "'DM Sans',sans-serif" }}>{cfg.label}</p>
                {isCurrent && <span style={{ fontSize: 10.5, color: cfg.dot, fontWeight: 500, fontFamily: "'DM Sans',sans-serif" }}>Current</span>}
              </div>
            </div>
          );
        })}
        {[{ key: "resolved", icon: <IcoCheck size={10} color="#059669" /> }, { key: "referred_to_police", icon: <IcoShield size={10} color="#DC2626" /> }].map(({ key, icon }) => {
          const cfg = sCfg(key), isCurrent = cas.status === key;
          return (
            <div key={key} style={{ display: "flex", gap: 12, paddingBottom: 8 }}>
              <div style={{ flexShrink: 0 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${isCurrent ? cfg.dot : "#E2E8F0"}`, background: isCurrent ? cfg.bg : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {isCurrent ? icon : <span style={{ width: 6, height: 6, borderRadius: '50%', background: "#E2E8F0" }} />}
                </div>
              </div>
              <div style={{ paddingTop: 2 }}>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: isCurrent ? 700 : 400, color: isCurrent ? cfg.color : "#94A3B8", fontFamily: "'DM Sans',sans-serif" }}>{cfg.label}</p>
                {isCurrent && <span style={{ fontSize: 10.5, color: cfg.dot, fontWeight: 500, fontFamily: "'DM Sans',sans-serif" }}>Current</span>}
              </div>
            </div>
          );
        })}
      </div>
      {!isDeleted && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {!isResolved && (
            <button className="rd-btn" onClick={onUpdateStatus}
              style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "none", background: "#C45E10", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "'DM Sans',sans-serif" }}>
              <IcoCheck size={14} color="#fff" /> {isReferred ? "Change Status (Revert)" : "Update Status"}
            </button>
          )}
          {canQuickRefer && (
            <button className="rd-btn" onClick={onReferToPolice}
              style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "2px solid #EF4444", background: "#FEF2F2", color: "#DC2626", fontSize: 13.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "'DM Sans',sans-serif" }}>
              <IcoShield size={15} color="#DC2626" /> Refer to Authorities (Serious Case)
            </button>
          )}
        </div>
      )}
      {isReferred && <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 4, background: "#FEF2F2", border: "1.5px solid #FECACA", display: "flex", gap: 10 }}><IcoShield size={15} color="#DC2626" /><div><p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: "#DC2626", fontFamily: "'DM Sans',sans-serif" }}>Referred to Authorities</p><p style={{ margin: 0, fontSize: 12, color: "#991B1B", lineHeight: 1.5, fontFamily: "'DM Sans',sans-serif" }}>Use "Change Status" to revert if needed.</p></div></div>}
      {isResolved && <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 4, background: "#ECFDF5", border: "1.5px solid #A7F3D0", display: "flex", gap: 10 }}><IcoCheck size={15} color="#059669" /><div><p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: "#059669", fontFamily: "'DM Sans',sans-serif" }}>Case Resolved</p><p style={{ margin: 0, fontSize: 12, color: "#065F46", lineHeight: 1.5, fontFamily: "'DM Sans',sans-serif" }}>Successfully resolved at barangay level.</p></div></div>}
    </Card>
  );
};

const PrintPanel = ({ cas }) => {
  const navigate = useNavigate();
  const docs = [
    { key: "summon",      label: "Summon Letter",              sub: "Katarungang Pambarangay" },
    { key: "cfa",         label: "Certificate to File Action", sub: "Lupong Tagapamayapa" },
    { key: "endorsement", label: "Endorsement Letter",         sub: "Punong Barangay" },
  ];
  return (
    <Card title="Print Documents" icon={<IcoPrint size={16} color="#475569" />}>
      <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "#94A3B8", fontFamily: "'DM Sans',sans-serif" }}>Auto-fill official barangay documents.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {docs.map(doc => (
          <button key={doc.key} className="rd-btn"
            onClick={() => navigate(`/print/${doc.key}/${cas.id}`)}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 10, border: "1.5px solid #E2E8F0", background: "#fff", cursor: "pointer", textAlign: "left", width: "100%" }}>
            <IcoPrint size={17} color="#64748B" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: "0 0 2px", fontSize: 13.5, fontWeight: 700, color: "#0F172A", fontFamily: "'DM Sans',sans-serif" }}>{doc.label}</p>
              <p style={{ margin: 0, fontSize: 11.5, color: "#94A3B8", fontFamily: "'DM Sans',sans-serif" }}>{doc.sub}</p>
            </div>
            <svg width="14" height="14" fill="none" viewBox="0 0 20 20"><path d="M7.5 5l5 5-5 5" stroke="#94A3B8" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        ))}
      </div>
    </Card>
  );
};

export default function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [cas, setCas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRecover, setShowRecover] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [incidentTypes, setIncidentTypes] = useState({});
  const [toast, setToast] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(false);
  const [showMessageLogs, setShowMessageLogs] = useState(false);
  const [deletingMsgId, setDeletingMsgId] = useState(null);

  const currentAdmin = (() => { try { return JSON.parse(localStorage.getItem("admin_user") || localStorage.getItem("admin") || "{}"); } catch { return {}; } })();
  const isSuperAdmin = !!currentAdmin.is_super_admin;

  const showToast = (msg, success = true) => { setToast({ msg, success }); setTimeout(() => setToast(null), 3500); };

  const handleSendMessage = async () => {
    const msg = messageText.trim();
    if (!msg) { showToast("Message cannot be empty.", false); return; }
    if (!sendEmail && !sendSms) { showToast("Select at least one channel (Email or SMS).", false); return; }
    setSendingMessage(true);
    try {
      const res = await api.patch(`/admin/cases/${id}/message`, { message: msg, send_email: sendEmail, send_sms: sendSms });
      const nowIso = new Date().toISOString();
      setCas(c => ({
        ...c,
        admin_message: msg,
        admin_message_at: nowIso,
        messages: [
          { id: `tmp-${Date.now()}`, message: msg, sent_email: sendEmail, sent_sms: sendSms, sent_by: currentAdmin.username, created_at: nowIso },
          ...(c.messages || []),
        ],
      }));
      setMessageText("");
      showToast(res.data?.message || "Message sent to the victim.");
    } catch (err) { showToast(err.response?.data?.detail || "Failed to send message.", false); }
    finally { setSendingMessage(false); }
  };

  const handleDeleteLogMessage = async (messageId) => {
    if (!(await confirmDialog({ title: "Delete message?", message: "The victim will no longer see this message.", confirmLabel: "Delete", danger: true }))) return;
    setDeletingMsgId(messageId);
    try {
      await api.delete(`/admin/cases/${id}/messages/${messageId}`);
      setCas(c => {
        const remaining = (c.messages || []).filter(m => m.id !== messageId);
        return { ...c, messages: remaining, admin_message: remaining[0]?.message || null, admin_message_at: remaining[0]?.created_at || null };
      });
      showToast("Message deleted.");
    } catch (err) { showToast(err.response?.data?.detail || "Failed to delete message.", false); }
    finally { setDeletingMsgId(null); }
  };

  const fetchCase = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.get(`/admin/cases/${id}`);
      setCas(res.data);
      const types = {};
      (res.data.reports || []).forEach(r => { types[r.id] = r.incident_type || ""; });
      setIncidentTypes(types);
      setTimeout(() => {
        const hash = window.location.hash;
        if (hash) {
          const el = document.querySelector(hash);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);
    } catch (err) { setError(err.response?.data?.detail || "Failed to load case."); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchCase(); }, [fetchCase]);

  const handleStatusSave = async (newStatus) => {
    setStatusSaving(true);
    try {
      await api.patch(`/admin/cases/${id}/status`, { status: newStatus });
      setCas(c => ({ ...c, status: newStatus }));
      setShowStatusModal(false);
      showToast("Status updated.");
    } catch (err) { showToast(err.response?.data?.detail || "Failed to update.", false); }
    finally { setStatusSaving(false); }
  };

  const handleReferToPolice = async () => {
    setStatusSaving(true);
    try {
      await api.patch(`/admin/cases/${id}/status`, { status: "referred_to_police" });
      setCas(c => ({ ...c, status: "referred_to_police" }));
      showToast("Case referred to authorities.");
    } catch (err) { showToast(err.response?.data?.detail || "Failed.", false); }
    finally { setStatusSaving(false); }
  };

  const handleIncidentTypeSave = async (reportId) => {
    try {
      await api.patch(`/admin/cases/${id}/reports/${reportId}/incident-type`, { incident_type: incidentTypes[reportId] || null, report_id: reportId });
      showToast("Incident type saved.");
    } catch (err) { showToast(err.response?.data?.detail || "Failed.", false); }
  };

  const handleDelete = async (reason) => {
    setActionLoading(true);
    try {
      await api.delete(`/admin/cases/${id}`, { data: { reason } });
      setShowDeleteConfirm(false);
      showToast("Case deleted.");
      setTimeout(() => navigate("/reports"), 1500);
    } catch (err) { showToast(err.response?.data?.detail || "Failed.", false); }
    finally { setActionLoading(false); }
  };

  const handleRecover = async () => {
    setActionLoading(true);
    try {
      await api.patch(`/admin/cases/${id}/recover`);
      setShowRecover(false);
      showToast("Case recovered.");
      fetchCase();
    } catch (err) { showToast(err.response?.data?.detail || "Failed.", false); }
    finally { setActionLoading(false); }
  };

  if (loading) return (
    <AdminLayout>
      <div style={{ maxWidth: 1200 }}>
        {[140, 200, 100].map((h, i) => (
          <div key={i} style={{ background: "linear-gradient(90deg,#F8FAFC 25%,#E2E8F0 50%,#F8FAFC 75%)", borderRadius: 4, height: h, marginBottom: 16, backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
        ))}
      </div>
    </AdminLayout>
  );

  if (error) return (
    <AdminLayout>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "50vh" }}>
        <IcoWarn size={36} color="#CBD5E1" />
        <p style={{ fontWeight: 600, color: "#0F172A", margin: "12px 0 6px", fontFamily: "'DM Sans',sans-serif" }}>Case not found</p>
        <p style={{ color: "#94A3B8", fontSize: 13, margin: "0 0 20px", fontFamily: "'DM Sans',sans-serif" }}>{error}</p>
        <button onClick={() => navigate("/reports")} style={{ padding: "8px 20px", borderRadius: 4, border: "1.5px solid #E2E8F0", background: "#fff", color: "#374151", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>← Back to Reports</button>
      </div>
    </AdminLayout>
  );

  const victim = cas.victim || {};
  const reports = cas.reports || [];
  const cfg = sCfg(cas.status);
  const isMinor = victim.is_minor || false;

  return (
    <AdminLayout>
      <style>{CSS}</style>
      <div style={{ maxWidth: 1200, fontFamily: "'DM Sans',sans-serif" }}>

        {/* Restricted-view banner - non–super admins see masked sensitive fields */}
        {cas.restricted && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#FFF3E0", border: "1.5px solid #FFCC99", borderRadius: 12, marginBottom: 16, fontFamily: "'DM Sans',sans-serif" }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: "#F47920", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="11" width="18" height="11" rx="2" stroke="#fff" strokeWidth="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#9A3412", fontFamily: "'DM Sans',sans-serif" }}>Restricted view</p>
              <p style={{ margin: "1px 0 0", fontSize: 12, color: "#7C2D12", lineHeight: 1.45, fontFamily: "'DM Sans',sans-serif" }}>
                Sensitive fields (offender name, victim contact details, full statement, location, photos) are masked. Super Admin access is required to view full case data.
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => navigate("/reports")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 4, cursor: "pointer", color: "#475569", fontSize: 13, fontWeight: 600, padding: "6px 12px", marginBottom: 14, fontFamily: "'DM Sans',sans-serif" }}>
            <svg width="13" height="13" fill="none" viewBox="0 0 20 20"><path d="M12.5 5l-5 5 5 5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg>
            Back to Reports
          </button>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0F172A", fontFamily: "'DM Sans',sans-serif" }}>{cas.case_number}</h1>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: cfg.color, background: cfg.bg, fontFamily: "'DM Sans',sans-serif" }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot }} />{cas.status_display || cfg.label}
                </span>
                {isMinor && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: "#FEF3C7", color: "#92400E", fontFamily: "'DM Sans',sans-serif" }}>
                    Minor
                  </span>
                )}
                {cas.is_deleted && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: "#FEF2F2", color: "#991B1B", fontFamily: "'DM Sans',sans-serif" }}><IcoTrash size={11} color="#991B1B" /> Deleted</span>}
              </div>
              <p style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 700, color: "#0F172A", fontFamily: "'DM Sans',sans-serif" }}>vs. <span style={{ color: "#7B2D8B" }}>{cas.offender_name}</span></p>
              <p style={{ margin: 0, fontSize: 12.5, color: "#94A3B8", fontFamily: "'DM Sans',sans-serif" }}>Filed {fmt(cas.created_at)}</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {!cas.is_deleted
                ? <button className="rd-btn" onClick={() => setShowDeleteConfirm(true)}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid #FECACA", background: "#FEF2F2", color: "#991B1B", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                  Delete Case
                </button>
                : <button className="rd-btn" onClick={() => setShowRecover(true)}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid #A7F3D0", background: "#ECFDF5", color: "#065F46", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                  Recover Case
                </button>
              }
            </div>
          </div>
        </div>

        {/* Two-column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* ── Complainant Information ── */}
            <Card title="Complainant Information" icon={<IcoUser size={16} color="#9B4DAB" />}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <InfoRow label="Full Name" value={cas.victim_name || [victim.first_name, victim.middle_name, victim.last_name].filter(Boolean).join(" ") || "-"} />
                <InfoRow label="Date of Birth" value={fmtDate(victim.date_of_birth || victim.birthdate)} />
                {(victim.date_of_birth || victim.birthdate) && <InfoRow label="Age" value={`${age(victim.date_of_birth || victim.birthdate)} years old`} />}
                <InfoRow label="Sex" value={victim.sex} />
                <InfoRow label="Contact Number" value={victim.phone_number || cas.victim_phone} />
                <InfoRow label="Email" value={victim.email || cas.victim_email} mono />
                <div style={{ gridColumn: "span 2" }}><InfoRow label="Address" value={victim.address} /></div>
              </div>

              {/* ── Minor / Guardian section ── */}
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #F1F5F9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <IcoGuardian size={14} color="#9B4DAB" />
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "'DM Sans',sans-serif" }}>Minor / Guardian</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                  <InfoRow
                    label="Victim is Minor"
                    value={isMinor ? "Yes (Below 18)" : "No"}
                    muted={!isMinor}
                  />
                  <InfoRow
                    label="Guardian Name"
                    value={victim.guardian_name || "N/A"}
                    muted={!victim.guardian_name}
                  />
                  <InfoRow
                    label="Relationship"
                    value={victim.guardian_relationship || "N/A"}
                    muted={!victim.guardian_relationship}
                  />
                </div>
              </div>
            </Card>

            {/* Reports / Testimonies - quick-nav tabs */}
            {reports.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "#fff", border: "1px solid #E2E8F0", padding: "10px 14px", borderRadius: 4, boxShadow: "0 1px 3px rgba(15,23,42,0.05)" }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#94A3B8", fontFamily: "'DM Sans',sans-serif", marginRight: 4 }}>
                  Jump to:
                </span>
                {reports.map((r, idx) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => document.getElementById(`report-${idx + 1}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 9999,
                      border: "1.5px solid #E1BEE7",
                      background: "#F3E5F5",
                      color: "#4A1259",
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "'DM Sans',sans-serif",
                      transition: "all 0.12s ease",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#9B4DAB"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#9B4DAB"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#F3E5F5"; e.currentTarget.style.color = "#4A1259"; e.currentTarget.style.borderColor = "#E1BEE7"; }}
                  >
                    Report {idx + 1}
                  </button>
                ))}
              </div>
            )}

            {reports.map((r, idx) => (
              <div key={r.id} id={`report-${idx + 1}`} style={{ scrollMarginTop: 80 }}>
                <Card title={`Report ${idx + 1} - Testimony`} icon={<IcoClip size={16} color="#9B4DAB" />}
                  headerRight={
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11.5, color: "#94A3B8", fontFamily: "'DM Sans',sans-serif" }}>
                        {fmt(r.created_at)}
                        {r.updated_at && new Date(r.updated_at) - new Date(r.created_at) > 60000 && (
                          <span style={{ marginLeft: 6, fontSize: 10.5, color: "#9B4DAB", fontWeight: 600 }}>
                            · edited {fmt(r.updated_at)}
                          </span>
                        )}
                      </span>
                      {reports.length > 1 && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!(await confirmDialog({ title: `Delete Report ${idx + 1}?`, message: "This report will be removed. This cannot be undone.", confirmLabel: "Delete", danger: true }))) return;
                            try {
                              await api.delete(`/admin/cases/${id}/reports/${r.id}`);
                              setCas(c => ({ ...c, reports: c.reports.filter(rep => rep.id !== r.id) }));
                              showToast(`Report ${idx + 1} deleted.`);
                            } catch (err) {
                              showToast(err.response?.data?.detail || "Failed to delete report.", false);
                            }
                          }}
                          style={{ padding: "4px 10px", borderRadius: 4, border: "1.5px solid #FECACA", background: "#FEF2F2", color: "#991B1B", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                          Delete
                        </button>
                      )}
                    </div>
                  }>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <p style={{ margin: "0 0 8px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#94A3B8", fontFamily: "'DM Sans',sans-serif" }}>Incident Type</p>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <select value={incidentTypes[r.id] || ""} onChange={e => setIncidentTypes(p => ({ ...p, [r.id]: e.target.value }))}
                          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 13.5, color: "#0F172A", background: "#F8FAFC", outline: "none", fontFamily: "'DM Sans',sans-serif" }}
                          onFocus={e => { e.target.style.borderColor = "#9B4DAB"; e.target.style.background = "#fff"; }}
                          onBlur={e => { e.target.style.borderColor = "#E2E8F0"; e.target.style.background = "#F8FAFC"; }}>
                          <option value="">- Not classified -</option>
                          {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button onClick={() => handleIncidentTypeSave(r.id)}
                          disabled={incidentTypes[r.id] === (r.incident_type || "")}
                          style={{ padding: "8px 14px", borderRadius: 4, border: "none", background: incidentTypes[r.id] === (r.incident_type || "") ? "#E2E8F0" : "#9B4DAB", color: incidentTypes[r.id] === (r.incident_type || "") ? "#94A3B8" : "#fff", fontSize: 13, fontWeight: 600, cursor: incidentTypes[r.id] === (r.incident_type || "") ? "not-allowed" : "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                          Save
                        </button>
                      </div>
                    </div>
                    {r.incident_date && (
                      <div>
                        <p style={{ margin: "0 0 4px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#94A3B8", fontFamily: "'DM Sans',sans-serif" }}>Date of Incident</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <IcoCal size={14} color="#9B4DAB" />
                          <span style={{ fontSize: 13.5, color: "#0F172A", fontWeight: 600, fontFamily: "'DM Sans',sans-serif" }}>{fmtDate(r.incident_date)}</span>
                        </div>
                      </div>
                    )}
                    {r.address && <InfoRow label="Reported Location" value={r.address} />}
                    <div>
                      <p style={{ margin: "0 0 8px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#94A3B8", fontFamily: "'DM Sans',sans-serif" }}>Statement</p>
                      {r.statement
                        ? <div style={{ background: "#F8FAFC", borderRadius: 4, padding: "14px 16px", fontSize: 13.5, color: "#374151", lineHeight: 1.75, borderLeft: "3px solid #E1BEE7", whiteSpace: "pre-wrap", fontFamily: "'DM Sans',sans-serif" }}>{r.statement}</div>
                        : <div style={{ background: "#F8FAFC", borderRadius: 4, padding: "14px 16px", fontSize: 13, color: "#94A3B8", fontStyle: "italic", borderLeft: "3px solid #E2E8F0", fontFamily: "'DM Sans',sans-serif" }}>No statement provided.</div>
                      }
                    </div>
                    {r.photo_urls?.length > 0 && (
                      <div>
                        <p style={{ margin: "0 0 8px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#94A3B8", fontFamily: "'DM Sans',sans-serif" }}>Evidence Photos ({r.photo_urls.length})</p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(100px,1fr))", gap: 8 }}>
                          {r.photo_urls.map((url, i) => (
                            <div key={i} onClick={() => setLightbox(url)} style={{ aspectRatio: "1", borderRadius: 4, overflow: "hidden", cursor: "zoom-in", border: "1px solid #E2E8F0" }}>
                              <img src={url} alt={`Evidence ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.2s" }}
                                onMouseEnter={e => e.target.style.transform = "scale(1.05)"}
                                onMouseLeave={e => e.target.style.transform = "scale(1)"} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Restricted: photos masked - show placeholders */}
                    {r.restricted && (r.photo_count || 0) > 0 && (!r.photo_urls || r.photo_urls.length === 0) && (
                      <div>
                        <p style={{ margin: "0 0 8px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#94A3B8", fontFamily: "'DM Sans',sans-serif" }}>Evidence Photos ({r.photo_count}) - Restricted</p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(100px,1fr))", gap: 8 }}>
                          {Array.from({ length: r.photo_count }).map((_, i) => (
                            <div key={i} title="Super Admin access required to view"
                              style={{ aspectRatio: "1", borderRadius: 4, overflow: "hidden", border: "1.5px solid #FFCC99", background: "repeating-linear-gradient(45deg, #FFF3E0, #FFF3E0 8px, #FFEDD5 8px, #FFEDD5 16px)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 4 }}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <rect x="3" y="11" width="18" height="11" rx="2" stroke="#9A3412" strokeWidth="2" />
                                <path d="M7 11V7a5 5 0 0110 0v4" stroke="#9A3412" strokeWidth="2" strokeLinecap="round" />
                              </svg>
                              <span style={{ fontSize: 9, fontWeight: 700, color: "#9A3412", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'DM Sans',sans-serif" }}>Locked</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {(r.latitude && r.longitude) && (
                      <a href={`https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`} target="_blank" rel="noopener noreferrer" className="rd-map"
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 4, border: "1.5px solid #E2E8F0", color: "#475569", fontSize: 13, fontWeight: 600, textDecoration: "none", fontFamily: "'DM Sans',sans-serif" }}>
                        <IcoPin size={14} color="#94A3B8" /> View on Google Maps
                      </a>
                    )}
                    {/* Restricted: location masked */}
                    {r.restricted && !r.latitude && !r.longitude && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 4, border: "1.5px dashed #FFCC99", color: "#9A3412", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", background: "#FFF3E0", width: "fit-content" }}>
                        <IcoPin size={14} color="#9A3412" /> Location restricted - Super Admin access required
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            ))}

            <Card title="Case Information" icon={<IcoClip size={16} color="#9B4DAB" />}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "16px 24px" }}>
                <InfoRow label="Case Number" value={cas.case_number} mono />
                <InfoRow label="Current Status" value={cas.status_display || cfg.label} />
                <InfoRow label="Respondent" value={cas.offender_name} />
                <InfoRow label="Date Filed" value={fmt(cas.created_at)} />
                <InfoRow label="Last Updated" value={fmt(cas.updated_at)} />
                {cas.admin_id && <InfoRow label="Handled By" value={cas.handled_by || `Admin #${cas.admin_id}`} />}
                <InfoRow label="Total Reports" value={`${reports.length} ${reports.length === 1 ? "testimony" : "testimonies"}`} />
                {cas.has_status_update && (
                  <InfoRow label="Victim Notification" value="Sent - awaiting victim to open the case in their portal" muted />
                )}
                {cas.admin_recovered && (
                  <InfoRow label="Recovery Note" value="This case was previously deleted and recovered by an admin" muted />
                )}
              </div>
            </Card>

            {/* Deletion details - only when soft-deleted */}
            {cas.is_deleted && (
              <Card title="Deletion Details" icon={<IcoTrash size={16} color="#C62828" />}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "16px 24px" }}>
                  <InfoRow label="Deleted On" value={fmt(cas.deleted_at)} />
                  <InfoRow
                    label="Reason"
                    value={cas.delete_reason || "Not specified"}
                    muted={!cas.delete_reason}
                  />
                  <InfoRow label="Recovery Window" value="30 days from deletion" muted />
                </div>
              </Card>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <CaseTimeline cas={cas} onUpdateStatus={() => setShowStatusModal(true)} onReferToPolice={handleReferToPolice} />

            {isSuperAdmin && !cas.is_deleted && (
              <Card title="Message to Victim" icon={<IcoClip size={16} color="#F47920" />}>
                <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "#94A3B8", lineHeight: 1.5, fontFamily: "'DM Sans',sans-serif" }}>
                  Send a note to the victim at any stage - e.g. an update, or the schedule and venue of the hearing. They are notified by email and in their portal.
                </p>
                {cas.messages && cas.messages.length > 0 && (
                  <button className="rd-btn" onClick={() => setShowMessageLogs(true)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", marginBottom: 10, padding: "9px 0", borderRadius: 8, border: "1.5px solid #E1BEE7", background: "#F3E5F5", color: "#7B2D8B", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                    <IcoClip size={13} color="#7B2D8B" /> Open message logs ({cas.messages.length})
                  </button>
                )}
                <textarea value={messageText} onChange={e => setMessageText(e.target.value)} rows={4}
                  style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #E2E8F0", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontFamily: "'DM Sans',sans-serif", color: "#0F172A", outline: "none", resize: "vertical" }} />

                {/* Channel selection */}
                <div style={{ display: "flex", gap: 18, alignItems: "center", margin: "10px 0 3px" }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'DM Sans',sans-serif" }}>Send via</span>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#374151", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                    <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} style={{ accentColor: "#7B2D8B" }} /> Email
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#374151", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                    <input type="checkbox" checked={sendSms} onChange={e => setSendSms(e.target.checked)} style={{ accentColor: "#7B2D8B" }} /> SMS
                  </label>
                </div>
                {sendSms && (
                  <p style={{ margin: "0 0 6px", fontSize: 11, color: "#94A3B8", lineHeight: 1.45, fontFamily: "'DM Sans',sans-serif" }}>
                    SMS uses Semaphore credits; long messages may use more than one credit.
                  </p>
                )}

                <button className="rd-btn" onClick={handleSendMessage} disabled={sendingMessage || !messageText.trim() || (!sendEmail && !sendSms)}
                  style={{ width: "100%", marginTop: 7, padding: "10px 0", borderRadius: 8, border: "none", background: (messageText.trim() && (sendEmail || sendSms)) ? "#C45E10" : "#E2E8F0", color: (messageText.trim() && (sendEmail || sendSms)) ? "#fff" : "#94A3B8", fontSize: 13.5, fontWeight: 600, cursor: (sendingMessage || !messageText.trim() || (!sendEmail && !sendSms)) ? "not-allowed" : "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                  {sendingMessage ? "Sending…" : "Send Message"}
                </button>
              </Card>
            )}

            <PrintPanel cas={cas} />
          </div>
        </div>
      </div>

      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 999, background: "#fff", border: `1px solid ${toast.success ? "#A7F3D0" : "#FECACA"}`, borderRadius: 4, padding: "12px 18px", boxShadow: "0 8px 24px rgba(0,0,0,0.10)", display: "flex", alignItems: "center", gap: 9, animation: "slideDown 0.2s ease", fontSize: 13.5, color: toast.success ? "#065F46" : "#991B1B", fontWeight: 500, fontFamily: "'DM Sans',sans-serif" }}>
          <span style={{ width: 20, height: 20, borderRadius: 4, background: toast.success ? "#D1FAE5" : "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {toast.success ? <svg width="10" height="10" fill="none" viewBox="0 0 20 20"><path d="M5 10l4 4 6-8" stroke="#10B981" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg> : <svg width="10" height="10" fill="none" viewBox="0 0 20 20"><path d="M15 5L5 15M5 5l10 10" stroke="#EF4444" strokeWidth={2} strokeLinecap="round" /></svg>}
          </span>
          {toast.msg}
        </div>
      )}

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, cursor: "zoom-out" }}>
          <img src={lightbox} alt="Evidence" style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 4, objectFit: "contain" }} />
          <button onClick={() => setLightbox(null)} style={{ position: "absolute", top: 20, right: 20, width: 40, height: 40, borderRadius: 4, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 20 20"><path d="M15 5L5 15M5 5l10 10" stroke="#fff" strokeWidth={2} strokeLinecap="round" /></svg>
          </button>
        </div>
      )}

      {showStatusModal && <StatusModal current={cas.status} onClose={() => setShowStatusModal(false)} onSave={handleStatusSave} saving={statusSaving} />}
      {showDeleteConfirm && <DeleteModal caseId={cas.case_number} loading={actionLoading} onConfirm={handleDelete} onClose={() => setShowDeleteConfirm(false)} />}
      {showRecover && <ConfirmModal title="Recover Case" message={`Restore case ${cas.case_number}?`} confirmLabel="Recover" danger={false} loading={actionLoading} onConfirm={handleRecover} onClose={() => setShowRecover(false)} />}

      {showMessageLogs && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setShowMessageLogs(false)}>
          <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 500, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(15,23,42,0.3)", fontFamily: "'DM Sans',sans-serif", overflow: "hidden", animation: "slideDown 0.22s ease" }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 22px", borderBottom: "1px solid #F1F5F9", background: "linear-gradient(135deg, #FBF3FC 0%, #F3E5F5 100%)" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #9B4DAB, #4A1259)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 12px rgba(74,18,89,0.28)" }}>
                <IcoClip size={18} color="#fff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#4A1259", letterSpacing: "-0.2px" }}>Message Logs</p>
                <p style={{ margin: "1px 0 0", fontSize: 12, color: "#9B4DAB", fontWeight: 500 }}>
                  {(cas.messages || []).length} message{(cas.messages || []).length !== 1 ? "s" : ""} sent to the victim
                </p>
              </div>
              <button onClick={() => setShowMessageLogs(false)} style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(255,255,255,0.7)", border: "1px solid #E1BEE7", cursor: "pointer", color: "#7B2D8B", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 20 20"><path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" /></svg>
              </button>
            </div>

            {/* Body — minimalist scrollable list */}
            <div className="msg-log-body" style={{ overflowY: "auto", padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
              {(cas.messages || []).length === 0 ? (
                <div style={{ textAlign: "center", padding: "36px 0" }}>
                  <IcoClip size={30} color="#E1BEE7" />
                  <p style={{ margin: "10px 0 0", fontSize: 13, color: "#94A3B8" }}>No messages yet.</p>
                </div>
              ) : (cas.messages || []).map((m, i) => {
                const isTmp = String(m.id).startsWith("tmp-");
                const isLatest = i === 0;
                return (
                  <div key={m.id} style={{ background: "#fff", border: "1px solid #EEE6F1", borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 7 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500 }}>{fmt(m.created_at)}</span>
                        {isLatest && <span style={{ fontSize: 9, fontWeight: 800, color: "#C45E10", background: "#FFF3E0", padding: "2px 7px", borderRadius: 9999, textTransform: "uppercase", letterSpacing: "0.05em" }}>Latest</span>}
                      </span>
                      <button onClick={() => handleDeleteLogMessage(m.id)} disabled={deletingMsgId === m.id || isTmp}
                        title={isTmp ? "Reload the page to delete a just-sent message" : "Delete this message"}
                        style={{ width: 26, height: 26, borderRadius: 8, border: "none", background: "transparent", cursor: (deletingMsgId === m.id || isTmp) ? "not-allowed" : "pointer", opacity: (deletingMsgId === m.id || isTmp) ? 0.35 : 1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <IcoTrash size={15} color="#DC2626" />
                      </button>
                    </div>
                    <p style={{ margin: "0 0 9px", fontSize: 13.5, color: "#1E1B29", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{m.message}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {m.sent_email && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: "#065F46", background: "#ECFDF5", border: "1px solid #A7F3D0", padding: "2px 8px", borderRadius: 9999 }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#10B981" }} /> Email
                        </span>
                      )}
                      {m.sent_sms && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: "#C45E10", background: "#FFF3E0", border: "1px solid #FFCC99", padding: "2px 8px", borderRadius: 9999 }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#F47920" }} /> SMS
                        </span>
                      )}
                      {m.sent_by && <span style={{ fontSize: 10.5, color: "#94A3B8" }}>by {m.sent_by}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
