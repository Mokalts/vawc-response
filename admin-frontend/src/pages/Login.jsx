import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';

// ─── Google Font ──────────────────────────────────────────────────────────────
if (!document.getElementById('vawc-font')) {
    const link = document.createElement('link');
    link.id = 'vawc-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(link);
}
if (!document.getElementById('vawc-admin-login-css')) {
    const s = document.createElement('style'); s.id = 'vawc-admin-login-css';
    s.textContent = `
        @keyframes spin { to { transform: rotate(360deg); } }
        .al-input:focus { border-color: #F47920 !important; background: #fff !important; box-shadow: 0 0 0 3px rgba(244,121,32,0.12) !important; }
        .al-pwwrap:focus-within { border-color: #F47920 !important; background: #fff !important; box-shadow: 0 0 0 3px rgba(244,121,32,0.12); }
        .al-btn:hover:not([disabled]) { filter: brightness(1.05); transform: translateY(-1px); box-shadow: 0 10px 24px rgba(196,94,16,0.32) !important; }
        .al-btn { transition: all 0.18s ease; }
    `;
    document.head.appendChild(s);
}

const EyeOpen = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
);
const EyeClosed = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
);
function Login() {
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({ username: '', password: '' });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async () => {
        if (!formData.username || !formData.password) {
            setError("Please enter your username and password.");
            return;
        }
        setLoading(true);
        setError('');
        try {
            const res = await api.post("/admin/auth/login", {
                username: formData.username,
                password: formData.password,
            });
            localStorage.removeItem("face_verified");
            localStorage.setItem("admin_user", JSON.stringify(res.data.admin));
            if (res.data.needs_face_enrollment) {
                navigate('/face-enroll');
            } else if (res.data.needs_face_verification) {
                navigate('/face-verify');
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            const detail = err.response?.data?.detail;
            if (err.response?.status === 429) {
                setError(detail || "Too many login attempts. Please wait and try again.");
            } else {
                setError(Array.isArray(detail) ? detail.map(e => e.msg).join(', ') : (detail || "Invalid username or password."));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => { if (e.key === 'Enter') handleSubmit(); };

    return (
        <div style={S.page}>
            <div style={S.formCard}>

                {/* Header */}
                <div style={S.formHeader}>
                    <div style={S.logoWrap}>
                        <img src="/barangay-logo.png" alt="Barangay Palanginan Seal"
                             style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                             onError={(e) => { e.target.style.display = 'none'; }} />
                    </div>
                    <h2 style={S.formTitle}>VAWC-Response</h2>
                    <p style={S.formSub}>Barangay Palanginan · Admin Portal</p>
                </div>

                {/* Username */}
                <div style={S.field}>
                    <label style={S.label}>Username</label>
                    <input
                        className="al-input"
                        type="text"
                        name="username"
                        placeholder="Enter your username"
                        value={formData.username}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                        style={{ ...S.input, borderColor: error ? '#FDA4AF' : '#FFE4CC' }}
                        autoComplete="username"
                    />
                </div>

                {/* Password */}
                <div style={S.field}>
                    <label style={S.label}>Password</label>
                    <div className="al-pwwrap" style={{ ...S.pwWrap, borderColor: error ? '#FDA4AF' : '#FFE4CC' }}>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            name="password"
                            placeholder="Enter your password"
                            value={formData.password}
                            onChange={handleChange}
                            onKeyDown={handleKeyDown}
                            style={S.pwInput}
                            autoComplete="current-password"
                        />
                        <button
                            type="button"
                            style={S.eyeBtn}
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? <EyeClosed /> : <EyeOpen />}
                        </button>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div style={S.errorBox}>
                        <span style={S.errorDot} />
                        <p style={S.errorText}>{error}</p>
                    </div>
                )}

                {/* Submit */}
                <button
                    type="button"
                    className="al-btn"
                    style={{ ...S.submitBtn, opacity: loading ? 0.75 : 1 }}
                    onClick={handleSubmit}
                    disabled={loading}
                >
                    {loading ? (
                        <span style={S.loadingRow}>
                            <span style={S.spinner} />
                            Signing in...
                        </span>
                    ) : 'Sign In'}
                </button>

                {/* 2FA Notice */}
                <div style={S.notice}>
                    <span style={S.noticeIcon}></span>
                    <p style={S.noticeText}>
                        Face recognition is required as a second step after signing in.
                    </p>
                </div>

                <p style={S.footerText}>Admin access only · Unauthorized access is prohibited</p>
            </div>
        </div>
    );
}

const FF = "'DM Sans', sans-serif";
const S = {
    page: { minHeight: '100vh', background: 'linear-gradient(180deg, #FFF9F3 0%, #FFF3E0 55%, #FFE9D6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: FF },

    // Form card
    formCard: { backgroundColor: '#fff', borderRadius: 22, padding: '36px 30px', width: '100%', maxWidth: '420px', boxShadow: '0 12px 36px rgba(244,121,32,0.13)', border: '1px solid #FFF0E1' },
    formHeader: { textAlign: 'center', marginBottom: '26px' },
    logoWrap: { width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', border: '3px solid #FFCC99', boxShadow: '0 6px 20px rgba(244,121,32,0.18)', overflow: 'hidden', padding: 4, boxSizing: 'border-box' },
    formTitle: { fontSize: '24px', fontWeight: '800', color: '#C45E10', marginBottom: '4px', fontFamily: FF, letterSpacing: '-0.5px' },
    formSub: { fontSize: '13px', fontWeight: '600', color: '#9B4DAB', fontFamily: FF },

    // Form
    field: { marginBottom: '18px' },
    label: { display: 'block', fontSize: '11px', fontWeight: '700', color: '#C45E10', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FF },
    input: { width: '100%', boxSizing: 'border-box', padding: '13px 15px', borderRadius: 12, border: '1.5px solid #FFE4CC', fontSize: '14px', color: '#0F172A', backgroundColor: '#FFFBF7', outline: 'none', fontFamily: FF },
    pwWrap: { display: 'flex', alignItems: 'center', border: '1.5px solid #FFE4CC', borderRadius: 12, backgroundColor: '#FFFBF7', overflow: 'hidden' },
    pwInput: { flex: 1, padding: '13px 15px', border: 'none', fontSize: '14px', color: '#0F172A', backgroundColor: 'transparent', outline: 'none', fontFamily: FF },
    eyeBtn: { padding: '0 14px', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', alignItems: 'center' },

    // Error
    errorBox: { display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 12, padding: '10px 14px', marginBottom: '16px' },
    errorDot: { width: '6px', height: '6px', borderRadius: 8, backgroundColor: '#FB7185', flexShrink: 0 },
    errorText: { fontSize: '13px', color: '#BE123C', fontFamily: FF },

    // Submit — orange primary
    submitBtn: { width: '100%', padding: '14px', background: 'linear-gradient(135deg, #F47920 0%, #E8641C 100%)', color: '#fff', fontSize: '15px', fontWeight: '700', border: 'none', borderRadius: 12, cursor: 'pointer', marginBottom: '20px', fontFamily: FF, boxShadow: '0 8px 20px rgba(196,94,16,0.28)' },
    loadingRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
    spinner: { width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' },

    // Notice — violet secondary accent
    notice: { display: 'flex', gap: '10px', backgroundColor: '#F3E5F5', border: '1px solid #E1BEE7', borderRadius: 12, padding: '12px 14px', marginBottom: '22px' },
    noticeIcon: { fontSize: '14px', flexShrink: 0 },
    noticeText: { fontSize: '12.5px', color: '#7B2D8B', lineHeight: '1.6', fontFamily: FF },
    footerText: { textAlign: 'center', fontSize: '11px', color: '#CBD5E1', fontFamily: FF },
};

// Spinner keyframes
const styleTag = document.createElement('style');
styleTag.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
if (!document.getElementById('vawc-spin')) { styleTag.id = 'vawc-spin'; document.head.appendChild(styleTag); }

export default Login;
