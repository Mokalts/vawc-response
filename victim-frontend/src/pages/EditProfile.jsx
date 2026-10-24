import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import BottomNavbar from '../components/BottomNavbar';
import api from '../api';

if (!document.getElementById('vawc-font')) {
    const l = document.createElement('link'); l.id='vawc-font'; l.rel='stylesheet';
    l.href='https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}
if (!document.getElementById('vawc-editprofile-css')) {
    const s = document.createElement('style'); s.id='vawc-editprofile-css';
    s.textContent=`
        @keyframes spin { to{transform:rotate(360deg)} }
        .ve-input { transition: border-color 0.15s, box-shadow 0.15s; }
        .ve-input:focus { border-color:#CC4B00 !important; outline:none; box-shadow:0 0 0 3px rgba(204,75,0,0.12) !important; }
        .ve-btn { transition: background-color 0.18s ease, transform 0.18s ease; }
        .ve-btn:active:not([disabled]) { transform:translateY(0) scale(0.99); }
        @media (hover: hover) and (pointer: fine) {
            .ve-btn:hover:not([disabled]) { transform:translateY(-1px); }
            .ve-save:hover:not([disabled]) { background-color:#A83D00; }
        }
    `;
    document.head.appendChild(s);
}

const IcoArrow    = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoWarn     = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#BE123C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke="#BE123C" strokeWidth="1.8" strokeLinecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="#BE123C" strokeWidth="2.4" strokeLinecap="round"/></svg>);
const IcoLock     = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="#64748B" strokeWidth="1.8"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round"/></svg>);
const IcoGuardian = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="#92400E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9" cy="7" r="4" stroke="#92400E" strokeWidth="1.8"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="#92400E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const Spinner     = ({ c='#CC4B00', size=22 }) => (<div style={{ width:size, height:size, border:`2.5px solid ${c}30`, borderTopColor:c, borderRadius:'50%', animation:'spin 0.75s linear infinite' }} />);

// Every field on this screen is editable, so the asterisk marks the two the
// save actually enforces rather than decorating all of them.
const Field = ({ label, required, inputProps }) => (
    <div style={FS.group}>
        <p style={FS.label}>
            {label}
            {required && <span aria-label="required" style={{ color:'#C62828', marginLeft:3 }}>*</span>}
        </p>
        <input className="ve-input" style={FS.input} aria-label={label} {...inputProps} />
    </div>
);

const ReadOnlyField = ({ label, value }) => (
    <div style={FS.group}>
        <p style={FS.label}>{label}</p>
        <p style={FS.value}>{value || <span style={{ color:'var(--text-muted)' }}>-</span>}</p>
    </div>
);

const FS = {
    group: { marginBottom:0 },
    label: { fontSize:10.5, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.7px', marginBottom:5, fontFamily:"'Lexend', sans-serif" },
    value: { fontSize:15, color:'var(--text)', fontFamily:"'Lexend', sans-serif", lineHeight:1.4 },
    input: { width:'100%', boxSizing:'border-box', padding:'11px 13px', borderRadius:9, border:'1.5px solid var(--border)', fontSize:15, color:'var(--text)', backgroundColor:'var(--surface-alt)', fontFamily:"'Lexend', sans-serif" },
};

function EditProfile() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving,  setSaving]  = useState(false);
    const [error,   setError]   = useState('');
    const [profile, setProfile] = useState(null);
    const [form,    setForm]    = useState({});

    const resetForm = (data) => setForm({
        first_name:   data.first_name   || '',
        middle_name:  data.middle_name  || '',
        last_name:    data.last_name    || '',
        phone_number: data.phone_number || '',
        address:      data.address      || '',
        birthdate:    data.birthdate    || '',
        sex:          data.sex          || '',
    });

    useEffect(() => {
        api.get("/users/me")
            .then(res => { setProfile(res.data); resetForm(res.data); })
            .catch(err => {
                if (err.response?.status === 401) { localStorage.removeItem("token"); navigate('/'); }
            })
            .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSave = async () => {
        if (!form.first_name.trim() || !form.last_name.trim()) { setError("First name and last name are required."); return; }
        setSaving(true); setError('');
        try {
            const res = await api.patch("/users/me", {
                first_name:   form.first_name,
                middle_name:  form.middle_name  || null,
                last_name:    form.last_name,
                phone_number: form.phone_number,
                address:      form.address      || null,
                birthdate:    form.birthdate    || null,
                sex:          form.sex          || null,
            });
            try {
                const u = JSON.parse(localStorage.getItem('user') || '{}');
                localStorage.setItem('user', JSON.stringify({ ...u, first_name: res.data.first_name, last_name: res.data.last_name }));
            } catch {}
            // The confirmation belongs on the screen she lands on, not on the
            // one that is about to unmount.
            try { sessionStorage.setItem('vawc_profile_saved', '1'); } catch {}
            navigate('/profile');
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to save changes.");
            setSaving(false);
        }
    };

    const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setError(''); };

    const header = (
        <header style={S.topBar}>
            <button className="vh-icon-btn" style={S.backBtn} onClick={() => navigate('/profile')} aria-label="Kanselahin ang pag-edit"><IcoArrow /></button>
            <h1 style={S.title}>Edit Profile</h1>
            <ThemeToggle size={44} />
        </header>
    );

    if (loading || !profile) return (
        <div style={S.page}>
            {header}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flex:1, gap:12 }}>
                <Spinner /><p style={{ fontSize:14, color:'var(--text-muted)', fontFamily:"'Lexend', sans-serif" }}>Loading profile…</p>
            </div>
            <BottomNavbar />
        </div>
    );

    const isMinor = profile.is_minor || false;
    const initials = [profile.first_name, profile.last_name].filter(Boolean).map(n => n[0]).join('').toUpperCase() || '?';

    return (
        <div style={S.page}>
            {header}

            <main style={S.content}>

                <div style={{ display:'flex', justifyContent:'center', paddingBottom:4 }}>
                    <div style={S.avatar}>{initials}</div>
                </div>

                <div style={S.card}>
                    <div style={S.section}>
                        <p style={S.sectionTitle}>Your Information</p>
                        <div style={S.fieldGrid}>
                            <Field required label="First Name"
                                inputProps={{ value:form.first_name, placeholder:'First name', onChange:e=>set('first_name',e.target.value) }} />
                            <Field required label="Last Name"
                                inputProps={{ value:form.last_name, placeholder:'Last name', onChange:e=>set('last_name',e.target.value) }} />
                        </div>
                        <Field label="Middle Name"
                            inputProps={{ value:form.middle_name, placeholder:'Optional', onChange:e=>set('middle_name',e.target.value) }} />
                        <div style={S.fieldGrid}>
                            <Field label="Birthdate"
                                inputProps={{ type:'date', value:form.birthdate, onChange:e=>set('birthdate',e.target.value) }} />
                            <div style={FS.group}>
                                <p style={FS.label}>Sex</p>
                                <select className="ve-input" aria-label="Sex" style={{ ...FS.input, appearance:'auto' }}
                                    value={form.sex} onChange={e=>set('sex',e.target.value)}>
                                    <option value="">Select</option>
                                    <option value="Female">Female</option>
                                    <option value="Male">Male</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div style={S.divider} />

                    <div style={S.section}>
                        <p style={S.sectionTitle}>Contact Details</p>
                        <Field label="Mobile Number"
                            inputProps={{ type:'tel', value:form.phone_number, placeholder:'09xxxxxxxxx', onChange:e=>set('phone_number',e.target.value) }} />
                        <div style={FS.group}>
                            <p style={FS.label}>Email Address</p>
                            <p style={FS.value}>{profile.email}</p>
                            <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:4 }}>
                                <IcoLock /><p style={{ fontSize:11.5, color:'var(--text-muted)', fontFamily:"'Lexend', sans-serif" }}>Email cannot be changed.</p>
                            </div>
                        </div>
                        <Field label="Home Address"
                            inputProps={{ value:form.address, placeholder:'Optional', onChange:e=>set('address',e.target.value) }} />
                    </div>

                    {/* ── Guardian Info (always visible, never editable) ── */}
                    <div style={S.divider} />
                    <div style={S.section}>
                        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                            <IcoGuardian />
                            <p style={{ ...S.sectionTitle, color:'#92400E' }}>Guardian Information</p>
                        </div>
                        <div style={{ backgroundColor: isMinor ? '#FFFBEB' : 'var(--surface-alt)', border:`1px solid ${isMinor ? '#FCD34D' : 'var(--border)'}`, borderRadius:9, padding:'14px' }}>
                            {isMinor ? (
                                <div style={S.fieldGrid}>
                                    <ReadOnlyField label="Guardian Name" value={profile.guardian_name} />
                                    <ReadOnlyField label="Relationship" value={profile.guardian_relationship} />
                                </div>
                            ) : (
                                <p style={{ margin:0, fontSize:13, color:'var(--text-muted)', fontStyle:'italic', fontFamily:"'Lexend', sans-serif" }}>
                                    Not applicable - account is not registered as a minor.
                                </p>
                            )}
                            <div style={{ display:'flex', alignItems:'center', gap:5, marginTop: isMinor ? 12 : 8 }}>
                                <IcoLock />
                                <p style={{ fontSize:11.5, color:'var(--text-muted)', fontFamily:"'Lexend', sans-serif", margin:0 }}>
                                    Guardian information is set during registration and cannot be changed here.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {error && (
                    <div style={S.errorBox}>
                        <IcoWarn /><p style={{ fontSize:13, color:'#BE123C', fontFamily:"'Lexend', sans-serif", margin:0 }}>{error}</p>
                    </div>
                )}

                <div style={{ display:'flex', gap:12 }}>
                    <button className="ve-btn" style={S.cancelBtn} onClick={() => navigate('/profile')} disabled={saving}>
                        Cancel
                    </button>
                    <button className="ve-btn ve-save" style={{ ...S.saveBtn, opacity: saving ? 0.75 : 1 }}
                        onClick={handleSave} disabled={saving}>
                        {saving ? <><Spinner c="#fff" size={16} /><span>Saving…</span></> : 'Save Changes'}
                    </button>
                </div>
            </main>

            <BottomNavbar />
        </div>
    );
}

