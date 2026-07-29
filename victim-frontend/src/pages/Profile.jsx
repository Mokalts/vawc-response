import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

if (!document.getElementById('vawc-font')) {
    const l = document.createElement('link'); l.id='vawc-font'; l.rel='stylesheet';
    l.href='https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}
if (!document.getElementById('vawc-profile-css')) {
    const s = document.createElement('style'); s.id='vawc-profile-css';
    s.textContent=`
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .vp-input { transition: border-color 0.15s, box-shadow 0.15s; }
        .vp-input:focus { border-color:#F47920 !important; outline:none; box-shadow:0 0 0 3px rgba(244,121,32,0.1) !important; background:#fff !important; }
        .vp-btn { transition: opacity 0.15s, transform 0.15s; }
        .vp-btn:hover:not([disabled]) { opacity:0.88; transform:translateY(-1px); }
    `;
    document.head.appendChild(s);
}

const IcoArrow    = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="#C45E10" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoEdit     = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoWarn     = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#BE123C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke="#BE123C" strokeWidth="1.8" strokeLinecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="#BE123C" strokeWidth="2.4" strokeLinecap="round"/></svg>);
const IcoLock     = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="#94A3B8" strokeWidth="1.8"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round"/></svg>);
const IcoCheck    = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoGuardian = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="#92400E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9" cy="7" r="4" stroke="#92400E" strokeWidth="1.8"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="#92400E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const Spinner     = ({ c='#F47920', size=22 }) => (<div style={{ width:size, height:size, border:`2.5px solid ${c}30`, borderTopColor:c, borderRadius: '50%', animation:'spin 0.75s linear infinite' }} />);

const Field = ({ label, value, editing, inputProps }) => (
    <div style={FS.group}>
        <p style={FS.label}>{label}</p>
        {editing
            ? <input className="vp-input" style={FS.input} {...inputProps} />
            : <p style={FS.value}>{value || <span style={{ color:'#CBD5E1' }}>-</span>}</p>}
    </div>
);

const ReadOnlyField = ({ label, value, muted }) => (
    <div style={FS.group}>
        <p style={FS.label}>{label}</p>
        <p style={{ ...FS.value, color: muted ? '#94A3B8' : '#0F172A', fontStyle: muted ? 'italic' : 'normal' }}>
            {value || <span style={{ color:'#CBD5E1' }}>-</span>}
        </p>
    </div>
);

const FS = {
    group: { marginBottom:0 },
    label: { fontSize:10.5, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.7px', marginBottom:5, fontFamily:"'DM Sans', sans-serif" },
    value: { fontSize:15, color:'#0F172A', fontFamily:"'DM Sans', sans-serif", lineHeight:1.4 },
    input: { width:'100%', boxSizing:'border-box', padding:'10px 13px', borderRadius: 8, border:'1.5px solid #E2E8F0', fontSize:15, color:'#0F172A', backgroundColor:'#F8FAFC', fontFamily:"'DM Sans', sans-serif" },
};

function Profile() {
    const navigate = useNavigate();
    const [editing, setEditing]   = useState(false);
    const [loading, setLoading]   = useState(true);
    const [saving,  setSaving]    = useState(false);
    const [error,   setError]     = useState('');
    const [saved,   setSaved]     = useState(false);
    const [profile, setProfile]   = useState(null);
    const [form,    setForm]      = useState({});

    useEffect(() => {
        api.get("/users/me")
            .then(res => { setProfile(res.data); resetForm(res.data); })
            .catch(err => {
                if (err.response?.status === 401) { localStorage.removeItem("token"); navigate('/'); }
            })
            .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const resetForm = (data) => setForm({
        first_name:   data.first_name   || '',
        middle_name:  data.middle_name  || '',
        last_name:    data.last_name    || '',
        phone_number: data.phone_number || '',
        address:      data.address      || '',
        birthdate:    data.birthdate    || '',
        sex:          data.sex          || '',
    });

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
            setProfile(res.data);
            resetForm(res.data);
            setEditing(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
            try {
                const u = JSON.parse(localStorage.getItem('user') || '{}');
                localStorage.setItem('user', JSON.stringify({ ...u, first_name: res.data.first_name, last_name: res.data.last_name }));
            } catch {}
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to save changes.");
        } finally {
            setSaving(false);
        }
    };

    const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setError(''); };

    const initials = profile
        ? [profile.first_name, profile.last_name].filter(Boolean).map(n => n[0]).join('').toUpperCase()
        : '?';
    const fullName = profile
        ? [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ')
        : '';

    if (loading || !profile) return (
        <div style={S.page}>
            <header style={S.topBar}>
                <button style={S.backBtn} onClick={() => navigate('/home')}><IcoArrow /></button>
                <h1 style={S.title}>My Profile</h1>
                <div style={{ width:36 }} />
            </header>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flex:1, gap:12 }}>
                <Spinner /><p style={{ fontSize:14, color:'#94A3B8', fontFamily:"'DM Sans', sans-serif" }}>Loading profile…</p>
            </div>
        </div>
    );

    const isMinor = profile.is_minor || false;

    return (
        <div style={S.page}>
            <header style={S.topBar}>
                <button style={S.backBtn} onClick={() => editing ? (resetForm(profile), setEditing(false), setError('')) : navigate('/home')}>
                    <IcoArrow />
                </button>
                <h1 style={S.title}>{editing ? 'Edit Profile' : 'My Profile'}</h1>
                <div style={{ width:36 }} />
            </header>

            <main style={S.content}>

                {/* Avatar */}
                <div style={S.avatarSection}>
                    <div style={S.avatar}>{initials}</div>
                    <p style={S.avatarName}>{fullName}</p>
                    <p style={S.avatarEmail}>{profile.email}</p>
                    {isMinor && (
                        <div style={{ display:'flex', alignItems:'center', gap:6, backgroundColor:'#FEF3C7', border:'1px solid #FCD34D', borderRadius: 4, padding:'4px 12px', fontSize:12, fontWeight:600, color:'#92400E', fontFamily:"'DM Sans', sans-serif", marginTop:4 }}>
                            Minor Account
                        </div>
                    )}
                    {saved && (
                        <div style={S.savedPill}>
                            <IcoCheck /><span>Profile saved</span>
                        </div>
                    )}
                </div>

                {/* Personal Info card */}
                <div style={S.card}>
                    <div style={S.section}>
                        <p style={S.sectionTitle}>Personal Information</p>
                        <div style={S.fieldGrid}>
                            <Field label="First Name" value={profile.first_name} editing={editing}
                                inputProps={{ value:form.first_name, placeholder:'First name', onChange:e=>set('first_name',e.target.value) }} />
                            <Field label="Last Name" value={profile.last_name} editing={editing}
                                inputProps={{ value:form.last_name, placeholder:'Last name', onChange:e=>set('last_name',e.target.value) }} />
                        </div>
                        <div style={S.divider} />
                        <Field label="Middle Name" value={profile.middle_name} editing={editing}
                            inputProps={{ value:form.middle_name, placeholder:'Optional', onChange:e=>set('middle_name',e.target.value) }} />
                        <div style={S.divider} />
                        <div style={S.fieldGrid}>
                            <Field label="Birthdate" value={profile.birthdate} editing={editing}
                                inputProps={{ type:'date', value:form.birthdate, onChange:e=>set('birthdate',e.target.value) }} />
                            <div style={FS.group}>
                                <p style={FS.label}>Sex</p>
                                {editing
                                    ? <select className="vp-input" style={{ ...FS.input, appearance:'auto' }} value={form.sex} onChange={e=>set('sex',e.target.value)}>
                                        <option value="">Select</option>
                                        <option value="Female">Female</option>
                                        <option value="Male">Male</option>
                                    </select>
                                    : <p style={FS.value}>{profile.sex || <span style={{color:'#CBD5E1'}}>-</span>}</p>}
                            </div>
                        </div>
                    </div>

                    <div style={S.divider} />

                    {/* Contact */}
                    <div style={S.section}>
                        <p style={S.sectionTitle}>Contact Details</p>
                        <Field label="Mobile Number" value={profile.phone_number} editing={editing}
                            inputProps={{ type:'tel', value:form.phone_number, placeholder:'09xxxxxxxxx', onChange:e=>set('phone_number',e.target.value) }} />
                        <div style={S.divider} />
                        <div style={FS.group}>
                            <p style={FS.label}>Email Address</p>
                            <p style={FS.value}>{profile.email}</p>
                            <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:4 }}>
                                <IcoLock /><p style={{ fontSize:11.5, color:'#94A3B8', fontFamily:"'DM Sans', sans-serif" }}>Email cannot be changed.</p>
                            </div>
                        </div>
                        <div style={S.divider} />
                        <Field label="Home Address" value={profile.address} editing={editing}
                            inputProps={{ value:form.address, placeholder:'Optional', onChange:e=>set('address',e.target.value) }} />
                    </div>

                    {/* ── Guardian Info (always visible, never editable) ── */}
                    <div style={S.divider} />
                    <div style={S.section}>
                        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:2 }}>
                            <IcoGuardian />
                            <p style={{ ...S.sectionTitle, color:'#92400E', margin:0 }}>Guardian Information</p>
                        </div>
                        <div style={{ backgroundColor: isMinor ? '#FFFBEB' : '#F8FAFC', border:`1px solid ${isMinor ? '#FCD34D' : '#E2E8F0'}`, borderRadius: 4, padding:'14px', marginTop:6 }}>
                            {isMinor ? (
                                <div style={S.fieldGrid}>
                                    <ReadOnlyField label="Guardian Name" value={profile.guardian_name} />
                                    <ReadOnlyField label="Relationship" value={profile.guardian_relationship} />
                                </div>
                            ) : (
                                <p style={{ margin:0, fontSize:13, color:'#94A3B8', fontStyle:'italic', fontFamily:"'DM Sans', sans-serif" }}>
                                    Not applicable - account is not registered as a minor.
                                </p>
                            )}
                            <div style={{ display:'flex', alignItems:'center', gap:5, marginTop: isMinor ? 12 : 8 }}>
                                <IcoLock />
                                <p style={{ fontSize:11.5, color:'#94A3B8', fontFamily:"'DM Sans', sans-serif", margin:0 }}>
                                    Guardian information is set during registration and cannot be changed here.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div style={S.errorBox}>
                        <IcoWarn /><p style={{ fontSize:13, color:'#BE123C', fontFamily:"'DM Sans', sans-serif", margin:0 }}>{error}</p>
                    </div>
                )}

                {/* Buttons */}
                {editing ? (
                    <div style={{ display:'flex', gap:12 }}>
                        <button className="vp-btn" style={S.cancelBtn}
                            onClick={() => { resetForm(profile); setError(''); setEditing(false); }}>
                            Cancel
                        </button>
                        <button className="vp-btn" style={{ ...S.saveBtn, opacity: saving?0.75:1 }}
                            onClick={handleSave} disabled={saving}>
                            {saving ? <><Spinner c="#fff" size={16} /><span>Saving…</span></> : 'Save Changes'}
                        </button>
                    </div>
                ) : (
                    <button className="vp-btn" style={S.editBtn} onClick={() => setEditing(true)}>
                        <IcoEdit /> Edit Profile
                    </button>
                )}
            </main>
        </div>
    );
}

