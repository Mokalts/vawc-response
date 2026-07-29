import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavbar from '../components/BottomNavbar';
import api from '../api';

if (!document.getElementById('vawc-font')) {
    const l = document.createElement('link'); l.id = 'vawc-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}
if (!document.getElementById('vawc-myreports-css')) {
    const s = document.createElement('style'); s.id = 'vawc-myreports-css';
    s.textContent = `
        @keyframes fadeUp  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes popIn   { from{opacity:0;transform:scale(0.95) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:0.45} }
        .vmr-card { transition: transform 0.15s ease, box-shadow 0.15s ease; cursor: pointer; }
        .vmr-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(244,121,32,0.12) !important; }
        .vmr-card:active { transform: scale(0.99); }
        .vmr-close:hover { background-color: #F1F5F9 !important; }
        .vmr-btn { transition: all 0.15s ease; }
        .vmr-btn:hover:not([disabled]) { opacity: 0.9; transform: translateY(-1px); }
        .vmr-del-btn:hover { background-color: #FFF1F2 !important; border-color: #FECDD3 !important; }
    `;
    document.head.appendChild(s);
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const IcoDoc = ({ c = '#CBD5E1', size = 48 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoX = ({ c = '#64748B', size = 18 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke={c} strokeWidth="2" strokeLinecap="round" /></svg>);
const IcoPin = ({ c = '#94A3B8' }) => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="10" r="3" stroke={c} strokeWidth="1.8" /></svg>);
const IcoImg = ({ c = '#94A3B8' }) => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke={c} strokeWidth="1.8" /><circle cx="8.5" cy="8.5" r="1.5" stroke={c} strokeWidth="1.8" /><path d="M21 15l-5-5L5 21" stroke={c} strokeWidth="1.8" strokeLinecap="round" /></svg>);
const IcoArr = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#F47920" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoWarn = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#BE123C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><line x1="12" y1="9" x2="12" y2="13" stroke="#BE123C" strokeWidth="1.8" strokeLinecap="round" /><line x1="12" y1="17" x2="12.01" y2="17" stroke="#BE123C" strokeWidth="2.4" strokeLinecap="round" /></svg>);
const IcoTrash = ({ c = '#BE123C' }) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M10 11v6M14 11v6" stroke={c} strokeWidth="2" strokeLinecap="round" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoInfo = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#92400E" strokeWidth="1.8" /><line x1="12" y1="8" x2="12" y2="12" stroke="#92400E" strokeWidth="1.8" strokeLinecap="round" /><line x1="12" y1="16" x2="12.01" y2="16" stroke="#92400E" strokeWidth="2.4" strokeLinecap="round" /></svg>);
const IcoBell = ({ c = '#F47920' }) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoUser = ({ c = '#94A3B8' }) => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={c} strokeWidth="1.8" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={c} strokeWidth="1.8" strokeLinecap="round" /></svg>);
const IcoCal = ({ c = '#94A3B8' }) => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke={c} strokeWidth="1.8" /><path d="M16 2v4M8 2v4M3 10h18" stroke={c} strokeWidth="1.8" strokeLinecap="round" /></svg>);

// ─── Status config (new values) ───────────────────────────────────────────────
const STATUS_MAP = {
    'submitted': { label: 'Submitted', bg: '#F1F5F9', color: '#475569', dot: '#94A3B8' },
    'awaiting_onsite_visit': { label: 'Awaiting Onsite Visit', bg: '#FFFBEB', color: '#92400E', dot: '#F59E0B' },
    'under_process': { label: 'Under Process', bg: '#ECFEFF', color: '#0E7490', dot: '#06B6D4' },
    'summon_issued': { label: 'Summon Letter Issued', bg: '#F3E5F5', color: '#7B2D8B', dot: '#9B4DAB' },
    'summon_acknowledged': { label: 'Summon Acknowledged', bg: '#F0FDF4', color: '#166534', dot: '#22C55E' },
    'resolved': { label: 'Resolved', bg: '#ECFDF5', color: '#065F46', dot: '#059669' },
    'referred_to_police': { label: 'Referred to Authorities', bg: '#FFF3E0', color: '#C45E10', dot: '#F47920' },
};

