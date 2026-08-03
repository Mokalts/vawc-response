import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavbar from '../components/BottomNavbar';
import api from '../api';

if (!document.getElementById('vawc-font')) {
    const l = document.createElement('link'); l.id='vawc-font'; l.rel='stylesheet';
    l.href='https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}
if (!document.getElementById('vawc-mycases-css')) {
    const s = document.createElement('style'); s.id='vawc-mycases-css';
    s.textContent=`
        @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes popIn  { from{opacity:0;transform:scale(0.95) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes shimmer{ 0%,100%{opacity:1} 50%{opacity:0.45} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        .vmc-card { transition:transform 0.15s ease,box-shadow 0.15s ease; cursor:pointer; }
        .vmc-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(244,121,32,0.12) !important; }
        .vmc-card:active { transform:scale(0.99); }
        .vmc-btn { transition:all 0.15s ease; }
        .vmc-btn:hover:not([disabled]) { opacity:0.9; transform:translateY(-1px); }
        .vmc-report-row:hover { background:#F8FAFC !important; }
        .vmc-report-row { transition:background 0.1s; }
    `;
    document.head.appendChild(s);
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const IcoFolder = ({ c='#CBD5E1', size=48 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoDoc    = ({ c='#CBD5E1', size=36 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoX      = ({ c='#64748B', size=16 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>);
const IcoArrow  = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#F47920" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoBell   = ({ c='#F47920' }) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoUser   = ({ c='#94A3B8', size=13 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={c} strokeWidth="1.8"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></svg>);
const IcoCal    = ({ c='#94A3B8', size=13 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke={c} strokeWidth="1.8"/><path d="M16 2v4M8 2v4M3 10h18" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></svg>);
const IcoPin    = ({ c='#94A3B8', size=13 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="10" r="3" stroke={c} strokeWidth="1.8"/></svg>);
const IcoImg    = ({ c='#94A3B8', size=13 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke={c} strokeWidth="1.8"/><circle cx="8.5" cy="8.5" r="1.5" stroke={c} strokeWidth="1.8"/><path d="M21 15l-5-5L5 21" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></svg>);
const IcoInfo   = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#92400E" strokeWidth="1.8"/><line x1="12" y1="8" x2="12" y2="12" stroke="#92400E" strokeWidth="1.8" strokeLinecap="round"/><line x1="12" y1="16" x2="12.01" y2="16" stroke="#92400E" strokeWidth="2.4" strokeLinecap="round"/></svg>);
const IcoWarn   = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#BE123C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke="#BE123C" strokeWidth="1.8" strokeLinecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="#BE123C" strokeWidth="2.4" strokeLinecap="round"/></svg>);

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_MAP = {
    submitted:             { label:'Submitted',               bg:'#F1F5F9', color:'#475569', dot:'#94A3B8' },
    awaiting_onsite_visit: { label:'Awaiting Onsite Visit',   bg:'#FFFBEB', color:'#92400E', dot:'#F59E0B' },
    under_process:         { label:'Under Process',           bg:'#ECFEFF', color:'#0E7490', dot:'#06B6D4' },
    summon_issued:         { label:'Summon Letter Issued',     bg:'#F3E5F5', color:'#7B2D8B', dot:'#9B4DAB' },
    summon_acknowledged:   { label:'Summon Acknowledged',      bg:'#F0FDF4', color:'#166534', dot:'#22C55E' },
    resolved:              { label:'Resolved',                 bg:'#ECFDF5', color:'#065F46', dot:'#059669' },
    referred_to_police:    { label:'Referred to Authorities',  bg:'#FFF3E0', color:'#C45E10', dot:'#F47920' },
};
const getSt   = (s) => STATUS_MAP[s] || { label:s||'Unknown', bg:'#F1F5F9', color:'#475569', dot:'#94A3B8' };
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric'}) : '-';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'}) : '';
const trunc   = (s,n) => !s?'-':s.length>n?s.slice(0,n)+'…':s;

// Timeline steps
const STATUS_STEPS = [
    { key:'submitted',             label:'Submitted' },
    { key:'awaiting_onsite_visit', label:'Awaiting Onsite Visit' },
    { key:'under_process',         label:'Under Process' },
    { key:'summon_issued',         label:'Summon Letter Issued' },
    { key:'summon_acknowledged',   label:'Summon Acknowledged' },
    { key:'resolved',              label:'Resolved' },
];

// ─── Skeleton ──────────────────────────────────────────────────────────────────
const Skel = () => (
    <div style={S.card}>
        {[['60%',12],['100%',11],['75%',11]].map(([w,h],i)=>(
            <div key={i} style={{width:w,height:h,borderRadius: 4,backgroundColor:'#F1F5F9',marginBottom:i<2?10:0,animation:'shimmer 1.2s infinite'}}/>
        ))}
    </div>
);

// ─── Status Timeline ──────────────────────────────────────────────────────────
function StatusTimeline({ currentStatus }) {
    const isReferred = currentStatus === 'referred_to_police';
    const steps = isReferred
        ? [...STATUS_STEPS.slice(0,3), { key:'referred_to_police', label:'Referred to Authorities' }]
        : STATUS_STEPS;
    const currentIdx = steps.findIndex(s => s.key === currentStatus);
    return (
        <div style={{display:'flex',flexDirection:'column',gap:0}}>
            {steps.map((step,idx)=>{
                const done=idx<=currentIdx, current=idx===currentIdx;
                const st = getSt(step.key);
                return (
                    <div key={step.key} style={{display:'flex',alignItems:'flex-start',gap:10}}>
                        <div style={{display:'flex',flexDirection:'column',alignItems:'center',flexShrink:0}}>
                            <div style={{width:20,height:20,borderRadius: '50%',background:current?st.dot:done?'#059669':'#E2E8F0',display:'flex',alignItems:'center',justifyContent:'center',border:current?`2px solid ${st.dot}`:'none'}}>
                                {done&&!current&&<svg width="10" height="10" fill="none" viewBox="0 0 20 20"><path d="M4 10l5 5 7-9" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                {current&&<div style={{width:7,height:7,borderRadius: '50%',background:'#fff'}}/>}
                            </div>
                            {idx<steps.length-1&&<div style={{width:2,height:18,background:done&&!current?'#059669':'#E2E8F0',marginTop:2}}/>}
                        </div>
                        <p style={{margin:'2px 0 18px',fontSize:13,fontWeight:current?700:500,color:current?st.color:done?'#059669':'#94A3B8',fontFamily:"'DM Sans',sans-serif"}}>
                            {step.label}
                            {current&&<span style={{marginLeft:6,fontSize:10.5,background:'#FFF3E0',color:'#F47920',padding:'2px 7px',borderRadius: 9999,fontWeight:700}}>Current</span>}
                        </p>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Case Card ────────────────────────────────────────────────────────────────
function CaseCard({ cas, onClick }) {
    const st = getSt(cas.status);
    return (
        <div className="vmc-card" style={{...S.card, border: cas.has_status_update?'1.5px solid #F47920':'1px solid #FFE4CC'}} onClick={onClick}>
            {cas.has_status_update && (
                <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:8}}>
                    <span style={{width:8,height:8,borderRadius: '50%',background:'#F47920',flexShrink:0}}/>
                    <span style={{fontSize:11,fontWeight:700,color:'#F47920',fontFamily:"'DM Sans',sans-serif"}}>Status Updated</span>
                </div>
            )}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                <div>
                    <p style={{margin:'0 0 2px',fontSize:11,fontWeight:700,color:'#C45E10',fontFamily:"'DM Sans',sans-serif",letterSpacing:'0.5px'}}>{cas.case_number}</p>
                    <p style={{margin:0,fontSize:13.5,fontWeight:700,color:'#0F172A',fontFamily:"'DM Sans',sans-serif"}}>vs. {cas.offender_name}</p>
                </div>
                <span style={{...S.badge,backgroundColor:st.bg,color:st.color}}>
                    <span style={{width:8,height:8,borderRadius: '50%',backgroundColor:st.dot,flexShrink:0}}/>
                    {cas.status_display || st.label}
                </span>
            </div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                    <span style={S.meta}><IcoCal/> {fmtDate(cas.created_at)}</span>
                    <span style={S.meta}><IcoDoc c="#94A3B8" size={13}/> {cas.report_count} {cas.report_count===1?'report':'reports'}</span>
                </div>
                <span style={S.viewLink}>View case <IcoArrow/></span>
            </div>
        </div>
    );
}

// ─── Report Row ───────────────────────────────────────────────────────────────
function ReportRow({ report, index, onClick }) {
    return (
        <div className="vmc-report-row" onClick={onClick}
            style={{padding:'14px 16px',borderBottom:'1px solid #F8FAFC',cursor:'pointer',backgroundColor:'#fff'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                <div style={{display:'flex',alignItems:'center',gap:7}}>
                    <span style={{fontSize:11.5,fontWeight:700,color:'#C45E10',background:'#FFF3E0',padding:'2px 8px',borderRadius: 4,fontFamily:"'DM Sans',sans-serif"}}>
                        Report #{index+1}
                    </span>
                    {report.incident_type&&(
                        <span style={{fontSize:11,color:'#4A1259',background:'#FFF3E0',padding:'2px 7px',borderRadius: 4,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>
                            {report.incident_type}
                        </span>
                    )}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:4}}>
                    <IcoCal c="#94A3B8" size={11}/>
                    <span style={{fontSize:11.5,color:'#94A3B8',fontFamily:"'DM Sans',sans-serif"}}>{fmtDate(report.created_at)}</span>
                </div>
            </div>
            <p style={{margin:0,fontSize:13.5,color:'#475569',lineHeight:1.5,fontFamily:"'DM Sans',sans-serif"}}>
                {trunc(report.statement,100)}
            </p>
            <div style={{display:'flex',alignItems:'center',gap:10,marginTop:6}}>
                {report.address&&<span style={S.meta}><IcoPin/> {trunc(report.address,30)}</span>}
                {report.photo_urls?.length>0&&<span style={S.meta}><IcoImg/> {report.photo_urls.length} photo{report.photo_urls.length>1?'s':''}</span>}
            </div>
        </div>
    );
}

// ─── Report Detail Modal ──────────────────────────────────────────────────────
function ReportDetailModal({ report, index, onClose }) {
    return (
        <div style={S.backdrop} onClick={onClose}>
            <div style={S.modal} onClick={e=>e.stopPropagation()}>
                <div style={S.modalHead}>
                    <div>
                        <p style={S.modalTitle}>Report #{index+1}</p>
                        <p style={{margin:0,fontSize:12,color:'#94A3B8',fontFamily:"'DM Sans',sans-serif"}}>
                            {fmtDate(report.created_at)} at {fmtTime(report.created_at)}
                        </p>
                    </div>
                    <button style={S.closeBtn} onClick={onClose}><IcoX/></button>
                </div>
                <div style={S.modalBody}>
                    {report.incident_type&&(
                        <div style={S.detailItem}>
                            <p style={S.detailLabel}>Incident Type</p>
                            <p style={S.detailValue}>{report.incident_type}</p>
                        </div>
                    )}
                    {report.incident_date&&(
                        <div style={S.detailItem}>
                            <p style={S.detailLabel}>Date of Incident</p>
                            <p style={S.detailValue}>{fmtDate(report.incident_date)}</p>
                        </div>
                    )}
                    <div style={S.detailItem}>
                        <p style={S.detailLabel}>Statement</p>
                        <p style={S.detailValue}>{report.statement}</p>
                    </div>
                    {report.address&&(
                        <div style={S.detailItem}>
                            <p style={S.detailLabel}>Location</p>
                            <p style={S.detailValue}>{report.address}</p>
                        </div>
                    )}
                    {report.photo_urls?.length>0&&(
                        <div style={S.detailItem}>
                            <p style={S.detailLabel}>Photos ({report.photo_urls.length})</p>
                            <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:4}}>
                                {report.photo_urls.map((url,i)=>(
                                    <a key={i} href={url} target="_blank" rel="noreferrer">
                                        <img src={url} alt={`Evidence ${i+1}`} style={{width:70,height:70,objectFit:'cover',borderRadius: 4,border:'1px solid #E2E8F0'}}/>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                    <div style={{display:'flex',gap:8,alignItems:'flex-start',backgroundColor:'#FFFBEB',borderRadius: 4,padding:'11px 13px',border:'1px solid #FDE68A'}}>
                        <IcoInfo/>
                        <p style={{fontSize:13,color:'#92400E',lineHeight:1.6,margin:0,fontFamily:"'DM Sans',sans-serif"}}>
                            This report is encrypted and confidential.
                        </p>
                    </div>
                    <button className="vmc-btn" style={S.closeFullBtn} onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
}

// ─── Case Detail Modal ────────────────────────────────────────────────────────
function CaseDetailModal({ cas, onClose, onStatusRead }) {
    const [selectedReport, setSelectedReport] = useState(null);
    const st = getSt(cas.status);

    useEffect(() => {
        if (cas.has_status_update) onStatusRead(cas.id);
    }, []);

    return (
        <div style={S.backdrop} onClick={onClose}>
            <div style={{...S.modal,maxWidth:480}} onClick={e=>e.stopPropagation()}>
                <div style={S.modalHead}>
                    <div>
                        <p style={{...S.modalTitle,fontSize:14}}>{cas.case_number}</p>
                        <p style={{margin:'2px 0 0',fontSize:13,fontWeight:700,color:'#0F172A',fontFamily:"'DM Sans',sans-serif"}}>vs. {cas.offender_name}</p>
                    </div>
                    <button style={S.closeBtn} onClick={onClose}><IcoX/></button>
                </div>
                <div style={S.modalBody}>
                    {/* Status update notice */}
                    {cas.has_status_update && (
                        <div style={{display:'flex',gap:8,alignItems:'flex-start',backgroundColor:'#FFF3E0',borderRadius: 4,padding:'11px 13px',border:'1px solid #FFE4CC'}}>
                            <IcoBell/>
                            <p style={{fontSize:13,color:'#C45E10',lineHeight:1.6,margin:0,fontFamily:"'DM Sans',sans-serif"}}>
                                The barangay has updated your case status.
                            </p>
                        </div>
                    )}

                    {/* Messages from the barangay (log — e.g., hearing schedule / venue) */}
                    {cas.messages && cas.messages.length > 0 && (
                        <div style={{backgroundColor:'#F3E5F5',borderRadius:12,padding:'14px 15px',border:'1.5px solid #E1BEE7'}}>
                            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                                <IcoBell c="#7B2D8B"/>
                                <p style={{margin:0,fontSize:13.5,fontWeight:800,color:'#4A1259',fontFamily:"'DM Sans',sans-serif"}}>Messages from the Barangay ({cas.messages.length})</p>
                            </div>
                            <div style={{display:'flex',flexDirection:'column',gap:10}}>
                                {cas.messages.map(m => (
                                    <div key={m.id} style={{backgroundColor:'#fff',borderRadius:8,padding:'10px 12px',border:'1px solid #E1BEE7'}}>
                                        <p style={{margin:0,fontSize:13.5,color:'#4A1259',lineHeight:1.6,whiteSpace:'pre-line',fontFamily:"'DM Sans',sans-serif"}}>{m.message}</p>
                                        <p style={{margin:'6px 0 0',fontSize:11,color:'#9B4DAB',fontFamily:"'DM Sans',sans-serif"}}>{fmtDate(m.created_at)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Status */}
                    <div style={S.detailItem}>
                        <p style={S.detailLabel}>Case Status</p>
                        <span style={{...S.badge,backgroundColor:st.bg,color:st.color,marginBottom:14,display:'inline-flex'}}>
                            <span style={{width:8,height:8,borderRadius: '50%',backgroundColor:st.dot,flexShrink:0}}/>
                            {cas.status_display||st.label}
                        </span>
                        <StatusTimeline currentStatus={cas.status}/>
                    </div>

                    {/* Onsite verification notice - victim must appear in person */}
                    {cas.status === 'awaiting_onsite_visit' && (
                        <div style={{backgroundColor:'#FFF3E0',borderRadius: 12,padding:'15px 16px',border:'1.5px solid #F47920'}}>
                            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                                <IcoPin c="#C45E10" size={17}/>
                                <p style={{margin:0,fontSize:13.5,fontWeight:800,color:'#C45E10',fontFamily:"'DM Sans',sans-serif"}}>
                                    Action Needed: Visit the VAWC Office
                                </p>
                            </div>
                            <p style={{margin:'0 0 10px',fontSize:13,color:'#7A3A0E',lineHeight:1.65,fontFamily:"'DM Sans',sans-serif"}}>
                                To move your case forward and receive protection, please <strong>appear in person at the Barangay VAWC Office</strong> so a VAWC officer can verify your identity and confirm your report. Protection measures can only be issued after this in-person verification.
                            </p>
                            <div style={{display:'flex',flexDirection:'column',gap:5,backgroundColor:'#fff',borderRadius: 8,padding:'11px 13px',border:'1px solid #FFE4CC'}}>
                                <span style={{display:'flex',alignItems:'center',gap:7,fontSize:12.5,color:'#0F172A',fontFamily:"'DM Sans',sans-serif"}}>
                                    <IcoPin c="#F47920" size={13}/> Barangay Palanginan VAWC Desk, Barangay Hall
                                </span>
                                <span style={{display:'flex',alignItems:'center',gap:7,fontSize:12.5,color:'#0F172A',fontFamily:"'DM Sans',sans-serif"}}>
                                    <IcoCal c="#F47920" size={13}/> Monday to Friday, 8:00 AM – 5:00 PM
                                </span>
                            </div>
                            <p style={{margin:'10px 0 0',fontSize:11.5,color:'#94A3B8',lineHeight:1.55,fontFamily:"'DM Sans',sans-serif"}}>
                                If it is unsafe for you to travel to the office, you may call the Barangay VAWC Desk to arrange a safe way to verify.
                            </p>
                        </div>
                    )}

                    {/* Reports */}
                    {cas.reports&&cas.reports.length>0&&(
                        <div>
                            <p style={{margin:'0 0 8px',fontSize:11,fontWeight:700,color:'#C45E10',textTransform:'uppercase',letterSpacing:'0.6px',fontFamily:"'DM Sans',sans-serif"}}>
                                Reports / Testimonies ({cas.reports.length})
                            </p>
                            <div style={{backgroundColor:'#fff',borderRadius: 0,border:'1px solid #E2E8F0',overflow:'hidden'}}>
                                {cas.reports.map((r,i)=>(
                                    <ReportRow key={r.id} report={r} index={i} onClick={()=>setSelectedReport({report:r,index:i})}/>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{display:'flex',gap:8,alignItems:'flex-start',backgroundColor:'#FFFBEB',borderRadius: 4,padding:'11px 13px',border:'1px solid #FDE68A'}}>
                        <IcoInfo/>
                        <p style={{fontSize:13,color:'#92400E',lineHeight:1.6,margin:0,fontFamily:"'DM Sans',sans-serif"}}>
                            Your case is encrypted and confidential. Only authorized VAWC officers can view it.
                        </p>
                    </div>

                    <button className="vmc-btn" style={S.closeFullBtn} onClick={onClose}>Close</button>
                </div>
            </div>

            {selectedReport&&(
                <ReportDetailModal
                    report={selectedReport.report}
                    index={selectedReport.index}
                    onClose={()=>setSelectedReport(null)}
                />
            )}
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function MyCases() {
    const navigate = useNavigate();
    const [cases,         setCases]         = useState([]);
    const [loading,       setLoading]       = useState(true);
    const [error,         setError]         = useState('');
    const [selectedCase,  setSelectedCase]  = useState(null);
    const [caseDetail,    setCaseDetail]    = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    useEffect(()=>{
        const fetch = async()=>{
            setLoading(true); setError('');
            try {
                const res = await api.get('/cases/');
                setCases(res.data);
            } catch {
                setError('Failed to load your cases. Please try again.');
            } finally { setLoading(false); }
        };
        fetch();
    },[]);

    const openCase = async(cas) => {
        setSelectedCase(cas);
        setDetailLoading(true);
        try {
            const res = await api.get(`/cases/${cas.id}`);
            setCaseDetail(res.data);
        } catch {
            setCaseDetail(cas);
        } finally { setDetailLoading(false); }
    };

    const handleStatusRead = async(caseId) => {
        try {
            await api.post(`/cases/${caseId}/mark-read`);
            setCases(prev=>prev.map(c=>c.id===caseId?{...c,has_status_update:false}:c));
        } catch {}
    };

    const newCount     = cases.filter(c=>c.has_status_update).length;
    const totalReports = cases.reduce((a,c)=>a+(c.report_count||0),0);

    return (
        <div style={S.page}>
            <header style={S.topBar}>
                <div>
                    <p style={S.title}>My Cases</p>
                    <p style={S.count}>{cases.length} case{cases.length!==1?'s':''} · {totalReports} report{totalReports!==1?'s':''}{newCount>0?` · ${newCount} updated`:''}</p>
                </div>
                {newCount>0&&(
                    <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'5px 12px',borderRadius: 4,background:'#FFF3E0',color:'#F47920',fontSize:12,fontWeight:700,fontFamily:"'DM Sans',sans-serif",border:'1px solid #FFE4CC'}}>
                        <IcoBell/> {newCount} update{newCount>1?'s':''}
                    </span>
                )}
            </header>

            <main style={S.content}>
                {error&&(
                    <div style={S.errorBox}>
                        <IcoWarn/>
                        <p style={{margin:0,fontSize:13,color:'#BE123C',fontFamily:"'DM Sans',sans-serif"}}>{error}</p>
                    </div>
                )}

                {loading&&[1,2,3].map(i=><Skel key={i}/>)}

                {!loading&&!error&&cases.length===0&&(
                    <div style={S.empty}>
                        <IcoFolder/>
                        <p style={S.emptyTitle}>No cases yet</p>
                        <p style={S.emptyText}>You haven't filed any cases. Tap below to submit a report.</p>
                        <button className="vmc-btn" style={S.emptyBtn} onClick={()=>navigate('/report')}>
                            Submit a Report
                        </button>
                    </div>
                )}

                {!loading&&cases.map(c=>(
                    <CaseCard key={c.id} cas={c} onClick={()=>openCase(c)}/>
                ))}
            </main>

            {selectedCase&&(
                detailLoading
                    ? <div style={{position:'fixed',inset:0,backgroundColor:'rgba(15,23,42,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:500}}>
                        <div style={{width:40,height:40,border:'3px solid #FFF3E0',borderTopColor:'#F47920',borderRadius: '50%',animation:'spin 0.7s linear infinite'}}/>
                      </div>
                    : caseDetail&&<CaseDetailModal
                        cas={caseDetail}
                        onClose={()=>{setSelectedCase(null);setCaseDetail(null);}}
                        onStatusRead={handleStatusRead}
                      />
            )}

            <BottomNavbar active="reports"/>
        </div>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
    page:        { minHeight:'100vh',backgroundColor:'#FFF3E0',display:'flex',flexDirection:'column',paddingBottom:80,fontFamily:"'DM Sans',sans-serif" },
    topBar:      { display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',backgroundColor:'#fff',borderBottom:'1px solid #FFE4CC',position:'sticky',top:0,zIndex:100,boxShadow:'0 1px 8px rgba(244,121,32,0.06)' },
    title:       { fontSize:18,fontWeight:800,color:'#C45E10',fontFamily:"'DM Sans',sans-serif",margin:'0 0 2px' },
    count:       { fontSize:12.5,fontWeight:600,color:'#94A3B8',fontFamily:"'DM Sans',sans-serif",margin:0 },
    content:     { padding:'20px',display:'flex',flexDirection:'column',gap:12 },
    errorBox:    { display:'flex',alignItems:'center',gap:8,backgroundColor:'#FFF1F2',border:'1px solid #FECDD3',borderRadius: 8,padding:'12px 15px' },
    card:        { backgroundColor:'#fff',borderRadius: 12,padding:'18px 16px',boxShadow:'0 2px 10px rgba(244,121,32,0.06)',border:'1px solid #FFE4CC',animation:'fadeUp 0.2s ease' },
    badge:       { display:'inline-flex',alignItems:'center',gap:5,fontSize:11.5,fontWeight:700,padding:'4px 10px',borderRadius: 12,fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap' },
    meta:        { display:'inline-flex',alignItems:'center',gap:4,fontSize:11.5,color:'#94A3B8',fontFamily:"'DM Sans',sans-serif" },
    viewLink:    { display:'inline-flex',alignItems:'center',gap:3,fontSize:12.5,fontWeight:700,color:'#F47920',fontFamily:"'DM Sans',sans-serif" },
    empty:       { display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',padding:'60px 24px',gap:10 },
    emptyTitle:  { fontSize:18,fontWeight:700,color:'#C45E10',fontFamily:"'DM Sans',sans-serif" },
    emptyText:   { fontSize:14,color:'#94A3B8',lineHeight:1.6,fontFamily:"'DM Sans',sans-serif",maxWidth:280 },
    emptyBtn:    { marginTop:8,padding:'13px 28px',backgroundColor:'#F47920',color:'#fff',fontSize:15,fontWeight:600,border:'none',borderRadius: 4,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",boxShadow:'0 2px 8px rgba(244,121,32,0.25)' },
    backdrop:    { position:'fixed',inset:0,backgroundColor:'rgba(15,23,42,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:500,backdropFilter:'blur(3px)',padding:'20px 16px',animation:'fadeIn 0.18s ease' },
    modal:       { backgroundColor:'#fff',borderRadius: 16,width:'100%',maxWidth:420,maxHeight:'88vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(15,23,42,0.2)',animation:'popIn 0.22s ease' },
    modalHead:   { display:'flex',justifyContent:'space-between',alignItems:'center',padding:'18px 20px 14px',borderBottom:'1px solid #F1F5F9',flexShrink:0 },
    modalBody:   { overflowY:'auto',padding:'16px 20px 24px',display:'flex',flexDirection:'column',gap:12 },
    modalTitle:  { fontSize:17,fontWeight:800,color:'#C45E10',fontFamily:"'DM Sans',sans-serif",margin:0 },
    closeBtn:    { width:34,height:34,borderRadius: 10,backgroundColor:'transparent',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' },
    detailItem:  { backgroundColor:'#F8FAFC',borderRadius: 0,padding:'14px 15px',border:'1px solid #E2E8F0' },
    detailLabel: { fontSize:10.5,fontWeight:700,color:'#C45E10',textTransform:'uppercase',letterSpacing:'0.7px',margin:'0 0 6px',fontFamily:"'DM Sans',sans-serif" },
    detailValue: { fontSize:14.5,color:'#0F172A',lineHeight:1.6,margin:0,fontFamily:"'DM Sans',sans-serif" },
    closeFullBtn:{ flex:1,padding:13,backgroundColor:'#F47920',color:'#fff',fontSize:15,fontWeight:600,border:'none',borderRadius: 4,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',justifyContent:'center',gap:6 },
};

export default MyCases;
