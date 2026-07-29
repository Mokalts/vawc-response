import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

if (!document.getElementById('vawc-font')) {
    const l = document.createElement('link'); l.id='vawc-font'; l.rel='stylesheet';
    l.href='https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}
if (!document.getElementById('vawc-cp-css')) {
    const s = document.createElement('style'); s.id='vawc-cp-css';
    s.textContent=`
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .vcp-input { transition: border-color 0.15s, box-shadow 0.15s; }
        .vcp-input:focus-within { border-color:#F47920 !important; box-shadow:0 0 0 3px rgba(244,121,32,0.1) !important; }
        .vcp-btn { transition: opacity 0.15s, transform 0.15s; }
        .vcp-btn:hover:not([disabled]) { opacity:0.88; transform:translateY(-1px); }
    `;
    document.head.appendChild(s);
}

const IcoArrow   = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="#C45E10" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoEyeOpen = () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="12" r="3" stroke="#94A3B8" strokeWidth="1.8"/></svg>);
const IcoEyeOff  = () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round"/></svg>);
const IcoWarn    = ({ c='#BE123C' }) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke={c} strokeWidth="1.8" strokeLinecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke={c} strokeWidth="2.4" strokeLinecap="round"/></svg>);
const IcoCheck   = ({ c='#059669', size=16 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoKey     = ({ c='#F47920' }) => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="8" cy="15" r="5" stroke={c} strokeWidth="1.8"/><path d="M11.5 11.5L21 2M19 4l2 2M16 4l2 2" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const Spinner    = ({ c='#fff', size=17 }) => (<div style={{ width:size, height:size, border:`2.5px solid ${c}40`, borderTopColor:c, borderRadius: '50%', animation:'spin 0.75s linear infinite' }} />);

// Password strength
const getStrength = (pw) => {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8)              score++;
    if (/[A-Z]/.test(pw))           score++;
    if (/[0-9]/.test(pw))           score++;
    if (/[^A-Za-z0-9]/.test(pw))   score++;
    return score;
};
const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLOR = ['', '#EF4444', '#F59E0B', '#9B4DAB', '#059669'];

const REQUIREMENTS = [
    { test: pw => pw.length >= 8,           label: 'At least 8 characters' },
    { test: pw => /[A-Z]/.test(pw),         label: 'One uppercase letter' },
    { test: pw => /[0-9]/.test(pw),         label: 'One number' },
    { test: pw => /[^A-Za-z0-9]/.test(pw), label: 'One special character' },
];

const PasswordField = ({ label, name, value, show, onToggle, onChange, placeholder }) => (
    <div style={S.fieldWrap}>
        <label style={S.label}>{label}</label>
        <div className="vcp-input" style={S.pwBox}>
            <input
                type={show ? 'text' : 'password'}
                name={name}
                placeholder={placeholder}
                autoComplete="new-password"
                style={S.pwInput}
                value={value}
                onChange={onChange}
            />
            <button type="button" style={S.eyeBtn} onClick={onToggle}>
                {show ? <IcoEyeOff /> : <IcoEyeOpen />}
            </button>
        </div>
    </div>
);

function ChangePassword() {
    const navigate = useNavigate();
    const [show,    setShow]    = useState({ current:false, newPass:false, confirm:false });
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState('');
    const [success, setSuccess] = useState(false);
    const [form,    setForm]    = useState({ current_password:'', new_password:'', confirm_password:'' });

    const toggle = (k) => setShow(s => ({ ...s, [k]: !s[k] }));
    const set    = (k, v) => { setForm(f => ({ ...f, [k]: v })); setError(''); };

    const strength = getStrength(form.new_password);
    const passwordsMatch = form.new_password && form.confirm_password && form.new_password === form.confirm_password;
    

    const handleSubmit = async () => {
        if (!form.current_password)                         { setError("Please enter your current password."); return; }
        if (!form.new_password || !form.confirm_password)  { setError("Please fill in both new password fields."); return; }
        if (strength < 4)                                   { setError("New password does not meet all requirements."); return; }
        if (form.new_password !== form.confirm_password)   { setError("New passwords do not match."); return; }
        if (form.current_password === form.new_password)   { setError("New password must be different from your current password."); return; }

        setLoading(true); setError('');
        try {
            await api.patch("/users/me/password", {
                current_password: form.current_password,
                new_password:     form.new_password,
            });
            setSuccess(true);
            setForm({ current_password:'', new_password:'', confirm_password:'' });
            setTimeout(() => navigate('/settings'), 2500);
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to change password.");
        } finally {
            setLoading(false);
        }
    };

    if (success) return (
        <div style={{ ...S.page, alignItems:'center', justifyContent:'center', padding:28 }}>
            <div style={{ textAlign:'center', maxWidth:340 }}>
                <div style={{ width:68, height:68, borderRadius: 4, backgroundColor:'#ECFDF5', border:'2px solid #6EE7B7', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 18px' }}>
                    <IcoCheck c="#059669" size={32} />
                </div>
                <h2 style={{ fontSize:20, fontWeight:800, color:'#059669', marginBottom:10, fontFamily:"'DM Sans', sans-serif" }}>Password Updated!</h2>
                <p style={{ fontSize:14, color:'#475569', lineHeight:1.7, fontFamily:"'DM Sans', sans-serif" }}>
                    Your password has been changed successfully. Redirecting you back to Settings…
                </p>
            </div>
        </div>
    );

    return (
        <div style={S.page}>
            <header style={S.topBar}>
                <button style={S.backBtn} onClick={() => navigate('/settings')}><IcoArrow /></button>
                <h1 style={S.title}>Change Password</h1>
                <div style={{ width:36 }} />
            </header>

            <main style={S.content}>

                {/* Header card */}
                <div style={S.headerCard}>
                    <div style={S.headerIcon}><IcoKey /></div>
                    <div>
                        <p style={{ fontSize:15, fontWeight:700, color:'#C45E10', fontFamily:"'DM Sans', sans-serif", marginBottom:2 }}>Update your password</p>
                        <p style={{ fontSize:13, color:'#94A3B8', fontFamily:"'DM Sans', sans-serif" }}>Choose a strong password to keep your account safe.</p>
                    </div>
                </div>

                {/* Form card */}
                <div style={S.card}>

                    <PasswordField
                        label="Current Password" name="current_password"
                        value={form.current_password} show={show.current}
                        onToggle={() => toggle('current')} onChange={e => set('current_password', e.target.value)}
                        placeholder="Enter your current password"
                    />

                    <div style={S.divider} />

                    <PasswordField
                        label="New Password" name="new_password"
                        value={form.new_password} show={show.newPass}
                        onToggle={() => toggle('newPass')} onChange={e => set('new_password', e.target.value)}
                        placeholder="Create a new password"
                    />

                    {/* Strength bar */}
                    {form.new_password.length > 0 && (
                        <div style={{ marginBottom:14, animation:'fadeUp 0.2s ease' }}>
                            <div style={{ display:'flex', gap:4, marginBottom:5 }}>
                                {[1,2,3,4].map(i => (
                                    <div key={i} style={{ flex:1, height:4, borderRadius: 4, backgroundColor: i<=strength ? STRENGTH_COLOR[strength] : '#F1F5F9', transition:'background-color 0.2s' }} />
                                ))}
                            </div>
                            <p style={{ fontSize:12, color: STRENGTH_COLOR[strength], fontWeight:600, fontFamily:"'DM Sans', sans-serif" }}>
                                {STRENGTH_LABEL[strength]}
                            </p>
                        </div>
                    )}

                    {/* Requirements checklist */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 12px', marginBottom:18 }}>
                        {REQUIREMENTS.map(req => {
                            const met = req.test(form.new_password);
                            return (
                                <div key={req.label} style={{ display:'flex', alignItems:'center', gap:6 }}>
                                    <div style={{ width:16, height:16, borderRadius: 4, backgroundColor: met?'#ECFDF5':'#F1F5F9', border:`1.5px solid ${met?'#6EE7B7':'#E2E8F0'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.15s' }}>
                                        {met && <IcoCheck c="#059669" size={9} />}
                                    </div>
                                    <p style={{ fontSize:11.5, color: met?'#059669':'#94A3B8', fontFamily:"'DM Sans', sans-serif", transition:'color 0.15s' }}>{req.label}</p>
                                </div>
                            );
                        })}
                    </div>

                    <PasswordField
                        label="Confirm New Password" name="confirm_password"
                        value={form.confirm_password} show={show.confirm}
                        onToggle={() => toggle('confirm')} onChange={e => set('confirm_password', e.target.value)}
                        placeholder="Re-enter your new password"
                    />

                    {/* Match indicator */}
                    {form.confirm_password && (
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4, animation:'fadeUp 0.15s ease' }}>
                            {passwordsMatch
                                ? <><IcoCheck c="#059669" size={13} /><p style={{ fontSize:12, color:'#059669', fontFamily:"'DM Sans', sans-serif" }}>Passwords match</p></>
                                : <><IcoWarn c="#EF4444" /><p style={{ fontSize:12, color:'#EF4444', fontFamily:"'DM Sans', sans-serif" }}>Passwords do not match</p></>}
                        </div>
                    )}

                    {error && (
                        <div style={{ display:'flex', alignItems:'center', gap:8, backgroundColor:'#FFF1F2', border:'1px solid #FECDD3', borderRadius: 4, padding:'10px 13px', marginBottom:4, animation:'fadeUp 0.2s ease' }}>
                            <IcoWarn /><p style={{ fontSize:13, color:'#BE123C', fontFamily:"'DM Sans', sans-serif", margin:0 }}>{error}</p>
                        </div>
                    )}
                </div>

                <button className="vcp-btn" style={{ ...S.submitBtn, opacity: loading?0.75:1 }} onClick={handleSubmit} disabled={loading}>
                    {loading ? <><Spinner /><span>Updating…</span></> : 'Update Password'}
                </button>
            </main>
        </div>
    );
}

const S = {
    page:       { minHeight:'100vh', backgroundColor:'#FFF3E0', display:'flex', flexDirection:'column', fontFamily:"'DM Sans', sans-serif" },
    topBar:     { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', backgroundColor:'#fff', borderBottom:'1px solid #FFE4CC', position:'sticky', top:0, zIndex:100 },
    backBtn:    { width:36, height:36, borderRadius: 10, backgroundColor:'#FFF3E0', border:'1px solid #FFE4CC', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' },
    title:      { fontSize:17, fontWeight:700, color:'#C45E10', fontFamily:"'DM Sans', sans-serif" },
    content:    { padding:'20px', display:'flex', flexDirection:'column', gap:14 },
    headerCard: { backgroundColor:'#fff', borderRadius: 4, padding:'16px', border:'1px solid #FFE4CC', display:'flex', alignItems:'center', gap:14 },
    headerIcon: { width:42, height:42, borderRadius: 10, backgroundColor:'#FFF3E0', border:'1px solid #FFE4CC', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
    card:       { backgroundColor:'#fff', borderRadius: 12, padding:'20px', border:'1px solid #FFE4CC', boxShadow:'0 2px 12px rgba(244,121,32,0.06)', display:'flex', flexDirection:'column', gap:16 },
    fieldWrap:  { display:'flex', flexDirection:'column', gap:7 },
    label:      { fontSize:11, fontWeight:700, color:'#C45E10', textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:"'DM Sans', sans-serif" },
    pwBox:      { display:'flex', alignItems:'center', border:'1.5px solid #E2E8F0', borderRadius: 4, backgroundColor:'#F8FAFC', overflow:'hidden' },
    pwInput:    { flex:1, padding:'12px 14px', border:'none', fontSize:15, color:'#0F172A', backgroundColor:'transparent', outline:'none', fontFamily:"'DM Sans', sans-serif" },
    eyeBtn:     { padding:'0 13px', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', flexShrink:0 },
    divider:    { height:1, backgroundColor:'#F1F5F9' },
    submitBtn:  { width:'100%', padding:'14px', backgroundColor:'#F47920', color:'#fff', border:'none', borderRadius: 8, fontSize:15, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:9, fontFamily:"'DM Sans', sans-serif", boxShadow:'0 2px 10px rgba(244,121,32,0.3)' },
};

export default ChangePassword;
