import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';

if (!document.getElementById('vawc-font')) {
    const l = document.createElement('link'); l.id='vawc-font'; l.rel='stylesheet';
    l.href='https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}
if (!document.getElementById('vawc-ve-css')) {
    const s = document.createElement('style'); s.id='vawc-ve-css';
    s.textContent=`
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.5} }
    `;
    document.head.appendChild(s);
}

const IcoCheck  = ({ c='#059669', size=36 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoX      = ({ c='#BE123C', size=36 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={c} strokeWidth="1.8"/><path d="M15 9l-6 6M9 9l6 6" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>);
const IcoShield = ({ c='#C45E10', size=36 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const Spinner   = () => (<div style={{ width:40, height:40, border:'3.5px solid #FFE4CC', borderTopColor:'#F47920', borderRadius: '50%', animation:'spin 0.8s linear infinite', margin:'0 auto' }} />);

const STATES = {
    loading: {
        icon: <Spinner />,
        iconBg: '#FFF3E0',
        iconBorder: '#FFE4CC',
        title: 'Verifying your account…',
        sub: 'Please wait a moment while we confirm your email address.',
        titleColor: '#C45E10',
    },
    success: {
        icon: <IcoCheck />,
        iconBg: '#ECFDF5',
        iconBorder: '#6EE7B7',
        title: 'Account Verified!',
        sub: 'Your email has been confirmed. You are being redirected to the app…',
        titleColor: '#059669',
    },
    already: {
        icon: <IcoShield />,
        iconBg: '#FFF3E0',
        iconBorder: '#FFE4CC',
        title: 'Already Verified',
        sub: 'Your account is already verified. You can sign in now.',
        titleColor: '#C45E10',
    },
    error: {
        icon: <IcoX />,
        iconBg: '#FFF1F2',
        iconBorder: '#FECDD3',
        title: 'Invalid or Expired Link',
        sub: 'This verification link is no longer valid. Please register again or request a new OTP.',
        titleColor: '#BE123C',
    },
};

function VerifyEmail() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState('loading');
    const token = searchParams.get('token');

    useEffect(() => {
        if (!token) { setStatus('error'); return; }
        api.get(`/auth/verify-link?token=${token}`)
            .then(res => {
                if (res.data.already_verified) {
                    setStatus('already');
                } else {
                    localStorage.setItem("token", res.data.access_token);
                    setStatus('success');
                    setTimeout(() => navigate('/home'), 3000);
                }
            })
            .catch(() => setStatus('error'));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const cfg = STATES[status];

    return (
        <div style={S.page}>
            {/* Brand */}
            <div style={S.brand}>
                <div style={S.brandIcon}><IcoShield c="#F47920" size={20} /></div>
                <p style={S.brandName}>VAWC-Response</p>
            </div>

            {/* Card */}
            <div style={S.card}>
                <div style={{ ...S.iconWrap, backgroundColor: cfg.iconBg, border: `2px solid ${cfg.iconBorder}` }}>
                    {cfg.icon}
                </div>

                <h2 style={{ ...S.title, color: cfg.titleColor, animation:'fadeUp 0.3s ease' }}>
                    {cfg.title}
                </h2>
                <p style={S.sub}>{cfg.sub}</p>

                {status === 'success' && (
                    <div style={S.progressWrap}>
                        <div style={S.progressBar}>
                            <div style={S.progressFill} />
                        </div>
                        <p style={S.progressLabel}>Redirecting in 3 seconds…</p>
                    </div>
                )}

                {(status === 'already' || status === 'error') && (
                    <button style={S.btn} onClick={() => navigate('/')}>
                        Go to Sign In
                    </button>
                )}

                {status === 'error' && (
                    <button style={S.outlineBtn} onClick={() => navigate('/signup')}>
                        Register Again
                    </button>
                )}
            </div>

            <p style={S.footer}>Barangay Palanginan, Iba, Zambales · RA 9262</p>
        </div>
    );
}

const S = {
    page:          { minHeight:'100vh', backgroundColor:'#FFF3E0', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'28px 20px', fontFamily:"'DM Sans', sans-serif" },
    brand:         { display:'flex', alignItems:'center', gap:10, marginBottom:28 },
    brandIcon:     { width:36, height:36, borderRadius: '50%', backgroundColor:'#fff', border:'1px solid #FFE4CC', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(244,121,32,0.1)' },
    brandName:     { fontSize:16, fontWeight:800, color:'#C45E10', fontFamily:"'DM Sans', sans-serif" },
    card:          { backgroundColor:'#fff', borderRadius: 12, padding:'36px 28px', width:'100%', maxWidth:400, boxShadow:'0 4px 24px rgba(244,121,32,0.1)', border:'1px solid #FFE4CC', textAlign:'center', animation:'fadeUp 0.25s ease' },
    iconWrap:      { width:72, height:72, borderRadius: 12, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' },
    title:         { fontSize:21, fontWeight:800, marginBottom:10, fontFamily:"'DM Sans', sans-serif" },
    sub:           { fontSize:14, color:'#475569', lineHeight:1.7, marginBottom:24, fontFamily:"'DM Sans', sans-serif" },
    progressWrap:  { marginBottom:24 },
    progressBar:   { height:5, backgroundColor:'#F1F5F9', borderRadius: 4, overflow:'hidden', marginBottom:8 },
    progressFill:  { height:'100%', width:'100%', backgroundColor:'#6EE7B7', borderRadius: 4, animation:'pulse 1s ease infinite' },
    progressLabel: { fontSize:12, color:'#94A3B8', fontFamily:"'DM Sans', sans-serif" },
    btn:           { width:'100%', padding:'13px', backgroundColor:'#F47920', color:'#fff', border:'none', borderRadius: 8, fontSize:15, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans', sans-serif", boxShadow:'0 2px 8px rgba(244,121,32,0.25)', marginBottom:10 },
    outlineBtn:    { width:'100%', padding:'13px', backgroundColor:'transparent', color:'#C45E10', border:'2px solid #FFE4CC', borderRadius: 8, fontSize:15, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans', sans-serif" },
    footer:        { marginTop:28, fontSize:11.5, color:'#CBD5E1', textAlign:'center', fontFamily:"'DM Sans', sans-serif" },
};

export default VerifyEmail;
