import React, { useState } from 'react';
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
    `;
    document.head.appendChild(s);
}

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const MIN_CHARS = 10;

// ── Icons ─────────────────────────────────────────────────────────────────────
const IcoArrow  = ({ dir='left', c='#C45E10' }) => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d={dir==='left'?"M15 18l-6-6 6-6":"M9 18l6-6-6-6"} stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoCheck  = ({ c='#059669', size=16 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoCamera = ({ c='#fff' }) => (<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="13" r="4" stroke={c} strokeWidth="1.8"/></svg>);
const IcoImage  = ({ c='#F47920' }) => (<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke={c} strokeWidth="1.8"/><circle cx="8.5" cy="8.5" r="1.5" stroke={c} strokeWidth="1.8"/><path d="M21 15l-5-5L5 21" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoPin    = ({ c='#fff', size=19 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="10" r="3" stroke={c} strokeWidth="1.8"/></svg>);
const IcoX      = ({ c='#EF4444' }) => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke={c} strokeWidth="2.4" strokeLinecap="round"/></svg>);
const IcoInfo   = ({ c='#0A5A42' }) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={c} strokeWidth="1.8"/><path d="M12 8v4M12 16h.01" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>);
const IcoShield = ({ c='#C45E10' }) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoEdit   = ({ c='#F47920' }) => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const Spinner   = ({ c='#fff', size=18 }) => (<div style={{ width:size, height:size, border:`2.5px solid ${c}40`, borderTopColor:c, borderRadius: '50%', animation:'spin 0.7s linear infinite' }} />);

const STEPS = [
    { id:1, short:'Details'  },
    { id:2, short:'Photos'   },
    { id:3, short:'Location' },
    { id:4, short:'Review'   },
];

// ── Main ──────────────────────────────────────────────────────────────────────
function ReportNow() {
    const navigate = useNavigate();
    const [step,          setStep]          = useState(1);
    const [statement,     setStatement]     = useState('');
    const [imageFiles,    setImageFiles]    = useState([]);
    const [imagePreviews, setImagePreviews] = useState([]);
    const [location,      setLocation]      = useState(null);
    const [address,       setAddress]       = useState('');
    const [locationErr,   setLocationErr]   = useState('');
    const [loading,       setLoading]       = useState(false);
    const [submitErr,     setSubmitErr]     = useState('');
    const [success,       setSuccess]       = useState(false);
    const [mergeInfo,     setMergeInfo]     = useState(null);   // duplicate case found
    const [showMerge,     setShowMerge]     = useState(false);  // show merge modal
    const [forceNew,      setForceNew]      = useState(false);
    const [offenderName,  setOffenderName]  = useState('');
    const [incidentDate,  setIncidentDate]  = useState('');

    const canNext1 = statement.trim().length >= MIN_CHARS && offenderName.trim().length >= 2 && incidentDate !== '';

    const handleImageUpload = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        setImageFiles(p => [...p, ...files]);
        setImagePreviews(p => [...p, ...files.map(f => URL.createObjectURL(f))]);
        e.target.value = '';
    };

    const removeImage = (i) => {
        setImageFiles(p => p.filter((_,idx) => idx !== i));
        setImagePreviews(p => p.filter((_,idx) => idx !== i));
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

    const doSubmit = async (isForceNew = false) => {
        if (!statement.trim()) { setSubmitErr('Please write your statement before submitting.'); return; }
        setLoading(true); setSubmitErr('');
        try {
            const photoUrls = [];
            for (const file of imageFiles) {
                const fd = new FormData(); fd.append("file", file);
                const res = await api.post("/upload/image", fd, { headers:{ "Content-Type":"multipart/form-data" } });
                photoUrls.push(res.data.url);
            }
            await api.post("/cases/", {
                statement,
                offender_name: offenderName.trim(),
                incident_date: incidentDate || null,
                incident_type: null,
                photo_urls:    photoUrls,
                latitude:      location?.lat  || null,
                longitude:     location?.lng  || null,
                address:       address || null,
                force_new:     isForceNew,
            });
            setSuccess(true);
        } catch (err) {
            setSubmitErr(err.response?.data?.detail || "Failed to submit report. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        const isDuplicate = await checkDuplicate();
        if (!isDuplicate) await doSubmit(forceNew);
    };

    // ── Success ───────────────────────────────────────────────────────────────
    if (success) return (
        <div style={{ ...S.page, alignItems:'center', justifyContent:'center', padding:28 }}>
            <div style={{ textAlign:'center', maxWidth:360 }}>
                <div style={{ width:72, height:72, borderRadius: 4, backgroundColor:'#ECFDF5', border:'2px solid #6EE7B7', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
                    <IcoCheck c="#059669" size={34} />
                </div>
                <h2 style={{ fontSize:22, fontWeight:800, color:'#0A5A42', marginBottom:10, fontFamily:"'Lexend', sans-serif" }}>Report Submitted</h2>
                <p style={{ fontSize:14, color:'var(--text-body)', lineHeight:1.7, fontFamily:"'Lexend', sans-serif", marginBottom:28 }}>
                    Your report has been received. You will be asked to visit your Barangay VAWC Desk for official confirmation.
                </p>
                <div style={{ backgroundColor:'var(--surface-tint)', borderRadius: 4, padding:'16px 18px', border:'1px solid var(--border)', marginBottom:24, textAlign:'left' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:6 }}>
                        <IcoShield />
                        <p style={{ fontSize:13, fontWeight:700, color:'var(--accent-text)', fontFamily:"'Lexend', sans-serif" }}>Confidential</p>
                    </div>
                    <p style={{ fontSize:13, color:'var(--text-body)', lineHeight:1.6, fontFamily:"'Lexend', sans-serif" }}>
                        All reports are kept strictly confidential under Republic Act 9262.
                    </p>
                </div>
                <button className="vrn-btn-hover" style={{ ...S.submitBtn, width:'100%', marginBottom:12 }} onClick={() => navigate('/my-reports')}>
                    View My Reports
                </button>
                <button style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:13.5, fontWeight:600, cursor:'pointer', fontFamily:"'Lexend', sans-serif" }} onClick={() => navigate('/home')}>
                    Back to Home
                </button>
            </div>
        </div>
    );

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
                                <div>
                                    <h2 style={S.cardTitle}>Attach Photos</h2>
                                    <p style={S.cardSub}>Optional - mga patunay</p>
                                </div>
                            </div>
                            <p style={S.hint}>Attach photos as evidence. This is optional but can help authorities assess your report.</p>
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
                            {imagePreviews.length > 0 && (
                                <div style={{ marginTop:16 }}>
                                    <p style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)', marginBottom:10, fontFamily:"'Lexend', sans-serif" }}>
                                        {imagePreviews.length} photo{imagePreviews.length!==1?'s':''} attached
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
                                <div>
                                    <h2 style={S.cardTitle}>Where did this happen?</h2>
                                    <p style={S.cardSub}>Crime scene location - lokasyon ng pangyayari</p>
                                </div>
                            </div>
                            <p style={S.hint}>
                                Pin the <strong>crime scene</strong> location. Choose any method below - use your phone's GPS, type the address, or tap the map. You may skip this step if unsure.
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
                            <p style={S.hint}>Please review everything before submitting. You cannot edit after submission.</p>

                            {[
                                { label:"Offender's Name",  value: offenderName || '-' },
                                { label:'Date of Incident', value: incidentDate ? new Date(incidentDate).toLocaleString('en-PH',{month:'long',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '-' },
                                { label:'Statement',        value: statement || '-', long: true },
                                { label:'Photos Attached',  value: imageFiles.length>0 ? `${imageFiles.length} photo${imageFiles.length!==1?'s':''}` : 'None attached' },
                                { label:'Location',         value: location ? (address || `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`) : 'No location shared' },
                            ].map(row => (
                                <div key={row.label} style={S.reviewRow}>
                                    <p style={S.reviewLabel}>{row.label}</p>
                                    <p style={{ ...S.reviewVal, ...(row.long?{}:{overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}) }}>{row.value}</p>
                                </div>
                            ))}

                            {imagePreviews.length > 0 && (
                                <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:14 }}>
                                    {imagePreviews.map((src,i) => (
                                        <img key={i} src={src} alt={`Attachment ${i+1}`} style={{ width:56, height:56, borderRadius: 4, objectFit:'cover', border:'1px solid var(--border)' }} />
                                    ))}
                                </div>
                            )}

                            <div style={{ ...S.noteBox, backgroundColor:'var(--surface-tint)', border:'1px solid var(--border)' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:7 }}>
                                    <IcoShield />
                                    <p style={{ fontSize:13, fontWeight:700, color:'var(--accent-text)', fontFamily:"'Lexend', sans-serif" }}>After Submission</p>
                                </div>
                                <p style={S.noteText}>You will be asked to visit your Barangay VAWC Desk for official confirmation of this report.</p>
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
                            {loading ? <><Spinner /><span>Submitting…</span></> : 'Submit Report'}
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
    reviewRow:    { marginBottom:12, backgroundColor:'var(--surface-alt)', borderRadius: 4, padding:'12px 14px', border:'1px solid var(--border-soft)' },
    reviewLabel:  { fontSize:10.5, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.7px', marginBottom:5, fontFamily:"'Lexend', sans-serif" },
    reviewVal:    { fontSize:14, color:'var(--text)', lineHeight:1.65, fontFamily:"'Lexend', sans-serif", wordBreak:'break-word' },
    prevBtn:      { flex:1, padding:'13px', backgroundColor:'transparent', color:'var(--accent-text)', fontSize:15, fontWeight:600, border:'2px solid var(--border)', borderRadius: 4, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontFamily:"'Lexend', sans-serif" },
    nextBtn:      { flex:1, padding:'13px', backgroundColor:'#F47920', color:'#fff', fontSize:15, fontWeight:600, border:'none', borderRadius: 4, display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontFamily:"'Lexend', sans-serif", boxShadow:'0 2px 8px rgba(244,121,32,0.3)' },
    submitBtn:    { flex:1, padding:'13px', backgroundColor:'#C45E10', color:'#fff', fontSize:15, fontWeight:700, border:'none', borderRadius: 8, cursor:'pointer', fontFamily:"'Lexend', sans-serif", boxShadow:'0 2px 10px rgba(244,121,32,0.3)' },
};

export default ReportNow;
