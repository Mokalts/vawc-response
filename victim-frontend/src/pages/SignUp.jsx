import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from "../api";
import { hasAcceptedTerms } from '../components/TermsModal';

if (!document.getElementById('vawc-font')) {
    const l = document.createElement('link'); l.id = 'vawc-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}
if (!document.getElementById('vawc-victim-css')) {
    const s = document.createElement('style'); s.id = 'vawc-victim-css';
    s.textContent = `
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideDown { from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)} }
        .vi-input { transition: border-color 0.15s, box-shadow 0.15s; }
        .vi-input:focus { border-color: #F47920 !important; background: #fff !important; outline: none; box-shadow: 0 0 0 3px rgba(244,121,32,0.1) !important; }
        .vi-btn { transition: all 0.15s ease; }
        .vi-btn:hover:not([disabled]) { background: #C45E10 !important; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(244,121,32,0.3) !important; }
        .vi-link:hover { color: #C45E10 !important; }
        .minor-toggle { transition: all 0.15s; }
        .minor-toggle:hover { border-color: #F47920 !important; }
        .guardian-section { animation: slideDown 0.2s ease; }
    `;
    document.head.appendChild(s);
}

const validatePassword = (pw) => {
    if (pw.length < 8)                                    return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(pw))                               return "Password must include at least one uppercase letter.";
    if (!/[0-9]/.test(pw))                               return "Password must include at least one number.";
    if (!/[!@#$%^&*(),.?":{}|<>_-]/.test(pw))           return "Password must include at least one special character.";
    return null;
};
const getStrength = (pw) => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[!@#$%^&*(),.?":{}|<>_-]/.test(pw)) s++;
    return s;
};
const STR_COLORS = ['', '#F47920', '#F0A500', '#1FA87A', '#0A5A42'];
const STR_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];

const GUARDIAN_RELATIONSHIPS = [
    'Mother', 'Father', 'Legal Guardian', 'Grandparent',
    'Aunt / Uncle', 'Older Sibling', 'Social Worker', 'Other',
];

const IcoShield    = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#F47920" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoEyeOpen   = () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="12" r="3" stroke="#94A3B8" strokeWidth="1.8"/></svg>);
const IcoEyeClosed = () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round"/></svg>);
const IcoHome      = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 9.5L12 3L21 9.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke="#C45E10" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoPhone     = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="#C45E10" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoLock      = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="#C45E10" strokeWidth="1.8"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="#C45E10" strokeWidth="1.8" strokeLinecap="round"/></svg>);
const IcoGuardian  = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="#C45E10" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9" cy="7" r="4" stroke="#C45E10" strokeWidth="1.8"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="#C45E10" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoCheck     = ({ pass }) => pass
    ? (<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>)
    : (<svg width="10" height="10" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#CBD5E1" strokeWidth="2"/></svg>);
const Spinner      = () => (<span style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius: '50%', animation:'spin 0.7s linear infinite', display:'inline-block', flexShrink:0 }} />);

const Field = ({ label, optional, children }) => (
    <div style={{ marginBottom:16 }}>
        <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#C45E10', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:"'DM Sans', sans-serif" }}>
            {label}{optional && <span style={{ fontWeight:400, color:'#94A3B8', fontSize:10.5, textTransform:'none', letterSpacing:0 }}> (optional)</span>}
        </label>
        {children}
    </div>
);

const Input = ({ type='text', name, placeholder, value, onChange, style={} }) => (
    <input className="vi-input" type={type} name={name} placeholder={placeholder} value={value} onChange={onChange}
        style={{ width:'100%', boxSizing:'border-box', padding:'12px 14px', borderRadius: 8, border:'1.5px solid #E2E8F0', fontSize:14.5, color:'#0F172A', backgroundColor:'#F8FAFC', outline:'none', fontFamily:"'DM Sans', sans-serif", ...style }} />
);

