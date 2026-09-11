import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "../components/Sidebar";
import { confirmDialog } from "../components/ConfirmDialog";
import api from "../api/api";

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700;800&display=swap');
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

// Lawful VAWC flow (RA 9262 / JMC 2010-2). No CFA, no Summons, no "resolved/settled".
const STATUS_CONFIG = {
  submitted: { label: "Submitted", color: "#BE185D", bg: "#FDF2F8", dot: "#EC4899" },
  under_assessment: { label: "Under Assessment", color: "#0E7490", bg: "#ECFEFF", dot: "#06B6D4" },
  awaiting_onsite_visit: { label: "Awaiting Onsite Visit", color: "#D97706", bg: "#FFFBEB", dot: "#F59E0B" },
  bpo_applied: { label: "BPO Applied", color: "#7B2D8B", bg: "#F3E5F5", dot: "#9B4DAB" },
  bpo_issued: { label: "BPO Issued", color: "#C45E10", bg: "#FFF3E0", dot: "#F47920" },
  bpo_served: { label: "BPO Served", color: "#B45309", bg: "#FFFBEB", dot: "#D97706" },
  endorsed: { label: "Endorsed", color: "#DC2626", bg: "#FEF2F2", dot: "#EF4444" },
  closed: { label: "Assistance Ended", color: "#475569", bg: "#F1F5F9", dot: "#64748B" },
};
const sCfg = (s) => STATUS_CONFIG[s] || { label: s || "Unknown", color: "#64748B", bg: "var(--adm-border)", dot: "#CBD5E1" };
// Directly settable via the status picker (assessment/investigation steps only).
// BPO / endorsement / close are driven by their own actions.
const ALL_STATUSES = ["under_assessment", "awaiting_onsite_visit"];

const TIMELINE_STEPS = ["submitted", "under_assessment", "awaiting_onsite_visit", "bpo_applied", "bpo_issued", "bpo_served"];
const ENDPOINT_STATES = ["endorsed", "closed"];

// Wording verified against the NVAW DocS Barangay Client Card (Barangay VAW
// Desk Handbook, Annex A, printed p. 66). Annex A records these when "the
// victim does not want to continue or pursue the case" and has no category for
// a case that ended well, so the last two are documented additions.
const CLOSURE_REASONS = [
  { id: "lost_interest_to_file", label: "Lost interest to file" },
  { id: "reconciled_without_mediation", label: "Reconciled with the perpetrator (w/o mediation)" },
  { id: "transferred_residence", label: "Transfer residence" },
  { id: "lack_of_support", label: "Lack of support" },
  { id: "lack_of_confidence_in_provider", label: "Lack of confidence with service provider" },
  { id: "referred_and_completed", label: "Referred and successfully turned over" },
  { id: "bpo_expired_no_incident", label: "BPO expired with no further incident" },
  { id: "others", label: "Others (please specify)" },
];
const SEVERITIES = [
  { id: "low", label: "Low" },
  { id: "moderate", label: "Moderate" },
  { id: "high", label: "High" },
  { id: "critical", label: "Critical" },
];
const ENDORSE_OFFICES = [
  { id: "pnp_iba_mps", label: "PNP - Iba MPS (WCPD)" },
  { id: "cmswdo", label: "C/MSWDO" },
  { id: "court", label: "Court" },
  { id: "pao", label: "PAO" },
  { id: "medical", label: "Medical / Hospital" },
  { id: "others", label: "Others" },
];
// RA 9262 abuse forms (values match backend VALID_INCIDENT_TYPES).
const INCIDENT_TYPES = [
  { id: "physical", label: "Physical" },
  { id: "sexual", label: "Sexual" },
  { id: "psychological", label: "Psychological" },
  { id: "economic", label: "Economic" },
  { id: "others", label: "Others" },
];

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
const IcoEdit = ({ size = 16, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoGuardian = ({ size = 16, color = "currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><circle cx="9" cy="7" r="4" stroke={color} strokeWidth="1.8" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>);

const Spinner = ({ size = 14, color = "#fff" }) => (
  <span style={{ width: size, height: size, border: `2px solid rgba(255,255,255,0.3)`, borderTopColor: color, borderRadius: '50%', animation: "spin 0.7s linear infinite", display: "inline-block", flexShrink: 0 }} />
);

const Card = ({ title, icon, children, style = {}, headerRight }) => (
  <div style={{ background: "var(--adm-card)", borderRadius: 0, border: "1px solid var(--adm-border)", overflow: "hidden", fontFamily: "'Lexend',sans-serif", boxShadow: "0 1px 3px rgba(15,23,42,0.05)", ...style }}>
    {title && (
      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--adm-border)", display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "var(--adm-muted)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 3, height: 16, borderRadius: 4, backgroundColor: "#9B4DAB" }} />
          {icon && <span style={{ display: "flex" }}>{icon}</span>}
          <h3 style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "var(--adm-text)", fontFamily: "'Lexend',sans-serif", textTransform: "uppercase", letterSpacing: "0.5px" }}>{title}</h3>
        </div>
        {headerRight}
      </div>
    )}
    <div style={{ padding: 20 }}>{children}</div>
  </div>
);

// One chip treatment for every submitted-date surface (report card header and the
// Case Information row) so the same fact never appears in two different shapes.
const DateChip = ({ prefix, children, wrap }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 6, maxWidth: "100%",
    background: "transparent", color: "var(--adm-text)",
    fontSize: 12, fontWeight: 500, lineHeight: 1.45,
    padding: "4px 10px", borderRadius: 9999, border: "1px solid var(--adm-border)",
    fontFamily: "'Lexend',sans-serif", fontVariantNumeric: "tabular-nums",
    whiteSpace: wrap ? "normal" : "nowrap", overflowWrap: "anywhere",
  }}>
    <IcoCal size={12.5} color="var(--adm-text-muted)" />
    {prefix && <span style={{ color: "var(--adm-text-muted)" }}>{prefix}</span>}
    <span style={{ fontWeight: 600 }}>{children}</span>
  </span>
);

const InfoRow = ({ label, value, mono, muted, highlight, action }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
    <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--adm-text-muted)", fontFamily: "'Lexend',sans-serif" }}>
      {label}{action}
    </span>
    {highlight ? (
      <span style={{ alignSelf: "flex-start", maxWidth: "100%" }}><DateChip wrap>{value || "-"}</DateChip></span>
    ) : (
      <span style={{ fontSize: 13.5, color: muted ? "#94A3B8" : "var(--adm-text)", fontWeight: 500, fontStyle: muted ? "italic" : "normal", fontFamily: mono ? "monospace" : "'Lexend',sans-serif" }}>{value || "-"}</span>
    )}
  </div>
);

const M = {
  backdrop: { position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { background: "var(--adm-card)", borderRadius: 16, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", padding: 28, fontFamily: "'Lexend',sans-serif" },
  title: { margin: 0, fontSize: 16, fontWeight: 700, color: "var(--adm-text)", fontFamily: "'Lexend',sans-serif" },
  sub: { margin: "3px 0 0", fontSize: 12.5, color: "var(--adm-text-muted)", fontFamily: "'Lexend',sans-serif" },
  closeBtn: { background: "none", border: "none", cursor: "pointer", color: "var(--adm-text-muted)", padding: 4, display: "flex" },
  cancelBtn: { padding: "8px 18px", borderRadius: 10, border: "1.5px solid var(--adm-border)", background: "var(--adm-card)", color: "var(--adm-text-2)", fontSize: 13.5, fontWeight: 500, cursor: "pointer", fontFamily: "'Lexend',sans-serif" },
  saveBtn: { padding: "8px 20px", borderRadius: 10, border: "none", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontFamily: "'Lexend',sans-serif" },
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
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 4, cursor: "pointer", border: `1.5px solid ${isActive ? cfg.dot : "var(--adm-border)"}`, background: isActive ? cfg.bg : "#fff", opacity: isPast ? 0.4 : 1 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: isActive ? 600 : 500, color: isActive ? cfg.color : "#374151", fontFamily: "'Lexend',sans-serif" }}>{cfg.label}</span>
                {isActive && <IcoCheck size={15} color={cfg.dot} />}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={M.cancelBtn}>Cancel</button>
          <button onClick={() => onSave(selected)} disabled={saving || selected === current}
            style={{ ...M.saveBtn, background: selected === current ? "var(--adm-border)" : "#9B4DAB", color: selected === current ? "#94A3B8" : "#fff", cursor: selected === current ? "not-allowed" : "pointer" }}>
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
      <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "#64748B", lineHeight: 1.6, fontFamily: "'Lexend',sans-serif" }}>{message}</p>
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