const getSt = (s) => STATUS_MAP[s] || { label: s || 'Unknown', bg: '#F1F5F9', color: '#475569', dot: '#94A3B8' };
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '';

// Status timeline steps in order
const STATUS_STEPS = [
    { key: 'submitted', label: 'Submitted' },
    { key: 'awaiting_onsite_visit', label: 'Awaiting Onsite Visit' },
    { key: 'under_process', label: 'Under Process' },
    { key: 'summon_issued', label: 'Summon Letter Issued' },
    { key: 'summon_acknowledged', label: 'Summon Acknowledged' },
    { key: 'resolved', label: 'Resolved' },
];
const REFERRED_KEY = 'referred_to_police';

const DELETE_REASONS = [
    { id: 'alter', label: 'I need to alter my report' },
    { id: 'unneeded', label: 'No longer needed' },
    { id: 'resolved', label: 'Resolved privately' },
    { id: 'mistake', label: 'Filed by mistake' },
    { id: 'other', label: 'Other' },
];

// ─── Skeleton ──────────────────────────────────────────────────────────────────
const Skel = () => (
    <div style={{ ...S.card, cursor: 'default' }}>
        {[['60%', 12], ['100%', 11], ['75%', 11]].map(([w, h], i) => (
            <div key={i} style={{ width: w, height: h, borderRadius: 4, backgroundColor: '#F1F5F9', marginBottom: i < 2 ? 10 : 0, animation: 'shimmer 1.2s infinite' }} />
        ))}
    </div>
);

