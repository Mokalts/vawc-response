import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as faceapi from 'face-api.js';
import api from '../api/api';

const CAPTURE_COUNT = 15;

// ─── Font injection ───────────────────────────────────────────────────────────
if (!document.getElementById('vawc-font')) {
    const l = document.createElement('link');
    l.id = 'vawc-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
if (!document.getElementById('vawc-enroll-css')) {
    const s = document.createElement('style');
    s.id = 'vawc-enroll-css';
    s.textContent = `
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:0.6} }
        @keyframes slideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scanLine {
            0%   { top: 20%; opacity: 0.8; }
            50%  { top: 75%; opacity: 1;   }
            100% { top: 20%; opacity: 0.8; }
        }
        .enroll-start-btn { transition: all 0.18s ease !important; }
        .enroll-start-btn:hover:not([disabled]) { background: #A34D0D !important; transform: translateY(-1px); box-shadow: 0 6px 16px rgba(196,94,16,0.35) !important; }
        .enroll-save-btn  { transition: all 0.18s ease !important; }
        .enroll-save-btn:hover:not([disabled])  { background: #047857 !important; transform: translateY(-1px); }
    `;
    document.head.appendChild(s);
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const IconCamera  = ({ size = 20, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="12" cy="13" r="4" stroke={color} strokeWidth="1.8"/>
    </svg>
);
const IconCheck   = ({ size = 20, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);
const IconShield  = ({ size = 20, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);
const IconSun     = ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="5" stroke={color} strokeWidth="1.8"/>
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
);
const IconEye     = ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.8"/>
    </svg>
);
const IconUser    = ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.8"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
);
const IconGlasses = ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M2 12h2M20 12h2M7 12a3 3 0 100 6 3 3 0 000-6zM17 12a3 3 0 100 6 3 3 0 000-6zM10 15h4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

function FaceEnroll() {
    const navigate  = useNavigate();
    const videoRef  = useRef(null);
    const overlayRef= useRef(null);
    const animRef   = useRef(null);

    const [modelsLoaded,  setModelsLoaded]  = useState(false);
    const [capturing,     setCapturing]     = useState(false);
    const [capturedCount, setCapturedCount] = useState(0);
    const [descriptors,   setDescriptors]   = useState([]);
    const [status,        setStatus]        = useState('Loading face recognition models…');
    const [error,         setError]         = useState('');
    const [done,          setDone]          = useState(false);
    const [saving,        setSaving]        = useState(false);

    // ── Oval overlay ─────────────────────────────────────────────────────────
    const drawOverlay = useCallback((count) => {
        const canvas = overlayRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        const cx = w / 2, cy = h / 2;
        const rx = w * 0.33, ry = h * 0.44;

        ctx.clearRect(0, 0, w, h);
        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.52)';
        ctx.fill('evenodd');

        const borderColor = count === 1 ? '#10B981' : '#9B4DAB';
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2.5;
        ctx.setLineDash(count === 1 ? [] : [8, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = 'bold 12px DM Sans, system-ui, sans-serif';
        ctx.textAlign = 'center';
        if (count === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.fillText('Position your face in the oval', cx, cy + ry + 22);
        } else if (count > 1) {
            ctx.fillStyle = '#FCA5A5';
            ctx.fillText('Only 1 face allowed in frame', cx, cy + ry + 22);
        } else {
            ctx.fillStyle = '#10B981';
            ctx.fillText('Face detected ✓', cx, cy + ry + 22);
        }
    }, []);

    useEffect(() => {
        const canvas = overlayRef.current;
        if (canvas) drawOverlay(0);
    }, [drawOverlay]);

    // ── Live detection ────────────────────────────────────────────────────────
    const startLiveDetection = useCallback(() => {
        if (animRef.current) cancelAnimationFrame(animRef.current);
        const detect = async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) {
                animRef.current = requestAnimationFrame(detect); return;
            }
            try {
                const d = await faceapi.detectAllFaces(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }));
                drawOverlay(d.length);
            } catch (_) {}
            animRef.current = requestAnimationFrame(detect);
        };
        animRef.current = requestAnimationFrame(detect);
    }, [drawOverlay]);

    // ── Load models + camera ──────────────────────────────────────────────────
    useEffect(() => {
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (videoRef.current) videoRef.current.srcObject = stream;
            } catch {
                setError('Camera access denied. Please allow camera permissions and refresh.');
            }
        };
        const load = async () => {
            try {
                await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
                await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
                await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
                setModelsLoaded(true);
                setStatus('Camera ready. Position your face and click Start Capture.');
                startLiveDetection();
            } catch {
                setError('Failed to load face recognition models. Please refresh.');
            }
        };
        startCamera();
        load();
        return () => {
            if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop());
            if (animRef.current) cancelAnimationFrame(animRef.current);
        };
    }, [startLiveDetection]);

    // ── Capture ───────────────────────────────────────────────────────────────
    const startCapture = async () => {
        if (!modelsLoaded) return;
        setCapturing(true); setError('');
        const collected = [];

        for (let i = 0; i < CAPTURE_COUNT; i++) {
            setStatus(`Capturing photo ${i + 1} of ${CAPTURE_COUNT}…`);
            await new Promise(r => setTimeout(r, 500));

            const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }));
            if (detections.length === 0) {
                setError(`No face detected on photo ${i + 1}. Keep your face inside the oval.`);
                setCapturing(false); return;
            }
            if (detections.length > 1) {
                setError(`Multiple faces detected. Only 1 face allowed during enrollment.`);
                setCapturing(false); return;
            }

            const detection = await faceapi.detectSingleFace(videoRef.current).withFaceLandmarks().withFaceDescriptor();
            if (!detection) {
                setError(`Could not read face on photo ${i + 1}. Please try again.`);
                setCapturing(false); return;
            }
            collected.push(Array.from(detection.descriptor));
            setCapturedCount(i + 1);
        }

        setDescriptors(collected);
        setCapturing(false);
        setDone(true);
        setStatus('All photos captured! Click Save Face to complete enrollment.');
        if (animRef.current) cancelAnimationFrame(animRef.current);
        if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    };

    const saveFace = async () => {
        if (descriptors.length === 0) return;
        setSaving(true); setError('');
        try {
            const avg = descriptors[0].map((_, i) =>
                descriptors.reduce((sum, d) => sum + d[i], 0) / descriptors.length
            );
            await api.post('/admin/auth/enroll-face', { descriptor: avg });
            localStorage.setItem('face_verified', 'true');
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to save face data. Please try again.');
            setSaving(false);
        }
    };

    const progress = Math.round((capturedCount / CAPTURE_COUNT) * 100);

    return (
        <div style={S.page}>
            <div style={S.card}>

                {/* Header */}
                <div style={S.header}>
                    <div style={S.logoWrap}>
                        <IconCamera size={22} color="#9B4DAB" />
                    </div>
                    <div>
                        <h1 style={S.title}>Face Enrollment</h1>
                        <p style={S.subtitle}>Step 2 of 2 - Set up your face for authentication</p>
                    </div>
                </div>

                {/* Tips */}
                <div style={S.tipsGrid}>
                    {[
                        { icon: <IconSun size={14} color="#D97706" />,    text: 'Good lighting, face well lit' },
                        { icon: <IconEye size={14} color="#9B4DAB" />,    text: 'Look directly at the camera' },
                        { icon: <IconUser size={14} color="#059669" />,   text: 'Only one face in frame' },
                        { icon: <IconGlasses size={14} color="#7B2D8B" />,text: 'Remove glasses if possible' },
                    ].map((t, i) => (
                        <div key={i} style={S.tip}>
                            <span style={S.tipIcon}>{t.icon}</span>
                            <span style={S.tipText}>{t.text}</span>
                        </div>
                    ))}
                </div>

                {/* Camera */}
                <div style={S.cameraWrap}>
                    <video ref={videoRef} autoPlay muted style={S.video} />
                    <canvas ref={overlayRef} width={640} height={480} style={S.overlayCanvas} />

                    {/* Capturing scan line */}
                    {capturing && (
                        <div style={S.scanLineWrap}>
                            <div style={S.scanLine} />
                        </div>
                    )}

                    {/* Done overlay */}
                    {done && (
                        <div style={S.doneOverlay}>
                            <div style={S.doneCircle}>
                                <IconCheck size={32} color="#fff" />
                            </div>
                            <p style={S.doneText}>Capture Complete</p>
                        </div>
                    )}
                </div>

                {/* Progress bar */}
                {capturedCount > 0 && (
                    <div style={S.progressWrap}>
                        <div style={S.progressTrack}>
                            <div style={{ ...S.progressFill, width: `${progress}%` }} />
                        </div>
                        <div style={S.progressRow}>
                            <span style={S.progressLabel}>{capturedCount} of {CAPTURE_COUNT} photos captured</span>
                            <span style={S.progressPct}>{progress}%</span>
                        </div>
                    </div>
                )}

                {/* Status */}
                <p style={S.status}>{status}</p>

                {/* Error */}
                {error && (
                    <div style={S.errorBox}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#BE123C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                            <line x1="12" y1="9" x2="12" y2="13" stroke="#BE123C" strokeWidth="1.8" strokeLinecap="round"/>
                            <line x1="12" y1="17" x2="12.01" y2="17" stroke="#BE123C" strokeWidth="2.4" strokeLinecap="round"/>
                        </svg>
                        <p style={S.errorText}>{error}</p>
                    </div>
                )}

                {/* Action buttons */}
                {!done ? (
                    <button
                        className="enroll-start-btn"
                        style={{ ...S.primaryBtn, opacity: (capturing || !modelsLoaded) ? 0.65 : 1 }}
                        onClick={startCapture}
                        disabled={capturing || !modelsLoaded}
                    >
                        {capturing ? (
                            <>
                                <span style={S.spinner} />
                                Capturing {capturedCount}/{CAPTURE_COUNT}…
                            </>
                        ) : (
                            <>
                                <IconCamera size={16} color="#fff" />
                                Start Capture
                            </>
                        )}
                    </button>
                ) : (
                    <button
                        className="enroll-save-btn"
                        style={{ ...S.primaryBtn, background: saving ? '#047857' : '#059669', opacity: saving ? 0.75 : 1 }}
                        onClick={saveFace}
                        disabled={saving}
                    >
                        {saving ? (
                            <>
                                <span style={S.spinner} />
                                Saving…
                            </>
                        ) : (
                            <>
                                <IconShield size={16} color="#fff" />
                                Save Face & Continue
                            </>
                        )}
                    </button>
                )}

                <p style={S.footerNote}>
                    Your face data is encrypted and stored securely. It is only used to verify your identity on login.
                </p>
            </div>
        </div>
    );
}

