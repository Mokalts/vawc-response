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
if (!document.getElementById('vawc-notif-css')) {
    const s = document.createElement('style'); s.id='vawc-notif-css';
    s.textContent=`
        @keyframes spin { to{transform:rotate(360deg)} }
        .vn-row { transition: background-color 0.15s ease, opacity 0.2s ease; }
        .vn-row[data-live="1"]:active { background-color: var(--border-soft); }
        .vn-row:focus-visible { outline:2px solid #CC4B00; outline-offset:-2px; }
        @media (hover: hover) and (pointer: fine) {
            .vn-row[data-live="1"]:hover { background-color: var(--surface-tint); }
        }
    `;
    document.head.appendChild(s);
}

const IcoArrow = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="#C45E10" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoLock  = () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="#64748B" strokeWidth="1.8"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round"/></svg>);
const IcoMail  = () => (<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="16" rx="2" stroke="#64748B" strokeWidth="1.8"/><path d="M2 7l10 6 10-6" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoPhone = () => (<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><rect x="6" y="2" width="12" height="20" rx="2.5" stroke="#64748B" strokeWidth="1.8"/><path d="M11 18.5h2" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round"/></svg>);
const IcoFile  = () => (<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M6 2h8l6 6v14H6z" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 2v6h6" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoChat  = () => (<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M21 11.5a8.4 8.4 0 01-9 8.4 8.9 8.9 0 01-4-.9L3 21l1.9-4.9A8.4 8.4 0 0112 3a8.4 8.4 0 019 8.5z" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoBell  = () => (<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="#C45E10" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const Spinner  = ({ c='#CC4B00', size=22 }) => (<div style={{ width:size, height:size, border:`2.5px solid ${c}30`, borderTopColor:c, borderRadius:'50%', animation:'spin 0.75s linear infinite' }} />);

const Toggle = ({ on, disabled, onToggle }) => (
    <button onClick={(e) => { e.stopPropagation(); if (!disabled) onToggle(); }}
        role="switch" aria-checked={on} disabled={disabled}
        style={{ ...S.toggle, backgroundColor: on ? '#1FA87A' : '#94A3B8',
                 opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
        <div style={{ ...S.toggleKnob, transform: on ? 'translateX(22px)' : 'translateX(2px)' }} />
    </button>
);

const Row = ({ icon, label, desc, on, disabled, onToggle, last, locked }) => (
    <div className="vn-row" data-live={disabled || locked ? '0' : '1'}
        onClick={() => { if (!disabled && !locked) onToggle(); }}
        role={locked ? undefined : 'switch'} aria-checked={locked ? undefined : on}
        tabIndex={locked || disabled ? undefined : 0}
        onKeyDown={(e) => { if (!locked && !disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onToggle(); } }}
        style={{ ...S.row, borderBottom: last ? 'none' : '1px solid var(--border-soft)',
                 opacity: disabled ? 0.45 : 1, cursor: locked || disabled ? 'default' : 'pointer' }}>
        <span style={S.rowIcon}>{icon}</span>
        <span style={{ flex:1, minWidth:0 }}>
            <span style={S.rowLabel}>{label}</span>
            {desc && <span style={S.rowDesc}>{desc}</span>}
        </span>
        {locked
            ? <span style={S.alwaysOn}>Always on</span>
            : <Toggle on={on} disabled={disabled} onToggle={onToggle} />}
    </div>
);

function NotificationSettings() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState('');
    const [prefs,   setPrefs]   = useState(null);

    useEffect(() => {
        api.get('/users/me/notifications')
            .then(r => setPrefs(r.data))
            .catch(err => {
                if (err.response?.status === 401) { localStorage.removeItem('token'); navigate('/'); return; }
                setError('Could not load your notification settings.');
            })
            .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Applied to the screen straight away and sent in the background. Waiting
    // on the network to move a switch makes the screen feel broken; if the
    // save fails the server's answer puts it back where it really is.
    const set = (field) => {
        if (!prefs) return;
        const next = { ...prefs, [field]: !prefs[field] };
        setPrefs(next);
        setError('');
        api.patch('/users/me/notifications', { [field]: next[field] })
            .then(r => setPrefs(r.data))
            .catch(() => {
                setPrefs(prefs);
                setError('That did not save. Check your connection and try again.');
            });
    };

    const header = (
        <header style={S.topBar}>
            <button style={S.backBtn} onClick={() => navigate('/profile')} aria-label="Bumalik sa My Profile"><IcoArrow /></button>
            <h1 style={S.title}>Notifications</h1>
            <ThemeToggle size={44} />
        </header>
    );

    if (loading) return (
        <div style={S.page}>
            {header}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flex:1, gap:12 }}>
                <Spinner /><p style={{ fontSize:14, color:'var(--text-muted)', fontFamily:"'Lexend', sans-serif" }}>Loading…</p>
            </div>
            <BottomNavbar />
        </div>
    );

    const off = !prefs?.notify_enabled;
    const smsOff = !prefs?.sms_available;

    return (
        <div style={S.page}>
            {header}

            <main style={S.content}>

                {error && <div style={S.errorBox}><p style={S.errorText}>{error}</p></div>}

                <div style={S.card}>
                    <Row icon={<IcoBell />} label="Allow notifications"
                        desc={off ? 'You will only get security messages' : 'Everything below follows this'}
                        on={!!prefs?.notify_enabled} onToggle={() => set('notify_enabled')} last />
                </div>

                <section style={S.group}>
                    <p style={S.groupTitle}>How you are told</p>
                    <div style={S.card}>
                        <Row icon={<IcoMail />} label="Email"
                            desc="Sent to the address on your account"
                            on={!!prefs?.notify_email} disabled={off}
                            onToggle={() => set('notify_email')} />
                        <Row icon={<IcoPhone />} label="SMS"
                            desc={smsOff
                                ? 'Not available right now'
                                : 'Sent to the mobile number on your account'}
                            on={!!prefs?.notify_sms} disabled={off || smsOff}
                            onToggle={() => set('notify_sms')} last />
                    </div>
                    {smsOff && (
                        <p style={S.groupNote}>
                            Text messaging is switched off on the barangay's system. This turns itself
                            on here as soon as the barangay enables it, with nothing for you to do.
                        </p>
                    )}
                </section>

                <section style={S.group}>
                    <p style={S.groupTitle}>What you are told about</p>
                    <div style={S.card}>
                        <Row icon={<IcoFile />} label="Case updates"
                            desc="When the barangay moves your case forward"
                            on={!!prefs?.notify_case_updates} disabled={off}
                            onToggle={() => set('notify_case_updates')} />
                        <Row icon={<IcoChat />} label="Messages from the barangay"
                            desc="Including hearing notices"
                            on={!!prefs?.notify_desk_messages} disabled={off}
                            onToggle={() => set('notify_desk_messages')} last />
                    </div>
                </section>

                {/* Listed, but with no switch. She should be able to see that
                    these exist and know they will reach her, without being able
                    to turn off the code she needs to sign in. */}
                <section style={S.group}>
                    <p style={S.groupTitle}>Always sent</p>
                    <div style={S.card}>
                        <Row icon={<IcoLock />} label="Sign-in codes" locked
                            desc="The code that lets you into your account" />
                        <Row icon={<IcoLock />} label="Password reset" locked
                            desc="Only when you ask for it" />
                        <Row icon={<IcoLock />} label="Security alerts" locked last
                            desc="If your account details are changed" />
                    </div>
                    <p style={S.groupNote}>
                        These cannot be turned off. Without them you could be locked out of your
                        own account, or not know that somebody else had got into it.
                    </p>
                </section>
            </main>

            <BottomNavbar />
        </div>
    );
}

const S = {
    page:       { minHeight:'100vh', background:'var(--page-grad)', color:'var(--text)', display:'flex', flexDirection:'column', paddingBottom:92, fontFamily:"'Lexend', sans-serif" },
    topBar:     { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', backgroundColor:'var(--surface)', borderBottom:'1px solid var(--border)', position:'sticky', top:0, zIndex:100 },
    backBtn:    { width:44, height:44, borderRadius:10, backgroundColor:'var(--surface-tint)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' },
    title:      { fontSize:17, fontWeight:700, color:'var(--accent-text)', fontFamily:"'Lexend', sans-serif" },
    content:    { padding:'20px 18px', display:'flex', flexDirection:'column', gap:18, width:'100%', maxWidth:620, marginLeft:'auto', marginRight:'auto', boxSizing:'border-box' },
    group:      { display:'flex', flexDirection:'column', gap:7 },
    groupTitle: { fontSize:10.5, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.8px', fontFamily:"'Lexend', sans-serif", paddingLeft:2 },
    groupNote:  { fontSize:12, lineHeight:1.6, color:'var(--text-muted)', fontFamily:"'Lexend', sans-serif", padding:'2px 2px 0' },
    card:       { backgroundColor:'var(--surface)', borderRadius:12, overflow:'hidden', border:'1px solid var(--border)', boxShadow:'var(--card-shadow)' },
    row:        { display:'flex', alignItems:'center', gap:12, padding:'0 16px', minHeight:60, boxSizing:'border-box' },
    rowIcon:    { width:34, height:34, flexShrink:0, borderRadius:9, backgroundColor:'var(--surface-alt)', display:'flex', alignItems:'center', justifyContent:'center' },
    rowLabel:   { display:'block', fontSize:14.5, fontWeight:600, color:'var(--text)', fontFamily:"'Lexend', sans-serif" },
    rowDesc:    { display:'block', fontSize:12, color:'var(--text-muted)', fontFamily:"'Lexend', sans-serif", marginTop:1, lineHeight:1.4 },
    alwaysOn:   { fontSize:11, fontWeight:700, color:'var(--text-muted)', backgroundColor:'var(--surface-alt)', border:'1px solid var(--border)', borderRadius:999, padding:'4px 10px', whiteSpace:'nowrap', fontFamily:"'Lexend', sans-serif" },
    toggle:     { width:46, height:26, flexShrink:0, borderRadius:999, border:'none', position:'relative', padding:0, transition:'background-color 0.2s ease' },
    toggleKnob: { width:22, height:22, borderRadius:'50%', backgroundColor:'#fff', position:'absolute', top:2, left:0, transition:'transform 0.2s ease', boxShadow:'0 1px 3px rgba(0,0,0,0.3)' },
    errorBox:   { backgroundColor:'#FFF1F2', border:'1px solid #FECDD3', borderRadius:8, padding:'10px 14px' },
    errorText:  { fontSize:13, color:'#BE123C', fontFamily:"'Lexend', sans-serif", margin:0 },
};

export default NotificationSettings;
