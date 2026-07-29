import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

if (!document.getElementById('vawc-font')) {
    const l = document.createElement('link'); l.id='vawc-font'; l.rel='stylesheet';
    l.href='https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}
if (!document.getElementById('vawc-settings-css')) {
    const s = document.createElement('style'); s.id='vawc-settings-css';
    s.textContent=`
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .vs-row { transition: background-color 0.12s ease; }
        .vs-row:hover { background-color:#FFF3E0 !important; }
        .vs-btn { transition: opacity 0.15s, transform 0.15s; }
        .vs-btn:hover:not([disabled]) { opacity:0.88; transform:translateY(-1px); }
    `;
    document.head.appendChild(s);
}

const IcoArrow    = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="#C45E10" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoChevron  = ({ c='#CBD5E1' }) => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoKey      = ({ c='#64748B' }) => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="8" cy="15" r="5" stroke={c} strokeWidth="1.8"/><path d="M11.5 11.5L21 2M19 4l2 2M16 4l2 2" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoTrash    = ({ c='#EF4444' }) => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoLogout   = ({ c='#C45E10' }) => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 17l5-5-5-5M21 12H9" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoBell     = ({ c='#64748B', active=false }) => (<svg width="17" height="17" viewBox="0 0 24 24" fill={active?"#F47920":"none"}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke={active?"#F47920":c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoShield   = ({ c='#C45E10' }) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoWarn     = ({ c='#92400E' }) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke={c} strokeWidth="1.8" strokeLinecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke={c} strokeWidth="2.4" strokeLinecap="round"/></svg>);
const Spinner     = ({ c='#F47920', size=18 }) => (<div style={{ width:size, height:size, border:`2.5px solid ${c}30`, borderTopColor:c, borderRadius: '50%', animation:'spin 0.75s linear infinite' }} />);

const Row = ({ icon, label, desc, descColor, onClick, right }) => (
    <div className="vs-row" onClick={onClick} style={{ ...S.row, cursor: onClick ? 'pointer' : 'default' }}
        role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}>
        <div style={S.rowIcon}>{icon}</div>
        <div style={{ flex:1, textAlign:'left' }}>
            <p style={{ ...S.rowLabel, color: descColor&&label?'#EF4444':undefined }}>{label}</p>
            {desc && <p style={{ ...S.rowDesc, color: descColor || '#94A3B8' }}>{desc}</p>}
        </div>
        {right || <IcoChevron />}
    </div>
);

