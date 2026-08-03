import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "../components/Sidebar";
import { confirmDialog } from "../components/ConfirmDialog";
import api from "../api/api";

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

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
  @keyframes shimmer   { 0%{background-position:200% 0}100%{background-position:-200% 0} }
  @keyframes slideDown { from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)} }
  .row-hover:hover td  { background:#F3E5F5 !important; cursor:pointer; }
  .row-hover td        { transition:background 0.1s; }
  .back-btn:hover      { background:#F1F5F9 !important; }
  .recover-btn:hover:not([disabled]) { background:#059669 !important; color:#fff !important; }
  .recover-btn         { transition:all 0.15s; }
  .search-input:focus  { border-color:#9B4DAB !important; outline:none; }
`;

const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "-";
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }) : "";
const truncate = (s, n) => !s ? "-" : s.length > n ? s.slice(0, n) + "…" : s;
const daysLeft = (d) => !d ? 0 : Math.max(0, 30 - Math.floor((Date.now() - new Date(d).getTime()) / 86400000));

const IcoSearch = () => (<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="9" cy="9" r="6" stroke="#94A3B8" strokeWidth="1.8" /><path d="M13.5 13.5L17 17" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" /></svg>);
const IcoUser = ({ size = 32, color = "#9B4DAB" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.8" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth="1.8" strokeLinecap="round" /></svg>);
const IcoFolder = ({ size = 14, color = "#7B2D8B" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoDoc = ({ size = 32, color = "#CBD5E1" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoChevron = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#9B4DAB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoBack = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoWarn = ({ size = 20 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><line x1="12" y1="9" x2="12" y2="13" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" /><line x1="12" y1="17" x2="12.01" y2="17" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" /></svg>);

function SkelRow({ cols = 5 }) {
  return (
    <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: "14px 16px" }}>
          <div style={{ height: 12, width: [80, 160, 120, 100, 50][i] || 80, borderRadius: 4, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
        </td>
      ))}
    </tr>
  );
}

function StatusBadge({ rawStatus, displayLabel }) {
  const cfg = sCfg(rawStatus);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 4, background: cfg.bg, color: cfg.color, fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap", fontFamily: "'DM Sans',sans-serif" }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {displayLabel || cfg.label}
    </span>
  );
}

function Breadcrumb({ items }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span style={{ color: "#CBD5E1", fontSize: 13 }}>›</span>}
          <span style={{ fontSize: 13, fontWeight: i === items.length - 1 ? 600 : 400, color: i === items.length - 1 ? "#7B2D8B" : "#94A3B8", fontFamily: "'DM Sans',sans-serif" }}>{item}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

export default function Reports() {
  const navigate = useNavigate();
  const [view, setView] = useState("victims");
  const [selectedVictim, setSelectedVictim] = useState(null);
  const [selectedCase, setSelectedCase] = useState(null);
  const [victims, setVictims] = useState([]);
  const [victimLoading, setVictimLoading] = useState(true);
  const [victimError, setVictimError] = useState(null);
  const [victimSearch, setVictimSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [cases, setCases] = useState([]);
  const [caseLoading, setCaseLoading] = useState(false);
  const [caseError, setCaseError] = useState(null);
  const [caseDetail, setCaseDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [deletedCases, setDeletedCases] = useState([]);
  const [deletedLoading, setDeletedLoading] = useState(false);
  const [recoveringId, setRecoveringId] = useState(null);
  const [forceDeletingId, setForceDeletingId] = useState(null);
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  // Super Admin gate for the temporary force-delete action
  const currentAdmin = (() => { try { return JSON.parse(localStorage.getItem("admin_user") || localStorage.getItem("admin") || "{}"); } catch { return {}; } })();
  const isSuperAdmin = !!currentAdmin.is_super_admin;

  const showToast = (msg, success = true) => { setToast({ msg, success }); setTimeout(() => setToast(null), 3500); };

  const handleSearch = (e) => {
    setVictimSearch(e.target.value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebouncedSearch(e.target.value), 350);
  };

  const fetchVictims = useCallback(async () => {
    setVictimLoading(true); setVictimError(null);
    try {
      const p = debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : "";
      const r = await api.get(`/admin/cases/victims${p}`);
      setVictims(r.data);
    } catch { setVictimError("Failed to load victims."); }
    finally { setVictimLoading(false); }
  }, [debouncedSearch]);

  const fetchCases = useCallback(async (userId) => {
    setCaseLoading(true); setCaseError(null);
    try {
      const r = await api.get(`/admin/cases/victims/${userId}`);
      setCases(r.data.cases || []);
    } catch { setCaseError("Failed to load cases."); }
    finally { setCaseLoading(false); }
  }, []);

  const fetchCaseDetail = useCallback(async (caseId) => {
    setDetailLoading(true); setDetailError(null);
    try {
      const r = await api.get(`/admin/cases/${caseId}`);
      setCaseDetail(r.data);
    } catch { setDetailError("Failed to load case."); }
    finally { setDetailLoading(false); }
  }, []);

  const fetchDeleted = useCallback(async () => {
    setDeletedLoading(true);
    try { const r = await api.get("/admin/cases/deleted"); setDeletedCases(r.data); }
    catch { setDeletedCases([]); }
    finally { setDeletedLoading(false); }
  }, []);

  useEffect(() => { if (view === "victims") fetchVictims(); if (view === "deleted") fetchDeleted(); }, [view, fetchVictims, fetchDeleted]);
  useEffect(() => { if (view === "victims") fetchVictims(); }, [debouncedSearch]);

  const openCases = (v) => { setSelectedVictim(v); setView("cases"); fetchCases(v.user_id); };
  const openDetail = (c) => { setSelectedCase(c); setView("reports"); fetchCaseDetail(c.id); };

  const handleRecover = async (id) => {
    setRecoveringId(id);
    try { await api.patch(`/admin/cases/${id}/recover`); showToast("Case recovered."); fetchDeleted(); }
    catch { showToast("Failed to recover.", false); }
    finally { setRecoveringId(null); }
  };

  // TEMPORARY: permanent hard-delete of a soft-deleted case (Super Admin only).
  const handleForceDelete = async (id, caseNumber) => {
    if (!(await confirmDialog({ title: "Permanently delete case?", message: `Case ${caseNumber} and all its reports will be erased from the database. This cannot be undone.`, confirmLabel: "Delete Permanently", danger: true }))) return;
    setForceDeletingId(id);
    try { await api.delete(`/admin/cases/${id}/force`); showToast(`Case ${caseNumber} permanently deleted.`); fetchDeleted(); }
    catch (e) { showToast(e.response?.data?.detail || "Failed to permanently delete.", false); }
    finally { setForceDeletingId(null); }
  };

  const isVictimTab = view === "victims" || view === "cases" || view === "reports";

  return (
    <AdminLayout>
      <style>{CSS}</style>
      <div style={S.wrap}>

        {/* Tabs */}
        <div style={S.tabsWrap}>
          {[{ key: "victims", label: "Cases" }, { key: "deleted", label: "Recently Deleted" }].map(tab => (
            <button key={tab.key}
              onClick={() => { setView(tab.key); setSelectedVictim(null); setSelectedCase(null); setCaseDetail(null); }}
              style={{ padding: "10px 18px", border: "none", borderBottom: (tab.key === "victims" ? isVictimTab : view === tab.key) ? "2px solid #7B2D8B" : "2px solid transparent", background: "transparent", fontSize: 13.5, fontWeight: 600, color: (tab.key === "victims" ? isVictimTab : view === tab.key) ? "#7B2D8B" : "#94A3B8", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
              {tab.label}
              {tab.key === "deleted" && deletedCases.length > 0 && <span style={{ marginLeft: 6, padding: "2px 7px", borderRadius: 4, background: "#FEF2F2", color: "#DC2626", fontSize: 11, fontWeight: 700 }}>{deletedCases.length}</span>}
            </button>
          ))}
        </div>

        {/* VICTIMS */}
        {view === "victims" && (
          <div style={S.card}>
            <div style={S.toolbar}>
              <div style={S.searchWrap}><IcoSearch /><input className="search-input" style={S.searchInput} placeholder="Search victim…" value={victimSearch} onChange={handleSearch} /></div>
              <span style={S.countLabel}>{victimLoading ? "Loading…" : `${victims.length} victim${victims.length !== 1 ? "s" : ""}`}</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead style={S.thead}>
                  <tr>
                    <th style={S.th}>Victim</th>
                    <th style={S.th}>Contact</th>
                    <th style={S.th}>Cases</th>
                    <th style={S.th}>Latest Status</th>
                    <th style={S.th}>Last Activity</th>
                    <th style={S.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {victimLoading && [1, 2, 3, 4].map(i => <SkelRow key={i} cols={6} />)}
                  {!victimLoading && victimError && <tr><td colSpan={6} style={{ textAlign: "center", padding: "48px" }}><IcoWarn size={28} /><p style={{ color: "#64748B", marginTop: 12, fontFamily: "'DM Sans',sans-serif" }}>{victimError}</p><button style={S.retryBtn} onClick={fetchVictims}>Retry</button></td></tr>}
                  {!victimLoading && !victimError && victims.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: "64px" }}><IcoUser size={40} color="#CBD5E1" /><p style={{ fontSize: 14, color: "#94A3B8", marginTop: 12, fontFamily: "'DM Sans',sans-serif" }}>No confirmed cases yet.</p></td></tr>}
                  {!victimLoading && !victimError && victims.map(v => (
                    <tr key={v.user_id} className="row-hover" onClick={() => openCases(v)}>
                      <td style={S.td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 4, background: "#F3E5F5", border: "1.5px solid #E1BEE7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IcoUser size={18} color="#9B4DAB" /></div>
                          <div><p style={S.victimName}>{v.full_name}</p><p style={S.victimSub}>{v.email || "-"}</p></div>
                        </div>
                      </td>
                      <td style={S.td}><span style={{ fontSize: 13, color: "#475569", fontFamily: "'DM Sans',sans-serif" }}>{v.phone_number || "-"}</span></td>
                      <td style={{ ...S.td, textAlign: "center" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 4, background: "#F3E5F5", color: "#7B2D8B", fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}>
                          <IcoFolder size={13} color="#7B2D8B" />{v.case_count} {v.case_count === 1 ? "case" : "cases"}
                        </span>
                      </td>
                      <td style={{ ...S.td, textAlign: "center" }}><StatusBadge rawStatus={v.latest_status} displayLabel={v.latest_status_display} /></td>
                      <td style={S.td}><p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#0F172A", fontFamily: "'DM Sans',sans-serif" }}>{fmtDate(v.latest_case_date)}</p></td>
                      <td style={{ ...S.td, textAlign: "center" }}><IcoChevron /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CASES */}
        {view === "cases" && selectedVictim && (
          <>
            <Breadcrumb items={["All Victims", selectedVictim.full_name]} />
            <button className="back-btn" onClick={() => { setView("victims"); setSelectedVictim(null); }}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 13.5, fontWeight: 600, color: "#475569", cursor: "pointer", marginBottom: 16, fontFamily: "'DM Sans',sans-serif" }}>
              <IcoBack /> All Victims
            </button>
            {/* Victim profile */}
            <div style={{ ...S.card, padding: "20px 24px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 4, background: "#F3E5F5", border: "2px solid #E1BEE7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IcoUser size={24} color="#9B4DAB" /></div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 800, color: "#7B2D8B", fontFamily: "'DM Sans',sans-serif" }}>{selectedVictim.full_name}</h2>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 20px" }}>
                    {[["Email", selectedVictim.email], ["Phone", selectedVictim.phone_number]].map(([l, v]) => v && <span key={l} style={{ fontSize: 12.5, color: "#64748B", fontFamily: "'DM Sans',sans-serif" }}><strong style={{ color: "#7B2D8B" }}>{l}:</strong> {v}</span>)}
                  </div>
                </div>
                <span style={{ padding: "6px 14px", borderRadius: 4, background: "#F3E5F5", color: "#7B2D8B", fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}>{selectedVictim.case_count} {selectedVictim.case_count === 1 ? "Case" : "Cases"}</span>
              </div>
            </div>
            <div style={S.card}>
              <div style={{ overflowX: "auto" }}>
                <table style={S.table}>
                  <thead style={S.thead}>
                    <tr>
                      <th style={S.th}>Case No.</th>
                      <th style={S.th}>Respondent</th>
                      <th style={S.th}>Reports</th>
                      <th style={S.th}>Status</th>
                      <th style={S.th}>Filed</th>
                      <th style={S.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {caseLoading && [1, 2, 3].map(i => <SkelRow key={i} cols={6} />)}
                    {!caseLoading && caseError && <tr><td colSpan={6} style={{ textAlign: "center", padding: "48px" }}><p style={{ color: "#64748B", fontFamily: "'DM Sans',sans-serif" }}>{caseError}</p></td></tr>}
                    {!caseLoading && !caseError && cases.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: "48px" }}><IcoDoc size={36} /><p style={{ fontSize: 14, color: "#94A3B8", marginTop: 10, fontFamily: "'DM Sans',sans-serif" }}>No confirmed cases.</p></td></tr>}
                    {!caseLoading && !caseError && cases.map(c => (
                      <tr key={c.id} className="row-hover" onClick={() => openDetail(c)}>
                        <td style={S.td}><span style={{ fontSize: 12, fontWeight: 700, color: "#7B2D8B", background: "#F3E5F5", padding: "3px 8px", borderRadius: 4, fontFamily: "monospace", border: "1px solid #E1BEE7" }}>{c.case_number}</span></td>
                        <td style={{ ...S.td, fontWeight: 600, color: "#0F172A" }}>{c.offender_name}</td>
                        <td style={{ ...S.td, textAlign: "center" }}><span style={{ fontSize: 13, color: "#475569", fontFamily: "'DM Sans',sans-serif" }}>{c.report_count} {c.report_count === 1 ? "report" : "reports"}</span></td>
                        <td style={{ ...S.td, textAlign: "center" }}><StatusBadge rawStatus={c.status} displayLabel={c.status_display} /></td>
                        <td style={S.td}><p style={{ margin: 0, fontSize: 13, color: "#0F172A", fontFamily: "'DM Sans',sans-serif" }}>{fmtDate(c.created_at)}</p></td>
                        <td style={{ ...S.td, textAlign: "center" }}><IcoChevron /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* REPORTS / CASE DETAIL */}
        {view === "reports" && selectedCase && (
          <>
            <Breadcrumb items={["All Victims", selectedVictim?.full_name || "-", selectedCase.case_number]} />
            <button className="back-btn" onClick={() => { setView("cases"); setSelectedCase(null); setCaseDetail(null); }}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 13.5, fontWeight: 600, color: "#475569", cursor: "pointer", marginBottom: 16, fontFamily: "'DM Sans',sans-serif" }}>
              <IcoBack /> Cases
            </button>

            {detailLoading && <div style={S.card}><div style={{ padding: 24 }}>{[1, 2, 3].map(i => <div key={i} style={{ height: 14, width: "60%", borderRadius: 12, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite", marginBottom: 16 }} />)}</div></div>}

            {!detailLoading && detailError && <div style={{ textAlign: "center", padding: "48px" }}><IcoWarn size={28} /><p style={{ color: "#64748B", fontFamily: "'DM Sans',sans-serif", marginTop: 12 }}>{detailError}</p></div>}

            {!detailLoading && !detailError && caseDetail && (
              <>
                {/* Case header */}
                <div style={{ ...S.card, padding: "20px 24px", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#7B2D8B", background: "#F3E5F5", padding: "3px 9px", borderRadius: 4, fontFamily: "monospace", border: "1px solid #E1BEE7", letterSpacing: "0.5px" }}>{caseDetail.case_number}</span>
                        <StatusBadge rawStatus={caseDetail.status} displayLabel={caseDetail.status_display} />
                      </div>
                      <h2 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 800, color: "#0F172A", fontFamily: "'DM Sans',sans-serif" }}>vs. <span style={{ color: "#7B2D8B" }}>{caseDetail.offender_name}</span></h2>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 20px" }}>
                        {[["Complainant", caseDetail.victim?.full_name], ["Handled by", caseDetail.handled_by], ["Filed", fmtDate(caseDetail.created_at)]].map(([l, v]) => v && <span key={l} style={{ fontSize: 12.5, color: "#64748B", fontFamily: "'DM Sans',sans-serif" }}><strong style={{ color: "#475569" }}>{l}:</strong> {v}</span>)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reports table */}
                <div style={S.card}>
                  <div style={{ padding: "14px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 8, backgroundColor: "#FAFAFA" }}>
                    <div style={{ width: 3, height: 16, borderRadius: 4, backgroundColor: "#7B2D8B" }} />
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A", fontFamily: "'DM Sans',sans-serif", textTransform: "uppercase", letterSpacing: "0.5px" }}>Reports / Testimonies</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#7B2D8B", background: "#F3E5F5", padding: "2px 8px", borderRadius: 4, fontFamily: "'DM Sans',sans-serif" }}>{caseDetail.reports?.length || 0} total</span>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={S.table}>
                      <thead style={S.thead}>
                        <tr>
                          <th style={S.th}>#</th>
                          <th style={S.th}>Incident Type</th>
                          <th style={S.th}>Incident Date</th>
                          <th style={S.th}>Location</th>
                          <th style={S.th}>Date Filed</th>
                          <th style={S.th}>Photos</th>
                          <th style={S.th}>View Case</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(!caseDetail.reports || caseDetail.reports.length === 0) && <tr><td colSpan={6} style={{ textAlign: "center", padding: "48px" }}><IcoDoc size={36} /><p style={{ fontSize: 14, color: "#94A3B8", marginTop: 10, fontFamily: "'DM Sans',sans-serif" }}>No reports in this case.</p></td></tr>}
                        {caseDetail.reports?.map((r, idx) => (
                          <tr key={r.id} className="row-hover" onClick={() => navigate(`/reports/${caseDetail.id}#report-${idx + 1}`)}>
                            <td style={S.td}><span style={{ fontSize: 12, fontWeight: 700, color: "#475569", background: "#F1F5F9", padding: "2px 8px", borderRadius: 4, fontFamily: "'DM Sans',sans-serif" }}>Report {idx + 1}</span></td>
                            <td style={S.td}>{r.incident_type ? <span style={{ fontSize: 12.5, color: "#4A1259", background: "#F3E5F5", padding: "3px 9px", borderRadius: 4, fontFamily: "'DM Sans',sans-serif" }}>{r.incident_type}</span> : <span style={{ color: "#CBD5E1" }}>-</span>}</td>
                            <td style={S.td}><span style={{ fontSize: 13, color: "#475569", fontFamily: "'DM Sans',sans-serif" }}>{fmtDate(r.incident_date)}</span></td>
                            <td style={S.td}><span style={{ fontSize: 13, color: "#475569", fontFamily: "'DM Sans',sans-serif" }}>{truncate(r.address, 35)}</span></td>
                            <td style={S.td}><p style={{ margin: 0, fontSize: 13, color: "#0F172A", fontFamily: "'DM Sans',sans-serif" }}>{fmtDate(r.created_at)}</p><p style={{ margin: 0, fontSize: 11.5, color: "#94A3B8", fontFamily: "'DM Sans',sans-serif" }}>{fmtTime(r.created_at)}</p></td>
                            <td style={{ ...S.td, textAlign: "center" }}>{r.photo_urls?.length > 0 ? <span style={{ fontSize: 12.5, color: "#C45E10", fontFamily: "'DM Sans',sans-serif" }}>{r.photo_urls.length} photo{r.photo_urls.length > 1 ? "s" : ""}</span> : <span style={{ color: "#CBD5E1" }}>-</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* DELETED */}
        {view === "deleted" && (
          <div style={S.card}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, margin: "16px 20px", padding: "12px 16px", background: "#FEF2F2", borderRadius: 12, border: "1px solid #FECACA" }}>
              <IcoWarn /><div><p style={{ fontSize: 13.5, fontWeight: 700, color: "#991B1B", margin: "0 0 2px", fontFamily: "'DM Sans',sans-serif" }}>Recently Deleted Cases</p><p style={{ fontSize: 12, color: "#B91C1C", margin: 0, fontFamily: "'DM Sans',sans-serif" }}>Recoverable within 30 days.</p></div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead style={S.thead}>
                  <tr>
                    <th style={S.th}>Case No.</th>
                    <th style={S.th}>Victim</th>
                    <th style={S.th}>Respondent</th>
                    <th style={S.th}>Deleted</th>
                    <th style={S.th}>Expires</th>
                    <th style={S.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {deletedLoading && [1, 2, 3].map(i => <SkelRow key={i} cols={6} />)}
                  {!deletedLoading && deletedCases.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: "48px" }}><IcoDoc size={36} /><p style={{ fontSize: 14, color: "#94A3B8", marginTop: 10, fontFamily: "'DM Sans',sans-serif" }}>No recently deleted cases.</p></td></tr>}
                  {!deletedLoading && deletedCases.map(c => {
                    const days = daysLeft(c.deleted_at);
                    return (
                      <tr key={c.id}>
                        <td style={S.td}><span style={{ fontSize: 12, fontWeight: 700, color: "#7B2D8B", background: "#F3E5F5", padding: "2px 8px", borderRadius: 4, fontFamily: "monospace" }}>{c.case_number}</span></td>
                        <td style={S.td}><p style={S.victimName}>{c.victim_name}</p><p style={S.victimSub}>{c.victim_email}</p></td>
                        <td style={{ ...S.td, fontWeight: 600, color: "#0F172A" }}>{c.offender_name}</td>
                        <td style={S.td}><p style={{ margin: 0, fontSize: 13, color: "#0F172A", fontFamily: "'DM Sans',sans-serif" }}>{fmtDate(c.deleted_at)}</p></td>
                        <td style={{ ...S.td, textAlign: "center" }}><span style={{ display: "inline-block", padding: "3px 8px", borderRadius: 4, fontSize: 11.5, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", background: days <= 5 ? "#FEF2F2" : "#FFFBEB", color: days <= 5 ? "#991B1B" : "#92400E" }}>{days}d left</span></td>
                        <td style={{ ...S.td, textAlign: "center" }}>
                          <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                            <button className="recover-btn" disabled={recoveringId === c.id} onClick={() => handleRecover(c.id)}
                              style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid #A7F3D0", background: "#ECFDF5", color: "#065F46", fontSize: 12.5, fontWeight: 600, cursor: recoveringId === c.id ? "not-allowed" : "pointer", opacity: recoveringId === c.id ? 0.7 : 1, fontFamily: "'DM Sans',sans-serif" }}>
                              {recoveringId === c.id ? "Recovering…" : "Recover"}
                            </button>
                            {isSuperAdmin && (
                              <button disabled={forceDeletingId === c.id} onClick={() => handleForceDelete(c.id, c.case_number)}
                                title="Permanently delete (Super Admin - cannot be undone)"
                                style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid #FECACA", background: "#FEF2F2", color: "#991B1B", fontSize: 12.5, fontWeight: 600, cursor: forceDeletingId === c.id ? "not-allowed" : "pointer", opacity: forceDeletingId === c.id ? 0.7 : 1, fontFamily: "'DM Sans',sans-serif" }}>
                                {forceDeletingId === c.id ? "Deleting…" : "Force Delete"}
                              </button>
                            )}
                          </div>
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

      {toast && (
        <div style={{ ...S.toast, borderColor: toast.success ? "#A7F3D0" : "#FECACA", color: toast.success ? "#065F46" : "#991B1B", animation: "slideDown 0.2s ease" }}>
          <span style={{ width: 20, height: 20, borderRadius: 4, background: toast.success ? "#D1FAE5" : "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {toast.success ? <svg width="10" height="10" fill="none" viewBox="0 0 20 20"><path d="M5 10l4 4 6-8" stroke="#10B981" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg> : <svg width="10" height="10" fill="none" viewBox="0 0 20 20"><path d="M15 5L5 15M5 5l10 10" stroke="#EF4444" strokeWidth={2} strokeLinecap="round" /></svg>}
          </span>
          {toast.msg}
        </div>
      )}
    </AdminLayout>
  );
}

const S = {
  wrap: { maxWidth: "1200px", fontFamily: "'DM Sans',sans-serif" },
  tabsWrap: { display: "flex", gap: 2, flexWrap: "wrap", borderBottom: "1px solid #E2E8F0", marginBottom: 16 },
  card: { backgroundColor: "#fff", borderRadius: 0, boxShadow: "0 1px 3px rgba(15,23,42,0.06)", border: "1px solid #E2E8F0", overflow: "hidden", marginBottom: 16 },
  toolbar: { display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid #F1F5F9", flexWrap: "wrap" },
  searchWrap: { display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 220, maxWidth: 400, border: "1.5px solid #E2E8F0", borderRadius: 4, padding: "9px 13px", backgroundColor: "#F8FAFC" },
  searchInput: { flex: 1, border: "none", outline: "none", fontSize: 13.5, color: "#0F172A", backgroundColor: "transparent", fontFamily: "'DM Sans',sans-serif" },
  countLabel: { marginLeft: "auto", fontSize: 12.5, color: "#94A3B8", fontFamily: "'DM Sans',sans-serif" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 600 },
  thead: { backgroundColor: "#F8FAFC", borderBottom: "2px solid #E2E8F0" },
  th: { padding: "11px 16px", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.7px", whiteSpace: "nowrap", fontFamily: "'DM Sans',sans-serif" },
  td: { padding: "13px 16px", verticalAlign: "middle", fontSize: 13.5, fontFamily: "'DM Sans',sans-serif", borderBottom: "1px solid #F8FAFC" },
  victimName: { fontSize: 13.5, fontWeight: 600, color: "#0F172A", margin: "0 0 2px", fontFamily: "'DM Sans',sans-serif" },
  victimSub: { fontSize: 11.5, color: "#94A3B8", margin: 0, fontFamily: "'DM Sans',sans-serif" },
  retryBtn: { padding: "8px 20px", background: "#9B4DAB", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13.5, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", marginTop: 12 },
  toast: { position: "fixed", top: 20, right: 20, zIndex: 999, background: "#fff", borderRadius: 4, border: "1px solid", padding: "12px 18px", boxShadow: "0 8px 24px rgba(0,0,0,0.10)", display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, fontWeight: 500, fontFamily: "'DM Sans',sans-serif" },
};
