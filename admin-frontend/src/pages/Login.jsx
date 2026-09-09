import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import ThemeToggle from '../components/ThemeToggle';
import { COLORS, RADIUS } from '../theme';

// ─── Google Font ──────────────────────────────────────────────────────────────
if (!document.getElementById('vawc-font')) {
    const link = document.createElement('link');
    link.id = 'vawc-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(link);
}
if (!document.getElementById('vawc-admin-login-css')) {
    const s = document.createElement('style'); s.id = 'vawc-admin-login-css';
    s.textContent = `
        @keyframes spin { to { transform: rotate(360deg); } }
        .al-input:focus { border-color: #F47920 !important; background: var(--adm-card) !important; box-shadow: 0 0 0 3px rgba(244,121,32,0.14) !important; }
        .al-pwwrap:focus-within { border-color: #F47920 !important; background: var(--adm-card) !important; box-shadow: 0 0 0 3px rgba(244,121,32,0.14); }
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
    const [waking, setWaking] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({ username: '', password: '' });

    // Pre-warm the backend on page load. Render's free tier spins the server
    // down after ~15 min idle, so the FIRST request of the day cold-starts
    // (~30-60s) and can time out. Firing a fire-and-forget request here wakes
    // the server while the admin is typing, so Sign In is fast and reliable.
    useEffect(() => {
        const base = api.defaults.baseURL;
        if (base) {
            // Hit the ROOT path to wake the server. (An ad blocker / redirect-blocker
            // extension may flag "/health/db".) The DB wakes on the first login query,
            // and the login call below retries automatically while it warms up.
            try { fetch(base + '/', { method: 'GET', mode: 'no-cors', cache: 'no-store' }).catch(() => {}); } catch (e) {}
        }
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // Log in with automatic retry on cold-start. Render's free tier sleeps after
    // ~15 min idle; the first request can time out at the network level while the
    // server wakes. A network error (no err.response) is NOT a bad password, so we
    // wait and retry a few times before giving up.
    const loginWithRetry = async (payload, attempts = 3) => {
        for (let i = 0; i < attempts; i++) {
            try {
                return await api.post("/admin/auth/login", payload, { timeout: 60000 });
            } catch (err) {
                if (err.response) throw err;           // real server answer — don't retry
                if (i === attempts - 1) throw err;     // out of retries
                setWaking(true);
                await new Promise(r => setTimeout(r, 3000));
            }
        }
    };

    const handleSubmit = async () => {
        if (!formData.username || !formData.password) {
            setError("Please enter your username and password.");
            return;
        }
        setLoading(true);
        setWaking(false);
        setError('');
        try {
            const res = await loginWithRetry({
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
            if (!err.response) {
                setError("Cannot reach the server. It may be waking up (this can take up to a minute on the first try). Please wait a moment and try again.");
            } else {
                const detail = err.response?.data?.detail;
                if (err.response?.status === 429) {
                    setError(detail || "Too many login attempts. Please wait and try again.");
                } else {
                    setError(Array.isArray(detail) ? detail.map(e => e.msg).join(', ') : (detail || "Invalid username or password."));
                }
            }
        } finally {
            setLoading(false);
            setWaking(false);
        }
    };

    const handleKeyDown = (e) => { if (e.key === 'Enter') handleSubmit(); };

    return (
        <div style={S.page}>
            <div style={S.toggleSlot}><ThemeToggle /></div>
            <div style={S.formCard}>
                {/* Same 3px accent bar the dashboard cards carry */}
                <div style={S.cardAccent} aria-hidden="true" />

                {/* Header */}
                <div style={S.formHeader}>
                    <div style={S.logoWrap}>
                        <img src="/barangay-logo.png" alt="Barangay Palanginan Seal"
                             style={S.logoImg}
                             onError={(e) => { e.target.style.display = 'none'; }} />
                    </div>
                    <h2 style={S.formTitle}>VAWC-Response</h2>
                    <p style={S.formSub}>Barangay Palanginan · Admin Portal</p>
                </div>

                {/* Username */}
                <div style={S.field}>
                    <label style={S.label} htmlFor="al-username">Username</label>
                    <input
                        className="al-input"
                        id="al-username"
                        type="text"
                        name="username"
                        placeholder="Enter your username"
                        value={formData.username}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                        style={{ ...S.input, borderColor: error ? '#FDA4AF' : COLORS.border }}
                        autoComplete="username"
                    />
                </div>

                {/* Password */}
                <div style={S.field}>
                    <label style={S.label} htmlFor="al-password">Password</label>
                    <div className="al-pwwrap" style={{ ...S.pwWrap, borderColor: error ? '#FDA4AF' : COLORS.border }}>
                        <input
                            id="al-password"
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
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
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
                            {waking ? 'Waking up server...' : 'Signing in...'}
                        </span>
                    ) : 'Sign In'}
                </button>

                {/* 2FA Notice */}
                <div style={S.notice}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={COLORS.secondary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M9 12l2 2 4-4" stroke={COLORS.secondary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p style={S.noticeText}>
                        Face recognition is required as a second step after signing in.
                    </p>
                </div>

                <p style={S.footerText}>Admin access only · Unauthorized access is prohibited</p>
            </div>
        </div>
    );
}

const FF = "'Lexend', sans-serif";
// Login now draws from the same tokens as the dashboard (neutral --adm-page
// behind a --adm-card panel, the 3px accent bar, uppercase micro-labels,
// RADIUS scale) instead of its own peach gradient and hardcoded hex, so the
// portal does not change character the moment an admin signs in. This also
// makes it theme-aware for free.
const S = {
    page: { position: 'relative', minHeight: '100vh', background: COLORS.bgPage, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: FF },
    toggleSlot: { position: 'absolute', top: 20, right: 20 },

    // Form card
    formCard: { position: 'relative', overflow: 'hidden', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: '34px 30px 28px', width: '100%', maxWidth: '420px', boxShadow: 'var(--adm-card-shadow)', border: `1px solid ${COLORS.border}` },
    cardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: COLORS.primary },
    formHeader: { textAlign: 'center', marginBottom: '26px' },
    logoWrap: { width: '104px', height: '104px', borderRadius: '50%', backgroundColor: '#fff', margin: '0 auto 16px', border: `3px solid ${COLORS.primaryBorder}`, boxShadow: '0 6px 20px rgba(244,121,32,0.18)', overflow: 'hidden', padding: 0, boxSizing: 'border-box' },
    // The seal PNG carries white padding around the artwork, so a plain fit
    // leaves the ring looking off-centre. Scale up and nudge to sit the seal
    // squarely inside the circle.
    logoImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scale(1.16) translateY(1%)', transformOrigin: 'center' },
    formTitle: { fontSize: '23px', fontWeight: '800', color: COLORS.textPrimary, marginBottom: '5px', fontFamily: FF, letterSpacing: '-0.5px' },
    formSub: { fontSize: '11px', fontWeight: '700', color: COLORS.textMuted, fontFamily: FF, textTransform: 'uppercase', letterSpacing: '0.09em' },

    // Form
    field: { marginBottom: '16px' },
    label: { display: 'block', fontSize: '10.5px', fontWeight: '700', color: COLORS.textMuted, marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FF },
    input: { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: RADIUS.md, border: `1.5px solid ${COLORS.border}`, fontSize: '14px', color: COLORS.textPrimary, backgroundColor: COLORS.bgMuted, outline: 'none', fontFamily: FF },
    pwWrap: { display: 'flex', alignItems: 'center', border: `1.5px solid ${COLORS.border}`, borderRadius: RADIUS.md, backgroundColor: COLORS.bgMuted, overflow: 'hidden' },
    pwInput: { flex: 1, padding: '12px 14px', border: 'none', fontSize: '14px', color: COLORS.textPrimary, backgroundColor: 'transparent', outline: 'none', fontFamily: FF },
    eyeBtn: { padding: '0 14px', minHeight: 44, background: 'none', border: 'none', cursor: 'pointer', color: COLORS.textMuted, display: 'flex', alignItems: 'center' },

    // Error
    errorBox: { display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: RADIUS.md, padding: '10px 14px', marginBottom: '16px' },
    errorDot: { width: '6px', height: '6px', borderRadius: 8, backgroundColor: '#FB7185', flexShrink: 0 },
    errorText: { fontSize: '13px', color: '#BE123C', fontFamily: FF },

    // Submit — orange primary
    submitBtn: { width: '100%', minHeight: 46, padding: '13px', background: COLORS.primary, color: '#fff', fontSize: '15px', fontWeight: '700', border: 'none', borderRadius: RADIUS.md, cursor: 'pointer', marginTop: 4, marginBottom: '18px', fontFamily: FF, boxShadow: '0 6px 16px rgba(196,94,16,0.24)' },
    loadingRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
    spinner: { width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' },

    // Notice — neutral panel with a violet accent, matching the dashboard's insets
    notice: { display: 'flex', gap: '9px', alignItems: 'flex-start', backgroundColor: COLORS.bgMuted, border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${COLORS.secondary}`, borderRadius: RADIUS.sm, padding: '11px 13px', marginBottom: '18px' },
    noticeText: { fontSize: '12.5px', color: COLORS.textSecondary, lineHeight: '1.6', fontFamily: FF },
    footerText: { textAlign: 'center', fontSize: '10.5px', color: COLORS.textMuted, fontFamily: FF },
};

// Spinner keyframes
const styleTag = document.createElement('style');
styleTag.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
if (!document.getElementById('vawc-spin')) { styleTag.id = 'vawc-spin'; document.head.appendChild(styleTag); }

export default Login;