const RespondentModal = ({ current, onClose, onSave, saving }) => {
  const [name, setName] = useState(current || "");
  const [err, setErr] = useState("");
  const trimmed = name.trim();
  const unchanged = trimmed === (current || "").trim();
  const submit = () => {
    if (!trimmed) { setErr("Respondent name cannot be empty."); return; }
    if (unchanged) { onClose(); return; }
    onSave(trimmed);
  };
  return (
    <div style={M.backdrop} onClick={!saving ? onClose : undefined}>
      <div style={{ ...M.modal, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <p style={M.title}>Edit Respondent Name</p>
            <p style={M.sub}>Correct a misspelling before it reaches the printed forms</p>
          </div>
          <CloseX onClick={onClose} />
        </div>
        <label htmlFor="resp-name" style={{ display: "block", margin: "0 0 6px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--adm-text-muted)", fontFamily: "'Lexend',sans-serif" }}>
          Respondent
        </label>
        <input
          id="resp-name"
          autoFocus
          value={name}
          maxLength={120}
          onChange={e => { setName(e.target.value); setErr(""); }}
          onBlur={() => { if (!name.trim()) setErr("Respondent name cannot be empty."); }}
          onKeyDown={e => { if (e.key === "Enter" && !saving) submit(); }}
          style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${err ? "#EF4444" : "var(--adm-border)"}`, borderRadius: 4, padding: "11px 12px", fontSize: 14, fontFamily: "'Lexend',sans-serif", color: "var(--adm-text)", background: "var(--adm-card)", outline: "none" }}
        />
        {err
          ? <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#EF4444", fontFamily: "'Lexend',sans-serif" }}>{err}</p>
          : <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--adm-text-muted)", lineHeight: 1.5, fontFamily: "'Lexend',sans-serif" }}>
              The victim typed this name when filing. It appears on the BPO application and the endorsement letter.
            </p>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button className="rd-btn" style={M.cancelBtn} onClick={onClose} disabled={saving}>Cancel</button>
          <button className="rd-btn" style={{ ...M.saveBtn, background: "#9B4DAB", opacity: saving || !trimmed ? 0.6 : 1, cursor: saving || !trimmed ? "not-allowed" : "pointer" }}
            onClick={submit} disabled={saving || !trimmed}>
            {saving && <Spinner />}{saving ? "Saving…" : "Save Name"}
          </button>
        </div>
      </div>
    </div>
  );
};

// Mirrors the enum in backend/models/case.py (RelationshipToOffender).
const RELATIONSHIP_OPTS = [
  { id: "current_spouse_partner", label: "Current spouse / partner" },
  { id: "former_spouse_partner",  label: "Former spouse / partner" },
  { id: "current_dating",         label: "Current dating relationship" },
  { id: "former_dating",          label: "Former dating relationship" },
  { id: "employer_supervisor",    label: "Employer / supervisor" },
  { id: "agent_of_employer",      label: "Agent of employer" },
  { id: "teacher_instructor",     label: "Teacher / instructor" },
  { id: "coach_trainer",          label: "Coach / trainer" },
  { id: "person_of_authority",    label: "Person of authority" },
  { id: "neighbor_coworker",      label: "Neighbor / co-worker" },
  { id: "immediate_family",       label: "Immediate family" },
  { id: "other_relative",         label: "Other relative" },
  { id: "stranger",               label: "Stranger" },
  { id: "others",                 label: "Others" },
];

const RelationshipModal = ({ current, onClose, onSave, saving }) => {
  const [value, setValue] = useState(current || "");
  const unchanged = value === (current || "");
  const submit = () => {
    if (!value) return;
    if (unchanged) { onClose(); return; }
    onSave(value);
  };
  return (
    <div style={M.backdrop} onClick={!saving ? onClose : undefined}>
      <div style={{ ...M.modal, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <p style={M.title}>Relationship to Respondent</p>
            <p style={M.sub}>As stated by the complainant at intake</p>
          </div>
          <CloseX onClick={onClose} />
        </div>
        <label htmlFor="rel-select" style={{ display: "block", margin: "0 0 6px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--adm-text-muted)", fontFamily: "'Lexend',sans-serif" }}>
          Relationship
        </label>
        <select
          id="rel-select"
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid var(--adm-border)", borderRadius: 4, padding: "11px 12px", fontSize: 14, fontFamily: "'Lexend',sans-serif", color: "var(--adm-text)", background: "var(--adm-card)", outline: "none" }}
        >
          <option value="" disabled>Select a relationship…</option>
          {RELATIONSHIP_OPTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--adm-text-muted)", lineHeight: 1.5, fontFamily: "'Lexend',sans-serif" }}>
          This determines whether RA 9262 applies and fills the "Relasyon sa Inirereklamo" line on the Pormal na Reklamo.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button className="rd-btn" style={M.cancelBtn} onClick={onClose} disabled={saving}>Cancel</button>
          <button className="rd-btn" style={{ ...M.saveBtn, background: "#9B4DAB", opacity: saving || !value ? 0.6 : 1, cursor: saving || !value ? "not-allowed" : "pointer" }}
            onClick={submit} disabled={saving || !value}>
            {saving && <Spinner />}{saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

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
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "var(--adm-text-2)", fontFamily: "'Lexend',sans-serif" }}>Why are you deleting this case?</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
          {DELETE_REASONS.map(r => (
            <label key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 4, cursor: "pointer", border: `1.5px solid ${reason === r.id ? "#FECACA" : "var(--adm-border)"}`, background: reason === r.id ? "#FEF2F2" : "#fff" }}>
              <input type="radio" name="del-reason" value={r.id} checked={reason === r.id} onChange={() => { setReason(r.id); setErr(""); }} style={{ accentColor: "#EF4444" }} />
              <span style={{ fontSize: 13.5, color: reason === r.id ? "#991B1B" : "#374151", fontWeight: reason === r.id ? 600 : 400, fontFamily: "'Lexend',sans-serif" }}>{r.label}</span>
            </label>
          ))}
          {reason === "other" && <textarea placeholder="Describe your reason…" value={otherText} onChange={e => setOtherText(e.target.value)} maxLength={300}
            style={{ width: "100%", boxSizing: "border-box", minHeight: 72, resize: "vertical", border: "1.5px solid var(--adm-border)", borderRadius: 4, padding: "10px 12px", fontSize: 13.5, fontFamily: "'Lexend',sans-serif", color: "var(--adm-text)", outline: "none", marginTop: 4 }} />}
          {err && <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#EF4444", fontFamily: "'Lexend',sans-serif" }}>{err}</p>}
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

const ENDPOINT_ICON = {
  endorsed: <IcoShield size={10} color="#DC2626" />,
  closed:   <IcoCheck size={10} color="#475569" />,
};
const ENDPOINT_NOTE = {
  endorsed: { title: "Endorsed", body: "Endorsed to the receiving office. It is not complete until acknowledged (see the Endorsements panel).", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", sub: "#991B1B" },
  closed:   { title: "Assistance Ended",   body: "The barangay ended its assistance with a recorded reason. The case is not dismissed, resolved or settled — only a court can dismiss a VAWC case.", color: "#475569", bg: "#F1F5F9", border: "#CBD5E1", sub: "#334155" },
};

// Sub-message under each timeline step. Prefers the real recorded fact (who, when,
// which office) and falls back to what the step means while it has not happened yet.
const stepDetail = (key, cas) => {
  const bpo  = (cas.bpos || [])[0];
  const endo = (cas.endorsements || [])[0];
  const on   = (d) => (d ? fmtDate(d) : null);   // date only; the chips carry the time
  switch (key) {
    case "submitted":
      return `Filed by the complainant${on(cas.created_at) ? ` on ${on(cas.created_at)}` : ""}.`;
    case "under_assessment":
      return cas.handled_by ? `${cas.handled_by} is reviewing the statement.` : "VAWC officer reviews the statement and severity.";
    case "awaiting_onsite_visit":
      return "Complainant asked to appear at the desk to confirm and sign.";
    case "bpo_applied":
      return bpo?.applied_at ? `Application recorded on ${on(bpo.applied_at)}.` : "BPO application prepared for the Punong Barangay.";
    case "bpo_issued":
      return bpo?.issued_at
        ? `Issued ${on(bpo.issued_at)}${bpo.expires_at ? `, expires ${on(bpo.expires_at)}` : ""}.`
        : "Punong Barangay issues the order. Valid 15 days, non-extendable.";
    case "bpo_served":
      return bpo?.served_at
        ? `Served ${on(bpo.served_at)}${bpo.served_by ? ` by ${bpo.served_by}` : ""}.`
        : "Order delivered to the respondent and proof of service recorded.";
    case "endorsed":
      return endo?.date_endorsed
        ? `Sent to ${endo.to_office_display || endo.to_office_other || "the receiving office"} on ${on(endo.date_endorsed)}.`
        : "Case forwarded to PNP, C/MSWDO, PAO, or the court.";
    case "closed":
      return cas.closure_reason_display
        ? `${cas.closure_reason_display}${on(cas.closed_at) ? ` on ${on(cas.closed_at)}` : ""}.`
        : "Barangay assistance ended with a recorded reason. The case itself is not dismissed.";
    default:
      return null;
  }
};

// Shared row so the linear steps and the two endpoints cannot drift apart.
const TimelineRow = ({ label, detail, dot, color, bg, icon, isDone, isCurrent, last }) => (
  <div style={{ display: "flex", gap: 12, position: "relative", paddingBottom: last ? 2 : 16 }}>
    {!last && (
      <span aria-hidden="true" style={{
        position: "absolute", left: 9, top: 22, bottom: 2, width: 2,
        background: isDone ? dot : "var(--adm-border)",
      }} />
    )}
    <span aria-hidden="true" style={{
      width: 20, height: 20, borderRadius: "50%", flexShrink: 0, zIndex: 1,
      border: `2px solid ${isCurrent || isDone ? dot : "var(--adm-border)"}`,
      background: isCurrent ? (icon ? bg : dot) : isDone ? bg : "var(--adm-card)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {icon
        ? icon
        : isCurrent
          ? <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--adm-card)" }} />
          : isDone && <svg width="9" height="9" fill="none" viewBox="0 0 20 20"><path d="M5 10l4 4 6-8" stroke={dot} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </span>
    <div style={{ minWidth: 0, paddingTop: 1 }}>
      <p style={{ margin: 0, fontSize: 12.5, fontWeight: isCurrent ? 700 : isDone ? 600 : 400, color: isCurrent ? color : isDone ? "var(--adm-text)" : "#94A3B8", fontFamily: "'Lexend',sans-serif", display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
        {label}
        {isCurrent && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color, background: bg, border: `1px solid ${dot}33`, padding: "2px 7px", borderRadius: 9999 }}>Now</span>}
      </p>
      {detail && (
        <p style={{ margin: "3px 0 0", fontSize: 11, lineHeight: 1.5, color: "var(--adm-text-muted)", opacity: isDone || isCurrent ? 1 : 0.8, fontFamily: "'Lexend',sans-serif" }}>
          {detail}
        </p>
      )}
    </div>
  </div>
);

const CaseTimeline = ({ cas, onUpdateStatus }) => {
  const isEndpoint = ENDPOINT_STATES.includes(cas.status);
  const isDeleted = cas.is_deleted;
  const currentIdx = TIMELINE_STEPS.indexOf(cas.status);
  const canPatch = ["submitted", "under_assessment", "awaiting_onsite_visit", "bpo_applied"].includes(cas.status);
  const rows = [
    ...TIMELINE_STEPS.map((s, i) => ({
      key: s,
      isDone: isEndpoint ? true : i < currentIdx,
      isCurrent: !isEndpoint && i === currentIdx,
      icon: null,
    })),
    ...ENDPOINT_STATES.map((key) => ({
      key,
      isDone: false,
      isCurrent: cas.status === key,
      icon: cas.status === key ? ENDPOINT_ICON[key] : null,
    })),
  ];
  return (
    <Card title="Case Timeline" icon={<IcoCheck size={16} color="#9B4DAB" />}>
      <div style={{ display: "flex", flexDirection: "column", marginBottom: 4 }}>
        {rows.map((row, i) => {
          const cfg = sCfg(row.key);
          return (
            <TimelineRow
              key={row.key}
              label={cfg.label}
              detail={stepDetail(row.key, cas)}
              dot={cfg.dot}
              color={cfg.color}
              bg={cfg.bg}
              icon={row.icon}
              isDone={row.isDone}
              isCurrent={row.isCurrent}
              last={i === rows.length - 1}
            />
          );
        })}
      </div>
      {!isDeleted && canPatch && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          <button className="rd-btn" onClick={onUpdateStatus}
            style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "none", background: "#C45E10", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "'Lexend',sans-serif" }}>
            <IcoCheck size={14} color="#fff" /> Update Assessment Status
          </button>
        </div>
      )}
      {isEndpoint && (() => { const n = ENDPOINT_NOTE[cas.status]; return (
        <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 4, background: n.bg, border: `1.5px solid ${n.border}`, display: "flex", gap: 10 }}>
          {ENDPOINT_ICON[cas.status]}
          <div><p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: n.color, fontFamily: "'Lexend',sans-serif" }}>{n.title}</p><p style={{ margin: 0, fontSize: 12, color: n.sub, lineHeight: 1.5, fontFamily: "'Lexend',sans-serif" }}>{n.body}</p></div>
        </div>
      ); })()}
    </Card>
  );
};

// ── Case actions (lawful VAWC): severity, mandatory report, BPO, endorsement, close ──
const inp = { width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: "1.5px solid var(--adm-border)", background: "var(--adm-card)", color: "var(--adm-text)", fontSize: 13, fontFamily: "'Lexend',sans-serif", outline: "none" };
const btnP = { padding: "9px 14px", borderRadius: 8, border: "none", background: "#9B4DAB", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Lexend',sans-serif", display: "inline-flex", alignItems: "center", gap: 7 };
// Small secondary button for undo / revert actions (accidental clicks).
const btnU = { padding: "4px 9px", borderRadius: 6, border: "1px solid var(--adm-border)", background: "var(--adm-card)", color: "var(--adm-text-2)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Lexend',sans-serif" };
const btnUDanger = { ...btnU, borderColor: "#FECACA", color: "#B91C1C" };
const lbl = { fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--adm-text-muted)", fontFamily: "'Lexend',sans-serif", marginBottom: 4, display: "block" };
const HRS4 = 4 * 60 * 60 * 1000;

const CaseActions = ({ cas, refetch, showToast }) => {
  const [busy, setBusy] = useState("");
  const activeBpo = (cas.bpos || []).find(b => ["applied", "issued", "served"].includes(b.status));
  const call = async (key, fn, okMsg) => {
    setBusy(key);
    try { await fn(); if (okMsg) showToast(okMsg); await refetch(); }
    catch (e) { showToast(e.response?.data?.detail || "Action failed.", false); }
    finally { setBusy(""); }
  };

  // Severity
  const [sev, setSev] = useState(cas.severity || "moderate");
  useEffect(() => { setSev(cas.severity || "moderate"); }, [cas.severity]);

  // BPO application reliefs
  const [reliefs, setReliefs] = useState({ physical: false, threats: false, stayaway: false });
  // Endorsement form
  const [endo, setEndo] = useState({ to_office: "pnp_iba_mps", purpose: "", docs: "" });
  // Close form
  const [close, setClose] = useState({ reason: "", note: "" });
  // Acknowledgment modal (replaces a raw browser prompt)
  const [ackFor, setAckFor] = useState(null);
  const [ackName, setAckName] = useState("");

  const overduePnp = !cas.reported_to_pnp_at && cas.created_at && (Date.now() - new Date(cas.created_at).getTime() > HRS4);
  const overdueMswdo = !cas.reported_to_mswdo_at && cas.created_at && (Date.now() - new Date(cas.created_at).getTime() > HRS4);
  const daysLeft = (b) => b.expires_at ? Math.ceil((new Date(b.expires_at).getTime() - Date.now()) / 86400000) : null;

  return (
    <Card title="Case Actions" icon={<IcoShield size={16} color="#9B4DAB" />}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

        {/* Severity */}
        <div>
          <span style={lbl}>Severity / Triage</span>
          <div style={{ display: "flex", gap: 8 }}>
            <select style={{ ...inp, flex: 1 }} value={sev} onChange={e => setSev(e.target.value)}>
              {SEVERITIES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <button className="rd-btn" style={{ ...btnP, opacity: busy === "sev" ? 0.7 : 1 }} disabled={busy === "sev" || sev === cas.severity}
              onClick={() => call("sev", () => api.patch(`/admin/cases/${cas.id}/severity`, { severity: sev }), "Severity updated.")}>
              {busy === "sev" ? <Spinner size={12} /> : "Set"}
            </button>
          </div>
          {sev === "critical" && <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "#DC2626", fontFamily: "'Lexend',sans-serif" }}>Critical: immediate endorsement to PNP is recommended.</p>}
        </div>

        {/* Mandatory reporting (4-hour clock) */}
        <div>
          <span style={lbl}>Mandatory Report (within 4 hours)</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[["pnp", "PNP", cas.reported_to_pnp_at, overduePnp], ["mswdo", "C/MSWDO", cas.reported_to_mswdo_at, overdueMswdo]].map(([office, name, at, overdue]) => (
              <div key={office} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--adm-text)", minWidth: 74, fontFamily: "'Lexend',sans-serif" }}>{name}</span>
                {at
                  ? <>
                      <span style={{ fontSize: 12, color: "#059669", fontFamily: "'Lexend',sans-serif" }}>Reported {fmt(at)}</span>
                      <button style={btnU} disabled={busy === "undo" + office} title="Undo an accidental mark"
                        onClick={async () => {
                          if (await confirmDialog({ title: `Undo ${name} report?`, message: `The recorded date and time of reporting to ${name} will be cleared. The 4-hour compliance clock will show this case as not yet reported.`, confirmLabel: "Undo" }))
                            call("undo" + office, () => api.patch(`/admin/cases/${cas.id}/mandatory-report`, { office, clear: true }), `Cleared ${name} report.`);
                        }}>
                        Undo
                      </button>
                    </>
                  : <>
                      {overdue && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#991B1B", background: "#FEF2F2", border: "1px solid #FECACA", padding: "1px 7px", borderRadius: 9999 }}>OVERDUE</span>}
                      <button className="rd-btn" style={{ ...btnP, background: "#0E7490", padding: "5px 10px", fontSize: 12 }} disabled={busy === "rpt" + office}
                        onClick={() => call("rpt" + office, () => api.patch(`/admin/cases/${cas.id}/mandatory-report`, { office }), `Marked reported to ${name}.`)}>
                        Mark reported
                      </button>
                    </>}
              </div>
            ))}
          </div>
        </div>

        {/* BPO */}
        <div>
          <span style={lbl}>Barangay Protection Order</span>
          {(cas.bpos || []).length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
              {cas.bpos.map(b => {
                const dl = daysLeft(b);
                return (
                  <div key={b.id} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--adm-border)", background: "var(--adm-muted)", fontSize: 12, fontFamily: "'Lexend',sans-serif" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <strong style={{ color: "var(--adm-text)" }}>{b.bpo_number}</strong>
                      <span style={{ color: "#7B2D8B", fontWeight: 700, textTransform: "capitalize" }}>{b.status}</span>
                    </div>
                    {b.issued_at && <div style={{ color: "var(--adm-text-muted)", marginTop: 2 }}>Issued {fmtDate(b.issued_at)} · Expires {fmtDate(b.expires_at)}{dl != null && b.status === "issued" ? ` (${dl} day${dl === 1 ? "" : "s"} left)` : ""}</div>}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
                      {b.status === "applied" && !cas.is_deleted && (
                        <button className="rd-btn" style={{ ...btnP, background: "#C45E10", padding: "5px 12px", fontSize: 12 }} disabled={busy === "issue" + b.id}
                          onClick={() => call("issue" + b.id, () => api.patch(`/admin/bpos/${b.id}/issue`), "BPO issued (valid 15 days).")}>Issue BPO</button>
                      )}
                      {b.status === "issued" && !cas.is_deleted && (
                        <button className="rd-btn" style={{ ...btnP, background: "#B45309", padding: "5px 12px", fontSize: 12 }} disabled={busy === "serve" + b.id}
                          onClick={() => call("serve" + b.id, () => api.patch(`/admin/bpos/${b.id}/serve`, {}), "BPO marked served.")}>Mark Served</button>
                      )}
                      {/* Undo an accidental click */}
                      {["issued", "served"].includes(b.status) && !cas.is_deleted && (
                        <button style={btnU} disabled={busy === "rev" + b.id}
                          title={b.status === "served" ? "Undo 'served' (back to issued)" : "Undo 'issued' (back to application; clears issue date and expiry)"}
                          onClick={async () => {
                            const ok = await confirmDialog(b.status === "served"
                              ? { title: "Undo 'served'?", message: `BPO ${b.bpo_number} will go back to Issued. The service date, server and proof of service will be cleared.`, confirmLabel: "Undo serve" }
                              : { title: "Undo 'issued'?", message: `BPO ${b.bpo_number} will go back to an application. The issue date, 15-day expiry and signing official will be cleared.`, confirmLabel: "Undo issue" });
                            if (ok) call("rev" + b.id, () => api.patch(`/admin/bpos/${b.id}/revert`), "BPO reverted.");
                          }}>
                          Undo {b.status === "served" ? "serve" : "issue"}
                        </button>
                      )}
                      {b.status === "applied" && !cas.is_deleted && (
                        <button style={btnUDanger} disabled={busy === "del" + b.id} title="Delete this BPO application"
                          onClick={async () => {
                            if (await confirmDialog({ title: "Delete BPO application?", message: `${b.bpo_number} was never issued, so no official order is lost. This cannot be undone.`, confirmLabel: "Delete", danger: true }))
                              call("del" + b.id, () => api.delete(`/admin/bpos/${b.id}`), "BPO application deleted.");
                          }}>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!activeBpo && !cas.is_deleted && (
            <div style={{ padding: "10px", borderRadius: 8, border: "1px dashed var(--adm-border)" }}>
              <p style={{ margin: "0 0 6px", fontSize: 11.5, color: "var(--adm-text-muted)", fontFamily: "'Lexend',sans-serif" }}>Reliefs (BPO form a, b, c):</p>
              {[["physical", "Stop acts of physical harm"], ["threats", "Stop threats of harm"], ["stayaway", "Stay away (100m)"]].map(([k, t]) => (
                <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--adm-text)", fontFamily: "'Lexend',sans-serif", marginBottom: 4 }}>
                  <input type="checkbox" checked={reliefs[k]} onChange={e => setReliefs(r => ({ ...r, [k]: e.target.checked }))} style={{ accentColor: "#9B4DAB" }} />{t}
                </label>
              ))}
              <button className="rd-btn" style={{ ...btnP, marginTop: 6 }} disabled={busy === "bpo"}
                onClick={() => call("bpo", () => api.post(`/admin/cases/${cas.id}/bpo`, {
                  relief_stop_physical_harm: reliefs.physical, relief_stop_threats: reliefs.threats, relief_stay_away_100m: reliefs.stayaway,
                }), "BPO application created.")}>
                {busy === "bpo" ? <Spinner size={12} /> : "Apply for BPO"}
              </button>
            </div>
          )}
          {activeBpo && <p style={{ margin: 0, fontSize: 11, color: "var(--adm-text-muted)", fontFamily: "'Lexend',sans-serif" }}>A BPO cannot be renewed or extended. A new BPO requires a new incident report.</p>}
        </div>

        {/* Endorsements */}
        <div>
          <span style={lbl}>Endorsements</span>
          {(cas.endorsements || []).map(e => (
            <div key={e.id} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--adm-border)", background: "var(--adm-muted)", fontSize: 12, fontFamily: "'Lexend',sans-serif", marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ color: "var(--adm-text)" }}>#{e.endorsement_number} → {e.to_office_display || e.to_office}</strong>
                <span style={{ color: e.acknowledged ? "#059669" : "#C45E10", fontWeight: 700 }}>{e.acknowledged ? "Acknowledged" : "Awaiting ack"}</span>
              </div>
              <div style={{ color: "var(--adm-text-muted)", marginTop: 2 }}>Endorsed {fmtDate(e.date_endorsed)}{e.received_at ? ` · Received ${fmtDate(e.received_at)} by ${e.received_by || "-"}` : ""}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
                {!e.acknowledged && !cas.is_deleted && (
                  <button className="rd-btn" style={{ ...btnP, background: "#059669", padding: "5px 12px", fontSize: 12 }} disabled={busy === "ack" + e.id}
                    onClick={() => { setAckFor(e); setAckName(""); }}>
                    Mark Acknowledged
                  </button>
                )}
                {e.acknowledged && !cas.is_deleted && (
                  <button style={btnU} disabled={busy === "unack" + e.id} title="Undo an accidental acknowledgment"
                    onClick={async () => {
                      if (await confirmDialog({ title: "Remove acknowledgment?", message: `Endorsement #${e.endorsement_number} will go back to awaiting receipt. The receiver's name and date will be cleared.`, confirmLabel: "Remove" }))
                        call("unack" + e.id, () => api.patch(`/admin/endorsements/${e.id}/unacknowledge`), "Acknowledgment removed.");
                    }}>
                    Undo ack
                  </button>
                )}
                {!cas.is_deleted && (
                  <button style={btnUDanger} disabled={busy === "dele" + e.id} title="Delete this endorsement"
                    onClick={async () => {
                      if (await confirmDialog({ title: "Delete endorsement?", message: `Endorsement #${e.endorsement_number} will be removed and the case steps back to its previous stage. This cannot be undone.`, confirmLabel: "Delete", danger: true }))
                        call("dele" + e.id, () => api.delete(`/admin/endorsements/${e.id}`), "Endorsement deleted.");
                    }}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
          {!cas.is_deleted && (
            <div style={{ padding: "10px", borderRadius: 8, border: "1px dashed var(--adm-border)", marginTop: 4 }}>
              <select style={{ ...inp, marginBottom: 6 }} value={endo.to_office} onChange={e => setEndo(x => ({ ...x, to_office: e.target.value }))}>
                {ENDORSE_OFFICES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              <input style={{ ...inp, marginBottom: 6 }} placeholder="Purpose (e.g. for filing / assistance)" value={endo.purpose} onChange={e => setEndo(x => ({ ...x, purpose: e.target.value }))} />
              <button className="rd-btn" style={btnP} disabled={busy === "endo"}
                onClick={() => call("endo", () => api.post(`/admin/cases/${cas.id}/endorsements`, {
                  to_office: endo.to_office, purpose: endo.purpose || null,
                  attached_documents: endo.docs ? endo.docs.split(",").map(s => s.trim()).filter(Boolean) : [],
                }), "Endorsement created.")}>
                {busy === "endo" ? <Spinner size={12} /> : "Create Endorsement"}
              </button>
            </div>
          )}
        </div>

        {/* Close */}
        {cas.status !== "closed" && !cas.is_deleted && (
          <div>
            <span style={lbl}>End Barangay Assistance (with reason)</span>
            <select style={{ ...inp, marginBottom: 6 }} value={close.reason} onChange={e => setClose(x => ({ ...x, reason: e.target.value }))}>
              <option value="">Select a reason…</option>
              {CLOSURE_REASONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            <input style={{ ...inp, marginBottom: 6 }} placeholder="Optional note" value={close.note} onChange={e => setClose(x => ({ ...x, note: e.target.value }))} />
            <button className="rd-btn" style={{ ...btnP, background: "#475569", opacity: close.reason ? 1 : 0.5 }} disabled={!close.reason || busy === "close"}
              onClick={() => call("close", () => api.patch(`/admin/cases/${cas.id}/close`, { closure_reason: close.reason, closure_note: close.note || null }), "Barangay assistance ended.")}>
              {busy === "close" ? <Spinner size={12} /> : "End Assistance"}
            </button>
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--adm-text-muted)", lineHeight: 1.5, fontFamily: "'Lexend',sans-serif" }}>
              This ends the barangay's assistance only. It does not close or dismiss the case, which only a court can do, and it is never marked "resolved" or "settled".
            </p>
          </div>
        )}
        {cas.closure_reason && (
          <div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--adm-muted)", border: "1px solid var(--adm-border)", fontSize: 12, color: "var(--adm-text-2)", fontFamily: "'Lexend',sans-serif" }}>
            <strong style={{ color: "var(--adm-text)" }}>Assistance ended:</strong> {cas.closure_reason_display || cas.closure_reason}{cas.closure_note ? `. ${cas.closure_note}` : ""}
            {!cas.is_deleted && (
              <div style={{ marginTop: 8 }}>
                <button style={btnU} disabled={busy === "reopen"} title="Undo an accidental entry"
                  onClick={async () => {
                    if (await confirmDialog({ title: "Resume barangay assistance?", message: "The recorded reason will be cleared and the case returns to the stage its records support.", confirmLabel: "Resume" }))
                      call("reopen", () => api.patch(`/admin/cases/${cas.id}/reopen`), "Assistance resumed.");
                  }}>
                  Resume assistance
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Acknowledgment modal */}
      {ackFor && (
        <div style={M.backdrop} onClick={() => setAckFor(null)}>
          <div style={{ ...M.modal, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <p style={M.title}>Acknowledge Endorsement #{ackFor.endorsement_number}</p>
            <p style={M.sub}>Record who at {ackFor.to_office_display || ackFor.to_office} received it.</p>
            <input autoFocus value={ackName} onChange={e => setAckName(e.target.value)}
              placeholder="Received by (name / designation)"
              onKeyDown={e => { if (e.key === "Enter" && ackName.trim()) { const t = ackFor; setAckFor(null); call("ack" + t.id, () => api.patch(`/admin/endorsements/${t.id}/acknowledge`, { received_by: ackName.trim() }), "Endorsement acknowledged."); } }}
              style={{ ...inp, marginTop: 14 }} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button style={M.cancelBtn} onClick={() => setAckFor(null)}>Cancel</button>
              <button style={{ ...M.saveBtn, background: ackName.trim() ? "#059669" : "var(--adm-border)", cursor: ackName.trim() ? "pointer" : "not-allowed" }}
                disabled={!ackName.trim()}
                onClick={() => { const t = ackFor; setAckFor(null); call("ack" + t.id, () => api.patch(`/admin/endorsements/${t.id}/acknowledge`, { received_by: ackName.trim() }), "Endorsement acknowledged."); }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

const PrintPanel = ({ cas }) => {
  const navigate = useNavigate();
  // The BPO packet already contains the Application, the BPO and the Pormal na
  // Reklamo, so those are not listed separately — print a page range instead.
  const docs = [
    { key: "blotter",     label: "Blotter Form",     sub: "Statement, first step in filing" },
    { key: "bpo-app",     label: "BPO Application",  sub: "3 pages: Application, BPO, Pormal na Reklamo" },
    { key: "endorsement", label: "1st Endorsement",  sub: "Referral to the Chief of Police, Iba MPS" },
  ];
  return (
    <Card title="Print Documents" icon={<IcoPrint size={16} color="#475569" />}>
      <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--adm-text-muted)", fontFamily: "'Lexend',sans-serif" }}>Auto-fill official barangay documents.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {docs.map(doc => (
          <button key={doc.key} className="rd-btn"
            onClick={() => navigate(`/print/${doc.key}/${cas.id}`)}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 10, border: "1.5px solid var(--adm-border)", background: "var(--adm-card)", cursor: "pointer", textAlign: "left", width: "100%" }}>
            <IcoPrint size={17} color="#64748B" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: "0 0 2px", fontSize: 13.5, fontWeight: 700, color: "var(--adm-text)", fontFamily: "'Lexend',sans-serif" }}>{doc.label}</p>
              <p style={{ margin: 0, fontSize: 11.5, color: "var(--adm-text-muted)", fontFamily: "'Lexend',sans-serif" }}>{doc.sub}</p>
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
  const [editRespondent, setEditRespondent] = useState(false);
  const [savingRespondent, setSavingRespondent] = useState(false);
  const [editRelationship, setEditRelationship] = useState(false);
  const [savingRelationship, setSavingRelationship] = useState(false);

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

  const handleRespondentSave = async (name) => {
    setSavingRespondent(true);
    try {
      const res = await api.patch(`/admin/cases/${id}/respondent`, { offender_name: name });
      setCas(c => ({ ...c, offender_name: res.data?.offender_name || name }));
      setEditRespondent(false);
      showToast("Respondent name updated.");
    } catch (err) { showToast(err.response?.data?.detail || "Failed to update respondent.", false); }
    finally { setSavingRespondent(false); }
  };

  const handleRelationshipSave = async (value) => {
    setSavingRelationship(true);
    try {
      const res = await api.patch(`/admin/cases/${id}/relationship`, { relationship_to_offender: value });
      setCas(c => ({
        ...c,
        relationship_to_offender: res.data?.relationship_to_offender || value,
        relationship_to_offender_display: res.data?.relationship_to_offender_display || value,
      }));
      setEditRelationship(false);
      showToast("Relationship updated.");
    } catch (err) { showToast(err.response?.data?.detail || "Failed to update relationship.", false); }
    finally { setSavingRelationship(false); }
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
          <div key={i} style={{ background: "linear-gradient(90deg,var(--adm-muted) 25%,var(--adm-border) 50%,var(--adm-muted) 75%)", borderRadius: 4, height: h, marginBottom: 16, backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
        ))}
      </div>
    </AdminLayout>
  );

  if (error) return (
    <AdminLayout>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "50vh" }}>
        <IcoWarn size={36} color="#CBD5E1" />
        <p style={{ fontWeight: 600, color: "var(--adm-text)", margin: "12px 0 6px", fontFamily: "'Lexend',sans-serif" }}>Case not found</p>
        <p style={{ color: "var(--adm-text-muted)", fontSize: 13, margin: "0 0 20px", fontFamily: "'Lexend',sans-serif" }}>{error}</p>
        <button onClick={() => navigate("/reports")} style={{ padding: "8px 20px", borderRadius: 4, border: "1.5px solid var(--adm-border)", background: "var(--adm-card)", color: "var(--adm-text-2)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Lexend',sans-serif" }}>← Back to Reports</button>
      </div>
    </AdminLayout>
  );

  const victim = cas.victim || {};
  // Newest report on top; number by chronological filing order (oldest = Report 1).
  const reports = [...(cas.reports || [])].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  const reportNo = (idx) => reports.length - idx;
  const cfg = sCfg(cas.status);
  const isMinor = victim.is_minor || false;
  const victimName = cas.victim_name || [victim.first_name, victim.middle_name, victim.last_name].filter(Boolean).join(" ") || "-";

  return (
    <AdminLayout breadcrumbs={[{ label: "Profiles", onClick: () => navigate("/reports") }, victimName, cas.case_number, "Reports"]}>
      <style>{CSS}</style>
      <div style={{ maxWidth: 1200, fontFamily: "'Lexend',sans-serif" }}>

        {/* Restricted-view banner - non–super admins see masked sensitive fields */}
        {cas.restricted && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#FFF3E0", border: "1.5px solid #FFCC99", borderRadius: 12, marginBottom: 16, fontFamily: "'Lexend',sans-serif" }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: "#F47920", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="11" width="18" height="11" rx="2" stroke="#fff" strokeWidth="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#9A3412", fontFamily: "'Lexend',sans-serif" }}>Restricted view</p>
              <p style={{ margin: "1px 0 0", fontSize: 12, color: "#7C2D12", lineHeight: 1.45, fontFamily: "'Lexend',sans-serif" }}>
                Sensitive fields (offender name, victim contact details, full statement, location, photos) are masked. Super Admin access is required to view full case data.
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => navigate("/reports")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--adm-muted)", border: "1px solid var(--adm-border)", borderRadius: 4, cursor: "pointer", color: "var(--adm-text-2)", fontSize: 13, fontWeight: 600, padding: "6px 12px", marginBottom: 14, fontFamily: "'Lexend',sans-serif" }}>
            <svg width="13" height="13" fill="none" viewBox="0 0 20 20"><path d="M12.5 5l-5 5 5 5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg>
            Back to Reports
          </button>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--adm-text)", fontFamily: "'Lexend',sans-serif" }}>{cas.case_number}</h1>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: "var(--adm-text-2)", background: "var(--adm-muted)", border: "1px solid var(--adm-border)", fontFamily: "'Lexend',sans-serif" }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot }} />{cas.status_display || cfg.label}
                </span>
                {isMinor && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: "#FEF3C7", color: "#92400E", fontFamily: "'Lexend',sans-serif" }}>
                    Minor
                  </span>
                )}
                {cas.is_deleted && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: "#FEF2F2", color: "#991B1B", fontFamily: "'Lexend',sans-serif" }}><IcoTrash size={11} color="#991B1B" /> Deleted</span>}
              </div>
              <p style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 700, color: "var(--adm-text)", fontFamily: "'Lexend',sans-serif" }}>vs. <span style={{ color: "#7B2D8B" }}>{cas.offender_name}</span></p>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--adm-text-muted)", fontFamily: "'Lexend',sans-serif" }}>Filed {fmt(cas.created_at)}</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {!cas.is_deleted
                ? <button className="rd-btn" onClick={() => setShowDeleteConfirm(true)}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid #FECACA", background: "#FEF2F2", color: "#991B1B", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Lexend',sans-serif" }}>
                  Delete Case
                </button>
                : <button className="rd-btn" onClick={() => setShowRecover(true)}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid #A7F3D0", background: "#ECFDF5", color: "#065F46", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Lexend',sans-serif" }}>
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
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--adm-border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <IcoGuardian size={14} color="#9B4DAB" />
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--adm-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "'Lexend',sans-serif" }}>Minor / Guardian</span>
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
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "var(--adm-card)", border: "1px solid var(--adm-border)", padding: "10px 14px", borderRadius: 4, boxShadow: "0 1px 3px rgba(15,23,42,0.05)" }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--adm-text-muted)", fontFamily: "'Lexend',sans-serif", marginRight: 4 }}>
                  Jump to:
                </span>
                {reports.map((r, idx) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => document.getElementById(`report-${reportNo(idx)}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 9999,
                      border: "1.5px solid #E1BEE7",
                      background: "#F3E5F5",
                      color: "#4A1259",
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "'Lexend',sans-serif",
                      transition: "all 0.12s ease",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#9B4DAB"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#9B4DAB"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#F3E5F5"; e.currentTarget.style.color = "#4A1259"; e.currentTarget.style.borderColor = "#E1BEE7"; }}
                  >
                    Report {reportNo(idx)}
                  </button>
                ))}
              </div>
            )}

            {reports.map((r, idx) => (
              <div key={r.id} id={`report-${reportNo(idx)}`} style={{ scrollMarginTop: 80 }}>
                <Card title={`Report ${reportNo(idx)}`} icon={<IcoClip size={16} color="#9B4DAB" />}
                  headerRight={
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, fontFamily: "'Lexend',sans-serif" }}>
                        <DateChip prefix="Submitted">{fmt(r.created_at)}</DateChip>
                        {r.updated_at && new Date(r.updated_at) - new Date(r.created_at) > 60000 && (
                          <span style={{ fontSize: 10.5, color: "var(--adm-text-muted)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                            edited {fmt(r.updated_at)}
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
                          style={{ padding: "4px 10px", borderRadius: 4, border: "1.5px solid #FECACA", background: "#FEF2F2", color: "#991B1B", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "'Lexend',sans-serif" }}>
                          Delete
                        </button>
                      )}
                    </div>
                  }>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <p style={{ margin: "0 0 8px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--adm-text-muted)", fontFamily: "'Lexend',sans-serif" }}>Incident Type</p>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <select value={incidentTypes[r.id] || ""} onChange={e => setIncidentTypes(p => ({ ...p, [r.id]: e.target.value }))}
                          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1.5px solid var(--adm-border)", fontSize: 13.5, color: "var(--adm-text)", background: "var(--adm-muted)", outline: "none", fontFamily: "'Lexend',sans-serif" }}
                          onFocus={e => { e.target.style.borderColor = "#9B4DAB"; e.target.style.background = "#fff"; }}
                          onBlur={e => { e.target.style.borderColor = "var(--adm-border)"; e.target.style.background = "var(--adm-muted)"; }}>
                          <option value="">- Not classified -</option>
                          {INCIDENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                        </select>
                        <button onClick={() => handleIncidentTypeSave(r.id)}
                          disabled={incidentTypes[r.id] === (r.incident_type || "")}
                          style={{ padding: "8px 14px", borderRadius: 4, border: "none", background: incidentTypes[r.id] === (r.incident_type || "") ? "var(--adm-border)" : "#9B4DAB", color: incidentTypes[r.id] === (r.incident_type || "") ? "#94A3B8" : "#fff", fontSize: 13, fontWeight: 600, cursor: incidentTypes[r.id] === (r.incident_type || "") ? "not-allowed" : "pointer", fontFamily: "'Lexend',sans-serif" }}>
                          Save
                        </button>
                      </div>
                    </div>
                    {r.incident_date && (
                      <div>
                        <p style={{ margin: "0 0 4px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--adm-text-muted)", fontFamily: "'Lexend',sans-serif" }}>Date of Incident</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <IcoCal size={14} color="#9B4DAB" />
                          <span style={{ fontSize: 13.5, color: "var(--adm-text)", fontWeight: 600, fontFamily: "'Lexend',sans-serif" }}>{fmtDate(r.incident_date)}</span>
                        </div>
                      </div>
                    )}
                    {r.address && <InfoRow label="Reported Location" value={r.address} />}
                    <div>
                      <p style={{ margin: "0 0 8px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--adm-text-muted)", fontFamily: "'Lexend',sans-serif" }}>Statement</p>
                      {r.statement
                        /* The complainant's own words are the most important content
                           on this page, so they get full-strength text, not the
                           secondary tone used for supporting copy. */
                        ? <div style={{ background: "var(--adm-muted)", borderRadius: 4, padding: "14px 16px", fontSize: 13.5, color: "var(--adm-text)", lineHeight: 1.75, borderLeft: "3px solid #E1BEE7", whiteSpace: "pre-wrap", fontFamily: "'Lexend',sans-serif" }}>{r.statement}</div>
                        : <div style={{ background: "var(--adm-muted)", borderRadius: 4, padding: "14px 16px", fontSize: 13, color: "var(--adm-text-muted)", fontStyle: "italic", borderLeft: "3px solid var(--adm-border)", fontFamily: "'Lexend',sans-serif" }}>No statement provided.</div>
                      }
                    </div>
                    {r.photo_urls?.length > 0 && (
                      <div>
                        <p style={{ margin: "0 0 8px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--adm-text-muted)", fontFamily: "'Lexend',sans-serif" }}>Evidence Photos ({r.photo_urls.length})</p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(100px,1fr))", gap: 8 }}>
                          {r.photo_urls.map((url, i) => (
                            <div key={i} onClick={() => setLightbox(url)} style={{ aspectRatio: "1", borderRadius: 4, overflow: "hidden", cursor: "zoom-in", border: "1px solid var(--adm-border)" }}>
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
                        <p style={{ margin: "0 0 8px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--adm-text-muted)", fontFamily: "'Lexend',sans-serif" }}>Evidence Photos ({r.photo_count}) - Restricted</p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(100px,1fr))", gap: 8 }}>
                          {Array.from({ length: r.photo_count }).map((_, i) => (
                            <div key={i} title="Super Admin access required to view"
                              style={{ aspectRatio: "1", borderRadius: 4, overflow: "hidden", border: "1.5px solid #FFCC99", background: "repeating-linear-gradient(45deg, #FFF3E0, #FFF3E0 8px, #FFEDD5 8px, #FFEDD5 16px)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 4 }}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <rect x="3" y="11" width="18" height="11" rx="2" stroke="#9A3412" strokeWidth="2" />
                                <path d="M7 11V7a5 5 0 0110 0v4" stroke="#9A3412" strokeWidth="2" strokeLinecap="round" />
                              </svg>
                              <span style={{ fontSize: 9, fontWeight: 700, color: "#9A3412", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'Lexend',sans-serif" }}>Locked</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {(r.latitude && r.longitude) && (
                      <a href={`https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`} target="_blank" rel="noopener noreferrer" className="rd-map"
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 4, border: "1.5px solid var(--adm-border)", color: "var(--adm-text-2)", fontSize: 13, fontWeight: 600, textDecoration: "none", fontFamily: "'Lexend',sans-serif" }}>
                        <IcoPin size={14} color="#94A3B8" /> View on Google Maps
                      </a>
                    )}
                    {/* Restricted: location masked */}
                    {r.restricted && !r.latitude && !r.longitude && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 4, border: "1.5px dashed #FFCC99", color: "#9A3412", fontSize: 13, fontWeight: 600, fontFamily: "'Lexend',sans-serif", background: "#FFF3E0", width: "fit-content" }}>
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
                <InfoRow
                  label="Respondent"
                  value={cas.offender_name}
                  action={!cas.is_deleted && (
                    <button
                      type="button"
                      className="rd-btn"
                      onClick={() => setEditRespondent(true)}
                      title="Correct the respondent's name"
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "1px 7px", borderRadius: 9999, border: "1px solid var(--adm-border)", background: "transparent", color: "var(--adm-text-muted)", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Lexend',sans-serif" }}>
                      <IcoEdit size={10} color="currentColor" /> Edit
                    </button>
                  )}
                />
                {/* The victim states this at intake and it decides whether RA 9262
                    applies, so the officer taking the statement in person needs to
                    see it and be able to correct a mis-tap. */}
                <InfoRow
                  label="Relationship to Respondent"
                  value={cas.relationship_to_offender_display || "Not stated"}
                  muted={!cas.relationship_to_offender}
                  action={!cas.is_deleted && (
                    <button
                      type="button"
                      className="rd-btn"
                      onClick={() => setEditRelationship(true)}
                      title="Correct the victim's relationship to the respondent"
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "1px 7px", borderRadius: 9999, border: "1px solid var(--adm-border)", background: "transparent", color: "var(--adm-text-muted)", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Lexend',sans-serif" }}>
                      <IcoEdit size={10} color="currentColor" /> Edit
                    </button>
                  )}
                />
                <InfoRow label="Date Submitted" value={fmt(cas.created_at)} highlight />
                <InfoRow label="Last Updated" value={fmt(cas.updated_at)} />
                {cas.admin_id && <InfoRow label="Handled By" value={cas.handled_by || `Admin #${cas.admin_id}`} />}
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
            <CaseTimeline cas={cas} onUpdateStatus={() => setShowStatusModal(true)} />
            {!cas.is_deleted && <CaseActions cas={cas} refetch={fetchCase} showToast={showToast} />}

            {isSuperAdmin && !cas.is_deleted && (
              <Card title="Message to Victim" icon={<IcoClip size={16} color="#F47920" />}>
                <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--adm-text-muted)", lineHeight: 1.5, fontFamily: "'Lexend',sans-serif" }}>
                  Send a note to the victim at any stage - e.g. an update, or the schedule and venue of the hearing. They are notified by email and in their portal.
                </p>
                {cas.messages && cas.messages.length > 0 && (
                  <button className="rd-btn" onClick={() => setShowMessageLogs(true)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", marginBottom: 10, padding: "9px 0", borderRadius: 8, border: "1.5px solid #E1BEE7", background: "#F3E5F5", color: "#7B2D8B", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "'Lexend',sans-serif" }}>
                    <IcoClip size={13} color="#7B2D8B" /> Open message logs ({cas.messages.length})
                  </button>
                )}
                <textarea value={messageText} onChange={e => setMessageText(e.target.value)} rows={4}
                  /* No background was set, so it fell back to the browser default
                     white while the text used var(--adm-text) — light on white. */
                  style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid var(--adm-border)", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontFamily: "'Lexend',sans-serif", color: "var(--adm-text)", background: "var(--adm-input)", outline: "none", resize: "vertical" }} />

                {/* Channel selection */}
                <div style={{ display: "flex", gap: 18, alignItems: "center", margin: "10px 0 3px" }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--adm-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'Lexend',sans-serif" }}>Send via</span>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--adm-text-2)", cursor: "pointer", fontFamily: "'Lexend',sans-serif" }}>
                    <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} style={{ accentColor: "#7B2D8B" }} /> Email
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--adm-text-2)", cursor: "pointer", fontFamily: "'Lexend',sans-serif" }}>
                    <input type="checkbox" checked={sendSms} onChange={e => setSendSms(e.target.checked)} style={{ accentColor: "#7B2D8B" }} /> SMS
                  </label>
                </div>
                {sendSms && (
                  <p style={{ margin: "0 0 6px", fontSize: 11, color: "var(--adm-text-muted)", lineHeight: 1.45, fontFamily: "'Lexend',sans-serif" }}>
                    SMS uses Semaphore credits; long messages may use more than one credit.
                  </p>
                )}

                <button className="rd-btn" onClick={handleSendMessage} disabled={sendingMessage || !messageText.trim() || (!sendEmail && !sendSms)}
                  style={{ width: "100%", marginTop: 7, padding: "10px 0", borderRadius: 8, border: "none", background: (messageText.trim() && (sendEmail || sendSms)) ? "#C45E10" : "var(--adm-border)", color: (messageText.trim() && (sendEmail || sendSms)) ? "#fff" : "#94A3B8", fontSize: 13.5, fontWeight: 600, cursor: (sendingMessage || !messageText.trim() || (!sendEmail && !sendSms)) ? "not-allowed" : "pointer", fontFamily: "'Lexend',sans-serif" }}>
                  {sendingMessage ? "Sending…" : "Send Message"}
                </button>
              </Card>
            )}

            <PrintPanel cas={cas} />
          </div>
        </div>
      </div>

      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 999, background: "var(--adm-card)", border: `1px solid ${toast.success ? "#A7F3D0" : "#FECACA"}`, borderRadius: 4, padding: "12px 18px", boxShadow: "0 8px 24px rgba(0,0,0,0.10)", display: "flex", alignItems: "center", gap: 9, animation: "slideDown 0.2s ease", fontSize: 13.5, color: toast.success ? "#065F46" : "#991B1B", fontWeight: 500, fontFamily: "'Lexend',sans-serif" }}>
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
      {editRespondent && <RespondentModal current={cas.offender_name} onClose={() => setEditRespondent(false)} onSave={handleRespondentSave} saving={savingRespondent} />}
      {editRelationship && <RelationshipModal current={cas.relationship_to_offender} onClose={() => setEditRelationship(false)} onSave={handleRelationshipSave} saving={savingRelationship} />}
      {showDeleteConfirm && <DeleteModal caseId={cas.case_number} loading={actionLoading} onConfirm={handleDelete} onClose={() => setShowDeleteConfirm(false)} />}
      {showRecover && <ConfirmModal title="Recover Case" message={`Restore case ${cas.case_number}?`} confirmLabel="Recover" danger={false} loading={actionLoading} onConfirm={handleRecover} onClose={() => setShowRecover(false)} />}

      {showMessageLogs && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setShowMessageLogs(false)}>
          <div style={{ background: "var(--adm-card)", borderRadius: 20, width: "100%", maxWidth: 500, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(15,23,42,0.3)", fontFamily: "'Lexend',sans-serif", overflow: "hidden", animation: "slideDown 0.22s ease" }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 22px", borderBottom: "1px solid var(--adm-border)", background: "linear-gradient(135deg, #FBF3FC 0%, #F3E5F5 100%)" }}>
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
                  <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--adm-text-muted)" }}>No messages yet.</p>
                </div>
              ) : (cas.messages || []).map((m, i) => {
                const isTmp = String(m.id).startsWith("tmp-");
                const isLatest = i === 0;
                return (
                  <div key={m.id} style={{ background: "var(--adm-card)", border: "1px solid #EEE6F1", borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 7 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        <span style={{ fontSize: 11, color: "var(--adm-text-muted)", fontWeight: 500 }}>{fmt(m.created_at)}</span>
                        {isLatest && <span style={{ fontSize: 9, fontWeight: 800, color: "#C45E10", background: "#FFF3E0", padding: "2px 7px", borderRadius: 9999, textTransform: "uppercase", letterSpacing: "0.05em" }}>Latest</span>}
                      </span>
                      <button onClick={() => handleDeleteLogMessage(m.id)} disabled={deletingMsgId === m.id || isTmp}
                        title={isTmp ? "Reload the page to delete a just-sent message" : "Delete this message"}
                        style={{ width: 26, height: 26, borderRadius: 8, border: "none", background: "transparent", cursor: (deletingMsgId === m.id || isTmp) ? "not-allowed" : "pointer", opacity: (deletingMsgId === m.id || isTmp) ? 0.35 : 1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <IcoTrash size={15} color="#DC2626" />
                      </button>
                    </div>
                    <p style={{ margin: "0 0 9px", fontSize: 13.5, color: "var(--adm-text)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{m.message}</p>
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
                      {m.sent_by && <span style={{ fontSize: 10.5, color: "var(--adm-text-muted)" }}>by {m.sent_by}</span>}
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
