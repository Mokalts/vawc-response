import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../components/Sidebar';
import api from '../api/api';

// ─── CSS ──────────────────────────────────────────────────────────────────────
if (!document.getElementById('dash-css')) {
    const s = document.createElement('style'); s.id = 'dash-css';
    s.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes shimmer   { 0%{background-position:200% 0}100%{background-position:-200% 0} }
        @keyframes fadeIn    { from{opacity:0}to{opacity:1} }
        @keyframes popIn     { from{opacity:0;transform:scale(0.96) translateY(10px)}to{opacity:1;transform:scale(1)translateY(0)} }
        @keyframes slideRight{ from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)} }
        @keyframes pulse-ring{
            0%  {box-shadow:0 0 0 0 rgba(123,45,139,0.4);}
            70% {box-shadow:0 0 0 9px rgba(123,45,139,0);}
            100%{box-shadow:0 0 0 0 rgba(123,45,139,0);}
        }
        .dash-row { cursor:pointer; }
        .dash-row:hover td { background:#F8FAFC !important; }
        .dash-row td { transition:background 0.1s; }
        .period-btn { transition:all 0.15s ease; }
        .period-btn:hover:not(.p-active) { color:#475569 !important; }
        .new-card { animation:pulse-ring 2.2s ease-out infinite; transition:transform 0.18s ease,box-shadow 0.18s ease; cursor:pointer; }
        .new-card:hover { transform:translateY(-2px) !important; box-shadow:0 8px 24px rgba(123,45,139,0.22) !important; }
        .confirm-btn:hover:not([disabled]) { background:#065F46 !important; color:#fff !important; }
        .confirm-btn { transition:all 0.15s ease; }
        .nr-row:hover { background:#F8FAFC !important; }
        .nr-row { transition:background 0.1s; cursor:pointer; }
    `;
    document.head.appendChild(s);
}

const PERIODS = [
    { key: 'monthly',       label: 'Monthly' },
    { key: 'quarterly',     label: 'Quarterly' },
    { key: 'semi_annually', label: 'Semi-Annual' },
    { key: 'annually',      label: 'Annual' },
];

// Calendar-aligned window around a reference date (defaults to today).
const computeRange = (key, ref = new Date()) => {
    const y = ref.getFullYear(), m = ref.getMonth();
    if (key === 'monthly') {
        const s = new Date(y, m, 1), e = new Date(y, m + 1, 0);
        return { start: s, end: e, desc: s.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }) };
    }
    if (key === 'semi_annually') {
        const half = m <= 5 ? 0 : 6;
        const s = new Date(y, half, 1), e = new Date(y, half + 6, 0);
        return { start: s, end: e, desc: `${m <= 5 ? 'First' : 'Second'} Half ${y}` };
    }
    if (key === 'annually') {
        return { start: new Date(y, 0, 1), end: new Date(y, 11, 31), desc: `Full Year ${y}` };
    }
    // quarterly (default)
    const qs = Math.floor(m / 3) * 3;
    const s = new Date(y, qs, 1), e = new Date(y, qs + 3, 0);
    return { start: s, end: e, desc: `Q${Math.floor(m / 3) + 1} ${y}` };
};

const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const INCIDENT_COLORS = {
    'Physical Abuse':      '#EF4444',
    'Sexual Abuse':        '#9B4DAB',
    'Psychological Abuse': '#F47920',
    'Economic Abuse':      '#0EA5E9',
    'Other':               '#64748B',
    'Unclassified':        '#CBD5E1',
};
const incidentColor = (t) => INCIDENT_COLORS[t] || '#7B2D8B';

const STATUS_CFG = {
    submitted: { label: 'Submitted', color: '#BE185D', bg: '#FDF2F8', dot: '#EC4899' },
    awaiting_onsite_visit: { label: 'Awaiting Onsite Visit', color: '#92400E', bg: '#FFFBEB', dot: '#F59E0B' },
    under_process: { label: 'Under Process', color: '#0E7490', bg: '#ECFEFF', dot: '#06B6D4' },
    summon_issued: { label: 'Summon Letter Issued', color: '#C45E10', bg: '#FFF3E0', dot: '#F47920' },
    summon_acknowledged: { label: 'Summon Acknowledged', color: '#4A1259', bg: '#F3E5F5', dot: '#9B4DAB' },
    resolved: { label: 'Resolved', color: '#065F46', bg: '#ECFDF5', dot: '#10B981' },
    referred_to_police: { label: 'Referred to Authorities', color: '#991B1B', bg: '#FEF2F2', dot: '#EF4444' },
};
const sCfg = (s) => STATUS_CFG[s] || { label: s || '-', color: '#94A3B8', bg: '#F1F5F9', dot: '#CBD5E1' };

// ─── Icons ────────────────────────────────────────────────────────────────────
const Ico = ({ d, size = 16, color = 'currentColor' }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d={d} stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoM = ({ children, size = 16 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none">{children}</svg>);
const IcoBell = ({ size = 16, color = 'currentColor' }) => <IcoM size={size}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></IcoM>;
const IcoClip = ({ size = 16, color = 'currentColor' }) => <IcoM size={size}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></IcoM>;
const IcoCheck = ({ size = 16, color = 'currentColor' }) => <Ico size={size} color={color} d="M20 6L9 17l-5-5" />;
const IcoX = ({ size = 14, color = 'currentColor' }) => <IcoM size={size}><path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth="2" strokeLinecap="round" /></IcoM>;
const IcoUser = ({ size = 14, color = 'currentColor' }) => <IcoM size={size}><circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.8" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth="1.8" strokeLinecap="round" /></IcoM>;
const IcoCal = ({ size = 14, color = 'currentColor' }) => <IcoM size={size}><rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth="1.8" /><path d="M16 2v4M8 2v4M3 10h18" stroke={color} strokeWidth="1.8" strokeLinecap="round" /></IcoM>;
const IcoPin = ({ size = 14, color = 'currentColor' }) => <IcoM size={size}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="10" r="3" stroke={color} strokeWidth="1.8" /></IcoM>;
const IcoInbox = ({ size = 36, color = 'currentColor' }) => <IcoM size={size}><path d="M22 12h-6l-2 3H10l-2-3H2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></IcoM>;
const IcoFilter = ({ size = 14, color = 'currentColor' }) => <Ico size={size} color={color} d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getGreeting = () => { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'; };
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '';
const truncate = (s, n) => !s ? '-' : s.length > n ? s.slice(0, n) + '…' : s;

// Human date-range subtitle from the backend-returned ISO start/end.
const rangeSubtitle = (stats) => {
    if (!stats?.start || !stats?.end) return '';
    const fmt = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
    return `${fmt(stats.start)} - ${fmt(stats.end)}`;
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Skel = ({ w = '100%', h = 14, r = 6, mb = 0 }) => (
    <div style={{ width: w, height: h, borderRadius: 4, background: 'linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', marginBottom: mb }} />
);

// ─── Period Tabs ──────────────────────────────────────────────────────────────
function PeriodTabs({ period, onChange }) {
    const refs = useRef([]);
    const [pill, setPill] = useState({ w: 0, l: 0, o: 0 });
    useEffect(() => {
        const i = PERIODS.findIndex(p => p.key === period);
        const el = refs.current[i];
        if (el) setPill({ w: el.offsetWidth, l: el.offsetLeft, o: 1 });
    }, [period]);
    return (
        <div style={{ position: 'relative', display: 'flex', gap: 2, backgroundColor: '#F1F5F9', padding: 4, borderRadius: 4, border: '1px solid #E2E8F0' }}>
            <div style={{ position: 'absolute', top: 4, bottom: 4, borderRadius: 4, backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(15,23,42,0.08)', transition: 'all 0.2s ease', width: pill.w, left: pill.l, opacity: pill.o }} />
            {PERIODS.map((p, i) => (
                <button key={p.key} ref={el => refs.current[i] = el}
                    className={`period-btn${period === p.key ? ' p-active' : ''}`}
                    onClick={() => onChange(p.key)}
                    style={{ padding: '6px 16px', borderRadius: 4, border: 'none', backgroundColor: 'transparent', fontSize: 13, fontWeight: period === p.key ? 600 : 500, color: period === p.key ? '#0F172A' : '#64748B', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", position: 'relative', zIndex: 1 }}>
                    {p.label}
                </button>
            ))}
        </div>
    );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ rawStatus, displayLabel }) {
    const cfg = sCfg(rawStatus);
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 4, fontSize: 11.5, fontWeight: 600, color: cfg.color, backgroundColor: cfg.bg, whiteSpace: 'nowrap', fontFamily: "'DM Sans',sans-serif" }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: cfg.dot, flexShrink: 0 }} />
            {displayLabel || cfg.label}
        </span>
    );
}

// ─── New Reports Modal ────────────────────────────────────────────────────────
function ReportBriefPanel({ report, onClose, onConfirm, isConfirmed, isConfirming }) {
    return (
        <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 12, marginTop: 4, animation: 'slideRight 0.15s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#7B2D8B', background: '#F3E5F5', padding: '2px 7px', borderRadius: 4, fontFamily: "'DM Sans',sans-serif" }}>{report.case_number}</span>
                    <StatusBadge rawStatus={report.status} displayLabel={report.status_display} />
                </div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 2, display: 'flex' }}><IcoX size={13} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 10 }}>
                {[
                    [<IcoUser color="#7B2D8B" />, 'Victim', report.victim_name],
                    [<IcoCal color="#7B2D8B" />, 'Filed', fmtDate(report.created_at)],
                    report.offender_name && [<IcoUser color="#7B2D8B" />, 'Respondent', report.offender_name],
                    report.incident_type && [null, 'Type', report.incident_type],
                    report.address && [<IcoPin color="#7B2D8B" />, 'Location', truncate(report.address, 40)],
                ].filter(Boolean).map(([icon, label, val], i) => (
                    <div key={i} style={{ background: '#F8FAFC', borderRadius: 4, padding: '8px 10px', border: '1px solid #E2E8F0', gridColumn: label === 'Location' ? 'span 2' : 'auto' }}>
                        <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: "'DM Sans',sans-serif", display: 'flex', alignItems: 'center', gap: 4 }}>{icon}{label}</p>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#0F172A', fontFamily: "'DM Sans',sans-serif" }}>{val}</p>
                    </div>
                ))}
                {report.statement && (
                    <div style={{ gridColumn: 'span 2', background: '#F8FAFC', borderRadius: 4, padding: '8px 10px', border: '1px solid #E2E8F0' }}>
                        <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: "'DM Sans',sans-serif" }}>Statement</p>
                        <p style={{ margin: 0, fontSize: 13, color: '#475569', fontFamily: "'DM Sans',sans-serif", lineHeight: 1.5 }}>{truncate(report.statement, 150)}</p>
                    </div>
                )}
            </div>
            {isConfirmed
                ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 4, background: '#ECFDF5', color: '#059669', fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}><IcoCheck color="#059669" /> Confirmed</div>
                : <button className="confirm-btn" disabled={isConfirming} onClick={() => onConfirm(report.id)}
                    style={{ width: '100%', padding: '9px 0', borderRadius: 8, border: '1.5px solid #A7F3D0', background: '#F0FDF4', color: '#065F46', fontSize: 13, fontWeight: 700, cursor: isConfirming ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans',sans-serif", opacity: isConfirming ? 0.7 : 1 }}>
                    {isConfirming ? 'Confirming…' : 'Confirm Report'}
                </button>
            }
        </div>
    );
}

function NewReportsModal({ onClose, onConfirmed }) {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [confirming, setConfirming] = useState({});
    const [confirmed, setConfirmed] = useState({});
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        // Fetch submitted (unconfirmed) cases from the correct endpoint
        api.get('/admin/cases?status=submitted&limit=50')
            .then(r => setReports(r.data.cases || r.data.reports || []))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const handleConfirm = async (id) => {
        setConfirming(p => ({ ...p, [id]: true }));
        try {
            await api.patch(`/admin/cases/${id}/status`, { status: 'awaiting_onsite_visit' });
            setConfirmed(p => ({ ...p, [id]: true }));
            setSelected(null);
            onConfirmed();
        } catch { }
        finally { setConfirming(p => ({ ...p, [id]: false })); }
    };

    const pending = reports.filter(r => !confirmed[r.id]);

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 900, backdropFilter: 'blur(4px)', padding: '20px 16px', animation: 'fadeIn 0.18s ease' }}
            onClick={onClose}>
            <div style={{ backgroundColor: '#fff', borderRadius: 4, width: '100%', maxWidth: 500, maxHeight: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(15,23,42,0.22)', animation: 'popIn 0.2s ease' }}
                onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px 14px', borderBottom: '1px solid #F1F5F9', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 4, background: '#7B2D8B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <IcoBell color="#fff" size={16} />
                        </div>
                        <div>
                            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#7B2D8B', fontFamily: "'DM Sans',sans-serif" }}>New Reports</p>
                            <p style={{ margin: 0, fontSize: 12, color: '#94A3B8', fontFamily: "'DM Sans',sans-serif" }}>
                                {loading ? 'Loading…' : pending.length > 0 ? `${pending.length} awaiting confirmation` : 'All confirmed'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 4, border: 'none', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><IcoX /></button>
                </div>

                {/* Body */}
                <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
                    {loading && [1, 2, 3].map(i => (
                        <div key={i} style={{ padding: '12px 24px', borderBottom: '1px solid #F8FAFC' }}>
                            <Skel w="55%" h={12} r={4} mb={7} /><Skel w="35%" h={10} r={4} />
                        </div>
                    ))}
                    {!loading && reports.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <IcoCheck color="#A7F3D0" size={36} />
                            <p style={{ marginTop: 10, fontSize: 14, fontWeight: 600, color: '#059669', fontFamily: "'DM Sans',sans-serif" }}>All caught up</p>
                            <p style={{ fontSize: 12.5, color: '#94A3B8', fontFamily: "'DM Sans',sans-serif", margin: '4px 0 0' }}>No new reports to confirm.</p>
                        </div>
                    )}
                    {!loading && !selected && reports.map(r => {
                        const done = confirmed[r.id];
                        return (
                            <div key={r.id} style={{ borderBottom: '1px solid #F8FAFC' }}>
                                <div className="nr-row" onClick={() => !done && setSelected(r)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 24px', opacity: done ? 0.45 : 1 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: done ? '#A7F3D0' : '#9B4DAB', flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ margin: '0 0 2px', fontSize: 13.5, fontWeight: 700, color: '#0F172A', fontFamily: "'DM Sans',sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.victim_name}</p>
                                        <p style={{ margin: 0, fontSize: 11.5, color: '#94A3B8', fontFamily: "'DM Sans',sans-serif" }}>{r.case_number} · {fmtDate(r.created_at)}</p>
                                    </div>
                                    {done
                                        ? <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: '#ECFDF5', padding: '3px 9px', borderRadius: 4, fontFamily: "'DM Sans',sans-serif" }}>Confirmed</span>
                                        : <button onClick={e => { e.stopPropagation(); setSelected(r); }} style={{ padding: '5px 12px', borderRadius: 4, border: '1.5px solid #E1BEE7', background: '#F3E5F5', color: '#7B2D8B', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", flexShrink: 0 }}>View</button>
                                    }
                                </div>
                            </div>
                        );
                    })}
                    {!loading && selected && (
                        <div style={{ padding: '8px 24px 16px' }}>
                            <ReportBriefPanel report={selected} onClose={() => setSelected(null)} onConfirm={handleConfirm} isConfirmed={confirmed[selected.id]} isConfirming={confirming[selected.id] && !confirmed[selected.id]} />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '14px 24px 18px', borderTop: '1px solid #F1F5F9', flexShrink: 0 }}>
                    <button onClick={onClose} style={{ width: '100%', padding: '10px 0', borderRadius: 4, border: '1.5px solid #E2E8F0', background: '#fff', color: '#475569', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Close</button>
                </div>
            </div>
        </div>
    );
}

// ─── Analytics: Chart card shell ──────────────────────────────────────────────
function ChartCard({ title, subtitle, children }) {
    return (
        <div style={S.tableCard}>
            <div style={{ ...S.tableHeader, justifyContent: 'flex-start', gap: 8 }}>
                <div style={S.cardAccent} />
                <span style={S.cardTitle}>{title}</span>
                {subtitle && <span style={{ fontSize: 11.5, color: '#94A3B8', fontFamily: "'DM Sans',sans-serif" }}>· {subtitle}</span>}
            </div>
            <div style={{ padding: '18px 20px' }}>{children}</div>
        </div>
    );
}

const ChartEmpty = ({ text }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 10px', textAlign: 'center' }}>
        <IcoInbox color="#CBD5E1" size={32} />
        <p style={{ margin: '10px 0 0', fontSize: 13, color: '#94A3B8', fontFamily: "'DM Sans',sans-serif" }}>{text}</p>
    </div>
);

// ─── Cases by Status - donut ──────────────────────────────────────────────────
function StatusDonut({ byStatus, loading }) {
    if (loading) return <Skel w="100%" h={180} r={8} />;
    const entries = Object.entries(byStatus || {}).filter(([, c]) => c > 0);
    const total = entries.reduce((a, [, c]) => a + c, 0);
    if (!total) return <ChartEmpty text="No cases in this period" />;

    const R = 54, STROKE = 20, C = 2 * Math.PI * R;
    let offset = 0;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <svg width={140} height={140} viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
                <g transform="rotate(-90 70 70)">
                    <circle cx={70} cy={70} r={R} fill="none" stroke="#F1F5F9" strokeWidth={STROKE} />
                    {entries.map(([s, c]) => {
                        const len = (c / total) * C;
                        const seg = (
                            <circle key={s} cx={70} cy={70} r={R} fill="none" stroke={sCfg(s).dot}
                                strokeWidth={STROKE} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />
                        );
                        offset += len;
                        return seg;
                    })}
                </g>
                <text x={70} y={66} textAnchor="middle" style={{ fontSize: 26, fontWeight: 800, fill: '#0F172A', fontFamily: "'DM Sans',sans-serif" }}>{total}</text>
                <text x={70} y={84} textAnchor="middle" style={{ fontSize: 11, fill: '#94A3B8', fontFamily: "'DM Sans',sans-serif" }}>cases</text>
            </svg>
            <div style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {entries.map(([s, c]) => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: sCfg(s).dot, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 12.5, color: '#475569', fontFamily: "'DM Sans',sans-serif" }}>{sCfg(s).label}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A', fontFamily: "'DM Sans',sans-serif" }}>{c}</span>
                        <span style={{ fontSize: 11, color: '#94A3B8', fontFamily: "'DM Sans',sans-serif", width: 38, textAlign: 'right' }}>{Math.round((c / total) * 100)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Incident Type - horizontal bars ──────────────────────────────────────────
function IncidentBars({ data, loading }) {
    if (loading) return <Skel w="100%" h={180} r={8} />;
    const items = (data || []).filter(d => d.count > 0).sort((a, b) => b.count - a.count);
    if (!items.length) return <ChartEmpty text="No classified incidents yet" />;
    const max = Math.max(...items.map(d => d.count));
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map(d => (
                <div key={d.type}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#475569', fontFamily: "'DM Sans',sans-serif" }}>{d.type}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A', fontFamily: "'DM Sans',sans-serif" }}>{d.count}</span>
                    </div>
                    <div style={{ height: 10, borderRadius: 6, background: '#F1F5F9', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(d.count / max) * 100}%`, background: incidentColor(d.type), borderRadius: 6, transition: 'width 0.3s ease' }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
    const navigate = useNavigate();
    const [period, setPeriod] = useState('quarterly');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [showCustom, setShowCustom] = useState(false);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [newCount, setNewCount] = useState(0);
    const [showModal, setShowModal] = useState(false);
    const [burstAlert, setBurstAlert] = useState(null);  // multi-report burst
    const [burstDismissedAt, setBurstDismissedAt] = useState(() => {
        try { return localStorage.getItem('multi_alert_dismissed_at'); } catch { return null; }
    });

    const admin = (() => { try { return JSON.parse(localStorage.getItem('admin_user') || localStorage.getItem('admin') || '{}'); } catch { return {}; } })();
    const adminName = admin.first_name || admin.username || 'Admin';

    const fetchStats = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const params = period === 'custom'
                ? { period: 'custom', start: customStart, end: customEnd }
                : { period };
            const [sRes, uRes] = await Promise.all([
                api.get('/admin/dashboard', { params }),
                api.get('/admin/cases/unread-count'),
            ]);
            setStats(sRes.data);
            setNewCount(uRes.data.unread || 0);
            setBurstAlert(uRes.data.multi_alert || null);
        } catch {
            setError('Failed to load dashboard data.');
        } finally {
            setLoading(false);
        }
    }, [period, customStart, customEnd]);

    useEffect(() => { fetchStats(); }, [fetchStats]);

    // Poll for burst detection every 30 seconds while on dashboard
    useEffect(() => {
        const t = setInterval(() => {
            api.get('/admin/cases/unread-count')
                .then(r => {
                    setNewCount(r.data.unread || 0);
                    setBurstAlert(r.data.multi_alert || null);
                })
                .catch(() => { });
        }, 30000);
        return () => clearInterval(t);
    }, []);

    const handleConfirmed = () => { fetchStats(); };

    const showBurst = !!(burstAlert && burstAlert.active && burstAlert.newest_at && burstAlert.newest_at !== burstDismissedAt);

    const handleDismissBurst = () => {
        if (!burstAlert?.newest_at) return;
        try { localStorage.setItem('multi_alert_dismissed_at', burstAlert.newest_at); } catch {}
        setBurstDismissedAt(burstAlert.newest_at);
    };

    const activeLabel = period === 'custom' ? 'Custom' : (PERIODS.find(p => p.key === period)?.label || 'Quarterly');
    const periodDesc  = stats?.period_label || (period !== 'custom' ? computeRange(period).desc : 'Custom range');
    const subtitle    = rangeSubtitle(stats);
    const canApply    = customStart && customEnd;

    // Exclude submitted (unconfirmed) cases from the dashboard table
    const reports = (stats?.recent_reports || []).filter(r => r.status !== 'submitted');

    return (
        <AdminLayout>
            <div style={S.wrap}>

                {/* ── Top row ─────────────────────────────────────────────── */}
                <div style={S.topRow}>
                    <div>
                        <h1 style={S.greeting}>Good {getGreeting()}, {adminName}</h1>
                        <p style={S.greetingSub}>VAWC Case Management - Barangay Palanginan</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <PeriodTabs period={period} onChange={(k) => { setPeriod(k); setShowCustom(false); }} />
                        <button className="period-btn" onClick={() => setShowCustom(v => !v)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 4, border: `1.5px solid ${period === 'custom' ? '#7B2D8B' : '#E2E8F0'}`, background: period === 'custom' ? '#F3E5F5' : '#fff', color: period === 'custom' ? '#7B2D8B' : '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                            <IcoCal size={13} color={period === 'custom' ? '#7B2D8B' : '#94A3B8'} /> Custom
                        </button>
                    </div>
                </div>

                {/* ── Custom date range picker ────────────────────────────── */}
                {showCustom && (
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 4, padding: '14px 16px', marginBottom: 16 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label style={S.dateLbl}>From</label>
                            <input type="date" value={customStart} max={customEnd || toISO(new Date())} onChange={e => setCustomStart(e.target.value)} style={S.dateInput} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label style={S.dateLbl}>To</label>
                            <input type="date" value={customEnd} min={customStart} max={toISO(new Date())} onChange={e => setCustomEnd(e.target.value)} style={S.dateInput} />
                        </div>
                        <button onClick={() => { if (canApply) setPeriod('custom'); }} disabled={!canApply}
                            style={{ padding: '9px 18px', borderRadius: 4, border: 'none', background: canApply ? '#7B2D8B' : '#E2E8F0', color: canApply ? '#fff' : '#94A3B8', fontSize: 13, fontWeight: 600, cursor: canApply ? 'pointer' : 'not-allowed', fontFamily: "'DM Sans',sans-serif" }}>
                            Apply
                        </button>
                        {period === 'custom' && (
                            <button onClick={() => { setPeriod('quarterly'); setCustomStart(''); setCustomEnd(''); setShowCustom(false); }}
                                style={{ padding: '9px 14px', borderRadius: 4, border: '1.5px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                                Clear
                            </button>
                        )}
                    </div>
                )}

                {/* ── Multi-report burst alert ────────────────────────────── */}
                {showBurst && (
                    <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                        background: '#FFF3E0', border: '1.5px solid #F47920',
                        borderRadius: 4, padding: '14px 16px', marginBottom: 16,
                        animation: 'fadeIn 0.25s ease',
                        boxShadow: '0 2px 8px rgba(244,121,32,0.18)',
                    }}>
                        <div style={{
                            width: 38, height: 38, borderRadius: '50%',
                            background: '#F47920',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                            boxShadow: '0 0 0 4px rgba(244,121,32,0.2)',
                        }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <line x1="12" y1="9" x2="12" y2="13" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                                <line x1="12" y1="17" x2="12.01" y2="17" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                            </svg>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#C45E10', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'DM Sans',sans-serif" }}>
                                Multiple reports received
                            </p>
                            <p style={{ margin: '3px 0 0', fontSize: 13.5, color: '#7C2D12', lineHeight: 1.55, fontFamily: "'DM Sans',sans-serif" }}>
                                <strong>{burstAlert.report_count}</strong> new report{burstAlert.report_count !== 1 ? 's' : ''} from <strong>{burstAlert.distinct_users}</strong> different victim{burstAlert.distinct_users !== 1 ? 's' : ''} in the last {burstAlert.window_minutes} minutes. Please review and respond promptly.
                            </p>
                        </div>
                        <button onClick={handleDismissBurst} title="Dismiss alert"
                            style={{
                                flexShrink: 0,
                                width: 30, height: 30, borderRadius: '50%',
                                background: 'rgba(255,255,255,0.6)',
                                border: '1.5px solid #FFCC99',
                                color: '#C45E10', cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                fontFamily: "'DM Sans',sans-serif",
                            }}>
                            <IcoX size={14} color="#C45E10" />
                        </button>
                    </div>
                )}

                {error && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 4, padding: '12px 16px', marginBottom: 16 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FB7185', flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: '#BE123C', fontFamily: "'DM Sans',sans-serif" }}>{error}</span>
                        <button onClick={fetchStats} style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: '#BE123C', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Retry</button>
                    </div>
                )}

                {/* ── Stat cards ──────────────────────────────────────────── */}
                <div style={S.statsRow}>
                    {/* Total Reports */}
                    <div style={S.statCard}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 42, height: 42, borderRadius: 4, background: '#F3E5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <IcoClip size={18} color="#7B2D8B" />
                            </div>
                            <div>
                                {loading
                                    ? <><Skel w={50} h={24} r={4} mb={5} /><Skel w={100} h={11} r={4} /></>
                                    : <>
                                        <p style={S.statNum}>{stats?.total_reports ?? '-'}</p>
                                        <p style={S.statLabel}>Total Cases</p>
                                    </>
                                }
                            </div>
                        </div>
                        <div style={S.statMeta}>
                            <IcoFilter size={11} color="#94A3B8" />
                            <span style={{ fontSize: 11.5, color: '#94A3B8', fontFamily: "'DM Sans',sans-serif" }}>{periodDesc}</span>
                        </div>
                    </div>

                    {/* New Reports - highlighted */}
                    <div className="new-card" onClick={() => setShowModal(true)} style={S.newCard}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 42, height: 42, borderRadius: 4, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <IcoBell size={18} color="#fff" />
                            </div>
                            <div>
                                {loading
                                    ? <><Skel w={50} h={24} r={4} mb={5} /><Skel w={100} h={11} r={4} /></>
                                    : <>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                                            <p style={{ ...S.statNum, color: '#fff', margin: 0 }}>{newCount}</p>
                                            {newCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.25)', color: '#fff', borderRadius: 4, padding: '1px 8px', fontFamily: "'DM Sans',sans-serif" }}>new</span>}
                                        </div>
                                        <p style={{ ...S.statLabel, color: 'rgba(255,255,255,0.75)', margin: 0 }}>New Reports</p>
                                    </>
                                }
                            </div>
                        </div>
                        <div style={{ ...S.statMeta, borderColor: 'rgba(255,255,255,0.15)' }}>
                            <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)', fontFamily: "'DM Sans',sans-serif" }}>Tap to review and confirm</span>
                        </div>
                    </div>
                </div>

                {/* ── Analytics ────────────────────────────────────────────── */}
                <div style={S.analyticsRow}>
                    <ChartCard title="Cases by Status" subtitle={periodDesc}>
                        <StatusDonut byStatus={stats?.by_status} loading={loading} />
                    </ChartCard>
                    <ChartCard title="Incident Types" subtitle={periodDesc}>
                        <IncidentBars data={stats?.incident_types} loading={loading} />
                    </ChartCard>
                </div>

                {/* ── Cases Table ──────────────────────────────────────────── */}
                <div style={S.tableCard}>
                    {/* Table header */}
                    <div style={S.tableHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={S.cardAccent} />
                            <span style={S.cardTitle}>Cases</span>
                            <span style={S.periodTag}>{activeLabel}</span>
                            {!loading && subtitle && (
                                <span style={{ fontSize: 11.5, color: '#94A3B8', fontFamily: "'DM Sans',sans-serif" }}>
                                    · {subtitle}
                                </span>
                            )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {!loading && (
                                <span style={{ fontSize: 12.5, color: '#94A3B8', fontFamily: "'DM Sans',sans-serif" }}>
                                    {reports.length} record{reports.length !== 1 ? 's' : ''}
                                </span>
                            )}
                            <button onClick={() => navigate('/reports')} style={{ padding: '6px 14px', borderRadius: 4, border: '1.5px solid #E2E8F0', background: '#fff', color: '#475569', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                                View All Cases
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                                    {['Case No.', 'Victim Name', 'Respondent', 'Date Filed', 'Status'].map(h => (
                                        <th key={h} style={{ padding: '10px 18px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap', fontFamily: "'DM Sans',sans-serif" }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading && [1, 2, 3, 4, 5, 6].map(i => (
                                    <tr key={i} style={{ borderBottom: '1px solid #F8FAFC' }}>
                                        {[80, 160, 140, 100, 70, 100].map((w, j) => (
                                            <td key={j} style={{ padding: '14px 18px' }}>
                                                <Skel w={w} h={12} r={4} />
                                            </td>
                                        ))}
                                    </tr>
                                ))}

                                {!loading && reports.length === 0 && (
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: 'center', padding: '56px 24px' }}>
                                            <IcoInbox color="#CBD5E1" size={40} />
                                            <p style={{ marginTop: 12, fontSize: 15, fontWeight: 600, color: '#475569', fontFamily: "'DM Sans',sans-serif" }}>
                                                No confirmed cases in this period
                                            </p>
                                            <p style={{ fontSize: 13, color: '#94A3B8', fontFamily: "'DM Sans',sans-serif", margin: '4px 0 0' }}>
                                                {subtitle}
                                            </p>
                                        </td>
                                    </tr>
                                )}

                                {!loading && reports.map(r => (
                                    <tr key={r.id} className="dash-row" onClick={() => navigate(`/reports/${r.id}`)}>
                                        <td style={S.td}>
                                            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700, color: '#7B2D8B', background: '#F3E5F5', fontFamily: 'monospace', border: '1px solid #E1BEE7' }}>
                                                {r.case_number || `#${String(r.id).padStart(5, '0')}`}
                                            </span>
                                        </td>
                                        <td style={{ ...S.td, fontWeight: 600, color: '#0F172A' }}>{r.victim_name}</td>
                                        <td style={S.td}>
                                            {r.offender_name
                                                ? <span style={{ fontSize: 13, color: '#475569', fontFamily: "'DM Sans',sans-serif" }}>{r.offender_name}</span>
                                                : <span style={{ color: '#CBD5E1', fontSize: 13 }}>-</span>
                                            }
                                        </td>
                                        <td style={S.td}>{fmtDate(r.created_at)}</td>
                                        <td style={S.td}>
                                            <StatusBadge rawStatus={r.status} displayLabel={r.status_display} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {showModal && <NewReportsModal onClose={() => setShowModal(false)} onConfirmed={handleConfirmed} />}
        </AdminLayout>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const FF = "'DM Sans', sans-serif";
const S = {
    wrap: { maxWidth: 1200, fontFamily: FF },
    topRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
    greeting: { margin: 0, fontSize: 19, fontWeight: 700, color: '#0F172A', fontFamily: FF, letterSpacing: '-0.2px' },
    greetingSub: { margin: '3px 0 0', fontSize: 12.5, color: '#94A3B8', fontFamily: FF },

    statsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 },
    analyticsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 },
    dateLbl: { fontSize: 10.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.6px', fontFamily: FF },
    dateInput: { padding: '8px 10px', borderRadius: 4, border: '1.5px solid #E2E8F0', fontSize: 13, color: '#0F172A', fontFamily: FF, outline: 'none' },

    statCard: { backgroundColor: '#fff', borderRadius: 4, padding: '18px 20px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15,23,42,0.05)', display: 'flex', flexDirection: 'column', gap: 12 },
    newCard: { borderRadius: 4, padding: '18px 20px', border: '2px solid #9B4DAB', background: 'linear-gradient(135deg,#7B2D8B,#9B4DAB)', boxShadow: '0 4px 14px rgba(123,45,139,0.22)', display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer' },
    statNum: { margin: '0 0 2px', fontSize: 26, fontWeight: 800, color: '#0F172A', fontFamily: FF, letterSpacing: '-0.5px' },
    statLabel: { margin: 0, fontSize: 12.5, fontWeight: 500, color: '#64748B', fontFamily: FF },
    statMeta: { display: 'flex', alignItems: 'center', gap: 5, paddingTop: 10, borderTop: '1px solid #F1F5F9' },

    tableCard: { backgroundColor: '#fff', borderRadius: 4, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15,23,42,0.05)', overflow: 'hidden' },
    tableHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #F1F5F9', backgroundColor: '#FAFAFA', flexWrap: 'wrap', gap: 10 },
    cardAccent: { width: 3, height: 16, borderRadius: 4, backgroundColor: '#7B2D8B', flexShrink: 0 },
    cardTitle: { fontSize: 12.5, fontWeight: 700, color: '#0F172A', fontFamily: FF, textTransform: 'uppercase', letterSpacing: '0.5px' },
    periodTag: { fontSize: 11, fontWeight: 600, color: '#7B2D8B', backgroundColor: '#F3E5F5', padding: '2px 8px', borderRadius: 4, fontFamily: FF },
    td: { padding: '13px 18px', fontSize: 13.5, color: '#475569', fontFamily: FF, borderBottom: '1px solid #F8FAFC' },
};