const S = {
    page:          { minHeight: '100vh', backgroundColor: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: "'DM Sans', sans-serif" },
    card:          { backgroundColor: '#fff', borderRadius: 12, padding: '32px', width: '100%', maxWidth: '480px', boxShadow: '0 4px 24px rgba(15,23,42,0.09)', border: '1px solid #E2E8F0' },

    header:        { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' },
    logoWrap:      { width: '48px', height: '48px', borderRadius: 4, backgroundColor: '#F3E5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    title:         { fontSize: '18px', fontWeight: '700', color: '#0F172A', marginBottom: '3px', fontFamily: "'DM Sans', sans-serif" },
    subtitle:      { fontSize: '12.5px', color: '#94A3B8', fontFamily: "'DM Sans', sans-serif" },

    tipsGrid:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' },
    tip:           { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: 4, border: '1px solid #F1F5F9' },
    tipIcon:       { flexShrink: 0, display: 'flex', alignItems: 'center' },
    tipText:       { fontSize: '11.5px', color: '#475569', fontFamily: "'DM Sans', sans-serif" },

    cameraWrap:    { position: 'relative', width: '100%', aspectRatio: '4/3', backgroundColor: '#0F172A', borderRadius: 4, overflow: 'hidden', marginBottom: '16px' },
    video:         { width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' },
    overlayCanvas: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' },

    scanLineWrap:  { position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' },
    scanLine:      { position: 'absolute', left: '10%', right: '10%', height: '2px', backgroundColor: '#9B4DAB', boxShadow: '0 0 10px #9B4DAB, 0 0 20px rgba(123,45,139,0.5)', animation: 'scanLine 2s ease-in-out infinite' },

    doneOverlay:   { position: 'absolute', inset: 0, backgroundColor: 'rgba(5,150,105,0.75)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' },
    doneCircle:    { width: '64px', height: '64px', borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    doneText:      { fontSize: '15px', fontWeight: '700', color: '#fff', fontFamily: "'DM Sans', sans-serif" },

    progressWrap:  { marginBottom: '12px' },
    progressTrack: { height: '6px', backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginBottom: '6px' },
    progressFill:  { height: '100%', backgroundColor: '#9B4DAB', borderRadius: 4, transition: 'width 0.3s ease' },
    progressRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    progressLabel: { fontSize: '12px', color: '#64748B', fontFamily: "'DM Sans', sans-serif" },
    progressPct:   { fontSize: '12px', fontWeight: '700', color: '#9B4DAB', fontFamily: "'DM Sans', sans-serif" },

    status:        { fontSize: '13px', color: '#64748B', textAlign: 'center', marginBottom: '16px', lineHeight: '1.5', fontFamily: "'DM Sans', sans-serif" },

    errorBox:      { display: 'flex', alignItems: 'flex-start', gap: '8px', backgroundColor: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 8, padding: '10px 13px', marginBottom: '14px' },
    errorText:     { fontSize: '12.5px', color: '#BE123C', lineHeight: '1.5', fontFamily: "'DM Sans', sans-serif" },

    primaryBtn:    { width: '100%', padding: '13px', backgroundColor: '#9B4DAB', color: '#fff', fontSize: '14.5px', fontWeight: '600', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 2px 8px rgba(123,45,139,0.25)', marginBottom: '16px', fontFamily: "'DM Sans', sans-serif" },
    spinner:       { width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block', flexShrink: 0 },

    footerNote:    { textAlign: 'center', fontSize: '11.5px', color: '#CBD5E1', lineHeight: '1.6', fontFamily: "'DM Sans', sans-serif" },
};

export default FaceEnroll;
