import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from "../api";
import SOSButton from '../components/SOSButton';
import TermsModal, { hasAcceptedTerms } from '../components/TermsModal';

// ─── Font + CSS ───────────────────────────────────────────────────────────────
if (!document.getElementById('vawc-font')) {
    const l = document.createElement('link'); l.id = 'vawc-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}
if (!document.getElementById('vawc-victim-css')) {
    const s = document.createElement('style'); s.id = 'vawc-victim-css';
    s.textContent = `
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .vi-input { transition: border-color 0.15s, box-shadow 0.15s; }
        .vi-input:focus { border-color: #F47920 !important; background: #fff !important; outline: none; box-shadow: 0 0 0 3px rgba(244,121,32,0.1) !important; }
        .vi-btn { transition: all 0.15s ease; }
        .vi-btn:hover:not([disabled]) { background: #C45E10 !important; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(244,121,32,0.3) !important; }
        .vi-link:hover { color: #C45E10 !important; }
        input[type="password"]::-ms-reveal { display: none; }
        input[type="password"]::-ms-clear { display: none; }
        input::-webkit-credentials-auto-fill-button { display: none !important; }
        input::-webkit-strong-password-auto-fill-button { display: none !important; }
    `;
    document.head.appendChild(s);
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const IcoEyeOpen = () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" /><circle cx="12" cy="12" r="3" stroke="#94A3B8" strokeWidth="1.8" /></svg>);
const IcoEyeClosed = () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" /><line x1="1" y1="1" x2="23" y2="23" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" /></svg>);
const IcoWarn = ({ c = '#BE123C' }) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><line x1="12" y1="9" x2="12" y2="13" stroke={c} strokeWidth="1.8" strokeLinecap="round" /><line x1="12" y1="17" x2="12.01" y2="17" stroke={c} strokeWidth="2.4" strokeLinecap="round" /></svg>);
const IcoCheck = ({ c = '#059669' }) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoClock = ({ c = '#D97706' }) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={c} strokeWidth="1.8" /><path d="M12 6v6l4 2" stroke={c} strokeWidth="1.8" strokeLinecap="round" /></svg>);
const IcoXCircle = ({ c = '#BE123C' }) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={c} strokeWidth="1.8" /><path d="M15 9l-6 6M9 9l6 6" stroke={c} strokeWidth="1.8" strokeLinecap="round" /></svg>);
const Spinner = () => (<span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block', flexShrink: 0 }} />);

// ─── Reusable InfoBox ─────────────────────────────────────────────────────────
const InfoBox = ({ variant, icon, title, text, children }) => {
    const v = { warn: { bg: '#FFFBEB', bd: '#FDE68A', tc: '#92400E', sc: '#78350F' }, error: { bg: '#FFF1F2', bd: '#FECDD3', tc: '#BE123C', sc: '#9F1239' }, success: { bg: '#ECFDF5', bd: '#A7F3D0', tc: '#065F46', sc: '#047857' } }[variant];
    return (
        <div style={{ backgroundColor: v.bg, border: `1.5px solid ${v.bd}`, borderRadius: 12, padding: '14px 16px', marginBottom: 16, animation: 'fadeUp 0.2s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: (text || children) ? 6 : 0 }}>
                {icon}
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: v.tc, fontFamily: "'DM Sans', sans-serif" }}>{title}</p>
            </div>
            {text && <p style={{ margin: 0, fontSize: 13, color: v.sc, lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>{text}</p>}
            {children}
        </div>
    );
};

const ActBtn = ({ label, bg = '#F47920', color = '#fff', border, onClick, loading, children }) => (
    <button onClick={onClick} disabled={loading} style={{ width: '100%', padding: '11px', borderRadius: 8, border: border || 'none', background: bg, color, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: "'DM Sans', sans-serif", opacity: loading ? 0.7 : 1 }}>
        {loading && <Spinner />}{children || label}
    </button>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
function SignIn() {
    const navigate = useNavigate();
    const location = useLocation();
    const accountCreated = location.state?.accountCreated || false;

    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({ email: '', password: '' });
    const [recovery, setRecovery] = useState(false);
    const [recovering, setRecovering] = useState(false);
    const [recovered, setRecovered] = useState(false);

    // RA 10173 Terms & Agreement modal - auto-shows on first visit
    const [termsOpen, setTermsOpen] = useState(false);
    const [pendingNav, setPendingNav] = useState(null);

    useEffect(() => {
        if (!hasAcceptedTerms()) setTermsOpen(true);
    }, []);

    const handleSignUpClick = () => {
        if (hasAcceptedTerms()) navigate('/signup');
        else { setPendingNav(() => () => navigate('/signup')); setTermsOpen(true); }
    };

    const handleTermsAccept = () => {
        setTermsOpen(false);
        if (pendingNav) { const fn = pendingNav; setPendingNav(null); fn(); }
    };

    const handleTermsDecline = () => {
        setTermsOpen(false);
        setPendingNav(null);
    };

    const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async () => {
        if (!form.email || !form.password) { setError("Please enter your email and password."); return; }
        setLoading(true); setError(''); setRecovery(false);
        try {
            const res = await api.post("/auth/login", { email: form.email, password: form.password });
            localStorage.setItem("token", res.data.access_token);
            localStorage.setItem("user", JSON.stringify(res.data.user));
            navigate('/home');
        } catch (err) {
            const raw = err.response?.data?.detail;
            const status = err.response?.status;
            const detail = Array.isArray(raw) ? raw.map(e => e.msg).join(', ') : raw;
            if (status === 429) setError(detail || "Too many failed attempts. Please try again later.");
            else if (detail === "account_deleted") setRecovery("recoverable");
            else if (detail === "account_permanently_deleted") setRecovery("permanent");
            else if (detail === "unverified_pending") setRecovery("unverified_pending");
            else if (detail === "unverified_expired") setRecovery("unverified_expired");
            else setError(detail || "Invalid email or password.");
        } finally { setLoading(false); }
    };

    const handleRecover = async () => {
        setRecovering(true); setError('');
        try {
            await api.post("/users/recover", { email: form.email, password: form.password });
            setRecovery(false); setRecovered(true);
        } catch (err) { setError(err.response?.data?.detail || "Recovery failed."); setRecovery(false); }
        finally { setRecovering(false); }
    };

    return (
        <div style={S.page}>

            {/* Brand header */}
            <div style={S.brand}>
                <div style={S.brandIcon}>
                    <img src="/barangay-logo.png" alt="Barangay Palanginan Seal"
                         style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', imageRendering: '-webkit-optimize-contrast' }}
                         onError={(e) => { e.target.style.display = 'none'; }} />
                </div>
                <h1 style={S.brandTitle}>VAWC-Response</h1>
                <p style={S.brandSub}>Barangay Palanginan, Iba, Zambales</p>
                <p style={S.brandTag}>Your safety matters. Sign in to continue.</p>
            </div>

            {/* Success banners */}
            {(accountCreated || recovered) && (
                <div style={{ width: '100%', maxWidth: 420, marginBottom: 16 }}>
                    <InfoBox variant="success" icon={<IcoCheck c="#059669" />}
                        title={accountCreated ? "Account Created!" : "Account Recovered!"}
                        text={accountCreated ? "Your account has been verified. You can now sign in." : "Your account has been restored. You can now sign in."} />
                </div>
            )}

            {/* Card */}
            <div style={S.card}>

                <div style={S.field}>
                    <label style={S.label}>Email Address</label>
                    <input className="vi-input" type="text" inputMode="email" name="email" placeholder="Enter your email"
                        autoComplete="off"
                        style={{ ...S.input, borderColor: error ? '#FECDD3' : '#E2E8F0' }}
                        value={form.email} onChange={handleChange}
                        onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
                </div>

                <div style={S.field}>
                    <label style={S.label}>Password</label>
                    <div style={{ ...S.pwWrap, borderColor: error ? '#FECDD3' : '#E2E8F0' }}>
                        <input className="vi-input" type={showPassword ? 'text' : 'password'} name="password"
                            placeholder="Enter your password" autoComplete="off"
                            style={{ ...S.pwInput, border: 'none', boxShadow: 'none' }}
                            value={form.password} onChange={handleChange}
                            onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
                        <button type="button" style={S.eyeBtn} onClick={() => setShowPassword(v => !v)}>
                            {showPassword ? <IcoEyeClosed /> : <IcoEyeOpen />}
                        </button>
                    </div>
                </div>

                {error && (
                    <div style={S.errorBox}>
                        <IcoWarn /><p style={{ margin: 0, fontSize: 13, color: '#BE123C', fontFamily: "'DM Sans', sans-serif" }}>{error}</p>
                    </div>
                )}

                <div style={{ textAlign: 'right', marginBottom: 20 }}>
                    <span className="vi-link" style={S.forgot} onClick={() => navigate('/forgot-password')}>Forgot Password?</span>
                </div>

                <button type="button" className="vi-btn" onClick={handleSubmit} style={{ ...S.submitBtn, opacity: loading ? 0.75 : 1 }} disabled={loading}>
                    {loading ? <><Spinner /> Signing in…</> : 'Sign In'}
                </button>

                {/* Recovery states */}
                {recovery === "recoverable" && (
                    <InfoBox variant="warn" icon={<IcoWarn c="#92400E" />} title="Your account was deleted"
                        text="This account was recently deleted but can still be recovered. Your reports are safe.">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                            <ActBtn label={recovering ? "Recovering…" : "Yes, Recover My Account"} bg="#059669" loading={recovering} onClick={handleRecover} />
                            <ActBtn label="Cancel" bg="transparent" color="#92400E" border="1.5px solid #FDE68A" onClick={() => setRecovery(false)} />
                        </div>
                    </InfoBox>
                )}
                {recovery === "permanent" && (
                    <InfoBox variant="error" icon={<IcoXCircle />} title="Account permanently deleted"
                        text="This account was deleted more than 30 days ago and cannot be recovered.">
                        <div style={{ marginTop: 12 }}><ActBtn label="Create New Account" onClick={() => navigate('/signup')} /></div>
                    </InfoBox>
                )}
                {recovery === "unverified_pending" && (
                    <InfoBox variant="warn" icon={<IcoClock />} title="Account not yet verified"
                        text="Your account hasn't been verified yet. Check your mobile or email for the OTP code. Your verification window is still open.">
                        <div style={{ marginTop: 12 }}><ActBtn label="Go to Verification" onClick={() => navigate('/otp', { state: { pendingVerification: true } })} /></div>
                    </InfoBox>
                )}
                {recovery === "unverified_expired" && (
                    <InfoBox variant="error" icon={<IcoClock c="#BE123C" />} title="Verification period expired"
                        text="Your account was never verified and the 1-hour window has closed. Please register again.">
                        <div style={{ marginTop: 12 }}><ActBtn label="Register Again" onClick={() => navigate('/signup')} /></div>
                    </InfoBox>
                )}



                <div style={S.divider} />
                <p style={S.bottomText}>Don't have an account?{' '}<span className="vi-link" style={S.bottomLink} onClick={handleSignUpClick}>Sign Up</span></p>
            </div>

            {/* Emergency SOS - accessible pre-login */}
            <div style={{ width: '100%', maxWidth: 420, marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <p style={{ margin: 0, fontSize: 12, color: '#64748B', fontFamily: "'DM Sans', sans-serif" }}>
                    Need help right now?
                </p>
                <SOSButton variant="compact" />
            </div>

            {/* RA 10173 Data Privacy notice */}
            <TermsModal open={termsOpen} onAccept={handleTermsAccept} onDecline={handleTermsDecline} />
        </div>
    );
}

const S = {
    page: { minHeight: '100vh', background: 'linear-gradient(180deg, #FFF9F3 0%, #FFF3E0 55%, #FFE9D6 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: "'DM Sans', sans-serif" },
    brand: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 3, marginBottom: 22, width: '100%', maxWidth: 420 },
    brandIcon: { width: 76, height: 76, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: '#fff', border: '3px solid #FFCC99', boxShadow: '0 6px 20px rgba(244,121,32,0.18)', marginBottom: 10 },
    brandTitle: { fontSize: 24, fontWeight: 800, color: '#C45E10', margin: 0, fontFamily: "'DM Sans', sans-serif", letterSpacing: '-0.5px' },
    brandSub: { fontSize: 12.5, fontWeight: 600, color: '#E8843C', margin: 0, fontFamily: "'DM Sans', sans-serif" },
    brandTag: { fontSize: 12.5, color: '#94A3B8', margin: '5px 0 0', fontFamily: "'DM Sans', sans-serif" },
    card: { backgroundColor: '#fff', borderRadius: 22, padding: '28px 24px', width: '100%', maxWidth: 420, boxShadow: '0 12px 36px rgba(244,121,32,0.13)', border: '1px solid #FFF0E1' },
    field: { marginBottom: 18 },
    label: { display: 'block', fontSize: 11, fontWeight: 700, color: '#C45E10', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: "'DM Sans', sans-serif" },
    input: { width: '100%', boxSizing: 'border-box', padding: '13px 15px', borderRadius: 12, border: '1.5px solid #FFE4CC', fontSize: 15, color: '#0F172A', backgroundColor: '#FFFBF7', outline: 'none', fontFamily: "'DM Sans', sans-serif" },
    pwWrap: { display: 'flex', alignItems: 'center', border: '1.5px solid #FFE4CC', borderRadius: 12, backgroundColor: '#FFFBF7', overflow: 'hidden' },
    pwInput: { flex: 1, padding: '13px 15px', border: 'none', fontSize: 15, color: '#0F172A', backgroundColor: 'transparent', outline: 'none', fontFamily: "'DM Sans', sans-serif" },
    eyeBtn: { padding: '0 13px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 },
    errorBox: { display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 12, padding: '10px 13px', marginBottom: 16 },
    forgot: { fontSize: 13.5, color: '#F47920', cursor: 'pointer', fontWeight: 600, fontFamily: "'DM Sans', sans-serif", transition: 'color 0.12s' },
    submitBtn: { width: '100%', padding: 14, background: 'linear-gradient(135deg, #F47920 0%, #E8641C 100%)', color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: "'DM Sans', sans-serif", boxShadow: '0 8px 20px rgba(196,94,16,0.28)' },
    divider: { height: 1, backgroundColor: '#F1F5F9', margin: '20px 0' },
    bottomText: { textAlign: 'center', fontSize: 14, color: '#64748B', margin: 0, fontFamily: "'DM Sans', sans-serif" },
    bottomLink: { color: '#F47920', fontWeight: 700, cursor: 'pointer', transition: 'color 0.12s' },
};

export default SignIn;