// ─── Status Timeline ──────────────────────────────────────────────────────────
function StatusTimeline({ currentStatus }) {
    const isReferred = currentStatus === REFERRED_KEY;
    const steps = isReferred
        ? [...STATUS_STEPS.slice(0, 3), { key: REFERRED_KEY, label: 'Referred to Authorities' }]
        : STATUS_STEPS;

    const currentIdx = steps.findIndex(s => s.key === currentStatus);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {steps.map((step, idx) => {
                const done = idx < currentIdx || (idx === currentIdx);
                const current = idx === currentIdx;
                return (
                    <div key={step.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                            <div style={{
                                width: 22, height: 22, borderRadius: '50%',
                                background: current ? '#F47920' : done ? '#059669' : '#E2E8F0',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: current ? '2px solid #C45E10' : 'none',
                            }}>
                                {done && !current && <svg width="10" height="10" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-9" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                {current && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
                            </div>
                            {idx < steps.length - 1 && (
                                <div style={{ width: 2, height: 20, background: done && idx < currentIdx ? '#059669' : '#E2E8F0', marginTop: 2 }} />
                            )}
                        </div>
                        <p style={{
                            margin: '2px 0 18px',
                            fontSize: 13,
                            fontWeight: current ? 700 : 500,
                            color: current ? '#F47920' : done ? '#059669' : '#94A3B8',
                            fontFamily: "'DM Sans',sans-serif",
                        }}>
                            {step.label}
                            {current && <span style={{ marginLeft: 6, fontSize: 10.5, background: '#FFF3E0', color: '#F47920', padding: '2px 7px', borderRadius: 9999, fontWeight: 700 }}>Current</span>}
                        </p>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Report Card ──────────────────────────────────────────────────────────────
function ReportCard({ report, onClick, onDelete }) {
    const st = getSt(report.status);
    const isSubmitted = report.status === 'submitted';
    return (
        <div className="vmr-card"
            style={{ ...S.card, border: report.has_status_update ? '1.5px solid #F47920' : '1px solid #FFE4CC' }}
            onClick={onClick}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {report.has_status_update && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                            <span style={{ width: 7, height: 7, borderRadius: 4, background: '#F47920', flexShrink: 0 }} />
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#F47920', fontFamily: "'DM Sans',sans-serif" }}>Status Updated</span>
                        </div>
                    )}
                    <p style={S.cardDate}>{fmtDate(report.created_at)}</p>
                    <p style={S.cardTime}>{fmtTime(report.created_at)}</p>
                </div>
                <span style={{ ...S.badge, backgroundColor: st.bg, color: st.color }}>
                    <span style={{ width: 6, height: 6, borderRadius: 4, backgroundColor: st.dot, flexShrink: 0 }} />
                    {st.label}
                </span>
            </div>

            {/* Offender + incident date chips */}
            {(report.offender_name || report.incident_date) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {report.offender_name && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#475569', background: '#F8FAFC', borderRadius: 4, padding: '3px 8px', border: '1px solid #E2E8F0', fontFamily: "'DM Sans',sans-serif" }}>
                            <IcoUser /> {report.offender_name}
                        </span>
                    )}
                    {report.incident_date && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#475569', background: '#F8FAFC', borderRadius: 4, padding: '3px 8px', border: '1px solid #E2E8F0', fontFamily: "'DM Sans',sans-serif" }}>
                            <IcoCal /> {fmtDate(report.incident_date)}
                        </span>
                    )}
                </div>
            )}

            <p style={S.excerpt}>
                {(report.statement?.length || 0) > 110 ? report.statement.slice(0, 110) + '…' : report.statement}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {report.address && (
                        <span style={S.meta}><IcoPin /> {report.address.length > 28 ? report.address.slice(0, 28) + '…' : report.address}</span>
                    )}
                    {(report.photo_urls?.length > 0) && (
                        <span style={S.meta}><IcoImg /> {report.photo_urls.length} photo{report.photo_urls.length > 1 ? 's' : ''}</span>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {isSubmitted && (
                        <button className="vmr-btn vmr-del-btn" style={S.deleteBtn}
                            onClick={(e) => { e.stopPropagation(); onDelete(report); }}>
                            <IcoTrash /> Delete
                        </button>
                    )}
                    <span style={S.viewLink}>View details <IcoArr /></span>
                </div>
            </div>
        </div>
    );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ report, onClose, onDelete }) {
    const st = getSt(report.status);
    return (
        <div style={S.backdrop} onClick={onClose}>
            <div style={S.modal} onClick={e => e.stopPropagation()}>
                <div style={S.modalHead}>
                    <div>
                        <p style={S.modalTitle}>Report Details</p>
                        <p style={{ margin: 0, fontSize: 12, color: '#94A3B8', fontFamily: "'DM Sans',sans-serif" }}>
                            Filed {fmtDate(report.created_at)} at {fmtTime(report.created_at)}
                        </p>
                    </div>
                    <button className="vmr-close" style={S.closeBtn} onClick={onClose}><IcoX /></button>
                </div>
                <div style={S.modalBody}>
                    {/* Status update notice */}
                    {report.has_status_update && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', backgroundColor: '#FFF3E0', borderRadius: 4, padding: '11px 13px', border: '1px solid #FFE4CC' }}>
                            <IcoBell />
                            <p style={{ fontSize: 13, color: '#C45E10', lineHeight: 1.6, margin: 0, fontFamily: "'DM Sans',sans-serif" }}>
                                The barangay has updated your case status.
                            </p>
                        </div>
                    )}

                    {/* Status + Timeline */}
                    <div style={S.detailItem}>
                        <p style={S.detailLabel}>Case Status</p>
                        <span style={{ ...S.badge, backgroundColor: st.bg, color: st.color, marginBottom: 14 }}>
                            <span style={{ width: 6, height: 6, borderRadius: 4, backgroundColor: st.dot, flexShrink: 0 }} />
                            {st.label}
                        </span>
                        <StatusTimeline currentStatus={report.status} />
                    </div>

                    {/* Offender */}
                    {report.offender_name && (
                        <div style={S.detailItem}>
                            <p style={S.detailLabel}>Offender Name</p>
                            <p style={S.detailValue}>{report.offender_name}</p>
                        </div>
                    )}

                    {/* Incident date */}
                    {report.incident_date && (
                        <div style={S.detailItem}>
                            <p style={S.detailLabel}>Date of Incident</p>
                            <p style={S.detailValue}>{fmtDate(report.incident_date)}</p>
                        </div>
                    )}

                    {/* Incident type */}
                    {report.incident_type && (
                        <div style={S.detailItem}>
                            <p style={S.detailLabel}>Incident Type</p>
                            <p style={S.detailValue}>{report.incident_type}</p>
                        </div>
                    )}

                    {/* Statement */}
                    <div style={S.detailItem}>
                        <p style={S.detailLabel}>Your Statement</p>
                        <p style={S.detailValue}>{report.statement}</p>
                    </div>

                    {/* Location */}
                    {report.address && (
                        <div style={S.detailItem}>
                            <p style={S.detailLabel}>Location</p>
                            <p style={S.detailValue}>{report.address}</p>
                        </div>
                    )}

                    {/* Photos */}
                    {(report.photo_urls?.length > 0) && (
                        <div style={S.detailItem}>
                            <p style={S.detailLabel}>Attached Photos ({report.photo_urls.length})</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                                {report.photo_urls.map((url, i) => (
                                    <a key={i} href={url} target="_blank" rel="noreferrer">
                                        <img src={url} alt={`Evidence ${i + 1}`} style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 4, border: '1px solid #E2E8F0' }} />
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Confidentiality notice */}
                    <div style={S.noteBox}>
                        <IcoInfo />
                        <p style={S.noteText}>
                            Your report is encrypted and confidential. Only authorized barangay VAWC officers can view this information.
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                        {report.status === 'submitted' && (
                            <button className="vmr-btn" style={{ ...S.closeFullBtn, flex: 'unset', padding: '13px 16px', backgroundColor: '#FFF1F2', color: '#BE123C', fontSize: 13 }}
                                onClick={() => { onClose(); onDelete(report); }}>
                                <IcoTrash c="#BE123C" /> Delete
                            </button>
                        )}
                        <button className="vmr-btn" style={S.closeFullBtn} onClick={onClose}>Close</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────
function DeleteModal({ report, onClose, onDeleted }) {
    const [reason, setReason] = useState('');
    const [custom, setCustom] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState('');

    const handleDelete = async () => {
        if (!reason) { setError('Please select a reason.'); return; }
        setDeleting(true);
        setError('');
        try {
            const finalReason = reason === 'other' ? (custom.trim() || 'Other') : DELETE_REASONS.find(r => r.id === reason)?.label;
            await api.delete(`/reports/${report.id}/`, { data: { reason: finalReason } });
            onDeleted(report.id);
        } catch {
            setError('Failed to delete. Please try again.');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div style={S.backdrop} onClick={onClose}>
            <div style={{ ...S.modal, maxWidth: 380 }} onClick={e => e.stopPropagation()}>
                <div style={S.modalHead}>
                    <p style={{ ...S.modalTitle, color: '#BE123C' }}>Delete Report</p>
                    <button className="vmr-close" style={S.closeBtn} onClick={onClose}><IcoX /></button>
                </div>
                <div style={S.modalBody}>
                    <div style={S.noteBox}>
                        <IcoInfo />
                        <p style={S.noteText}>
                            Deleted reports can only be recovered by the barangay VAWC officer within 30 days.
                        </p>
                    </div>
                    <p style={{ fontSize: 13.5, color: '#475569', margin: 0, fontFamily: "'DM Sans',sans-serif" }}>
                        Why are you deleting this report?
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {DELETE_REASONS.map(r => (
                            <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 4, border: `1.5px solid ${reason === r.id ? '#F47920' : '#E2E8F0'}`, background: reason === r.id ? '#FFF3E0' : '#fff', cursor: 'pointer', fontSize: 13.5, color: '#0F172A', fontFamily: "'DM Sans',sans-serif", transition: 'all 0.12s' }}>
                                <input type="radio" name="del-reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} style={{ accentColor: '#F47920' }} />
                                {r.label}
                            </label>
                        ))}
                    </div>
                    {reason === 'other' && (
                        <textarea
                            placeholder="Please specify…"
                            value={custom}
                            onChange={e => setCustom(e.target.value)}
                            style={{ width: '100%', minHeight: 80, padding: '10px 12px', borderRadius: 4, border: '1.5px solid #E2E8F0', fontSize: 13.5, color: '#0F172A', fontFamily: "'DM Sans',sans-serif", resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
                        />
                    )}
                    {error && (
                        <div style={S.errorBox}>
                            <IcoWarn />
                            <p style={{ margin: 0, fontSize: 13, color: '#BE123C', fontFamily: "'DM Sans',sans-serif" }}>{error}</p>
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button className="vmr-btn" style={{ ...S.closeFullBtn, backgroundColor: '#F1F5F9', color: '#475569' }} onClick={onClose}>Cancel</button>
                        <button className="vmr-btn" style={{ ...S.closeFullBtn, backgroundColor: '#BE123C' }} disabled={deleting} onClick={handleDelete}>
                            {deleting ? 'Deleting…' : 'Confirm Delete'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function MyReports() {
    const navigate = useNavigate();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selected, setSelected] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);

    useEffect(() => {
        const fetchReports = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await api.get('/reports/');
                setReports(res.data);
            } catch {
                setError('Failed to load your reports. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        fetchReports();
    }, []);

    const dismissUpdate = async (reportId) => {
        try {
            await api.post(`/reports/${reportId}/mark-read/`);
            setReports(prev => prev.map(r => r.id === reportId ? { ...r, has_status_update: false } : r));
        } catch { }
    };

    const handleDeleted = (reportId) => {
        setReports(prev => prev.filter(r => r.id !== reportId));
        setDeleteTarget(null);
    };

    const newCount = reports.filter(r => r.has_status_update).length;

    return (
        <div style={S.page}>
            {/* Top bar */}
            <header style={S.topBar}>
                <div>
                    <p style={S.title}>My Reports</p>
                    <p style={S.count}>{reports.length} total{newCount > 0 ? ` · ${newCount} updated` : ''}</p>
                </div>
                {newCount > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 4, background: '#FFF3E0', color: '#F47920', fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans',sans-serif", border: '1px solid #FFE4CC' }}>
                        <IcoBell /> {newCount} update{newCount > 1 ? 's' : ''}
                    </span>
                )}
            </header>

            <main style={S.content}>
                {error && (
                    <div style={S.errorBox}>
                        <IcoWarn />
                        <p style={{ margin: 0, fontSize: 13, color: '#BE123C', fontFamily: "'DM Sans',sans-serif" }}>{error}</p>
                    </div>
                )}

                {loading && [1, 2, 3].map(i => <Skel key={i} />)}

                {!loading && !error && reports.length === 0 && (
                    <div style={S.empty}>
                        <IcoDoc />
                        <p style={S.emptyTitle}>No reports yet</p>
                        <p style={S.emptyText}>You haven't submitted any reports. Tap below to file one.</p>
                        <button className="vmr-btn" style={S.emptyBtn} onClick={() => navigate('/report')}>
                            Submit a Report
                        </button>
                    </div>
                )}

                {!loading && reports.map(r => (
                    <ReportCard
                        key={r.id}
                        report={r}
                        onClick={() => { setSelected(r); if (r.has_status_update) dismissUpdate(r.id); }}
                        onDelete={(rep) => setDeleteTarget(rep)}
                    />
                ))}
            </main>

            {selected && (
                <DetailModal
                    report={selected}
                    onClose={() => setSelected(null)}
                    onDelete={(rep) => { setSelected(null); setDeleteTarget(rep); }}
                />
            )}

            {deleteTarget && (
                <DeleteModal
                    report={deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    onDeleted={handleDeleted}
                />
            )}

            <BottomNavbar active="reports" />
        </div>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
    page: { minHeight: '100vh', backgroundColor: '#FFF3E0', display: 'flex', flexDirection: 'column', paddingBottom: 80, fontFamily: "'DM Sans',sans-serif" },
    topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', backgroundColor: '#fff', borderBottom: '1px solid #FFE4CC', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 8px rgba(244,121,32,0.06)' },
    title: { fontSize: 18, fontWeight: 800, color: '#C45E10', fontFamily: "'DM Sans',sans-serif", margin: '0 0 2px' },
    count: { fontSize: 12.5, fontWeight: 600, color: '#94A3B8', fontFamily: "'DM Sans',sans-serif", margin: 0 },
    content: { padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 },
    errorBox: { display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 8, padding: '12px 15px' },
    card: { backgroundColor: '#fff', borderRadius: 12, padding: '18px 16px', boxShadow: '0 2px 10px rgba(244,121,32,0.06)', border: '1px solid #FFE4CC', animation: 'fadeUp 0.2s ease' },
    cardDate: { fontSize: 13.5, fontWeight: 700, color: '#0F172A', margin: '0 0 2px', fontFamily: "'DM Sans',sans-serif" },
    cardTime: { fontSize: 11.5, color: '#94A3B8', fontFamily: "'DM Sans',sans-serif", margin: 0 },
    badge: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 4, fontFamily: "'DM Sans',sans-serif", whiteSpace: 'nowrap' },
    excerpt: { fontSize: 14, color: '#475569', lineHeight: 1.55, marginBottom: 12, fontFamily: "'DM Sans',sans-serif" },
    meta: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#94A3B8', fontFamily: "'DM Sans',sans-serif" },
    viewLink: { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12.5, fontWeight: 700, color: '#F47920', fontFamily: "'DM Sans',sans-serif" },
    deleteBtn: { display: 'inline-flex', alignItems: 'center', gap: 5, background: '#fff', border: '1px solid #FFE4CC', borderRadius: 4, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, color: '#BE123C', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: 'all 0.12s' },
    empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '60px 24px', gap: 10 },
    emptyTitle: { fontSize: 18, fontWeight: 700, color: '#C45E10', fontFamily: "'DM Sans',sans-serif" },
    emptyText: { fontSize: 14, color: '#94A3B8', lineHeight: 1.6, fontFamily: "'DM Sans',sans-serif", maxWidth: 280 },
    emptyBtn: { marginTop: 8, padding: '13px 28px', backgroundColor: '#F47920', color: '#fff', fontSize: 15, fontWeight: 600, border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", boxShadow: '0 2px 8px rgba(244,121,32,0.25)' },
    backdrop: { position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, backdropFilter: 'blur(3px)', padding: '20px 16px', animation: 'fadeIn 0.18s ease' },
    modal: { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(15,23,42,0.2)', animation: 'popIn 0.22s ease' },
    modalHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px 14px', borderBottom: '1px solid #F1F5F9', flexShrink: 0 },
    modalBody: { overflowY: 'auto', padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: 12 },
    modalTitle: { fontSize: 17, fontWeight: 800, color: '#C45E10', fontFamily: "'DM Sans',sans-serif", margin: 0 },
    closeBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    detailItem: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: '14px 15px', border: '1px solid #E2E8F0' },
    detailLabel: { fontSize: 10.5, fontWeight: 700, color: '#C45E10', textTransform: 'uppercase', letterSpacing: '0.7px', margin: '0 0 6px', fontFamily: "'DM Sans',sans-serif" },
    detailValue: { fontSize: 14.5, color: '#0F172A', lineHeight: 1.6, margin: 0, fontFamily: "'DM Sans',sans-serif" },
    noteBox: { display: 'flex', gap: 8, alignItems: 'flex-start', backgroundColor: '#FFFBEB', borderRadius: 4, padding: '11px 13px', border: '1px solid #FDE68A' },
    noteText: { fontSize: 13, color: '#92400E', lineHeight: 1.6, margin: 0, fontFamily: "'DM Sans',sans-serif" },
    closeFullBtn: { flex: 1, padding: 13, backgroundColor: '#F47920', color: '#fff', fontSize: 15, fontWeight: 600, border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
};

export default MyReports;