const Select = ({ name, value, onChange, children }) => (
    <select name={name} value={value} onChange={onChange}
        style={{ width:'100%', padding:'12px 14px', borderRadius: 8, border:'1.5px solid #E2E8F0', fontSize:14.5, color:'#0F172A', backgroundColor:'#F8FAFC', outline:'none', fontFamily:"'DM Sans', sans-serif", cursor:'pointer' }}>
        {children}
    </select>
);

const SectionHeader = ({ icon, title }) => (
    <div style={{ display:'flex', alignItems:'center', gap:8, borderBottom:'1.5px solid #FFE4CC', paddingBottom:10, marginBottom:16, marginTop:8 }}>
        {icon}
        <p style={{ margin:0, fontSize:13, fontWeight:700, color:'#C45E10', fontFamily:"'DM Sans', sans-serif" }}>{title}</p>
    </div>
);

function SignUp() {
    const navigate = useNavigate();

    // RA 10173 guard - direct hits to /signup must accept the privacy notice first
    useEffect(() => {
        if (!hasAcceptedTerms()) navigate('/', { replace: true });
    }, [navigate]);

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm,  setShowConfirm]  = useState(false);
    const [loading,      setLoading]      = useState(false);
    const [error,        setError]        = useState('');
    const [isMinor,      setIsMinor]      = useState(false);
    const [form, setForm] = useState({
        first_name:'', middle_name:'', last_name:'', birthdate:'', sex:'',
        phone_number:'', email:'', street:'', purok:'', landmark:'',
        guardian_name:'', guardian_relationship:'',
        password:'', confirm_password:'',
    });

    const handleChange = e => {
        setForm(p => ({ ...p, [e.target.name]: e.target.value }));
        setError('');
    };

    const handleMinorToggle = () => {
        setIsMinor(v => !v);
        // Clear guardian fields when toggling off
        if (isMinor) setForm(p => ({ ...p, guardian_name:'', guardian_relationship:'' }));
        setError('');
    };

    const handleSubmit = async () => {
        if (!form.first_name || !form.last_name) { setError("Please enter your first and last name."); return; }
        if (!form.phone_number)                  { setError("Please enter your mobile number."); return; }
        if (!form.email)                         { setError("Please enter your email address."); return; }
        if (!form.street)                        { setError("Please enter your house number and street."); return; }
        if (!form.purok)                         { setError("Please enter your purok or zone."); return; }
        if (isMinor && !form.guardian_name.trim()) { setError("Please enter the guardian's full name."); return; }
        if (isMinor && !form.guardian_relationship) { setError("Please select the guardian's relationship."); return; }
        if (!form.password || !form.confirm_password) { setError("Please fill in both password fields."); return; }
        const pwErr = validatePassword(form.password);
        if (pwErr) { setError(pwErr); return; }
        if (form.password !== form.confirm_password) { setError("Passwords do not match."); return; }

        const parts = [form.street, form.purok];
        if (form.landmark) parts.push(`Near ${form.landmark}`);
        const fullAddress = parts.join(', ');

        setLoading(true); setError('');
        try {
            await api.post("/auth/register", {
                first_name: form.first_name,
                middle_name: form.middle_name || null,
                last_name: form.last_name,
                birthdate: form.birthdate || null,
                sex: form.sex || null,
                email: form.email,
                phone_number: form.phone_number,
                address: fullAddress,
                password: form.password,
                is_minor: isMinor,
                guardian_name: isMinor ? form.guardian_name.trim() : null,
                guardian_relationship: isMinor ? form.guardian_relationship : null,
            });
            localStorage.setItem("pending_phone", form.phone_number);
            localStorage.setItem("pending_email",  form.email);
            navigate('/otp');
        } catch (err) {
            const data = err.response?.data;
            if (err.response?.status === 409 && data?.code === "PENDING_VERIFICATION") {
                localStorage.setItem("pending_phone", data.phone_number);
                localStorage.setItem("pending_email",  data.email);
                navigate('/otp', { state:{ pendingVerification:true } }); return;
            }
            setError(data?.detail || "Registration failed. Please try again.");
        } finally { setLoading(false); }
    };

    const strength = getStrength(form.password);
    const pwChecks = [
        { test: form.password.length >= 8,                         label:"At least 8 characters" },
        { test: /[A-Z]/.test(form.password),                       label:"One uppercase letter" },
        { test: /[0-9]/.test(form.password),                       label:"One number" },
        { test: /[!@#$%^&*(),.?":{}|<>_-]/.test(form.password),   label:"One special character" },
    ];

    return (
        <div style={S.page}>
            <div style={S.brand}>
                <div style={S.brandIcon}><IcoShield /></div>
                <div>
                    <h1 style={S.brandTitle}>VAWC-Response</h1>
                    <p style={S.brandSub}>This information will be kept private and secure.</p>
                </div>
            </div>

            <div style={S.card}>

                {/* Personal Info */}
                <SectionHeader icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="#C45E10" strokeWidth="1.8"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#C45E10" strokeWidth="1.8" strokeLinecap="round"/></svg>} title="Personal Information" />

                <div style={{ display:'flex', gap:12 }}>
                    <Field label="First Name"><Input name="first_name" placeholder="First name" value={form.first_name} onChange={handleChange} /></Field>
                    <Field label="Last Name"><Input name="last_name" placeholder="Last name" value={form.last_name} onChange={handleChange} /></Field>
                </div>
                <Field label="Middle Name" optional><Input name="middle_name" placeholder="Middle name" value={form.middle_name} onChange={handleChange} /></Field>

                <div style={{ display:'flex', gap:12 }}>
                    <Field label="Birthdate"><Input type="date" name="birthdate" value={form.birthdate} onChange={handleChange} /></Field>
                    <Field label="Sex">
                        <Select name="sex" value={form.sex} onChange={handleChange}>
                            <option value="">Select</option>
                            <option value="Female">Female</option>
                            <option value="Male">Male</option>
                        </Select>
                    </Field>
                </div>

                {/* ── Minor Toggle ───────────────────────────────────────── */}
                <button type="button" className="minor-toggle"
                    onClick={handleMinorToggle}
                    style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius: 4, border:`1.5px solid ${isMinor ? '#F47920' : '#E2E8F0'}`, background: isMinor ? '#FFF3E0' : '#F8FAFC', cursor:'pointer', marginBottom:16, textAlign:'left' }}>
                    {/* Checkbox visual */}
                    <div style={{ width:18, height:18, borderRadius: 4, border:`2px solid ${isMinor ? '#F47920' : '#CBD5E1'}`, background: isMinor ? '#F47920' : '#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.15s' }}>
                        {isMinor && <svg width="10" height="10" fill="none" viewBox="0 0 20 20"><path d="M4 10l5 5 7-8" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <div>
                        <p style={{ margin:0, fontSize:13.5, fontWeight:600, color: isMinor ? '#C45E10' : '#475569', fontFamily:"'DM Sans', sans-serif" }}>The victim is a minor (below 18)</p>
                        <p style={{ margin:'2px 0 0', fontSize:11.5, color:'#94A3B8', fontFamily:"'DM Sans', sans-serif" }}>Guardian information will be required</p>
                    </div>
                </button>

                {/* ── Guardian Section (conditional) ─────────────────────── */}
                {isMinor && (
                    <div className="guardian-section" style={{ backgroundColor:'#FFF3E0', border:'1.5px solid #FFE4CC', borderRadius: 4, padding:'16px', marginBottom:16 }}>
                        <SectionHeader icon={<IcoGuardian />} title="Guardian Information" />
                        <Field label="Guardian's Full Name">
                            <Input name="guardian_name" placeholder="e.g. Maria Santos" value={form.guardian_name} onChange={handleChange} />
                        </Field>
                        <Field label="Relationship to Victim">
                            <Select name="guardian_relationship" value={form.guardian_relationship} onChange={handleChange}>
                                <option value="">Select relationship</option>
                                {GUARDIAN_RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                            </Select>
                        </Field>
                        <div style={{ backgroundColor:'#FFF3E0', borderRadius: 8, padding:'10px 12px', border:'1px solid #FFCC99', marginTop:-4 }}>
                            <p style={{ fontSize:12, color:'#92400E', margin:0, lineHeight:1.6, fontFamily:"'DM Sans', sans-serif" }}>
                                The guardian named above will be the official filer of this report on behalf of the minor victim.
                            </p>
                        </div>
                    </div>
                )}

                {/* Contact */}
                <SectionHeader icon={<IcoPhone />} title="Contact Information" />

                <Field label="Mobile Number"><Input type="tel" name="phone_number" placeholder="e.g. 09xxxxxxxxx" value={form.phone_number} onChange={handleChange} /></Field>
                <Field label="Email Address"><Input type="email" name="email" placeholder="Enter your email address" value={form.email} onChange={handleChange} /></Field>

                <div style={{ backgroundColor:'#ECFDF5', borderRadius: 4, padding:'12px 14px', marginBottom:16, marginTop:-4, border:'1px solid #A7F3D0' }}>
                    <p style={{ fontSize:12.5, color:'#065F46', lineHeight:1.6, margin:0, fontFamily:"'DM Sans', sans-serif" }}>
                        Your mobile number and email will be used to verify your account and send updates about your report.
                    </p>
                </div>

                {/* Address */}
                <SectionHeader icon={<IcoHome />} title="Address within the Barangay" />

                <Field label="House No. / Street"><Input name="street" placeholder="e.g. 12 Mabini Street" value={form.street} onChange={handleChange} /></Field>
                <Field label="Purok / Zone"><Input name="purok" placeholder="e.g. Purok 3 or Zone 2" value={form.purok} onChange={handleChange} /></Field>
                <Field label="Landmark" optional><Input name="landmark" placeholder="e.g. Near the covered court" value={form.landmark} onChange={handleChange} /></Field>

                {/* Password */}
                <SectionHeader icon={<IcoLock />} title="Create Password" />

                <Field label="Password">
                    <div style={S.pwWrap}>
                        <input className="vi-input" type={showPassword?'text':'password'} name="password"
                            placeholder="Create a password" value={form.password} onChange={handleChange}
                            style={{ flex:1, padding:'12px 14px', border:'none', fontSize:14.5, color:'#0F172A', background:'transparent', outline:'none', fontFamily:"'DM Sans', sans-serif" }} />
                        <button type="button" style={S.eyeBtn} onClick={() => setShowPassword(v=>!v)}>
                            {showPassword ? <IcoEyeClosed /> : <IcoEyeOpen />}
                        </button>
                    </div>
                    {form.password.length > 0 && (
                        <div style={{ marginTop:10 }}>
                            <div style={{ display:'flex', gap:3, marginBottom:4 }}>
                                {[1,2,3,4].map(i => (
                                    <div key={i} style={{ flex:1, height:3, borderRadius: 4, backgroundColor: i<=strength ? STR_COLORS[strength] : '#E2E8F0', transition:'background-color 0.2s' }} />
                                ))}
                            </div>
                            <p style={{ fontSize:11.5, color:STR_COLORS[strength], margin:'0 0 8px', fontWeight:600, fontFamily:"'DM Sans', sans-serif" }}>{STR_LABELS[strength]}</p>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 8px' }}>
                                {pwChecks.map(({ test, label }) => (
                                    <p key={label} style={{ fontSize:11.5, margin:0, color: test?'#059669':'#94A3B8', display:'flex', alignItems:'center', gap:5, fontFamily:"'DM Sans', sans-serif" }}>
                                        <IcoCheck pass={test} />{label}
                                    </p>
                                ))}
                            </div>
                        </div>
                    )}
                </Field>

                <Field label="Confirm Password">
                    <div style={S.pwWrap}>
                        <input className="vi-input" type={showConfirm?'text':'password'} name="confirm_password"
                            placeholder="Confirm your password" value={form.confirm_password} onChange={handleChange}
                            style={{ flex:1, padding:'12px 14px', border:'none', fontSize:14.5, color:'#0F172A', background:'transparent', outline:'none', fontFamily:"'DM Sans', sans-serif" }} />
                        <button type="button" style={S.eyeBtn} onClick={() => setShowConfirm(v=>!v)}>
                            {showConfirm ? <IcoEyeClosed /> : <IcoEyeOpen />}
                        </button>
                    </div>
                    {form.confirm_password.length > 0 && form.password !== form.confirm_password && (
                        <p style={{ fontSize:12, color:'#F47920', marginTop:6, marginBottom:0, fontFamily:"'DM Sans', sans-serif" }}>Passwords do not match.</p>
                    )}
                </Field>

                {error && (
                    <div style={{ display:'flex', alignItems:'center', gap:8, backgroundColor:'#FFF1F2', border:'1px solid #FECDD3', borderRadius: 4, padding:'10px 13px', marginBottom:16 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#BE123C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke="#BE123C" strokeWidth="1.8" strokeLinecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="#BE123C" strokeWidth="2.4" strokeLinecap="round"/></svg>
                        <p style={{ margin:0, fontSize:13, color:'#BE123C', fontFamily:"'DM Sans', sans-serif" }}>{error}</p>
                    </div>
                )}

                <button className="vi-btn" style={{ ...S.submitBtn, opacity: loading?0.75:1 }} onClick={handleSubmit} disabled={loading}>
                    {loading ? <><Spinner /> Signing up…</> : 'Create Account'}
                </button>

                <div style={S.divider} />
                <p style={S.bottomText}>Already have an account?{' '}<span className="vi-link" style={S.bottomLink} onClick={() => navigate('/')}>Sign In</span></p>
            </div>
        </div>
    );
}

const S = {
    page:       { minHeight:'100vh', backgroundColor:'#FFF3E0', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px 24px 48px', fontFamily:"'DM Sans', sans-serif" },
    brand:      { display:'flex', alignItems:'center', gap:14, marginBottom:20, width:'100%', maxWidth:460 },
    brandIcon:  { width:44, height:44, borderRadius: '50%', backgroundColor:'#fff', border:'1px solid #FFE4CC', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 2px 8px rgba(244,121,32,0.1)' },
    brandTitle: { fontSize:20, fontWeight:800, color:'#C45E10', margin:'0 0 2px', fontFamily:"'DM Sans', sans-serif" },
    brandSub:   { fontSize:12.5, color:'#94A3B8', margin:0, fontFamily:"'DM Sans', sans-serif" },
    card:       { backgroundColor:'#fff', borderRadius: 12, padding:'24px', width:'100%', maxWidth:460, boxShadow:'0 4px 20px rgba(244,121,32,0.08)', border:'1px solid #FFE4CC' },
    pwWrap:     { display:'flex', alignItems:'center', border:'1.5px solid #E2E8F0', borderRadius: 12, backgroundColor:'#F8FAFC', overflow:'hidden' },
    eyeBtn:     { padding:'0 13px', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', flexShrink:0 },
    submitBtn:  { width:'100%', padding:13, backgroundColor:'#F47920', color:'#fff', fontSize:15, fontWeight:600, border:'none', borderRadius: 10, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontFamily:"'DM Sans', sans-serif", boxShadow:'0 2px 8px rgba(244,121,32,0.25)' },
    divider:    { height:1, backgroundColor:'#F1F5F9', margin:'20px 0' },
    bottomText: { textAlign:'center', fontSize:14, color:'#64748B', margin:0, fontFamily:"'DM Sans', sans-serif" },
    bottomLink: { color:'#F47920', fontWeight:600, cursor:'pointer', transition:'color 0.12s' },
};

export default SignUp;