const S = {
    page:         { minHeight:'100vh', background:'var(--page-grad)', color:'var(--text)', display:'flex', flexDirection:'column', paddingBottom:92, fontFamily:"'Lexend', sans-serif" },
    topBar:       { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', backgroundColor:'var(--surface)', borderBottom:'1px solid var(--border)', position:'sticky', top:0, zIndex:100 },
    backBtn:      { width:44, height:44, borderRadius:10, backgroundColor: 'transparent', border: 'none', color: 'var(--text)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' },
    title:        { fontSize:17, fontWeight:700, color:'var(--accent-text)', fontFamily:"'Lexend', sans-serif" },
    content:      { padding:'20px 18px', display:'flex', flexDirection:'column', gap:16, width:'100%', maxWidth:620, marginLeft:'auto', marginRight:'auto', boxSizing:'border-box' },
    avatar:       { width:72, height:72, borderRadius:'50%', background:'#F47920', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:800, color:'#fff', fontFamily:"'Lexend', sans-serif" },
    card:         { backgroundColor:'var(--surface)', borderRadius:12, overflow:'hidden', border:'1px solid var(--border)', boxShadow:'var(--card-shadow)' },
    section:      { padding:'16px 18px', display:'flex', flexDirection:'column', gap:14 },
    sectionTitle: { fontSize:10.5, fontWeight:700, color:'var(--accent-text)', textTransform:'uppercase', letterSpacing:'0.7px', fontFamily:"'Lexend', sans-serif" },
    fieldGrid:    { display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 },
    divider:      { height:1, backgroundColor:'var(--border-soft)' },
    errorBox:     { display:'flex', alignItems:'center', gap:8, backgroundColor:'#FFF1F2', border:'1px solid #FECDD3', borderRadius:8, padding:'10px 14px' },
    cancelBtn:    { flex:1, padding:'13px', backgroundColor:'transparent', color:'var(--text)', border:'1.5px solid var(--border)', borderRadius:10, fontSize:15, fontWeight:600, cursor:'pointer', fontFamily:"'Lexend', sans-serif" },
    saveBtn:      { flex:1, padding:'13px', backgroundColor:'#CC4B00', color:'#fff', border:'none', borderRadius:10, fontSize:15, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontFamily:"'Lexend', sans-serif", boxShadow:'0 2px 6px rgba(204,75,0,0.22)' },
};

export default EditProfile;
