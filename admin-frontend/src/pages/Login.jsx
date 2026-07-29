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
                        type="text"
                        name="username"
                        placeholder="Enter your username"
                        value={formData.username}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                        style={{ ...S.input, borderColor: error ? '#FDA4AF' : '#E2E8F0' }}
                        autoComplete="username"
                    />
                </div>

                {/* Password */}
                <div style={S.field}>
                    <label style={S.label}>Password</label>
                    <div style={{ ...S.pwWrap, borderColor: error ? '#FDA4AF' : '#E2E8F0' }}>
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

const S = {
    page: { minHeight: '100vh', backgroundColor: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: "'DM Sans', sans-serif" },

    // Form card
    formCard: { backgroundColor: '#fff', borderRadius: 12, padding: '40px', width: '100%', maxWidth: '420px', boxShadow: '0 4px 24px rgba(15,23,42,0.08)' },
    formHeader: { textAlign: 'center', marginBottom: '28px' },
    logoWrap: { width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 0 0 4px rgba(123,45,139,0.12)', overflow: 'hidden', padding: 4, boxSizing: 'border-box' },
    formTitle: { fontSize: '22px', fontWeight: '700', color: '#0F172A', marginBottom: '6px', fontFamily: "'DM Sans', sans-serif" },
    formSub: { fontSize: '13px', color: '#94A3B8', fontFamily: "'DM Sans', sans-serif" },

    // Form
    field: { marginBottom: '18px' },
    label: { display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.6px', fontFamily: "'DM Sans', sans-serif" },
    input: { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: '14px', color: '#0F172A', backgroundColor: '#F8FAFC', outline: 'none', fontFamily: "'DM Sans', sans-serif" },
    pwWrap: { display: 'flex', alignItems: 'center', border: '1.5px solid #E2E8F0', borderRadius: 8, backgroundColor: '#F8FAFC', overflow: 'hidden' },
    pwInput: { flex: 1, padding: '12px 14px', border: 'none', fontSize: '14px', color: '#0F172A', backgroundColor: 'transparent', outline: 'none', fontFamily: "'DM Sans', sans-serif" },
    eyeBtn: { padding: '0 14px', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', alignItems: 'center' },

    // Error
    errorBox: { display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 8, padding: '10px 14px', marginBottom: '16px' },
    errorDot: { width: '6px', height: '6px', borderRadius: 8, backgroundColor: '#FB7185', flexShrink: 0 },
    errorText: { fontSize: '13px', color: '#BE123C', fontFamily: "'DM Sans', sans-serif" },

    // Submit
    submitBtn: { width: '100%', padding: '13px', backgroundColor: '#7B2D8B', color: '#fff', fontSize: '15px', fontWeight: '600', border: 'none', borderRadius: 8, cursor: 'pointer', marginBottom: '20px', fontFamily: "'DM Sans', sans-serif" },
    loadingRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
    spinner: { width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' },

    // Notice
    notice: { display: 'flex', gap: '10px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 4, padding: '12px 14px', marginBottom: '24px' },
    noticeIcon: { fontSize: '14px', flexShrink: 0 },
    noticeText: { fontSize: '12.5px', color: '#64748B', lineHeight: '1.6', fontFamily: "'DM Sans', sans-serif" },
    footerText: { textAlign: 'center', fontSize: '11px', color: '#CBD5E1', fontFamily: "'DM Sans', sans-serif" },
};

// Spinner keyframes
const styleTag = document.createElement('style');
styleTag.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
if (!document.getElementById('vawc-spin')) { styleTag.id = 'vawc-spin'; document.head.appendChild(styleTag); }

export default Login;
