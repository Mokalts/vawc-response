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
if (!document.getElementById('vawc-activity-css')) {
    const s = document.createElement('style'); s.id='vawc-activity-css';
    s.textContent=`@keyframes spin { to{transform:rotate(360deg)} }`;
    document.head.appendChild(s);
}

const IcoArrow = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="#AD530F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoYou   = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="#AD530F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="7" r="4" stroke="#AD530F" strokeWidth="2"/></svg>);
const IcoDesk  = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 21h18M5 21V8l7-5 7 5v13M10 21v-6h4v6" stroke="#0F766E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoEmpty = () => (<svg width="30" height="30" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="var(--text-muted)" strokeWidth="1.6"/><path d="M12 7v5l3 2" stroke="var(--text-muted)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const Spinner  = ({ c='#CC4B00', size=22 }) => (<div style={{ width:size, height:size, border:`2.5px solid ${c}30`, borderTopColor:c, borderRadius:'50%', animation:'spin 0.75s linear infinite' }} />);

// The server sends PH local time already, so these only format it. Parsing it
// as a Date and re-formatting would drag the viewer's own timezone back in.
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const dayKey  = (iso) => iso.slice(0, 10);
const timeOf  = (iso) => {
    const [h, m] = iso.slice(11, 16).split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
};
const dayLabel = (key, todayKey, yesterdayKey) => {
    if (key === todayKey) return 'Today';
    if (key === yesterdayKey) return 'Yesterday';
    const [y, m, d] = key.split('-').map(Number);
    return `${MONTHS[m - 1]} ${d}, ${y}`;
};

function ActivityLog() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState('');
    const [entries, setEntries] = useState([]);

    useEffect(() => {
        api.get('/users/me/activity')
            .then(r => setEntries(r.data.entries || []))
            .catch(err => {
                if (err.response?.status === 401) { localStorage.removeItem('token'); navigate('/'); return; }
                setError('Could not load your activity.');
            })
            .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const header = (
        <header style={S.topBar}>
            <button style={S.backBtn} onClick={() => navigate('/profile')} aria-label="Bumalik sa My Profile"><IcoArrow /></button>
            <h1 style={S.title}>Activity</h1>
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

    // Grouped by day in the order the server sent, which is newest first.
    const days = [];
    for (const e of entries) {
        const key = dayKey(e.at);
        const last = days[days.length - 1];
        if (last && last.key === key) last.items.push(e);
        else days.push({ key, items: [e] });
    }

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const y = new Date(now.getTime() - 86400000);
    const yesterdayKey = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;

    return (
        <div style={S.page}>
            {header}

            <main style={S.content}>

                <p style={S.intro}>
                    What you have done on this account, and what the barangay has done with your
                    case. If you see a sign-in that was not you, change your password.
                </p>

                {error && <div style={S.errorBox}><p style={S.errorText}>{error}</p></div>}

                {!error && entries.length === 0 && (
                    <div style={S.empty}>
                        <IcoEmpty />
                        <p style={S.emptyTitle}>Nothing here yet</p>
                        <p style={S.emptyText}>Your account activity will appear here as you use the app.</p>
                    </div>
                )}

                {days.map(day => (
                    <section key={day.key} style={S.group}>
                        <p style={S.groupTitle}>{dayLabel(day.key, todayKey, yesterdayKey)}</p>
                        <div style={S.card}>
                            {day.items.map((e, i) => (
                                <div key={`${e.at}-${i}`} style={{ ...S.row, borderBottom: i === day.items.length - 1 ? 'none' : '1px solid var(--border-soft)' }}>
                                    <span style={{ ...S.dot, backgroundColor: e.kind === 'barangay' ? '#ECFDF5' : 'var(--surface-tint)' }}>
                                        {e.kind === 'barangay' ? <IcoDesk /> : <IcoYou />}
                                    </span>
                                    <span style={{ flex:1, minWidth:0 }}>
                                        <span style={S.rowLabel}>{e.text}</span>
                                        {e.detail && <span style={S.rowDesc}>{e.detail}</span>}
                                    </span>
                                    <span style={S.time}>{timeOf(e.at)}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                ))}
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
    intro:      { fontSize:12.5, lineHeight:1.6, color:'var(--text-muted)', fontFamily:"'Lexend', sans-serif", padding:'0 2px' },
    group:      { display:'flex', flexDirection:'column', gap:7 },
    groupTitle: { fontSize:10.5, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.8px', fontFamily:"'Lexend', sans-serif", paddingLeft:2 },
    card:       { backgroundColor:'var(--surface)', borderRadius:12, overflow:'hidden', border:'1px solid var(--border)', boxShadow:'var(--card-shadow)' },
    row:        { display:'flex', alignItems:'center', gap:12, padding:'13px 16px', boxSizing:'border-box' },
    dot:        { width:30, height:30, flexShrink:0, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' },
    rowLabel:   { display:'block', fontSize:14, fontWeight:600, color:'var(--text)', fontFamily:"'Lexend', sans-serif", lineHeight:1.4 },
    rowDesc:    { display:'block', fontSize:12, color:'var(--text-muted)', fontFamily:"'Lexend', sans-serif", marginTop:1 },
    time:       { fontSize:11.5, color:'var(--text-muted)', fontFamily:"'Lexend', sans-serif", whiteSpace:'nowrap', flexShrink:0 },
    empty:      { display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'44px 20px', backgroundColor:'var(--surface)', borderRadius:12, border:'1px solid var(--border)' },
    emptyTitle: { fontSize:15, fontWeight:700, color:'var(--text)', fontFamily:"'Lexend', sans-serif" },
    emptyText:  { fontSize:13, color:'var(--text-muted)', textAlign:'center', fontFamily:"'Lexend', sans-serif" },
    errorBox:   { backgroundColor:'#FFF1F2', border:'1px solid #FECDD3', borderRadius:8, padding:'10px 14px' },
    errorText:  { fontSize:13, color:'#BE123C', fontFamily:"'Lexend', sans-serif", margin:0 },
};

export default ActivityLog;
