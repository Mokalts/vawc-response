import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "../components/Sidebar";
import api from "../api/api";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
  @keyframes spin      { to{transform:rotate(360deg)} }
  @keyframes shimmer   { 0%{background-position:-200% 0}100%{background-position:200% 0} }
  @keyframes slideDown { from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)} }
  .rd-btn { transition:all 0.15s ease !important; }
  .rd-btn:hover { transform:translateY(-1px); box-shadow:0 4px 12px rgba(0,0,0,0.12); }
  .rd-status-opt { transition:all 0.12s ease !important; }
  .rd-status-opt:hover { border-color:currentColor !important; }
  .rd-map:hover { border-color:#F47920 !important; color:#C45E10 !important; background:#FFF3E0 !important; }
  .rd-map { transition:all 0.15s ease !important; }
`;

const STATUS_CONFIG = {
  submitted:             { label:"Submitted",             color:"#9B4DAB", bg:"#F3E5F5", dot:"#9B4DAB" },
  awaiting_onsite_visit: { label:"Awaiting Onsite Visit", color:"#D97706", bg:"#FFFBEB", dot:"#F59E0B" },
  under_process: { label:"Under Process", color:"#0E7490", bg:"#ECFEFF", dot:"#06B6D4" },
  summon_issued:         { label:"Summon Letter Issued",  color:"#C45E10", bg:"#FFF3E0", dot:"#F47920" },
  summon_acknowledged:   { label:"Summon Acknowledged",   color:"#F47920", bg:"#FFF3E0", dot:"#9B4DAB" },
  resolved:              { label:"Resolved",              color:"#059669", bg:"#ECFDF5", dot:"#10B981" },
  referred_to_police:    { label:"Referred to Authorities", color:"#DC2626", bg:"#FEF2F2", dot:"#EF4444" },
};
const sCfg = (s) => STATUS_CONFIG[s] || { label:s||"Unknown", color:"#64748B", bg:"#F1F5F9", dot:"#CBD5E1" };
const ALL_STATUSES = Object.keys(STATUS_CONFIG).filter(s => s !== 'submitted');

const TIMELINE_STEPS = ["submitted","awaiting_onsite_visit","under_process","summon_issued","summon_acknowledged"];
const INCIDENT_TYPES = ["Physical Abuse","Sexual Abuse","Psychological Abuse","Economic Abuse","Other"];

const fmt     = (d) => !d?"-":new Date(d).toLocaleString("en-PH",{month:"long",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"});
const fmtDate = (d) => !d?"-":new Date(d).toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"});
const age     = (dob) => !dob?null:Math.floor((Date.now()-new Date(dob).getTime())/(1000*60*60*24*365.25));
const daysLeft = (d) => !d?0:Math.max(0,30-Math.floor((Date.now()-new Date(d).getTime())/86400000));

const IcoUser     = ({ size=16, color="currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.8"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth="1.8" strokeLinecap="round"/></svg>);
const IcoClip     = ({ size=16, color="currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoPin      = ({ size=16, color="currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="10" r="3" stroke={color} strokeWidth="1.8"/></svg>);
const IcoWarn     = ({ size=16, color="currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke={color} strokeWidth="1.8" strokeLinecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke={color} strokeWidth="2.5" strokeLinecap="round"/></svg>);
const IcoCheck    = ({ size=16, color="currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoShield   = ({ size=16, color="currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoPrint    = ({ size=16, color="currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><rect x="6" y="14" width="12" height="8" rx="1" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoTrash    = ({ size=16, color="currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoCal      = ({ size=16, color="currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth="1.8"/><path d="M16 2v4M8 2v4M3 10h18" stroke={color} strokeWidth="1.8" strokeLinecap="round"/></svg>);
const IcoGuardian = ({ size=16, color="currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9" cy="7" r="4" stroke={color} strokeWidth="1.8"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoRecover  = ({ size=16, color="currentColor" }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);

const Spinner = ({ size=14, color="#fff" }) => (
  <span style={{ width:size, height:size, border:`2px solid rgba(255,255,255,0.3)`, borderTopColor:color, borderRadius: '50%', animation:"spin 0.7s linear infinite", display:"inline-block", flexShrink:0 }}/>
);

const Card = ({ title, icon, children, style={}, headerRight }) => (
  <div style={{ background:"#fff", borderRadius: 12, border:"1px solid #E2E8F0", overflow:"hidden", fontFamily:"'DM Sans',sans-serif", boxShadow:"0 1px 3px rgba(15,23,42,0.05)", ...style }}>
    {title&&(
      <div style={{ padding:"14px 20px", borderBottom:"1px solid #F1F5F9", display:"flex", alignItems:"center", justifyContent:"space-between", backgroundColor:"#FAFAFA" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:3, height:16, borderRadius: 4, backgroundColor:"#F47920" }}/>
          {icon&&<span style={{ display:"flex" }}>{icon}</span>}
          <h3 style={{ margin:0, fontSize:12.5, fontWeight:700, color:"#0F172A", fontFamily:"'DM Sans',sans-serif", textTransform:"uppercase", letterSpacing:"0.5px" }}>{title}</h3>
        </div>
        {headerRight}
      </div>
    )}
    <div style={{ padding:20 }}>{children}</div>
  </div>
);

const InfoRow = ({ label, value, mono, muted }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
    <span style={{ fontSize:10.5, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:"#94A3B8", fontFamily:"'DM Sans',sans-serif" }}>{label}</span>
    <span style={{ fontSize:13.5, color:muted?"#94A3B8":"#0F172A", fontWeight:500, fontStyle:muted?"italic":"normal", fontFamily:mono?"monospace":"'DM Sans',sans-serif" }}>{value||"-"}</span>
  </div>
);

const M = {
  backdrop: { position:"fixed", inset:0, zIndex:1000, background:"rgba(15,23,42,0.5)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 },
  modal:    { background:"#fff", borderRadius: 16, width:"100%", boxShadow:"0 20px 60px rgba(0,0,0,0.15)", padding:28, fontFamily:"'DM Sans',sans-serif" },
  title:    { margin:0, fontSize:16, fontWeight:700, color:"#0F172A", fontFamily:"'DM Sans',sans-serif" },
  sub:      { margin:"3px 0 0", fontSize:12.5, color:"#94A3B8", fontFamily:"'DM Sans',sans-serif" },
  closeBtn: { background:"none", border:"none", cursor:"pointer", color:"#94A3B8", padding:4, display:"flex" },
  cancelBtn:{ padding:"8px 18px", borderRadius: 10, border:"1.5px solid #E2E8F0", background:"#fff", color:"#374151", fontSize:13.5, fontWeight:500, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" },
  saveBtn:  { padding:"8px 20px", borderRadius: 4, border:"none", color:"#fff", fontSize:13.5, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:7, fontFamily:"'DM Sans',sans-serif" },
};

const CloseX = ({ onClick }) => (
  <button onClick={onClick} style={M.closeBtn}>
    <svg width="16" height="16" fill="none" viewBox="0 0 20 20"><path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"/></svg>
  </button>
);

const StatusModal = ({ current, onClose, onSave, saving }) => {
  const [selected, setSelected] = useState(current);
  const currentIdx = ALL_STATUSES.indexOf(current);
  return (
    <div style={M.backdrop} onClick={onClose}>
      <div style={{ ...M.modal, maxWidth:440 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div><p style={M.title}>Update Case Status</p><p style={M.sub}>Select the new status for this case</p></div>
          <CloseX onClick={onClose}/>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:16 }}>
          {ALL_STATUSES.map((s,i)=>{
            const cfg=sCfg(s), isActive=s===selected, isPast=i<currentIdx&&s!==selected;
            return (
              <div key={s} className="rd-status-opt" onClick={()=>setSelected(s)}
                style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", borderRadius: 4, cursor:"pointer", border:`1.5px solid ${isActive?cfg.dot:"#F1F5F9"}`, background:isActive?cfg.bg:"#fff", opacity:isPast?0.4:1 }}>
                <span style={{ width:8, height:8, borderRadius: 4, background:cfg.dot, flexShrink:0 }}/>
                <span style={{ flex:1, fontSize:13.5, fontWeight:isActive?600:500, color:isActive?cfg.color:"#374151", fontFamily:"'DM Sans',sans-serif" }}>{cfg.label}</span>
                {isActive&&<IcoCheck size={15} color={cfg.dot}/>}
              </div>
            );
          })}
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onClose} style={M.cancelBtn}>Cancel</button>
          <button onClick={()=>onSave(selected)} disabled={saving||selected===current}
            style={{ ...M.saveBtn, background:selected===current?"#E2E8F0":"#F47920", color:selected===current?"#94A3B8":"#fff", cursor:selected===current?"not-allowed":"pointer" }}>
            {saving?<><Spinner/><span>Saving…</span></>:"Save Status"}
          </button>
        </div>
      </div>
    </div>
  );
};

const ConfirmModal = ({ title, message, confirmLabel, danger, onConfirm, onClose, loading }) => (
  <div style={M.backdrop} onClick={onClose}>
    <div style={{ ...M.modal, maxWidth:400 }} onClick={e=>e.stopPropagation()}>
      <p style={{ ...M.title, margin:"0 0 8px" }}>{title}</p>
      <p style={{ margin:"0 0 20px", fontSize:13.5, color:"#64748B", lineHeight:1.6, fontFamily:"'DM Sans',sans-serif" }}>{message}</p>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
        <button onClick={onClose} style={M.cancelBtn}>Cancel</button>
        <button onClick={onConfirm} disabled={loading} style={{ ...M.saveBtn, background:danger?"#EF4444":"#F47920", opacity:loading?0.7:1 }}>
          {loading&&<Spinner/>}{confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

// ─── Delete Report Modal ──────────────────────────────────────────────────────
const DeleteReportModal = ({ reportNum, onClose, onConfirm, loading }) => (
  <div style={M.backdrop} onClick={!loading?onClose:undefined}>
    <div style={{ ...M.modal, maxWidth:420 }} onClick={e=>e.stopPropagation()}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
        <div>
          <p style={M.title}>Delete Report {reportNum}</p>
          <p style={M.sub}>This report will be soft-deleted and can be recovered</p>
        </div>
        <CloseX onClick={onClose}/>
      </div>

      {/* Recovery info box */}
      <div style={{ display:"flex", gap:10, alignItems:"flex-start", background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius: 4, padding:"12px 14px", marginBottom:16 }}>
        <IcoWarn size={15} color="#92400E"/>
        <div>
          <p style={{ margin:"0 0 4px", fontSize:13, fontWeight:700, color:"#92400E", fontFamily:"'DM Sans',sans-serif" }}>Recoverable within 30 days</p>
          <p style={{ margin:0, fontSize:12.5, color:"#78350F", lineHeight:1.5, fontFamily:"'DM Sans',sans-serif" }}>
            Deleted reports are not permanently removed. You can recover them from the case detail page within 30 days. After 30 days, they are permanently deleted.
          </p>
        </div>
      </div>

      <p style={{ margin:"0 0 16px", fontSize:13.5, color:"#374151", fontFamily:"'DM Sans',sans-serif" }}>
        Are you sure you want to delete <strong>Report {reportNum}</strong>?
      </p>

      <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
        <button onClick={onClose} style={M.cancelBtn} disabled={loading}>Cancel</button>
        <button onClick={onConfirm} disabled={loading} style={{ ...M.saveBtn, background:"#EF4444", opacity:loading?0.7:1 }}>
          {loading&&<Spinner/>} {loading?"Deleting…":"Delete Report"}
        </button>
      </div>
    </div>
  </div>
);

const DELETE_REASONS = [
  { id:"duplicate",    label:"Duplicate case" },
  { id:"error",        label:"Filed in error" },
  { id:"insufficient", label:"Insufficient information" },
  { id:"jurisdiction", label:"Outside jurisdiction" },
  { id:"other",        label:"Other" },
];

const DeleteModal = ({ caseId, onClose, onConfirm, loading }) => {
  const [reason,    setReason]    = useState("");
  const [otherText, setOtherText] = useState("");
  const [err,       setErr]       = useState("");
  const submit = () => {
    if (!reason) { setErr("Please select a reason."); return; }
    if (reason==="other"&&!otherText.trim()) { setErr("Please describe your reason."); return; }
    const label = reason==="other"?otherText.trim():DELETE_REASONS.find(r=>r.id===reason)?.label;
    onConfirm(label);
  };
  return (
    <div style={M.backdrop} onClick={!loading?onClose:undefined}>
      <div style={{ ...M.modal, maxWidth:420 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
          <div><p style={M.title}>Delete Case</p><p style={M.sub}>Case #{caseId} will be moved to Recently Deleted</p></div>
          <CloseX onClick={onClose}/>
        </div>
        <p style={{ margin:"0 0 10px", fontSize:13, fontWeight:600, color:"#374151", fontFamily:"'DM Sans',sans-serif" }}>Why are you deleting this case?</p>
        <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:12 }}>
          {DELETE_REASONS.map(r=>(
            <label key={r.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius: 4, cursor:"pointer", border:`1.5px solid ${reason===r.id?"#FECACA":"#F1F5F9"}`, background:reason===r.id?"#FEF2F2":"#fff" }}>
              <input type="radio" name="del-reason" value={r.id} checked={reason===r.id} onChange={()=>{ setReason(r.id); setErr(""); }} style={{ accentColor:"#EF4444" }}/>
              <span style={{ fontSize:13.5, color:reason===r.id?"#991B1B":"#374151", fontWeight:reason===r.id?600:400, fontFamily:"'DM Sans',sans-serif" }}>{r.label}</span>
            </label>
          ))}
          {reason==="other"&&<textarea placeholder="Describe your reason…" value={otherText} onChange={e=>setOtherText(e.target.value)} maxLength={300}
            style={{ width:"100%", boxSizing:"border-box", minHeight:72, resize:"vertical", border:"1.5px solid #E2E8F0", borderRadius: 4, padding:"10px 12px", fontSize:13.5, fontFamily:"'DM Sans',sans-serif", color:"#0F172A", outline:"none", marginTop:4 }}/>}
          {err&&<p style={{ margin:"4px 0 0", fontSize:12.5, color:"#EF4444", fontFamily:"'DM Sans',sans-serif" }}>{err}</p>}
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onClose} style={M.cancelBtn} disabled={loading}>Cancel</button>
          <button onClick={submit} disabled={loading} style={{ ...M.saveBtn, background:"#EF4444", opacity:loading?0.7:1 }}>
            {loading&&<Spinner/>} {loading?"Deleting…":"Delete Case"}
          </button>
        </div>
      </div>
    </div>
  );
};

const CaseTimeline = ({ cas, onUpdateStatus, onReferToPolice }) => {
  const isReferred = cas.status==="referred_to_police";
  const isResolved = cas.status==="resolved";
  const isDeleted  = cas.is_deleted;
  const currentIdx = TIMELINE_STEPS.indexOf(cas.status);
  const canQuickRefer = cas.status==="awaiting_onsite_visit"&&!isDeleted;
  return (
    <Card title="Case Timeline" icon={<IcoCheck size={16} color="#F47920"/>}>
      <div style={{ display:"flex", flexDirection:"column", gap:0, marginBottom:4 }}>
        {TIMELINE_STEPS.map((s,i)=>{
          const cfg=sCfg(s), isDone=isReferred?false:i<currentIdx, isCurrent=!isReferred&&i===currentIdx;
          return (
            <div key={s} style={{ display:"flex", gap:12, paddingBottom:14 }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0 }}>
                <div style={{ width:20, height:20, borderRadius: 4, border:`2px solid ${isCurrent?cfg.dot:isDone?cfg.dot:"#E2E8F0"}`, background:isCurrent?cfg.dot:isDone?cfg.bg:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {isDone&&!isCurrent&&<svg width="9" height="9" fill="none" viewBox="0 0 20 20"><path d="M5 10l4 4 6-8" stroke={cfg.dot} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  {isCurrent&&<div style={{ width:7, height:7, borderRadius: 4, background:"#fff" }}/>}
                </div>
                {i<TIMELINE_STEPS.length-1&&<div style={{ width:2, flex:1, minHeight:14, background:isDone?cfg.dot:"#E2E8F0", marginTop:3 }}/>}
              </div>
              <div style={{ paddingTop:2 }}>
                <p style={{ margin:0, fontSize:12.5, fontWeight:isCurrent?700:isDone?500:400, color:isCurrent?cfg.color:isDone?"#374151":"#94A3B8", fontFamily:"'DM Sans',sans-serif" }}>{cfg.label}</p>
                {isCurrent&&<span style={{ fontSize:10.5, color:cfg.dot, fontWeight:500, fontFamily:"'DM Sans',sans-serif" }}>Current</span>}
              </div>
            </div>
          );
        })}
        {[{key:"resolved",icon:<IcoCheck size={10} color="#059669"/>},{key:"referred_to_police",icon:<IcoShield size={10} color="#DC2626"/>}].map(({key,icon})=>{
          const cfg=sCfg(key), isCurrent=cas.status===key;
          return (
            <div key={key} style={{ display:"flex", gap:12, paddingBottom:8 }}>
              <div style={{ flexShrink:0 }}>
                <div style={{ width:20, height:20, borderRadius: 4, border:`2px solid ${isCurrent?cfg.dot:"#E2E8F0"}`, background:isCurrent?cfg.bg:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {isCurrent?icon:<span style={{ width:6, height:6, borderRadius: 4, background:"#E2E8F0" }}/>}
                </div>
              </div>
              <div style={{ paddingTop:2 }}>
                <p style={{ margin:0, fontSize:12.5, fontWeight:isCurrent?700:400, color:isCurrent?cfg.color:"#94A3B8", fontFamily:"'DM Sans',sans-serif" }}>{cfg.label}</p>
                {isCurrent&&<span style={{ fontSize:10.5, color:cfg.dot, fontWeight:500, fontFamily:"'DM Sans',sans-serif" }}>Current</span>}
              </div>
            </div>
          );
        })}
      </div>
      {!isDeleted&&(
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:8 }}>
          {!isResolved&&(
            <button className="rd-btn" onClick={onUpdateStatus}
              style={{ width:"100%", padding:"10px 0", borderRadius: 8, border:"none", background:"#C45E10", color:"#fff", fontSize:13.5, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, fontFamily:"'DM Sans',sans-serif" }}>
              <IcoCheck size={14} color="#fff"/> {isReferred?"Change Status (Revert)":"Update Status"}
            </button>
          )}
          {canQuickRefer&&(
            <button className="rd-btn" onClick={onReferToPolice}
              style={{ width:"100%", padding:"10px 0", borderRadius: 8, border:"2px solid #EF4444", background:"#FEF2F2", color:"#DC2626", fontSize:13.5, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, fontFamily:"'DM Sans',sans-serif" }}>
              <IcoShield size={15} color="#DC2626"/> Refer to Authorities (Serious Case)
            </button>
          )}
        </div>
      )}
      {isReferred&&<div style={{ marginTop:10, padding:"12px 14px", borderRadius: 4, background:"#FEF2F2", border:"1.5px solid #FECACA", display:"flex", gap:10 }}><IcoShield size={15} color="#DC2626"/><div><p style={{ margin:"0 0 2px", fontSize:13, fontWeight:700, color:"#DC2626", fontFamily:"'DM Sans',sans-serif" }}>Referred to Authorities</p><p style={{ margin:0, fontSize:12, color:"#991B1B", lineHeight:1.5, fontFamily:"'DM Sans',sans-serif" }}>Use "Change Status" to revert if needed.</p></div></div>}
      {isResolved&&<div style={{ marginTop:10, padding:"12px 14px", borderRadius: 4, background:"#ECFDF5", border:"1.5px solid #A7F3D0", display:"flex", gap:10 }}><IcoCheck size={15} color="#059669"/><div><p style={{ margin:"0 0 2px", fontSize:13, fontWeight:700, color:"#059669", fontFamily:"'DM Sans',sans-serif" }}>Case Resolved</p><p style={{ margin:0, fontSize:12, color:"#065F46", lineHeight:1.5, fontFamily:"'DM Sans',sans-serif" }}>Successfully resolved at barangay level.</p></div></div>}
    </Card>
  );
};

const PrintPanel = ({ cas }) => {
  const docs = [
    { key:"summon",      label:"Summon Letter",              sub:"Katarungang Pambarangay", color:"#1D4ED8", bg:"#F3E5F5", border:"#BFDBFE" },
    { key:"cfa",         label:"Certificate to File Action", sub:"Lupong Tagapamayapa",     color:"#F47920", bg:"#FFF3E0", border:"#E1BEE7" },
    { key:"endorsement", label:"Endorsement Letter",         sub:"Punong Barangay",          color:"#DC2626", bg:"#FEF2F2", border:"#FECACA" },
  ];
  return (
    <Card title="Print Documents" icon={<IcoPrint size={16} color="#F47920"/>}>
      <p style={{ margin:"0 0 12px", fontSize:12.5, color:"#94A3B8", fontFamily:"'DM Sans',sans-serif" }}>Auto-fill official barangay documents.</p>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {docs.map(doc=>(
          <button key={doc.key} className="rd-btn"
            onClick={()=>alert(`Print: ${doc.key} - coming soon`)}
            style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius: 4, border:`1.5px solid ${doc.border}`, background:doc.bg, cursor:"pointer", textAlign:"left", width:"100%" }}>
            <IcoPrint size={15} color={doc.color}/>
            <div style={{ flex:1 }}>
              <p style={{ margin:0, fontSize:13, fontWeight:600, color:doc.color, fontFamily:"'DM Sans',sans-serif" }}>{doc.label}</p>
              <p style={{ margin:0, fontSize:11, color:doc.color+"99", fontFamily:"'DM Sans',sans-serif" }}>{doc.sub}</p>
            </div>
            <svg width="14" height="14" fill="none" viewBox="0 0 20 20"><path d="M7.5 5l5 5-5 5" stroke={doc.color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        ))}
      </div>
    </Card>
  );
};

export default function ReportDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [cas,               setCas]               = useState(null);
  const [loading,           setLoading]           = useState(true);
  const [error,             setError]             = useState(null);
  const [showStatusModal,   setShowStatusModal]   = useState(false);
  const [statusSaving,      setStatusSaving]      = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRecover,       setShowRecover]       = useState(false);
  const [actionLoading,     setActionLoading]     = useState(false);
  const [incidentTypes,     setIncidentTypes]     = useState({});
  const [toast,             setToast]             = useState(null);
  const [lightbox,          setLightbox]          = useState(null);
  // Per-report delete modal state
  const [deleteReportTarget, setDeleteReportTarget] = useState(null); // { id, num }
  const [deletingReport,     setDeletingReport]     = useState(false);
  const [recoverReportTarget,setRecoverReportTarget]= useState(null); // { id, num }
  const [recoveringReport,   setRecoveringReport]   = useState(false);

  const showToast = (msg,success=true) => { setToast({msg,success}); setTimeout(()=>setToast(null),3500); };

  const fetchCase = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.get(`/admin/cases/${id}`);
      setCas(res.data);
      const types = {};
      (res.data.reports||[]).forEach(r=>{ types[r.id]=r.incident_type||""; });
      setIncidentTypes(types);
      setTimeout(() => {
        const hash = window.location.hash;
        if (hash) {
          const el = document.querySelector(hash);
          if (el) el.scrollIntoView({ behavior:'smooth', block:'start' });
        }
      }, 150);
    } catch (err) { setError(err.response?.data?.detail||"Failed to load case."); }
    finally { setLoading(false); }
  },[id]);

  useEffect(()=>{ fetchCase(); },[fetchCase]);

  const handleStatusSave = async (newStatus) => {
    setStatusSaving(true);
    try {
      await api.patch(`/admin/cases/${id}/status`,{status:newStatus});
      setCas(c=>({...c,status:newStatus}));
      setShowStatusModal(false);
      showToast("Status updated.");
    } catch (err) { showToast(err.response?.data?.detail||"Failed to update.",false); }
    finally { setStatusSaving(false); }
  };

  const handleReferToPolice = async () => {
    setStatusSaving(true);
    try {
      await api.patch(`/admin/cases/${id}/status`,{status:"referred_to_police"});
      setCas(c=>({...c,status:"referred_to_police"}));
      showToast("Case referred to authorities.");
    } catch (err) { showToast(err.response?.data?.detail||"Failed.",false); }
    finally { setStatusSaving(false); }
  };

  const handleIncidentTypeSave = async (reportId) => {
    try {
      await api.patch(`/admin/cases/${id}/reports/${reportId}/incident-type`,{ incident_type:incidentTypes[reportId]||null, report_id:reportId });
      showToast("Incident type saved.");
    } catch (err) { showToast(err.response?.data?.detail||"Failed.",false); }
  };

  const handleDelete = async (reason) => {
    setActionLoading(true);
    try {
      await api.delete(`/admin/cases/${id}`,{data:{reason}});
      setShowDeleteConfirm(false);
      showToast("Case deleted.");
      setTimeout(()=>navigate("/reports"),1500);
    } catch (err) { showToast(err.response?.data?.detail||"Failed.",false); }
    finally { setActionLoading(false); }
  };

  const handleRecover = async () => {
    setActionLoading(true);
    try {
      await api.patch(`/admin/cases/${id}/recover`);
      setShowRecover(false);
      showToast("Case recovered.");
      fetchCase();
    } catch (err) { showToast(err.response?.data?.detail||"Failed.",false); }
    finally { setActionLoading(false); }
  };

  // ── Per-report soft delete ────────────────────────────────────────────────
  const handleDeleteReport = async () => {
    if (!deleteReportTarget) return;
    setDeletingReport(true);
    try {
      await api.delete(`/admin/cases/${id}/reports/${deleteReportTarget.id}`);
      setCas(c=>({
        ...c,
        reports: c.reports.map(r=>
          r.id===deleteReportTarget.id
            ? { ...r, is_deleted:true, deleted_at:new Date().toISOString() }
            : r
        )
      }));
      setDeleteReportTarget(null);
      showToast(`Report ${deleteReportTarget.num} deleted. Recoverable within 30 days.`);
    } catch (err) { showToast(err.response?.data?.detail||"Failed to delete report.",false); }
    finally { setDeletingReport(false); }
  };

  // ── Per-report recover ────────────────────────────────────────────────────
  const handleRecoverReport = async () => {
    if (!recoverReportTarget) return;
    setRecoveringReport(true);
    try {
      await api.patch(`/admin/cases/${id}/reports/${recoverReportTarget.id}/recover`);
      setCas(c=>({
        ...c,
        reports: c.reports.map(r=>
          r.id===recoverReportTarget.id
            ? { ...r, is_deleted:false, deleted_at:null }
            : r
        )
      }));
      setRecoverReportTarget(null);
      showToast(`Report ${recoverReportTarget.num} recovered.`);
    } catch (err) { showToast(err.response?.data?.detail||"Failed to recover.",false); }
    finally { setRecoveringReport(false); }
  };

  if (loading) return (
    <AdminLayout>
      <div style={{ maxWidth:1200 }}>
        {[140,200,100].map((h,i)=>(
          <div key={i} style={{ background:"linear-gradient(90deg,#F8FAFC 25%,#E2E8F0 50%,#F8FAFC 75%)", borderRadius: 4, height:h, marginBottom:16, backgroundSize:"200% 100%", animation:"shimmer 1.4s infinite" }}/>
        ))}
      </div>
    </AdminLayout>
  );

  if (error) return (
    <AdminLayout>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"50vh" }}>
        <IcoWarn size={36} color="#CBD5E1"/>
        <p style={{ fontWeight:600, color:"#0F172A", margin:"12px 0 6px", fontFamily:"'DM Sans',sans-serif" }}>Case not found</p>
        <p style={{ color:"#94A3B8", fontSize:13, margin:"0 0 20px", fontFamily:"'DM Sans',sans-serif" }}>{error}</p>
        <button onClick={()=>navigate("/reports")} style={{ padding:"8px 20px", borderRadius: 4, border:"1.5px solid #E2E8F0", background:"#fff", color:"#374151", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>← Back to Reports</button>
      </div>
    </AdminLayout>
  );

  const victim   = cas.victim||{};
  const reports  = cas.reports||[];
  const cfg      = sCfg(cas.status);
  const isMinor  = victim.is_minor || false;
  const activeReportCount = reports.filter(r=>!r.is_deleted).length;

  return (
    <AdminLayout>
      <style>{CSS}</style>
      <div style={{ maxWidth:1200, fontFamily:"'DM Sans',sans-serif" }}>

        {/* Header */}
        <div style={{ marginBottom:20 }}>
          <button onClick={()=>navigate("/reports")}
            style={{ display:"inline-flex", alignItems:"center", gap:6, background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius: 4, cursor:"pointer", color:"#475569", fontSize:13, fontWeight:600, padding:"6px 12px", marginBottom:14, fontFamily:"'DM Sans',sans-serif" }}>
            <svg width="13" height="13" fill="none" viewBox="0 0 20 20"><path d="M12.5 5l-5 5 5 5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/></svg>
            Back to Reports
          </button>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:6 }}>
                <h1 style={{ margin:0, fontSize:20, fontWeight:800, color:"#0F172A", fontFamily:"'DM Sans',sans-serif" }}>{cas.case_number}</h1>
                <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"5px 12px", borderRadius: 4, fontSize:12.5, fontWeight:600, color:cfg.color, background:cfg.bg, fontFamily:"'DM Sans',sans-serif" }}>
                  <span style={{ width:7, height:7, borderRadius: 4, background:cfg.dot }}/>{cas.status_display||cfg.label}
                </span>
                {isMinor&&<span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius: 4, fontSize:11, fontWeight:600, background:"#FEF3C7", color:"#92400E", fontFamily:"'DM Sans',sans-serif" }}>Minor</span>}
                {cas.is_deleted&&<span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius: 4, fontSize:11, fontWeight:600, background:"#FEF2F2", color:"#991B1B", fontFamily:"'DM Sans',sans-serif" }}><IcoTrash size={11} color="#991B1B"/> Deleted</span>}
              </div>
              <p style={{ margin:"0 0 2px", fontSize:16, fontWeight:700, color:"#0F172A", fontFamily:"'DM Sans',sans-serif" }}>vs. <span style={{ color:"#C45E10" }}>{cas.offender_name}</span></p>
              <p style={{ margin:0, fontSize:12.5, color:"#94A3B8", fontFamily:"'DM Sans',sans-serif" }}>Filed {fmt(cas.created_at)}</p>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              {!cas.is_deleted
                ? <button className="rd-btn" onClick={()=>setShowDeleteConfirm(true)}
                    style={{ padding:"8px 16px", borderRadius: 8, border:"1.5px solid #FECACA", background:"#FEF2F2", color:"#991B1B", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                    Delete Case
                  </button>
                : <button className="rd-btn" onClick={()=>setShowRecover(true)}
                    style={{ padding:"8px 16px", borderRadius: 8, border:"1.5px solid #A7F3D0", background:"#ECFDF5", color:"#065F46", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                    Recover Case
                  </button>
              }
            </div>
          </div>
        </div>

        {/* Two-column layout */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 340px", gap:16, alignItems:"start" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

            {/* Complainant Info */}
            <Card title="Complainant Information" icon={<IcoUser size={16} color="#F47920"/>}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                <InfoRow label="Full Name" value={cas.victim_name||[victim.first_name,victim.middle_name,victim.last_name].filter(Boolean).join(" ")||"-"}/>
                <InfoRow label="Date of Birth" value={fmtDate(victim.date_of_birth||victim.birthdate)}/>
                {(victim.date_of_birth||victim.birthdate)&&<InfoRow label="Age" value={`${age(victim.date_of_birth||victim.birthdate)} years old`}/>}
                <InfoRow label="Sex" value={victim.sex}/>
                <InfoRow label="Contact Number" value={victim.phone_number||cas.victim_phone}/>
                <InfoRow label="Email" value={victim.email||cas.victim_email} mono/>
                <div style={{ gridColumn:"span 2" }}><InfoRow label="Address" value={victim.address}/></div>
              </div>
              <div style={{ marginTop:16, paddingTop:16, borderTop:"1px solid #F1F5F9" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                  <IcoGuardian size={14} color="#F47920"/>
                  <span style={{ fontSize:10.5, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.07em", fontFamily:"'DM Sans',sans-serif" }}>Minor / Guardian</span>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
                  <InfoRow label="Victim is Minor" value={isMinor?"Yes (Below 18)":"No"} muted={!isMinor}/>
                  <InfoRow label="Guardian Name" value={victim.guardian_name||"N/A"} muted={!victim.guardian_name}/>
                  <InfoRow label="Relationship" value={victim.guardian_relationship||"N/A"} muted={!victim.guardian_relationship}/>
                </div>
              </div>
            </Card>

            {/* Reports */}
            {reports.map((r,idx)=>{
              const isDelR = r.is_deleted || false;
              const dLeft  = isDelR ? daysLeft(r.deleted_at) : null;
              return (
                <div key={r.id} id={`report-${r.id}`} style={{ scrollMarginTop:24 }}>
                  <Card
                    title={`Report ${idx+1} - Testimony`}
                    icon={<IcoClip size={16} color={isDelR?"#94A3B8":"#F47920"}/>}
                    style={{ opacity: isDelR ? 0.75 : 1, border: isDelR ? "1.5px dashed #FECACA" : "1px solid #E2E8F0" }}
                    headerRight={
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:11.5, color:"#94A3B8", fontFamily:"'DM Sans',sans-serif" }}>{fmt(r.created_at)}</span>
                        {isDelR ? (
                          // Show recover button for deleted reports
                          dLeft > 0 ? (
                            <button
                              onClick={()=>setRecoverReportTarget({id:r.id,num:idx+1})}
                              style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius: 4, border:"1.5px solid #A7F3D0", background:"#ECFDF5", color:"#065F46", fontSize:11.5, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                              <IcoRecover size={11} color="#065F46"/> Recover ({dLeft}d left)
                            </button>
                          ) : (
                            <span style={{ fontSize:11, color:"#EF4444", fontFamily:"'DM Sans',sans-serif" }}>Expired</span>
                          )
                        ) : (
                          // Show delete button only if more than 1 active report
                          activeReportCount > 1 && (
                            <button
                              onClick={()=>setDeleteReportTarget({id:r.id,num:idx+1})}
                              style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius: 4, border:"1.5px solid #FECACA", background:"#FEF2F2", color:"#991B1B", fontSize:11.5, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                              <IcoTrash size={11} color="#991B1B"/> Delete
                            </button>
                          )
                        )}
                      </div>
                    }>

                    {/* Deleted report banner */}
                    {isDelR && (
                      <div style={{ display:"flex", gap:10, alignItems:"flex-start", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius: 4, padding:"10px 14px", marginBottom:14 }}>
                        <IcoTrash size={14} color="#DC2626"/>
                        <div>
                          <p style={{ margin:"0 0 2px", fontSize:13, fontWeight:700, color:"#DC2626", fontFamily:"'DM Sans',sans-serif" }}>This report has been deleted</p>
                          <p style={{ margin:0, fontSize:12, color:"#991B1B", fontFamily:"'DM Sans',sans-serif" }}>
                            {dLeft > 0
                              ? `Recoverable for ${dLeft} more day${dLeft!==1?'s':''}. Go to Cases → Recently Deleted to manage deleted cases, or click Recover above.`
                              : "Recovery period has expired. This report will be permanently deleted."
                            }
                          </p>
                        </div>
                      </div>
                    )}

                    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                      <div>
                        <p style={{ margin:"0 0 8px", fontSize:10.5, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:"#94A3B8", fontFamily:"'DM Sans',sans-serif" }}>Incident Type</p>
                        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                          <select value={incidentTypes[r.id]||""} onChange={e=>setIncidentTypes(p=>({...p,[r.id]:e.target.value}))}
                            disabled={isDelR}
                            style={{ flex:1, padding:"8px 12px", borderRadius: 4, border:"1.5px solid #E2E8F0", fontSize:13.5, color:"#0F172A", background:"#F8FAFC", outline:"none", fontFamily:"'DM Sans',sans-serif", opacity:isDelR?0.5:1 }}
                            onFocus={e=>{ e.target.style.borderColor="#F47920"; e.target.style.background="#fff"; }}
                            onBlur={e=>{ e.target.style.borderColor="#E2E8F0"; e.target.style.background="#F8FAFC"; }}>
                            <option value="">- Not classified -</option>
                            {INCIDENT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                          </select>
                          {!isDelR && (
                            <button onClick={()=>handleIncidentTypeSave(r.id)}
                              disabled={incidentTypes[r.id]===(r.incident_type||"")}
                              style={{ padding:"8px 14px", borderRadius: 4, border:"none", background:incidentTypes[r.id]===(r.incident_type||"")?"#E2E8F0":"#F47920", color:incidentTypes[r.id]===(r.incident_type||"")?"#94A3B8":"#fff", fontSize:13, fontWeight:600, cursor:incidentTypes[r.id]===(r.incident_type||"")?"not-allowed":"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                              Save
                            </button>
                          )}
                        </div>
                      </div>
                      {r.incident_date&&(
                        <div>
                          <p style={{ margin:"0 0 4px", fontSize:10.5, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:"#94A3B8", fontFamily:"'DM Sans',sans-serif" }}>Date of Incident</p>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <IcoCal size={14} color="#F47920"/>
                            <span style={{ fontSize:13.5, color:"#0F172A", fontWeight:600, fontFamily:"'DM Sans',sans-serif" }}>{fmtDate(r.incident_date)}</span>
                          </div>
                        </div>
                      )}
                      {r.address&&<InfoRow label="Reported Location" value={r.address}/>}
                      <div>
                        <p style={{ margin:"0 0 8px", fontSize:10.5, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:"#94A3B8", fontFamily:"'DM Sans',sans-serif" }}>Statement</p>
                        {r.statement
                          ? <div style={{ background:"#F8FAFC", borderRadius: 4, padding:"14px 16px", fontSize:13.5, color:"#374151", lineHeight:1.75, borderLeft:"3px solid #FFE4CC", whiteSpace:"pre-wrap", fontFamily:"'DM Sans',sans-serif" }}>{r.statement}</div>
                          : <div style={{ background:"#F8FAFC", borderRadius: 4, padding:"14px 16px", fontSize:13, color:"#94A3B8", fontStyle:"italic", borderLeft:"3px solid #E2E8F0", fontFamily:"'DM Sans',sans-serif" }}>No statement provided.</div>
                        }
                      </div>
                      {r.photo_urls?.length>0&&(
                        <div>
                          <p style={{ margin:"0 0 8px", fontSize:10.5, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:"#94A3B8", fontFamily:"'DM Sans',sans-serif" }}>Evidence Photos ({r.photo_urls.length})</p>
                          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))", gap:8 }}>
                            {r.photo_urls.map((url,i)=>(
                              <div key={i} onClick={()=>setLightbox(url)} style={{ aspectRatio:"1", borderRadius: 4, overflow:"hidden", cursor:"zoom-in", border:"1px solid #E2E8F0" }}>
                                <img src={url} alt={`Evidence ${i+1}`} style={{ width:"100%", height:"100%", objectFit:"cover", transition:"transform 0.2s" }}
                                  onMouseEnter={e=>e.target.style.transform="scale(1.05)"}
                                  onMouseLeave={e=>e.target.style.transform="scale(1)"}/>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {(r.latitude&&r.longitude)&&(
                        <a href={`https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`} target="_blank" rel="noopener noreferrer" className="rd-map"
                          style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 12px", borderRadius: 4, border:"1.5px solid #E2E8F0", color:"#475569", fontSize:13, fontWeight:600, textDecoration:"none", fontFamily:"'DM Sans',sans-serif" }}>
                          <IcoPin size={14} color="#94A3B8"/> View on Google Maps
                        </a>
                      )}
                    </div>
                  </Card>
                </div>
              );
            })}

            <Card title="Case Information" icon={<IcoClip size={16} color="#F47920"/>}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:"16px 24px" }}>
                <InfoRow label="Case Number"   value={cas.case_number} mono/>
                <InfoRow label="Respondent"    value={cas.offender_name}/>
                <InfoRow label="Date Filed"    value={fmt(cas.created_at)}/>
                <InfoRow label="Last Updated"  value={fmt(cas.updated_at)}/>
                {cas.admin_id&&<InfoRow label="Handled By" value={cas.handled_by||`Admin #${cas.admin_id}`}/>}
                <InfoRow label="Total Reports" value={`${reports.length} ${reports.length===1?"testimony":"testimonies"}`}/>
              </div>
            </Card>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:16, position:"sticky", top:20 }}>
            <CaseTimeline cas={cas} onUpdateStatus={()=>setShowStatusModal(true)} onReferToPolice={handleReferToPolice}/>
            <PrintPanel cas={cas}/>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast&&(
        <div style={{ position:"fixed", top:20, right:20, zIndex:999, background:"#fff", border:`1px solid ${toast.success?"#A7F3D0":"#FECACA"}`, borderRadius: 4, padding:"12px 18px", boxShadow:"0 8px 24px rgba(0,0,0,0.10)", display:"flex", alignItems:"center", gap:9, animation:"slideDown 0.2s ease", fontSize:13.5, color:toast.success?"#065F46":"#991B1B", fontWeight:500, fontFamily:"'DM Sans',sans-serif" }}>
          <span style={{ width:20, height:20, borderRadius: 4, background:toast.success?"#D1FAE5":"#FEE2E2", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            {toast.success?<svg width="10" height="10" fill="none" viewBox="0 0 20 20"><path d="M5 10l4 4 6-8" stroke="#10B981" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"/></svg>:<svg width="10" height="10" fill="none" viewBox="0 0 20 20"><path d="M15 5L5 15M5 5l10 10" stroke="#EF4444" strokeWidth={2} strokeLinecap="round"/></svg>}
          </span>
          {toast.msg}
        </div>
      )}

      {/* Lightbox */}
      {lightbox&&(
        <div onClick={()=>setLightbox(null)} style={{ position:"fixed", inset:0, zIndex:2000, background:"rgba(0,0,0,0.88)", backdropFilter:"blur(6px)", display:"flex", alignItems:"center", justifyContent:"center", padding:20, cursor:"zoom-out" }}>
          <img src={lightbox} alt="Evidence" style={{ maxWidth:"90vw", maxHeight:"90vh", borderRadius: 4, objectFit:"contain" }}/>
          <button onClick={()=>setLightbox(null)} style={{ position:"absolute", top:20, right:20, width:40, height:40, borderRadius: 4, background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.2)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 20 20"><path d="M15 5L5 15M5 5l10 10" stroke="#fff" strokeWidth={2} strokeLinecap="round"/></svg>
          </button>
        </div>
      )}

      {/* Modals */}
      {showStatusModal&&<StatusModal current={cas.status} onClose={()=>setShowStatusModal(false)} onSave={handleStatusSave} saving={statusSaving}/>}
      {showDeleteConfirm&&<DeleteModal caseId={cas.case_number} loading={actionLoading} onConfirm={handleDelete} onClose={()=>setShowDeleteConfirm(false)}/>}
      {showRecover&&<ConfirmModal title="Recover Case" message={`Restore case ${cas.case_number}?`} confirmLabel="Recover" danger={false} loading={actionLoading} onConfirm={handleRecover} onClose={()=>setShowRecover(false)}/>}

      {/* Delete report modal */}
      {deleteReportTarget&&(
        <DeleteReportModal
          reportNum={deleteReportTarget.num}
          onClose={()=>setDeleteReportTarget(null)}
          onConfirm={handleDeleteReport}
          loading={deletingReport}
        />
      )}

      {/* Recover report confirm */}
      {recoverReportTarget&&(
        <ConfirmModal
          title={`Recover Report ${recoverReportTarget.num}`}
          message={`This will restore Report ${recoverReportTarget.num} and make it visible again in the case.`}
          confirmLabel="Recover Report"
          danger={false}
          loading={recoveringReport}
          onConfirm={handleRecoverReport}
          onClose={()=>setRecoverReportTarget(null)}
        />
      )}
    </AdminLayout>
  );
}