const S = {
    page:          { minHeight:'100vh', backgroundColor:'#FFF3E0', display:'flex', flexDirection:'column', fontFamily:"'DM Sans', sans-serif" },
    topBar:        { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', backgroundColor:'#fff', borderBottom:'1px solid #FFE4CC', position:'sticky', top:0, zIndex:100 },
    backBtn:       { width:36, height:36, borderRadius: 10, backgroundColor:'#FFF3E0', border:'1px solid #FFE4CC', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' },
    title:         { fontSize:17, fontWeight:700, color:'#C45E10', fontFamily:"'DM Sans', sans-serif" },
    content:       { padding:'20px', display:'flex', flexDirection:'column', gap:16 },
    avatarSection: { display:'flex', flexDirection:'column', alignItems:'center', gap:6, padding:'12px 0 4px' },
    avatar:        { width:72, height:72, borderRadius: '50%', background:'linear-gradient(135deg,#FFE4CC,#F47920)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:800, color:'#fff', fontFamily:"'DM Sans', sans-serif", marginBottom:4 },
    avatarName:    { fontSize:17, fontWeight:700, color:'#C45E10', fontFamily:"'DM Sans', sans-serif" },
    avatarEmail:   { fontSize:13, color:'#94A3B8', fontFamily:"'DM Sans', sans-serif" },
    savedPill:     { display:'flex', alignItems:'center', gap:6, backgroundColor:'#ECFDF5', border:'1px solid #6EE7B7', borderRadius: 4, padding:'4px 12px', fontSize:12, fontWeight:600, color:'#059669', fontFamily:"'DM Sans', sans-serif", marginTop:4 },
    card:          { backgroundColor:'#fff', borderRadius: 12, overflow:'hidden', border:'1px solid #FFE4CC', boxShadow:'0 2px 12px rgba(244,121,32,0.06)' },
    section:       { padding:'16px 18px', display:'flex', flexDirection:'column', gap:14 },
    sectionTitle:  { fontSize:10.5, fontWeight:700, color:'#F47920', textTransform:'uppercase', letterSpacing:'0.7px', fontFamily:"'DM Sans', sans-serif" },
    fieldGrid:     { display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 },
    divider:       { height:1, backgroundColor:'#F1F5F9' },
    errorBox:      { display:'flex', alignItems:'center', gap:8, backgroundColor:'#FFF1F2', border:'1px solid #FECDD3', borderRadius: 8, padding:'10px 14px' },
    editBtn:       { width:'100%', padding:'13px', backgroundColor:'#F47920', color:'#fff', border:'none', borderRadius: 8, fontSize:15, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontFamily:"'DM Sans', sans-serif", boxShadow:'0 2px 8px rgba(244,121,32,0.25)' },
    cancelBtn:     { flex:1, padding:'13px', backgroundColor:'transparent', color:'#C45E10', border:'2px solid #FFE4CC', borderRadius: 4, fontSize:15, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans', sans-serif" },
    saveBtn:       { flex:1, padding:'13px', backgroundColor:'#F47920', color:'#fff', border:'none', borderRadius: 4, fontSize:15, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontFamily:"'DM Sans', sans-serif", boxShadow:'0 2px 8px rgba(244,121,32,0.25)' },
};

export default Profile;
