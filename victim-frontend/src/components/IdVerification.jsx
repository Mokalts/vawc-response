import React, { useState } from 'react';
import api from '../api';
import axios from 'axios';

// Sending an ID so the barangay can confirm the account belongs to a real
// person. REQUIRED before the system will take a report.
//
// The card is blunt about that, and about the wait, because the alternative is
// a woman writing out the worst night of her life and only then being told the
// system will not accept it. It also points at the hotlines, which need no
// account and no officer on duty, since for someone in danger tonight that is
// the answer and this form is not.
//
// It says the photograph is deleted once an officer has checked it, because
// that is what someone hesitating over handing across an ID wants to know.
const IdVerification = ({ profile, onUpdated }) => {
    const [file, setFile] = useState(null);
    const [idType, setIdType] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const status = profile.id_status || 'none';

    const submit = async () => {
        if (!file || !idType.trim()) { setErr('Pick an ID and say what it is.'); return; }
        setBusy(true); setErr('');
        try {
            const body = new FormData();
            body.append('id_type', idType.trim());
            body.append('file', file);
            await api.post('/users/me/id-document', body);
            setFile(null); setIdType('');
            onUpdated();
        } catch (e) {
            setErr(e.response?.data?.detail || 'Could not send that. Please try again.');
        } finally { setBusy(false); }
    };

    const banner = {
        approved: { bg:'#ECFDF5', bd:'#6EE7B7', fg:'#065F46', text:'Verified. You can file a report.' },
        pending:  { bg:'#EFF6FF', bd:'#93C5FD', fg:'#1E40AF', text:'Sent. The desk will check it. You can file a report once it is approved.' },
        rejected: { bg:'#FEF2F2', bd:'#FECACA', fg:'#991B1B', text: profile.id_reject_reason || 'Not accepted. You can send another.' },
    }[status];

    return (
        <div style={ST.card}>
            <div style={ST.section}>
                <p style={ST.sectionTitle}>Identity verification</p>
                <p style={{ margin:0, fontSize:13, lineHeight:1.6, color:'var(--text-muted)', fontFamily:"'Lexend', sans-serif" }}>
                    The barangay checks your ID before you can file a report. This keeps fake reports out of
                    the desk's records. Any ID will do, and the photo is deleted as soon as an officer has
                    checked it.
                </p>
                <p style={{ margin:0, fontSize:12.5, lineHeight:1.6, color:'#92400E', backgroundColor:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:8, padding:'9px 11px', fontFamily:"'Lexend', sans-serif" }}>
                    If you are in danger right now, do not wait for this. Call 911 or the hotlines on the home
                    screen. They do not need an account.
                </p>

                {banner && (
                    <div style={{ backgroundColor:banner.bg, border:`1px solid ${banner.bd}`, borderRadius:8, padding:'10px 12px' }}>
                        <p style={{ margin:0, fontSize:13, fontWeight:600, color:banner.fg, lineHeight:1.5, fontFamily:"'Lexend', sans-serif" }}>
                            {banner.text}
                        </p>
                        {status === 'approved' && profile.id_type && (
                            <p style={{ margin:'3px 0 0', fontSize:12, color:banner.fg, opacity:0.85, fontFamily:"'Lexend', sans-serif" }}>{profile.id_type}</p>
                        )}
                    </div>
                )}

                {(status === 'none' || status === 'rejected') && (
                    <>
                        <input
                            type="text"
                            value={idType}
                            onChange={e => { setIdType(e.target.value); setErr(''); }}
                            placeholder="Anong ID ito? e.g. Barangay ID, PhilSys, Driver's License"
                            style={{ width:'100%', boxSizing:'border-box', border:'1px solid var(--border)', borderRadius:8, padding:'11px 12px', fontSize:14, fontFamily:"'Lexend', sans-serif", color:'var(--text)', background:'var(--surface-alt)', outline:'none' }}
                        />
                        <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/heic"
                            onChange={e => { setFile(e.target.files?.[0] || null); setErr(''); }}
                            style={{ fontSize:13, fontFamily:"'Lexend', sans-serif", color:'var(--text-body)' }}
                        />
                        {err && <p style={{ margin:0, fontSize:12.5, color:'#B91C1C', fontFamily:"'Lexend', sans-serif" }}>{err}</p>}
                        <button
                            onClick={submit}
                            disabled={busy || !file || !idType.trim()}
                            style={{ padding:'11px 0', borderRadius:8, border:'none', background:(busy || !file || !idType.trim()) ? 'var(--border)' : '#C45E10', color:(busy || !file || !idType.trim()) ? 'var(--text-muted)' : '#fff', fontSize:14, fontWeight:700, cursor:(busy || !file || !idType.trim()) ? 'not-allowed' : 'pointer', fontFamily:"'Lexend', sans-serif" }}>
                            {busy ? 'Sending…' : 'Send ID for checking'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

/**
 * Sending an ID when there is no session to send it with.
 *
 * Sign-in is refused until a barangay officer approves the ID, so the upload on
 * the sign-in screen has no logged-in user behind it. The server hands back a
 * token that opens this one endpoint and nothing else; it is held in memory for
 * the life of the screen and never stored, because it is not a session.
 *
 * Raw axios rather than the shared client: that client's interceptor overwrites
 * Authorization with whatever token is in localStorage, which at a refused
 * sign-in is either absent or stale, and either way not the one that works.
 */
export function IdUpload({ token, onSent }) {
    const [file, setFile] = useState(null);
    const [idType, setIdType] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');

    const submit = async () => {
        if (!file || !idType.trim()) { setErr('Pick an ID and say what it is.'); return; }
        setBusy(true); setErr('');
        try {
            const body = new FormData();
            body.append('id_type', idType.trim());
            body.append('file', file);
            await axios.post(
                (process.env.REACT_APP_API_URL || 'http://localhost:8000') + '/users/me/id-document',
                body,
                { headers: { Authorization: `Bearer ${token}` } },
            );
            onSent();
        } catch (e) {
            setErr(e.response?.data?.detail || 'Could not send that. Please try again.');
        } finally { setBusy(false); }
    };

    const ready = file && idType.trim() && !busy;
    return (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <input type="text" value={idType} onChange={e => { setIdType(e.target.value); setErr(''); }}
                placeholder="Anong ID ito? e.g. Barangay ID, PhilSys"
                style={{ width:'100%', boxSizing:'border-box', border:'1px solid var(--border)', borderRadius:8, padding:'11px 12px', fontSize:14, fontFamily:"'Lexend', sans-serif", color:'var(--text)', background:'var(--surface-alt)', outline:'none' }} />
            <input type="file" accept="image/jpeg,image/png,image/webp,image/heic"
                onChange={e => { setFile(e.target.files?.[0] || null); setErr(''); }}
                style={{ fontSize:13, fontFamily:"'Lexend', sans-serif", color:'var(--text-body)' }} />
            {err && <p style={{ margin:0, fontSize:12.5, color:'#B91C1C', fontFamily:"'Lexend', sans-serif" }}>{err}</p>}
            <button onClick={submit} disabled={!ready}
                style={{ padding:'11px 0', borderRadius:8, border:'none', background: ready ? '#C45E10' : 'var(--border)', color: ready ? '#fff' : 'var(--text-muted)', fontSize:14, fontWeight:700, cursor: ready ? 'pointer' : 'not-allowed', fontFamily:"'Lexend', sans-serif" }}>
                {busy ? 'Sending…' : 'Send ID'}
            </button>
        </div>
    );
}

const ST = {
    card:         { backgroundColor:'var(--surface)', borderRadius: 12, overflow:'hidden', border:'1px solid var(--border)', boxShadow:'0 2px 12px rgba(244,121,32,0.06)' },
    section:      { padding:'16px 18px', display:'flex', flexDirection:'column', gap:14 },
    sectionTitle: { fontSize:10.5, fontWeight:700, color:'var(--accent-text)', textTransform:'uppercase', letterSpacing:'0.7px', fontFamily:"'Lexend', sans-serif" },
};

export default IdVerification;
