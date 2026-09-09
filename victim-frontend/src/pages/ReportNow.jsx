import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import BottomNavbar from '../components/BottomNavbar';
import LocationPicker from '../components/LocationPicker';
import api from '../api';

if (!document.getElementById('vawc-font')) {
    const l = document.createElement('link'); l.id='vawc-font'; l.rel='stylesheet';
    l.href='https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}
if (!document.getElementById('vawc-rn-css')) {
    const s = document.createElement('style'); s.id='vawc-rn-css';
    s.textContent=`
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .vrn-btn-hover:hover { opacity:0.88; transform:translateY(-1px); }
        .vrn-btn-hover { transition: opacity 0.15s, transform 0.15s; }
        .vrn-remove:hover { background-color:#FFF1F2 !important; border-color:#FCA5A5 !important; }
        .vrn-remove { transition: background-color 0.15s, border-color 0.15s; }
        .vrn-upload-hover:hover { background-color:var(--surface-tint) !important; border-color:#F47920 !important; }
        .vrn-upload-hover { transition: background-color 0.15s, border-color 0.15s; }

        /* ── Success screen ─────────────────────────────────────────────── */
        :root { --vrn-ok:#047857; --vrn-ok-soft:rgba(4,120,87,0.10); --vrn-ok-line:rgba(4,120,87,0.28); }
        [data-theme="dark"] { --vrn-ok:#34D399; --vrn-ok-soft:rgba(52,211,153,0.13); --vrn-ok-line:rgba(52,211,153,0.32); }

        @keyframes vrnSeal   { 0%{opacity:0;transform:scale(0.72)} 60%{opacity:1;transform:scale(1.06)} 100%{opacity:1;transform:scale(1)} }
        @keyframes vrnRing   { 0%{opacity:0.55;transform:scale(0.85)} 100%{opacity:0;transform:scale(1.75)} }
        @keyframes vrnDraw   { to{stroke-dashoffset:0} }
        @keyframes vrnRise   { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes vrnGrow   { from{transform:scaleY(0)} to{transform:scaleY(1)} }
        @keyframes vrnDot    { from{opacity:0;transform:scale(0.4)} to{opacity:1;transform:scale(1)} }

        .vrn-seal  { animation: vrnSeal 0.55s cubic-bezier(0.34,1.4,0.5,1) both; }
        .vrn-ring  { animation: vrnRing 1.5s ease-out 0.25s 2 both; }
        .vrn-draw  { stroke-dasharray:1; stroke-dashoffset:1; animation: vrnDraw 0.45s cubic-bezier(0.65,0,0.35,1) 0.3s forwards; }
        .vrn-rise  { animation: vrnRise 0.5s cubic-bezier(0.22,1,0.36,1) both; }
        .vrn-grow  { transform-origin:top; animation: vrnGrow 0.5s cubic-bezier(0.22,1,0.36,1) both; }
        .vrn-dot   { animation: vrnDot 0.35s cubic-bezier(0.34,1.4,0.5,1) both; }

        @media (prefers-reduced-motion: reduce) {
            .vrn-seal, .vrn-ring, .vrn-draw, .vrn-rise, .vrn-grow, .vrn-dot {
                animation: none !important; opacity:1 !important; transform:none !important; stroke-dashoffset:0 !important;
            }
            .vrn-ring { display:none !important; }
        }
    `;
    document.head.appendChild(s);
}

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const MIN_CHARS = 10;
const MAX_PHOTOS = 5;              // cap per report to control cloud storage
const MAX_MB = 10;                 // per-photo size limit (matches backend)
const ALLOWED_IMG = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const RELATIONSHIP_OPTS = [
    { id: 'current_spouse_partner', label: 'Current spouse / partner' },
    { id: 'former_spouse_partner', label: 'Former spouse / partner' },
    { id: 'current_dating', label: 'Current dating relationship' },
    { id: 'former_dating', label: 'Former dating relationship' },
    { id: 'immediate_family', label: 'Immediate family' },
    { id: 'other_relative', label: 'Other relative' },
    { id: 'neighbor_coworker', label: 'Neighbor / co-worker' },
    { id: 'person_of_authority', label: 'Person of authority' },
    { id: 'stranger', label: 'Stranger' },
    { id: 'others', label: 'Others' },
];
const ABUSE_OPTS = [
    { id: 'physical', label: 'Physical' },
    { id: 'sexual', label: 'Sexual' },
    { id: 'psychological', label: 'Psychological / emotional' },
    { id: 'economic', label: 'Economic' },
    { id: 'others', label: 'Others' },
];

// ── Icons ─────────────────────────────────────────────────────────────────────
const IcoArrow  = ({ dir='left', c='#C45E10' }) => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d={dir==='left'?"M15 18l-6-6 6-6":"M9 18l6-6-6-6"} stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoCheck  = ({ c='#059669', size=16 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoCamera = ({ c='#fff' }) => (<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="13" r="4" stroke={c} strokeWidth="1.8"/></svg>);
const IcoImage  = ({ c='#F47920' }) => (<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke={c} strokeWidth="1.8"/><circle cx="8.5" cy="8.5" r="1.5" stroke={c} strokeWidth="1.8"/><path d="M21 15l-5-5L5 21" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoPin    = ({ c='#fff', size=19 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="10" r="3" stroke={c} strokeWidth="1.8"/></svg>);
const IcoX      = ({ c='#EF4444' }) => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke={c} strokeWidth="2.4" strokeLinecap="round"/></svg>);
const IcoInfo   = ({ c='#0A5A42' }) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={c} strokeWidth="1.8"/><path d="M12 8v4M12 16h.01" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>);
const IcoCal    = ({ c='#C45E10', size=13 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke={c} strokeWidth="1.9"/><path d="M16 2v4M8 2v4M3 10h18" stroke={c} strokeWidth="1.9" strokeLinecap="round"/></svg>);
const IcoShield = ({ c='#C45E10' }) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoEdit   = ({ c='#F47920' }) => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const Spinner   = ({ c='#fff', size=18 }) => (<div style={{ width:size, height:size, border:`2.5px solid ${c}40`, borderTopColor:c, borderRadius: '50%', animation:'spin 0.7s linear infinite' }} />);

const STEPS = [
    { id:1, short:'Details'  },
    { id:2, short:'Photos'   },
    { id:3, short:'Location' },
    { id:4, short:'Review'   },
];

// ── Draft auto-save (text only; photos are never persisted for safety) ─────────
const DRAFT_KEY = 'vawc_report_draft';
const loadDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY)) || {}; } catch { return {}; } };
const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch {} };