function Settings() {
    const navigate = useNavigate();
    const [notifications,      setNotifications]      = useState(true);
    const [showDeleteConfirm,  setShowDeleteConfirm]  = useState(false);
    const [deleting,           setDeleting]           = useState(false);
    const [deleteErr,          setDeleteErr]          = useState('');

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate('/');
    };

    const handleDeleteAccount = async () => {
        setDeleting(true); setDeleteErr('');
        try {
            await api.delete("/users/me");
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            navigate('/');
        } catch (err) {
            setDeleteErr(err.response?.data?.detail || "Failed to delete account. Please try again.");
            setDeleting(false);
        }
    };

    // ── Toggle component ──────────────────────────────────────────────────────
    const Toggle = ({ on, onToggle }) => (
        <button onClick={onToggle} style={{ ...S.toggle, backgroundColor: on?'#1FA87A':'#CBD5E1' }}>
            <div style={{ ...S.toggleKnob, transform: on?'translateX(22px)':'translateX(2px)' }} />
        </button>
    );

    return (
        <div style={S.page}>
            <header style={S.topBar}>
                <button style={S.backBtn} onClick={() => navigate('/home')}><IcoArrow /></button>
                <h1 style={S.title}>Settings</h1>
                <div style={{ width:36 }} />
            </header>

            <main style={S.content}>

                {/* Preferences */}
                <div style={S.section}>
                    <p style={S.sectionLabel}>Preferences</p>
                    <div style={S.card}>
                        <Row
                            icon={<IcoBell c="#64748B" active={notifications} />}
                            label="Notifications"
                            desc={notifications ? 'Enabled' : 'Disabled'}
                            onClick={() => setNotifications(v => !v)}
                            right={<Toggle on={notifications} onToggle={() => setNotifications(v => !v)} />}
                        />
                    </div>
                </div>

                {/* Account */}
                <div style={S.section}>
                    <p style={S.sectionLabel}>Account</p>
                    <div style={S.card}>
                        <Row
                            icon={<IcoKey />}
                            label="Change Password"
                            desc="Update your login password"
                            onClick={() => navigate('/change-password')}
                        />
                        <div style={S.divider} />
                        <Row
                            icon={<IcoTrash />}
                            label={<span style={{ color:'#EF4444' }}>Delete Account</span>}
                            desc="Recoverable within 30 days"
                            onClick={() => { setDeleteErr(''); setShowDeleteConfirm(true); }}
                            right={<IcoChevron c="#FCA5A5" />}
                        />
                    </div>
                </div>

                {/* Legal */}
                <div style={S.section}>
                    <p style={S.sectionLabel}>Legal</p>
                    <div style={S.card}>
                        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 16px' }}>
                            <div style={S.rowIcon}><IcoShield /></div>
                            <p style={{ fontSize:13, color:'#475569', lineHeight:1.6, fontFamily:"'DM Sans', sans-serif" }}>
                                This app is governed by <strong style={{ color:'#C45E10' }}>Republic Act 9262</strong>. All reports and personal data are kept strictly confidential.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Logout */}
                <button className="vs-btn" style={S.logoutBtn} onClick={handleLogout}>
                    <IcoLogout /><span>Sign Out</span>
                </button>

                <p style={S.version}>VAWC-Response · Barangay Palanginan, Iba, Zambales</p>
            </main>

            {/* Delete confirm modal */}
            {showDeleteConfirm && (
                <div style={S.backdrop} onClick={() => !deleting && setShowDeleteConfirm(false)}>
                    <div style={S.modal} onClick={e => e.stopPropagation()}>

                        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                            <div style={{ width:38, height:38, borderRadius: 4, backgroundColor:'#FFF1F2', border:'1px solid #FECDD3', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                <IcoTrash />
                            </div>
                            <h2 style={S.modalTitle}>Delete Account?</h2>
                        </div>

                        <p style={S.modalText}>
                            Are you sure you want to delete your account? You will be signed out immediately.
                        </p>

                        <div style={S.noticeBox}>
                            <div style={{ display:'flex', alignItems:'flex-start', gap:7, marginBottom:7 }}>
                                <div style={{ marginTop:1 }}><IcoWarn /></div>
                                <p style={{ fontSize:13, fontWeight:700, color:'#92400E', fontFamily:"'DM Sans', sans-serif" }}>Before you delete</p>
                            </div>
                            <p style={{ fontSize:13, color:'#78350F', lineHeight:1.6, fontFamily:"'DM Sans', sans-serif", marginBottom:6 }}>
                                You can recover your account within <strong>30 days</strong> by signing in again with your email and password.
                            </p>
                            <p style={{ fontSize:13, color:'#78350F', lineHeight:1.6, fontFamily:"'DM Sans', sans-serif" }}>
                                Your submitted reports will <strong>not</strong> be deleted.
                            </p>
                        </div>

                        {deleteErr && (
                            <div style={{ backgroundColor:'#FFF1F2', border:'1px solid #FECDD3', borderRadius: 4, padding:'10px 13px', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                                <IcoWarn c="#BE123C" />
                                <p style={{ fontSize:13, color:'#BE123C', fontFamily:"'DM Sans', sans-serif", margin:0 }}>{deleteErr}</p>
                            </div>
                        )}

                        <div style={{ display:'flex', gap:10 }}>
                            <button className="vs-btn" style={S.cancelBtn} onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                                Cancel
                            </button>
                            <button className="vs-btn" style={{ ...S.deleteBtn, opacity: deleting?0.75:1 }} onClick={handleDeleteAccount} disabled={deleting}>
                                {deleting ? <><Spinner c="#fff" size={15} /><span>Deleting…</span></> : 'Yes, Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const S = {
    page:       { minHeight:'100vh', backgroundColor:'#FFF3E0', display:'flex', flexDirection:'column', fontFamily:"'DM Sans', sans-serif" },
    topBar:     { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', backgroundColor:'#fff', borderBottom:'1px solid #FFE4CC', position:'sticky', top:0, zIndex:100 },
    backBtn:    { width:36, height:36, borderRadius: 10, backgroundColor:'#FFF3E0', border:'1px solid #FFE4CC', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' },
    title:      { fontSize:17, fontWeight:700, color:'#C45E10', fontFamily:"'DM Sans', sans-serif" },
    content:    { padding:'20px', display:'flex', flexDirection:'column', gap:6 },
    section:    { display:'flex', flexDirection:'column', gap:6, marginBottom:10 },
    sectionLabel:{ fontSize:10.5, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.7px', paddingLeft:4, fontFamily:"'DM Sans', sans-serif" },
    card:       { backgroundColor:'#fff', borderRadius: 12, overflow:'hidden', border:'1px solid #FFE4CC', boxShadow:'0 2px 8px rgba(244,121,32,0.05)' },
    row:        { display:'flex', alignItems:'center', gap:12, padding:'14px 16px', width:'100%', backgroundColor:'transparent', border:'none', cursor:'pointer', textAlign:'left' },
    rowIcon:    { width:34, height:34, borderRadius: 4, backgroundColor:'#F8FAFC', border:'1px solid #F1F5F9', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
    rowLabel:   { fontSize:14.5, fontWeight:600, color:'#0F172A', fontFamily:"'DM Sans', sans-serif", marginBottom:1 },
    rowDesc:    { fontSize:12, fontFamily:"'DM Sans', sans-serif" },
    divider:    { height:1, backgroundColor:'#F8FAFC', marginLeft:62 },
    toggle:     { width:46, height:26, borderRadius: 4, border:'none', cursor:'pointer', position:'relative', padding:0, transition:'background-color 0.2s', flexShrink:0 },
    toggleKnob: { width:22, height:22, borderRadius: 4, backgroundColor:'#fff', position:'absolute', top:2, transition:'transform 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.15)' },
    logoutBtn:  { display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'13px', backgroundColor:'transparent', color:'#C45E10', fontSize:15, fontWeight:600, border:'2px solid #FFE4CC', borderRadius: 4, cursor:'pointer', fontFamily:"'DM Sans', sans-serif" },
    version:    { textAlign:'center', fontSize:11.5, color:'#CBD5E1', marginTop:8, fontFamily:"'DM Sans', sans-serif" },
    backdrop:   { position:'fixed', inset:0, backgroundColor:'rgba(15,23,42,0.5)', zIndex:400, display:'flex', alignItems:'flex-end', justifyContent:'center', animation:'fadeIn 0.15s ease' },
    modal:      { backgroundColor:'#fff', borderRadius: 16, padding:'28px 22px 36px', width:'100%', maxWidth:480, animation:'slideUp 0.2s ease' },
    modalTitle: { fontSize:18, fontWeight:700, color:'#0F172A', fontFamily:"'DM Sans', sans-serif" },
    modalText:  { fontSize:14, color:'#475569', lineHeight:1.65, marginBottom:16, fontFamily:"'DM Sans', sans-serif" },
    noticeBox:  { backgroundColor:'#FFFBEB', border:'1px solid #FDE68A', borderRadius: 4, padding:'14px 16px', marginBottom:18 },
    cancelBtn:  { flex:1, padding:'13px', backgroundColor:'transparent', color:'#64748B', border:'2px solid #E2E8F0', borderRadius: 4, fontSize:15, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans', sans-serif" },
    deleteBtn:  { flex:1, padding:'13px', backgroundColor:'#EF4444', color:'#fff', border:'none', borderRadius: 4, fontSize:15, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontFamily:"'DM Sans', sans-serif" },
};

export default Settings;
