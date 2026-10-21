import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import BottomNavbar from '../components/BottomNavbar';
import api from '../api';
import IdVerification from '../components/IdVerification';

if (!document.getElementById('vawc-font')) {
    const l = document.createElement('link'); l.id='vawc-font'; l.rel='stylesheet';
    l.href='https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}
if (!document.getElementById('vawc-profile-css')) {
    const s = document.createElement('style'); s.id='vawc-profile-css';
    s.textContent=`
        @keyframes spin { to{transform:rotate(360deg)} }
        .vp-btn { transition: background-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease; }
        .vp-btn:hover:not([disabled]) { background-color:#A83D00; transform:translateY(-1px); }
        .vp-btn:active:not([disabled]) { transform:translateY(0) scale(0.99); }
        /* Rows are the whole screen now, so the press state has to read on a
           phone where there is no hover at all. */
        .vp-row { transition: background-color 0.15s ease; }
        .vp-row:hover  { background-color: var(--surface-tint); }
        .vp-row:active { background-color: var(--border-soft); }
        .vp-row:focus-visible { outline:2px solid #CC4B00; outline-offset:-2px; }
        .vp-row-danger:hover  { background-color:#FFF1F2; }
        :root[data-theme="dark"] .vp-row-danger:hover { background-color:#2E1517; }
        .vp-chev { transition: transform 0.15s ease; }
        .vp-row:hover .vp-chev { transform: translateX(2px); }
    `;
    document.head.appendChild(s);
}

const IcoArrow   = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="#C45E10" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoEdit    = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoChevron = ({ c='var(--text-muted)' }) => (<svg className="vp-chev" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoKey     = () => (<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoBell    = () => (<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoClock   = () => (<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#64748B" strokeWidth="1.8"/><path d="M12 7v5l3 2" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoTrash   = () => (<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a1 1 0 01-1 1H7a1 1 0 01-1-1V6" stroke="#C62828" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoLogout  = () => (<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="#C62828" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoWarn    = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#BE123C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke="#BE123C" strokeWidth="1.8" strokeLinecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="#BE123C" strokeWidth="2.4" strokeLinecap="round"/></svg>);
const IcoCheck   = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const Spinner    = ({ c='#CC4B00', size=22 }) => (<div style={{ width:size, height:size, border:`2.5px solid ${c}30`, borderTopColor:c, borderRadius:'50%', animation:'spin 0.75s linear infinite' }} />);

// One row shape for the whole list. Kept at 56px tall rather than the 44px
// minimum: these are the only controls on the screen and there is room.
const Row = ({ icon, label, desc, onClick, right, danger, last }) => (
    <div className={`vp-row${danger ? ' vp-row-danger' : ''}`} onClick={onClick}
        role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
        style={{ ...S.row, borderBottom: last ? 'none' : '1px solid var(--border-soft)' }}>
        <span style={S.rowIcon}>{icon}</span>
        <span style={{ flex:1, minWidth:0 }}>
            <span style={{ ...S.rowLabel, color: danger ? '#C62828' : 'var(--text)' }}>{label}</span>
            {desc && <span style={S.rowDesc}>{desc}</span>}
        </span>
        {right !== undefined ? right : <IcoChevron c={danger ? '#FCA5A5' : 'var(--text-muted)'} />}
    </div>
);

const Group = ({ title, children }) => (
    <section style={{ display:'flex', flexDirection:'column', gap:7 }}>
        {title && <p style={S.groupTitle}>{title}</p>}
        <div style={S.card}>{children}</div>
    </section>
);

function Profile() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteErr, setDeleteErr] = useState('');
    const [saved, setSaved] = useState(false);

    // Named, because the ID card re-reads the profile after an upload so the
    // status reflects what the server now holds rather than what the page
    // assumed.
    const load = () => api.get("/users/me")
        .then(res => setProfile(res.data))
        .catch(err => {
            if (err.response?.status === 401) { localStorage.removeItem("token"); navigate('/'); }
        })
        .finally(() => setLoading(false));

    useEffect(() => {
        load();
        // Edit Profile sends us back here after a save; the pill is the only
        // confirmation she gets that it went through.
        try {
            if (sessionStorage.getItem('vawc_profile_saved') === '1') {
                sessionStorage.removeItem('vawc_profile_saved');
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            }
        } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!showDeleteConfirm) return;
        const onKey = (e) => { if (e.key === 'Escape' && !deleting) setShowDeleteConfirm(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [showDeleteConfirm, deleting]);

    const handleSignOut = () => {
        try { api.post('/auth/logout').catch(() => {}); } catch {}
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
        } finally {
            setDeleting(false);
        }
    };

    const header = (
        <header style={S.topBar}>
            <button style={S.backBtn} onClick={() => navigate('/home')} aria-label="Bumalik sa Home"><IcoArrow /></button>
            <h1 style={S.title}>My Profile</h1>
            <ThemeToggle size={44} />
        </header>
    );

    if (loading || !profile) return (
        <div style={S.page}>
            {header}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flex:1, gap:12 }}>
                <Spinner /><p style={{ fontSize:14, color:'var(--text-muted)', fontFamily:"'Lexend', sans-serif" }}>Loading profile…</p>
            </div>
            {/* Also on the loading screen, so the bar does not pop in once the
                request resolves on a slow connection. */}
            <BottomNavbar />
        </div>
    );

    const initials = [profile.first_name, profile.last_name].filter(Boolean).map(n => n[0]).join('').toUpperCase() || '?';
    const fullName = [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ');
    const isMinor  = profile.is_minor || false;

    return (
        <div style={S.page}>
            {header}

            <main style={S.content}>

                {/* Who she is, and the one button that changes it. */}
                <div style={S.identity}>
                    <div style={S.avatar}>{initials}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                        <p style={S.identityName}>{fullName}</p>
                        <p style={S.identityEmail}>{profile.email}</p>
                        {isMinor && <span style={S.minorPill}>Minor Account</span>}
                    </div>
                </div>

                {saved && (
                    <div style={S.savedPill}><IcoCheck /><span>Profile saved</span></div>
                )}

                <button className="vp-btn" style={S.editBtn} onClick={() => navigate('/profile/edit')}>
                    <IcoEdit /> Edit Profile
                </button>

                {/* The ID gate stays a full card rather than a row: until it is
                    approved she cannot file a report, which is too important to
                    reduce to a line of text with a chevron. */}
                <IdVerification profile={profile} onUpdated={load} />

                <Group title="Account">
                    <Row icon={<IcoKey />} label="Change Password" desc="Update your login password"
                        onClick={() => navigate('/change-password')} />
                    <Row icon={<IcoBell />} label="Notifications"
                        desc="Choose what the barangay tells you about"
                        onClick={() => navigate('/profile/notifications')} />
                    <Row icon={<IcoClock />} label="Activity"
                        desc="Sign-ins, and what happened with your case"
                        onClick={() => navigate('/profile/activity')} last />
                </Group>

                <Group>
                    <Row icon={<IcoTrash />} label="Delete Account" desc="Recoverable within 30 days" danger
                        onClick={() => { setDeleteErr(''); setShowDeleteConfirm(true); }} />
                    <Row icon={<IcoLogout />} label="Sign Out" danger last
                        onClick={handleSignOut} />
                </Group>

                <p style={S.version}>VAWC-Response · Barangay Palanginan, Iba, Zambales</p>
            </main>

            <BottomNavbar />

            {/* Delete confirm modal */}
            {showDeleteConfirm && (
                <div style={S.backdrop} onClick={() => !deleting && setShowDeleteConfirm(false)}>
                    <div style={S.modal} onClick={e => e.stopPropagation()}
                        role="dialog" aria-modal="true" aria-label="Kumpirmahin ang pagtanggal ng account">
                        <div style={S.modalIcon}><IcoTrash /></div>
                        <h2 style={S.modalTitle}>Delete Account?</h2>
                        <p style={S.modalText}>
                            Your account and reports will be hidden immediately. The barangay can restore them
                            within 30 days; after that they are erased for good.
                        </p>
                        {deleteErr && (
                            <div style={S.errorBox}>
                                <IcoWarn /><p style={{ fontSize:13, color:'#BE123C', fontFamily:"'Lexend', sans-serif", margin:0 }}>{deleteErr}</p>
                            </div>
                        )}
                        <div style={{ display:'flex', gap:10, width:'100%' }}>
                            <button className="vp-btn" style={S.cancelBtn} onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                                Cancel
                            </button>
                            <button style={{ ...S.deleteBtn, opacity: deleting ? 0.75 : 1 }} onClick={handleDeleteAccount} disabled={deleting}>
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
    page:          { minHeight:'100vh', background:'var(--page-grad)', color:'var(--text)', display:'flex', flexDirection:'column', paddingBottom:92, fontFamily:"'Lexend', sans-serif" },
    topBar:        { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', backgroundColor:'var(--surface)', borderBottom:'1px solid var(--border)', position:'sticky', top:0, zIndex:100 },
    backBtn:       { width:44, height:44, borderRadius:10, backgroundColor:'var(--surface-tint)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' },
    title:         { fontSize:17, fontWeight:700, color:'var(--accent-text)', fontFamily:"'Lexend', sans-serif" },
    // Capped and centred to match the Home page, which tops out at 1060px.
    content:       { padding:'20px 18px', display:'flex', flexDirection:'column', gap:16, width:'100%', maxWidth:620, marginLeft:'auto', marginRight:'auto', boxSizing:'border-box' },

    identity:      { display:'flex', alignItems:'center', gap:14, padding:'4px 2px' },
    avatar:        { width:64, height:64, flexShrink:0, borderRadius:'50%', background:'linear-gradient(135deg,var(--border),#F47920)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:21, fontWeight:800, color:'#fff', fontFamily:"'Lexend', sans-serif" },
    identityName:  { fontSize:17, fontWeight:700, color:'var(--text)', fontFamily:"'Lexend', sans-serif", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
    identityEmail: { fontSize:13, color:'var(--text-muted)', fontFamily:"'Lexend', sans-serif", marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
    minorPill:     { display:'inline-block', backgroundColor:'#FEF3C7', border:'1px solid #FCD34D', borderRadius:999, padding:'3px 10px', fontSize:11.5, fontWeight:600, color:'#92400E', fontFamily:"'Lexend', sans-serif", marginTop:6 },
    savedPill:     { display:'flex', alignSelf:'flex-start', alignItems:'center', gap:6, backgroundColor:'#ECFDF5', border:'1px solid #6EE7B7', borderRadius:999, padding:'5px 13px', fontSize:12, fontWeight:600, color:'#059669', fontFamily:"'Lexend', sans-serif" },

    editBtn:       { width:'100%', padding:'13px', backgroundColor:'#CC4B00', color:'#fff', border:'none', borderRadius:10, fontSize:15, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontFamily:"'Lexend', sans-serif", boxShadow:'0 2px 6px rgba(204,75,0,0.22)' },

    groupTitle:    { fontSize:10.5, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.8px', fontFamily:"'Lexend', sans-serif", paddingLeft:2 },
    card:          { backgroundColor:'var(--surface)', borderRadius:12, overflow:'hidden', border:'1px solid var(--border)', boxShadow:'var(--card-shadow)' },
    row:           { display:'flex', alignItems:'center', gap:12, padding:'0 16px', minHeight:56, cursor:'pointer', boxSizing:'border-box' },
    rowIcon:       { width:34, height:34, flexShrink:0, borderRadius:9, backgroundColor:'var(--surface-alt)', display:'flex', alignItems:'center', justifyContent:'center' },
    rowLabel:      { display:'block', fontSize:14.5, fontWeight:600, fontFamily:"'Lexend', sans-serif" },
    rowDesc:       { display:'block', fontSize:12, color:'var(--text-muted)', fontFamily:"'Lexend', sans-serif", marginTop:1 },

    version:       { fontSize:11.5, color:'var(--text-muted)', textAlign:'center', fontFamily:"'Lexend', sans-serif", paddingTop:4 },

    backdrop:      { position:'fixed', inset:0, backgroundColor:'var(--overlay)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, zIndex:2000 },
    modal:         { backgroundColor:'var(--surface)', borderRadius:16, padding:'24px 22px', width:'100%', maxWidth:380, display:'flex', flexDirection:'column', alignItems:'center', gap:12, border:'1px solid var(--border)' },
    modalIcon:     { width:52, height:52, borderRadius:'50%', backgroundColor:'#FFF1F2', display:'flex', alignItems:'center', justifyContent:'center' },
    modalTitle:    { fontSize:18, fontWeight:700, color:'var(--text)', fontFamily:"'Lexend', sans-serif" },
    modalText:     { fontSize:13.5, color:'var(--text-muted)', textAlign:'center', lineHeight:1.6, fontFamily:"'Lexend', sans-serif" },
    errorBox:      { display:'flex', alignItems:'center', gap:8, backgroundColor:'#FFF1F2', border:'1px solid #FECDD3', borderRadius:8, padding:'10px 14px', width:'100%', boxSizing:'border-box' },
    cancelBtn:     { flex:1, padding:'12px', backgroundColor:'transparent', color:'var(--text)', border:'1.5px solid var(--border)', borderRadius:10, fontSize:14.5, fontWeight:600, cursor:'pointer', fontFamily:"'Lexend', sans-serif" },
    deleteBtn:     { flex:1, padding:'12px', backgroundColor:'#C62828', color:'#fff', border:'none', borderRadius:10, fontSize:14.5, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontFamily:"'Lexend', sans-serif" },
};

export default Profile;