// ── Main ──────────────────────────────────────────────────────────────────────
function ReportNow() {
    const navigate = useNavigate();
    const draft0 = loadDraft();
    const [step,          setStep]          = useState(1);
    const [statement,     setStatement]     = useState(draft0.statement || '');
    const [imageFiles,    setImageFiles]    = useState([]);
    const [imagePreviews, setImagePreviews] = useState([]);
    const [location,      setLocation]      = useState(draft0.location || null);
    const [address,       setAddress]       = useState(draft0.address || '');
    const [locationErr,   setLocationErr]   = useState('');
    const [loading,       setLoading]       = useState(false);
    const [submitErr,     setSubmitErr]     = useState('');
    const [success,       setSuccess]       = useState(false);
    const [submitResult,  setSubmitResult]  = useState(null);   // { caseNumber, merged }
    const [mergeInfo,     setMergeInfo]     = useState(null);   // duplicate case found
    const [showMerge,     setShowMerge]     = useState(false);  // show merge modal
    const [forceNew,      setForceNew]      = useState(false);
    const [offenderName,  setOffenderName]  = useState(draft0.offenderName || '');
    const [incidentDate,  setIncidentDate]  = useState(draft0.incidentDate || '');
    const [relationship,  setRelationship]  = useState(draft0.relationship || '');
    const [abuseTypes,    setAbuseTypes]    = useState(draft0.abuseTypes || []);
    const [children,      setChildren]      = useState(draft0.children || []);
    const [photoErr,      setPhotoErr]      = useState('');
    const [draftSaved,    setDraftSaved]    = useState(false);
    const [waking,        setWaking]        = useState(false);

    const canNext1 = statement.trim().length >= MIN_CHARS && offenderName.trim().length >= 2 && incidentDate !== '' && relationship !== '' && abuseTypes.length > 0;
    const toggleAbuse = (id) => setAbuseTypes(a => a.includes(id) ? a.filter(x => x !== id) : [...a, id]);
    const addChild = () => setChildren(c => [...c, { name: '', date_of_birth: '', sex: '', under_her_care: false }]);
    const setChild = (i, k, v) => setChildren(c => c.map((x, idx) => idx === i ? { ...x, [k]: v } : x));
    const removeChild = (i) => setChildren(c => c.filter((_, idx) => idx !== i));

    // Auto-save the text draft (debounced) so a back/refresh/close does not lose it.
    // Photos are intentionally NOT persisted. Cleared on successful submit or discard.
    useEffect(() => {
        const hasContent = statement.trim() || offenderName.trim() || incidentDate || address;
        if (!hasContent) return;
        const t = setTimeout(() => {
            try {
                localStorage.setItem(DRAFT_KEY, JSON.stringify({ statement, offenderName, incidentDate, relationship, abuseTypes, children, address, location, savedAt: Date.now() }));
                setDraftSaved(true);
            } catch {}
        }, 600);
        return () => clearTimeout(t);
    }, [statement, offenderName, incidentDate, address, location]);

    const discardDraft = () => {
        clearDraft();
        setStatement(''); setOffenderName(''); setIncidentDate(''); setRelationship(''); setAbuseTypes([]); setChildren([]); setAddress(''); setLocation(null);
        setImageFiles([]); setImagePreviews([]); setPhotoErr(''); setDraftSaved(false); setStep(1);
    };

    const handleImageUpload = (e) => {
        const picked = Array.from(e.target.files);
        e.target.value = '';
        if (!picked.length) return;

        const accepted = [];
        let err = '';
        for (const f of picked) {
            if (imageFiles.length + accepted.length >= MAX_PHOTOS) {
                err = `You can attach up to ${MAX_PHOTOS} photos per report.`;
                break;
            }
            const type = (f.type || '').toLowerCase();
            const isImg = type.startsWith('image/') || ALLOWED_IMG.includes(type);
            if (!isImg) { err = 'Only photo files (JPEG, PNG, WEBP, HEIC) are allowed.'; continue; }
            if (f.size > MAX_MB * 1024 * 1024) { err = `Each photo must be ${MAX_MB}MB or smaller.`; continue; }
            accepted.push(f);
        }
        if (accepted.length) {
            setImageFiles(p => [...p, ...accepted]);
            setImagePreviews(p => [...p, ...accepted.map(f => URL.createObjectURL(f))]);
        }
        setPhotoErr(err);
    };

    const removeImage = (i) => {
        setImageFiles(p => p.filter((_,idx) => idx !== i));
        setImagePreviews(p => p.filter((_,idx) => idx !== i));
        setPhotoErr('');
    };

    const checkDuplicate = async () => {
        if (!offenderName.trim()) return;
        try {
            const res = await api.get(`/cases/check-duplicate?offender_name=${encodeURIComponent(offenderName.trim())}`);
            if (res.data.duplicate && !forceNew) {
                setMergeInfo(res.data);
                setShowMerge(true);
                return true; // duplicate found
            }
        } catch {}
        return false;
    };

    // Retry on cold-start. Render's free tier sleeps after ~15 min idle, so the
    // first request can fail at the network level. A network error (no
    // err.response) is not a real rejection, so wait and retry before giving up.
    // Wake the backend as soon as the form opens, so it is up by the time the
    // victim finishes typing and taps Submit.
    useEffect(() => {
        try {
            const base = api.defaults.baseURL;
            if (base) fetch(base + '/', { method: 'GET', mode: 'no-cors', cache: 'no-store' }).catch(() => {});
        } catch (e) {}
    }, []);

    const withRetry = async (fn, attempts = 4) => {
        for (let i = 0; i < attempts; i++) {
            try { return await fn(); }
            catch (err) {
                if (err.response) throw err;        // real server answer - don't retry
                if (i === attempts - 1) throw err;  // out of retries
                setWaking(true);
                await new Promise(r => setTimeout(r, 3000));
            }
        }
    };

    const doSubmit = async (isForceNew = false) => {
        if (!statement.trim()) { setSubmitErr('Please write your statement before submitting.'); return; }
        setLoading(true); setSubmitErr(''); setWaking(false);
        try {
            const photoUrls = [];
            for (const file of imageFiles) {
                const res = await withRetry(() => {
                    const fd = new FormData(); fd.append("file", file);
                    return api.post("/upload/image", fd, { headers:{ "Content-Type":"multipart/form-data" }, timeout: 60000 });
                });
                photoUrls.push(res.data.url);
            }
            const res = await withRetry(() => api.post("/cases/", {
                statement,
                offender_name: offenderName.trim(),
                incident_date: incidentDate || null,
                incident_type: null,
                incident_types: abuseTypes,
                relationship_to_offender: relationship || null,
                children: children.filter(c => (c.name || '').trim()).map(c => ({ name: c.name.trim(), date_of_birth: c.date_of_birth || null, sex: c.sex || null, under_her_care: !!c.under_her_care })),
                photo_urls:    photoUrls,
                latitude:      location?.lat  || null,
                longitude:     location?.lng  || null,
                address:       address || null,
                force_new:     isForceNew,
            }, { timeout: 60000 }));
            clearDraft();
            setSubmitResult({
                caseNumber: res?.data?.case_number || '',
                merged:     !!res?.data?.merged,
            });
            setSuccess(true);
        } catch (err) {
            if (!err.response) {
                const timedOut = err.code === "ECONNABORTED" || /timeout/i.test(err.message || "");
                setSubmitErr(
                    (timedOut
                        ? "The server took too long to respond. Your report was NOT sent, but your draft is saved. Please try again in a moment."
                        : "Cannot reach the server right now. Your report was NOT sent, but your draft is saved. Please check your internet and tap Submit again.")
                    + ` [${err.code || "network"}${imageFiles.length ? ", " + imageFiles.length + " photo(s)" : ""}]`
                );
            } else {
                const raw = err.response?.data?.detail;
                setSubmitErr(Array.isArray(raw) ? raw.map(e => e.msg).join(', ') : (raw || "Failed to submit report. Please try again."));
            }
        } finally {
            setLoading(false); setWaking(false);
        }
    };

    const handleSubmit = async () => {
        const isDuplicate = await checkDuplicate();
        if (!isDuplicate) await doSubmit(forceNew);
    };

    // ── Success ───────────────────────────────────────────────────────────────
    if (success) {
        const merged = !!submitResult?.merged;
        const caseNo = submitResult?.caseNumber || '';
        // Delay helper keeps the reveal reading top to bottom without hardcoding
        // a delay on every element.
        let seq = 0;
        const rise = (extra = 0) => ({ animationDelay: `${(seq++ * 0.07 + 0.18 + extra).toFixed(2)}s` });

        const nextSteps = [
            { done: true,  label: 'Report recorded',
              detail: merged ? 'Added to your existing case file.' : 'Your statement is now on file at the Barangay VAWC Desk.' },
            { done: false, label: 'Desk assessment',
              detail: 'The VAWC officer reviews your report and prepares the next action.' },
            { done: false, label: 'Confirmation visit',
              detail: 'You will be asked to come to the desk to confirm and sign your statement.' },
        ];

        return (
            <div style={{ ...S.page, alignItems:'center', justifyContent:'center', padding:'32px 20px' }}>
                <div style={{ width:'100%', maxWidth:400 }} role="status" aria-live="polite">

                    {/* Seal */}
                    <div style={{ position:'relative', width:88, height:88, margin:'0 auto 22px' }}>
                        <span aria-hidden="true" className="vrn-ring" style={{
                            position:'absolute', inset:0, borderRadius:'50%',
                            border:'2px solid var(--vrn-ok-line)', pointerEvents:'none',
                        }} />
                        <div className="vrn-seal" style={{
                            position:'relative', width:88, height:88, borderRadius:'50%',
                            backgroundColor:'var(--vrn-ok-soft)', border:'1.5px solid var(--vrn-ok-line)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                        }}>
                            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path className="vrn-draw" d="M20 6.5L9.5 17 4.5 12" pathLength="1"
                                    style={{ stroke:'var(--vrn-ok)' }} strokeWidth="2.6"
                                    strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </div>

                    {/* Headline */}
                    <h1 className="vrn-rise" style={{ ...rise(), fontSize:25, fontWeight:800, letterSpacing:'-0.4px', color:'var(--text)', textAlign:'center', margin:'0 0 8px', fontFamily:"'Lexend', sans-serif" }}>
                        {merged ? 'Added to Your Case' : 'Report Submitted'}
                    </h1>
                    <p className="vrn-rise" style={{ ...rise(), fontSize:14.5, color:'var(--text-body)', lineHeight:1.65, textAlign:'center', margin:'0 0 22px', fontFamily:"'Lexend', sans-serif" }}>
                        {merged
                            ? 'Your new report was filed under the case you already have open. The VAWC officer has been notified.'
                            : 'Your report reached the Barangay VAWC Desk. Here is what happens from here.'}
                    </p>

                    {/* Case reference */}
                    {caseNo && (
                        <div className="vrn-rise" style={{
                            ...rise(),
                            display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
                            backgroundColor:'var(--surface)', border:'1px solid var(--border)',
                            borderLeft:'3px solid #F47920', borderRadius:10,
                            padding:'13px 16px', marginBottom:16,
                        }}>
                            <span style={{ fontSize:10.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.8px', color:'var(--text-muted)', fontFamily:"'Lexend', sans-serif" }}>
                                Case reference
                            </span>
                            <span style={{ fontSize:16.5, fontWeight:800, color:'var(--accent-text)', letterSpacing:'0.6px', fontVariantNumeric:'tabular-nums', fontFamily:"'Lexend', sans-serif" }}>
                                {caseNo}
                            </span>
                        </div>
                    )}

                    {/* Next steps */}
                    <div className="vrn-rise" style={{
                        ...rise(),
                        backgroundColor:'var(--surface)', border:'1px solid var(--border)',
                        borderRadius:12, padding:'18px 18px 6px', marginBottom:16,
                    }}>
                        <p style={{ fontSize:10.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.8px', color:'var(--text-muted)', margin:'0 0 14px', fontFamily:"'Lexend', sans-serif" }}>
                            What happens next
                        </p>
                        {nextSteps.map((s, i) => (
                            <div key={s.label} style={{ display:'flex', gap:13, position:'relative', paddingBottom:16 }}>
                                {/* connector */}
                                {i < nextSteps.length - 1 && (
                                    <span aria-hidden="true" className="vrn-grow" style={{
                                        position:'absolute', left:8.5, top:20, bottom:2, width:1.5,
                                        backgroundColor:'var(--border)',
                                        animationDelay:`${(0.5 + i * 0.12).toFixed(2)}s`,
                                    }} />
                                )}
                                <span aria-hidden="true" className="vrn-dot" style={{
                                    width:18, height:18, borderRadius:'50%', flexShrink:0, zIndex:1,
                                    backgroundColor: s.done ? 'var(--vrn-ok)' : 'var(--surface)',
                                    border: s.done ? '1.5px solid var(--vrn-ok)' : '1.5px solid var(--border)',
                                    display:'flex', alignItems:'center', justifyContent:'center',
                                    animationDelay:`${(0.45 + i * 0.12).toFixed(2)}s`,
                                }}>
                                    {s.done
                                        ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        : <span style={{ width:5, height:5, borderRadius:'50%', backgroundColor:'var(--text-muted)', opacity:0.55 }} />}
                                </span>
                                <div style={{ minWidth:0 }}>
                                    <p style={{ fontSize:14, fontWeight:700, color: s.done ? 'var(--text)' : 'var(--text-body)', margin:'0 0 2px', fontFamily:"'Lexend', sans-serif" }}>
                                        {s.label}
                                    </p>
                                    <p style={{ fontSize:12.5, color:'var(--text-muted)', lineHeight:1.55, margin:0, fontFamily:"'Lexend', sans-serif" }}>
                                        {s.detail}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Confidentiality footnote */}
                    <div className="vrn-rise" style={{ ...rise(), display:'flex', gap:9, alignItems:'flex-start', padding:'0 4px', marginBottom:24 }}>
                        <span style={{ marginTop:1, flexShrink:0 }}><IcoShield /></span>
                        <p style={{ fontSize:12.5, color:'var(--text-muted)', lineHeight:1.6, margin:0, fontFamily:"'Lexend', sans-serif" }}>
                            Your report is kept strictly confidential under Republic Act 9262.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="vrn-rise" style={rise()}>
                        <button className="vrn-btn-hover" style={{ ...S.submitBtn, width:'100%', minHeight:48, marginBottom:6 }} onClick={() => navigate('/my-reports')}>
                            View My Cases
                        </button>
                        <button style={{ width:'100%', minHeight:44, background:'none', border:'none', color:'var(--text-muted)', fontSize:13.5, fontWeight:600, cursor:'pointer', fontFamily:"'Lexend', sans-serif" }} onClick={() => navigate('/home')}>
                            Back to Home
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Merge Modal ───────────────────────────────────────────────────────────
    if (showMerge && mergeInfo) return (
        <div style={{ ...S.page, alignItems:'center', justifyContent:'center', padding:28 }}>
            <div style={{ backgroundColor:'var(--surface)', borderRadius: 4, padding:28, maxWidth:360, width:'100%', boxShadow:'0 20px 60px rgba(15,23,42,0.15)' }}>
                <div style={{ width:60, height:60, borderRadius: 4, backgroundColor:'#FFFBEB', border:'2px solid #FDE68A', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                    <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#D97706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke="#D97706" strokeWidth="1.8" strokeLinecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="#D97706" strokeWidth="2.4" strokeLinecap="round"/></svg>
                </div>
                <h2 style={{ fontSize:18, fontWeight:800, color:'var(--text)', textAlign:'center', marginBottom:8, fontFamily:"'Lexend',sans-serif" }}>
                    Existing Case Found
                </h2>
                <p style={{ fontSize:13.5, color:'var(--text-body)', lineHeight:1.6, textAlign:'center', marginBottom:16, fontFamily:"'Lexend',sans-serif" }}>
                    You already have an open case against <strong>{mergeInfo.offender}</strong> ({mergeInfo.case_number}) with {mergeInfo.report_count} report{mergeInfo.report_count!==1?'s':''}.
                </p>
                <div style={{ backgroundColor:'#FFFBEB', borderRadius: 4, padding:'12px 14px', marginBottom:20, border:'1px solid #FDE68A' }}>
                    <p style={{ fontSize:13, color:'#92400E', lineHeight:1.6, margin:0, fontFamily:"'Lexend',sans-serif" }}>
                        Adding to the existing case keeps all your reports organized together. The VAWC officer will be notified of this new report.
                    </p>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    <button className="vrn-btn-hover" style={{ ...S.submitBtn, textAlign:'center' }}
                        onClick={() => { setShowMerge(false); doSubmit(false); }}>
                        Add to Existing Case ({mergeInfo.case_number})
                    </button>
                    <button className="vrn-btn-hover" style={{ ...S.prevBtn, justifyContent:'center' }}
                        onClick={() => { setShowMerge(false); setForceNew(true); doSubmit(true); }}>
                        Create New Case Instead
                    </button>
                    <button style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:13.5, fontWeight:600, cursor:'pointer', fontFamily:"'Lexend',sans-serif" }}
                        onClick={() => setShowMerge(false)}>
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );

    // ── Step bar ──────────────────────────────────────────────────────────────
    const StepBar = () => (
        <div style={{ display:'flex', alignItems:'center', gap:0 }}>
            {STEPS.map((s, i) => {
                const done = step > s.id, current = step === s.id;
                return (
                    <React.Fragment key={s.id}>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                            <div style={{ width:26, height:26, borderRadius: 8, backgroundColor: done?'#059669':current?'#F47920':'var(--border)', display:'flex', alignItems:'center', justifyContent:'center', transition:'background-color 0.2s' }}>
                                {done ? <IcoCheck c="#fff" size={13} /> : <span style={{ fontSize:11, fontWeight:700, color: current?'#fff':'#64748B', fontFamily:"'Lexend', sans-serif" }}>{s.id}</span>}
                            </div>
                            <p style={{ fontSize:10.5, fontWeight: current?700:600, color: done?'#047857':current?'#C45E10':'#64748B', marginTop:3, fontFamily:"'Lexend', sans-serif", whiteSpace:'nowrap' }}>{s.short}</p>
                        </div>
                        {i < STEPS.length-1 && (
                            <div style={{ flex:1, height:2, backgroundColor: step>s.id?'#059669':'var(--border)', margin:'0 4px', marginBottom:14, transition:'background-color 0.3s' }} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );

    // ── Steps ─────────────────────────────────────────────────────────────────
    const chars    = statement.trim().length;
    const pct      = Math.min(chars / 200, 1);
    const shortage = MIN_CHARS - chars;

    return (
        <div style={S.page}>
            <header style={S.topBar}>
                <button style={S.backBtn} onClick={() => step>1 ? setStep(step-1) : navigate('/home')}
                    aria-label={step>1 ? 'Bumalik sa nakaraang hakbang' : 'Bumalik sa Home'}>
                    <IcoArrow dir="left" />
                </button>
                <h1 style={S.title}>Submit a Report</h1>
                <ThemeToggle size={44} />
            </header>

            <div style={{ padding:'16px 20px 8px', backgroundColor:'var(--surface)', borderBottom:'1px solid var(--border-soft)' }}>
                <div style={{ maxWidth:680, margin:'0 auto' }}>
                    <StepBar />
                    <p style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center', marginTop:4, fontFamily:"'Lexend', sans-serif" }}>
                        Step {step} of {STEPS.length}
                    </p>
                    {draftSaved && (
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginTop:8 }}>
                            <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11.5, color:'var(--text-muted)', fontFamily:"'Lexend', sans-serif" }}>
                                <IcoCheck c="#059669" size={13} /> Draft saved on this device
                            </span>
                            <button onClick={discardDraft}
                                style={{ background:'none', border:'none', color:'#BE123C', fontSize:11.5, fontWeight:600, cursor:'pointer', textDecoration:'underline', fontFamily:"'Lexend', sans-serif" }}>
                                Discard
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <main style={S.content}>
                <div style={{ animation:'fadeUp 0.2s ease' }}>

                    {/* ── Step 1: Incident Details ── */}
                    {step === 1 && (
                        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                            {/* Offender name */}
                            <div style={S.card}>
                                <div style={S.cardHeader}>
                                    <div style={{ ...S.iconBox, backgroundColor:'var(--surface-tint)', borderColor:'var(--border)' }}>
                                        <IcoEdit />
                                    </div>
                                    <div>
                                        <h2 id="lbl-offender" style={S.cardTitle}>Offender's Name</h2>
                                        <p style={S.cardSub}>Pangalan ng salarin - required</p>
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    aria-labelledby="lbl-offender"
                                    placeholder="Full name of the offender"
                                    value={offenderName}
                                    onChange={e => setOffenderName(e.target.value)}
                                    style={{ ...S.textarea, resize:'none', padding:'12px 14px', minHeight:'unset' }}
                                />
                                {offenderName.trim().length > 0 && offenderName.trim().length < 2 && (
                                    <p style={{ fontSize:12, color:'#BE123C', marginTop:5, fontFamily:"'Lexend', sans-serif" }}>Please enter a valid name</p>
                                )}
                            </div>

                            {/* Incident date */}
                            <div style={S.card}>
                                <div style={S.cardHeader}>
                                    <div style={{ ...S.iconBox, backgroundColor:'var(--surface-tint)', borderColor:'var(--border)' }}>
                                        <IcoEdit />
                                    </div>
                                    <div>
                                        <h2 id="lbl-date" style={S.cardTitle}>Date of Incident</h2>
                                        <p style={S.cardSub}>Petsa ng pangyayari - required</p>
                                    </div>
                                </div>
                                <input
                                    type="datetime-local"
                                    aria-labelledby="lbl-date"
                                    value={incidentDate}
                                    max={new Date().toISOString().slice(0,16)}
                                    onChange={e => setIncidentDate(e.target.value)}
                                    style={{ ...S.textarea, resize:'none', padding:'12px 14px', minHeight:'unset', colorScheme:'light' }}
                                />
                            </div>

                            {/* Relationship to offender */}
                            <div style={S.card}>
                                <div style={S.cardHeader}>
                                    <div style={{ ...S.iconBox, backgroundColor:'var(--surface-tint)', borderColor:'var(--border)' }}><IcoEdit /></div>
                                    <div>
                                        <h2 id="lbl-rel" style={S.cardTitle}>Relationship to the Offender</h2>
                                        <p style={S.cardSub}>Ugnayan sa nang-abuso - required</p>
                                    </div>
                                </div>
                                <select aria-labelledby="lbl-rel" value={relationship} onChange={e => setRelationship(e.target.value)}
                                    style={{ ...S.textarea, resize:'none', padding:'12px 14px', minHeight:'unset', colorScheme:'light' }}>
                                    <option value="">- Select relationship -</option>
                                    {RELATIONSHIP_OPTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                                </select>
                            </div>

                            {/* Type(s) of abuse */}
                            <div style={S.card}>
                                <div style={S.cardHeader}>
                                    <div style={{ ...S.iconBox, backgroundColor:'var(--surface-tint)', borderColor:'var(--border)' }}><IcoEdit /></div>
                                    <div>
                                        <h2 style={S.cardTitle}>Type of Abuse</h2>
                                        <p style={S.cardSub}>Uri ng pang-aabuso - piliin lahat ng angkop</p>
                                    </div>
                                </div>
                                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                                    {ABUSE_OPTS.map(o => (
                                        <label key={o.id} style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, color:'var(--text-body)', fontFamily:"'Lexend', sans-serif", cursor:'pointer' }}>
                                            <input type="checkbox" checked={abuseTypes.includes(o.id)} onChange={() => toggleAbuse(o.id)} style={{ width:18, height:18, accentColor:'#C45E10' }} />
                                            {o.label}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Children (optional) */}
                            <div style={S.card}>
                                <div style={S.cardHeader}>
                                    <div style={{ ...S.iconBox, backgroundColor:'var(--surface-tint)', borderColor:'var(--border)' }}><IcoEdit /></div>
                                    <div>
                                        <h2 style={S.cardTitle}>Children (optional)</h2>
                                        <p style={S.cardSub}>Mga anak na apektado - kung mayroon</p>
                                    </div>
                                </div>
                                {children.map((c, i) => (
                                    <div key={i} style={{ display:'flex', flexDirection:'column', gap:8, padding:'12px', border:'1px solid var(--border)', borderRadius:8, marginBottom:10 }}>
                                        <input placeholder="Name / Pangalan" value={c.name} onChange={e => setChild(i, 'name', e.target.value)}
                                            style={{ ...S.textarea, resize:'none', padding:'10px 12px', minHeight:'unset' }} />
                                        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                                            <input type="date" value={c.date_of_birth} max={new Date().toISOString().slice(0,10)} onChange={e => setChild(i, 'date_of_birth', e.target.value)}
                                                style={{ ...S.textarea, resize:'none', padding:'10px 12px', minHeight:'unset', flex:1, colorScheme:'light' }} />
                                            <select value={c.sex} onChange={e => setChild(i, 'sex', e.target.value)}
                                                style={{ ...S.textarea, resize:'none', padding:'10px 12px', minHeight:'unset', flex:1, colorScheme:'light' }}>
                                                <option value="">Sex</option><option value="Female">Female</option><option value="Male">Male</option>
                                            </select>
                                        </div>
                                        <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13.5, color:'var(--text-body)', fontFamily:"'Lexend', sans-serif" }}>
                                            <input type="checkbox" checked={!!c.under_her_care} onChange={e => setChild(i, 'under_her_care', e.target.checked)} style={{ width:17, height:17, accentColor:'#C45E10' }} />
                                            Under my care / Nasa aking pangangalaga
                                        </label>
                                        <button type="button" onClick={() => removeChild(i)} style={{ alignSelf:'flex-start', background:'none', border:'none', color:'#BE123C', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'Lexend', sans-serif" }}>Remove</button>
                                    </div>
                                ))}
                                <button type="button" onClick={addChild} style={{ padding:'9px 14px', borderRadius:8, border:'1.5px dashed var(--border)', background:'var(--surface)', color:'var(--text-body)', fontSize:13.5, fontWeight:600, cursor:'pointer', fontFamily:"'Lexend', sans-serif" }}>+ Add a child</button>
                            </div>

                            {/* Statement */}
                            <div style={S.card}>
                                <div style={S.cardHeader}>
                                    <div style={{ ...S.iconBox, backgroundColor:'var(--surface-tint)', borderColor:'var(--border)' }}>
                                        <IcoEdit />
                                    </div>
                                    <div>
                                        <h2 id="lbl-statement" style={S.cardTitle}>Your Statement</h2>
                                        <p style={S.cardSub}>Ilarawan ang nangyari</p>
                                    </div>
                                </div>
                                <p style={S.hint}>Describe what happened in your own words. You may write in Filipino or English.</p>
                                <textarea
                                    aria-labelledby="lbl-statement"
                                    style={{ ...S.textarea, borderColor: chars>0&&chars<MIN_CHARS?'#FCA5A5':chars>=MIN_CHARS?'#6EE7B7':'var(--border)' }}
                                    placeholder="Ilarawan ang nangyari sa iyong sariling salita…"
                                    value={statement}
                                    onChange={e => setStatement(e.target.value)}
                                    rows={6}
                                />
                                <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
                                    <p style={{ fontSize:12, color: chars>=MIN_CHARS?'#047857':chars>0?'#BE123C':'#64748B', fontFamily:"'Lexend', sans-serif" }}>
                                        {chars>=MIN_CHARS ? 'Minimum met' : chars>0 ? `${shortage} more character${shortage!==1?'s':''} needed` : `Minimum ${MIN_CHARS} characters`}
                                    </p>
                                    <p style={{ fontSize:12, color:'var(--text-muted)', fontFamily:"'Lexend', sans-serif" }}>{chars}</p>
                                </div>
                                <div style={{ height:4, backgroundColor:'var(--border-soft)', borderRadius: 4, marginTop:8, overflow:'hidden' }}>
                                    <div style={{ height:'100%', width:`${pct*100}%`, backgroundColor: chars>=MIN_CHARS?'#6EE7B7':'#FCA5A5', borderRadius: 4, transition:'width 0.2s' }} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Step 2: Photos ── */}
                    {step === 2 && (
                        <div style={S.card}>
                            <div style={S.cardHeader}>
                                <div style={{ ...S.iconBox, backgroundColor:'var(--surface-tint)', borderColor:'var(--border)' }}>
                                    <IcoImage />
                                </div>
                                <div style={{ minWidth:0 }}>
                                    <h2 style={S.cardTitle}>Attach Photos</h2>
                                    <p style={S.cardSub}>Mga patunay</p>
                                </div>
                                <span style={S.optChip}>Optional</span>
                            </div>
                            <p style={S.hint}>Photos help the VAWC officer assess your report. Up to {MAX_PHOTOS} photos, {MAX_MB}MB each.</p>
                            {imageFiles.length >= MAX_PHOTOS ? (
                                <div style={{ padding:'12px 14px', borderRadius:4, backgroundColor:'var(--surface-tint)', border:'1px solid var(--border)' }}>
                                    <p style={{ fontSize:13, color:'var(--text-body)', margin:0, fontFamily:"'Lexend', sans-serif" }}>
                                        Maximum of {MAX_PHOTOS} photos attached. Remove one to add another.
                                    </p>
                                </div>
                            ) : (
                                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                                    {isMobile && (
                                        <label className="vrn-btn-hover" style={S.uploadSolid}>
                                            <IcoCamera /><span>Take a Photo</span>
                                            <input type="file" accept="image/*" capture="environment" style={{ display:'none' }} onChange={handleImageUpload} />
                                        </label>
                                    )}
                                    <label className="vrn-upload-hover vrn-btn-hover" style={S.uploadOutline}>
                                        <IcoImage /><span>Upload from Gallery</span>
                                        <input type="file" accept="image/*" multiple style={{ display:'none' }} onChange={handleImageUpload} />
                                    </label>
                                </div>
                            )}
                            {photoErr && (
                                <p role="alert" style={{ fontSize:12.5, color:'#BE123C', marginTop:10, fontFamily:"'Lexend', sans-serif" }}>{photoErr}</p>
                            )}
                            {imagePreviews.length > 0 && (
                                <div style={{ marginTop:16 }}>
                                    <p style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)', marginBottom:10, fontFamily:"'Lexend', sans-serif" }}>
                                        {imagePreviews.length} of {MAX_PHOTOS} photo{imagePreviews.length!==1?'s':''} attached
                                    </p>
                                    <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
                                        {imagePreviews.map((src, i) => (
                                            <div key={i} style={{ position:'relative', width:80, height:80, flexShrink:0 }}>
                                                <img src={src} alt={`Attachment ${i+1}`} style={{ width:'100%', height:'100%', borderRadius: 4, objectFit:'cover', border:'1px solid var(--border)' }} />
                                                <button className="vrn-remove" onClick={() => removeImage(i)}
                                                    aria-label={`Alisin ang larawan ${i+1}`}
                                                    style={{ position:'absolute', top:-9, right:-9, width:28, height:28, borderRadius: '50%', backgroundColor:'#FFF1F2', border:'1.5px solid #FECDD3', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                                                    <IcoX />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div style={S.noteBox}>
                                <div style={{ display:'flex', alignItems:'flex-start', gap:7 }}>
                                    <div style={{ marginTop:1 }}><IcoInfo /></div>
                                    <p style={S.noteText}>Photos are encrypted and only accessible to authorized VAWC officers.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Step 3: Location ── */}
                    {step === 3 && (
                        <div style={S.card}>
                            <div style={S.cardHeader}>
                                <div style={{ ...S.iconBox, backgroundColor:'#ECFDF5', borderColor:'#6EE7B7' }}>
                                    <IcoPin c="#059669" size={18} />
                                </div>
                                <div style={{ minWidth:0 }}>
                                    <h2 style={S.cardTitle}>Where did this happen?</h2>
                                    <p style={S.cardSub}>Lokasyon ng pangyayari</p>
                                </div>
                                <span style={S.optChip}>Optional</span>
                            </div>
                            <p style={S.hint}>
                                Pin the place where the incident happened. Skip this if you are unsure.
                            </p>

                            <LocationPicker
                                location={location}
                                address={address}
                                onChange={({ lat, lng, address: addr }) => {
                                    setLocation({ lat, lng });
                                    setAddress(addr || '');
                                    setLocationErr('');
                                }}
                                onClear={() => { setLocation(null); setAddress(''); setLocationErr(''); }}
                                error={locationErr}
                                onError={setLocationErr}
                            />
                        </div>
                    )}

                    {/* ── Step 4: Review ── */}
                    {step === 4 && (
                        <div style={S.card}>
                            <h2 style={{ ...S.cardTitle, marginBottom:5 }}>Review Your Report</h2>
                            <p style={S.hint}>Check everything below. You cannot edit after submitting.</p>

                            {/* Lead block: who and when, the two facts the desk reads first */}
                            <div style={{ ...S.reviewRow, borderLeft:'3px solid #F47920', padding:'15px 16px', marginBottom:10 }}>
                                <p style={S.reviewLabel}>Respondent</p>
                                <p style={{ ...S.reviewVal, fontSize:18, fontWeight:700, lineHeight:1.35, marginBottom: incidentDate ? 10 : 0 }}>
                                    {offenderName || 'Not provided'}
                                </p>
                                {incidentDate && (
                                    <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12.5, fontWeight:600, color:'var(--accent-text)', backgroundColor:'var(--surface-tint)', border:'1px solid var(--border)', borderRadius:9999, padding:'4px 11px', fontFamily:"'Lexend', sans-serif" }}>
                                        <IcoCal /> {new Date(incidentDate).toLocaleString('en-PH',{month:'long',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                                    </span>
                                )}
                            </div>

                            {/* Classification, only when the victim answered */}
                            {(relationship || abuseTypes.length > 0) && (
                                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:10, marginBottom:10 }}>
                                    {relationship && (
                                        <div style={{ ...S.reviewRow, marginBottom:0 }}>
                                            <p style={S.reviewLabel}>Relationship</p>
                                            <p style={S.reviewVal}>{RELATIONSHIP_OPTS.find(o => o.id === relationship)?.label || relationship}</p>
                                        </div>
                                    )}
                                    {abuseTypes.length > 0 && (
                                        <div style={{ ...S.reviewRow, marginBottom:0 }}>
                                            <p style={S.reviewLabel}>Type of Abuse</p>
                                            <p style={S.reviewVal}>{abuseTypes.map(t => ABUSE_OPTS.find(o => o.id === t)?.label || t).join(', ')}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Statement gets the most room; it is the report */}
                            <div style={{ ...S.reviewRow, padding:'14px 16px' }}>
                                <p style={S.reviewLabel}>Statement</p>
                                <p style={{ ...S.reviewVal, whiteSpace:'pre-wrap' }}>{statement || '-'}</p>
                            </div>

                            {/* Photos: thumbnails carry the count, so no separate tally line */}
                            <div style={S.reviewRow}>
                                <p style={S.reviewLabel}>Photos</p>
                                {imagePreviews.length > 0 ? (
                                    <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:2 }}>
                                        {imagePreviews.map((src,i) => (
                                            <img key={i} src={src} alt={`Attachment ${i+1}`} style={{ width:52, height:52, borderRadius:8, objectFit:'cover', border:'1px solid var(--border)' }} />
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ ...S.reviewVal, color:'var(--text-muted)' }}>None attached</p>
                                )}
                            </div>

                            <div style={S.reviewRow}>
                                <p style={S.reviewLabel}>Location</p>
                                <p style={{ ...S.reviewVal, ...(location ? {} : { color:'var(--text-muted)' }) }}>
                                    {location ? (address || `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`) : 'Not shared'}
                                </p>
                            </div>

                            <div style={{ ...S.noteBox, backgroundColor:'var(--surface-tint)', border:'1px solid var(--border)' }}>
                                <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                                    <span style={{ marginTop:2, flexShrink:0 }}><IcoShield /></span>
                                    <p style={{ ...S.noteText, color:'var(--text-body)' }}>
                                        After submitting, you will be asked to visit your Barangay VAWC Desk to confirm this report in person.
                                    </p>
                                </div>
                            </div>

                            {submitErr && (
                                <div style={{ backgroundColor:'#FFF1F2', borderRadius: 4, padding:'12px 14px', border:'1px solid #FECDD3', marginBottom:4 }}>
                                    <p style={{ fontSize:13, color:'#BE123C', lineHeight:1.6, fontFamily:"'Lexend', sans-serif" }}>{submitErr}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Nav buttons ── */}
                <div style={{ display:'flex', gap:12 }}>
                    {step > 1 && (
                        <button className="vrn-btn-hover" style={S.prevBtn} onClick={() => setStep(step-1)}>
                            <IcoArrow dir="left" c="#C45E10" /> Previous
                        </button>
                    )}
                    {step < STEPS.length ? (
                        <button className="vrn-btn-hover"
                            style={{ ...S.nextBtn, opacity: step===1&&!canNext1?0.45:1, cursor: step===1&&!canNext1?'not-allowed':'pointer' }}
                            onClick={() => { if (step===1&&!canNext1) return; setStep(step+1); }}
                            disabled={step===1 && !canNext1}>
                            Next <IcoArrow dir="right" c="#fff" />
                        </button>
                    ) : (
                        <button className="vrn-btn-hover"
                            style={{ ...S.submitBtn, display:'flex', alignItems:'center', justifyContent:'center', gap:9, opacity: loading?0.75:1 }}
                            onClick={handleSubmit} disabled={loading}>
                            {loading ? <><Spinner /><span>{waking ? 'Waking up server…' : 'Submitting…'}</span></> : 'Submit Report'}
                        </button>
                    )}
                </div>
            </main>

            <BottomNavbar active="report" />
        </div>
    );
}

const S = {
    page:         { minHeight:'100vh', background:'var(--page-grad)', color:'var(--text)', display:'flex', flexDirection:'column', paddingBottom:80, fontFamily:"'Lexend', sans-serif" },
    topBar:       { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', backgroundColor:'var(--surface)', borderBottom:'1px solid var(--border)', position:'sticky', top:0, zIndex:100 },
    backBtn:      { width:44, height:44, borderRadius: 10, backgroundColor:'var(--surface-tint)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' },
    title:        { fontSize:16, fontWeight:700, color:'var(--accent-text)', fontFamily:"'Lexend', sans-serif" },
    content:      { padding:'18px 20px', display:'flex', flexDirection:'column', gap:14, maxWidth:680, width:'100%', marginLeft:'auto', marginRight:'auto', boxSizing:'border-box' },
    card:         { backgroundColor:'var(--surface)', borderRadius: 12, padding:'20px', boxShadow:'0 2px 12px rgba(244,121,32,0.06)', border:'1px solid var(--border)' },
    cardHeader:   { display:'flex', alignItems:'center', gap:10, marginBottom:14 },
    iconBox:      { width:34, height:34, borderRadius: 10, border:'1px solid', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
    cardTitle:    { fontSize:17, fontWeight:700, color:'var(--accent-text)', margin:0, fontFamily:"'Lexend', sans-serif" },
    cardSub:      { fontSize:12, color:'var(--text-muted)', fontFamily:"'Lexend', sans-serif", marginTop:1 },
    hint:         { fontSize:13, color:'var(--text-body)', lineHeight:1.65, marginBottom:16, fontFamily:"'Lexend', sans-serif" },
    textarea:     { width:'100%', padding:'13px 14px', borderRadius: 4, border:'1.5px solid var(--border)', fontSize:15, backgroundColor:'var(--surface-alt)', outline:'none', color:'var(--text)', resize:'vertical', lineHeight:1.65, fontFamily:"'Lexend', sans-serif", boxSizing:'border-box', transition:'border-color 0.15s' },
    uploadSolid:  { display:'flex', alignItems:'center', justifyContent:'center', gap:9, width:'100%', padding:'14px', backgroundColor:'#F47920', color:'#fff', fontSize:15, fontWeight:600, borderRadius: 4, cursor:'pointer', boxSizing:'border-box', fontFamily:"'Lexend', sans-serif" },
    uploadOutline:{ display:'flex', alignItems:'center', justifyContent:'center', gap:9, width:'100%', padding:'14px', backgroundColor:'transparent', color:'var(--accent-text)', fontSize:15, fontWeight:600, borderRadius: 4, cursor:'pointer', border:'2px dashed var(--border)', boxSizing:'border-box', fontFamily:"'Lexend', sans-serif" },
    locBtn:       { width:'100%', padding:'15px', backgroundColor:'#1FA87A', color:'#fff', fontSize:15, fontWeight:600, border:'none', borderRadius: 4, cursor:'pointer', fontFamily:"'Lexend', sans-serif", boxShadow:'0 2px 8px rgba(31,168,122,0.25)' },
    noteBox:      { backgroundColor:'#ECFDF5', borderRadius: 4, padding:'12px 14px', marginTop:14, border:'1px solid #6EE7B7' },
    noteText:     { fontSize:12.5, color:'#0A5A42', lineHeight:1.65, fontFamily:"'Lexend', sans-serif", margin:0 },
    optChip:      { marginLeft:'auto', flexShrink:0, alignSelf:'center', fontSize:10, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:'var(--text-muted)', border:'1px solid var(--border)', borderRadius:9999, padding:'3px 9px', fontFamily:"'Lexend', sans-serif" },
    reviewRow:    { marginBottom:10, backgroundColor:'var(--surface-alt)', borderRadius: 8, padding:'12px 14px', border:'1px solid var(--border-soft)' },
    reviewLabel:  { fontSize:10.5, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.7px', marginBottom:5, fontFamily:"'Lexend', sans-serif" },
    reviewVal:    { fontSize:14, color:'var(--text)', lineHeight:1.65, fontFamily:"'Lexend', sans-serif", wordBreak:'break-word' },
    prevBtn:      { flex:1, padding:'13px', backgroundColor:'transparent', color:'var(--accent-text)', fontSize:15, fontWeight:600, border:'2px solid var(--border)', borderRadius: 4, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontFamily:"'Lexend', sans-serif" },
    nextBtn:      { flex:1, padding:'13px', backgroundColor:'#F47920', color:'#fff', fontSize:15, fontWeight:600, border:'none', borderRadius: 4, display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontFamily:"'Lexend', sans-serif", boxShadow:'0 2px 8px rgba(244,121,32,0.3)' },
    submitBtn:    { flex:1, padding:'13px', backgroundColor:'#C45E10', color:'#fff', fontSize:15, fontWeight:700, border:'none', borderRadius: 8, cursor:'pointer', fontFamily:"'Lexend', sans-serif", boxShadow:'0 2px 10px rgba(244,121,32,0.3)' },
};

export default ReportNow;
