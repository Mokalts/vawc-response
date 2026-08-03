import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as faceapi from 'face-api.js';
import api from '../api/api';

// ─── Font injection ───────────────────────────────────────────────────────────
if (!document.getElementById('vawc-font')) {
    const l = document.createElement('link');
    l.id = 'vawc-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
if (!document.getElementById('vawc-verify-css')) {
    const s = document.createElement('style');
    s.id = 'vawc-verify-css';
    s.textContent = `
        @keyframes spin     { to { transform: rotate(360deg); } }
        @keyframes scanLine {
            0%   { top: 20%; opacity: 0.8; }
            50%  { top: 75%; opacity: 1;   }
            100% { top: 20%; opacity: 0.8; }
        }
        @keyframes slideUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse    { 0%,100%{box-shadow:0 0 0 0 rgba(123,45,139,0.4)} 70%{box-shadow:0 0 0 10px rgba(123,45,139,0)} }
        @keyframes fadeIn   { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        .verify-btn { transition: all 0.18s ease !important; }
        .verify-btn:hover:not([disabled]) { background: #A34D0D !important; transform: translateY(-1px); box-shadow: 0 6px 16px rgba(196,94,16,0.35) !important; }
        .verify-modal-btn { transition: all 0.15s ease !important; }
        .verify-modal-btn:hover { transform: translateY(-1px); }
    `;
    document.head.appendChild(s);
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const IconFace = ({ size = 22, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.8" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <line x1="9" y1="10" x2="9.01" y2="10" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="15" y1="10" x2="15.01" y2="10" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
);
const IconShield = ({ size = 22, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 12l2 2 4-4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
const IconX = ({ size = 22, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.8" />
        <path d="M15 9l-6 6M9 9l6 6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
);
const IconRefresh = ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
const IconBack = ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M19 12H5M12 5l-7 7 7 7" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// ─── Liveness constants ───────────────────────────────────────────────────────
// NOTE: blink detection was removed - see git history. Browser webcams have
// frame rates and landmark precision too low to reliably detect blinks. Head
// turn alone still defeats photo spoofing (a printed face can't rotate).
const LIVENESS_DURATION = 10;       // seconds per attempt
const MAX_LIVENESS_ATTEMPTS = 3;    // before forcing return to login
const TURN_THRESHOLD = 0.16;        // nose-from-face-center offset (~16% of face width)

function FaceVerify() {
    const navigate = useNavigate();
    const videoRef = useRef(null);
    const overlayRef = useRef(null);
    const animRef = useRef(null);

    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [status, setStatus] = useState('Loading face recognition models…');
    const [ready, setReady] = useState(false);
    const [popup, setPopup] = useState(null);

    // ── Liveness state ────────────────────────────────────────────────────────
    const [phase, setPhase] = useState('idle');                  // 'idle' | 'liveness' | 'capturing'
    const [livenessTimeLeft, setLivenessTimeLeft] = useState(0);
    const [livenessAttempts, setLivenessAttempts] = useState(0);
    const [turnLeftDone, setTurnLeftDone] = useState(false);
    const [turnRightDone, setTurnRightDone] = useState(false);

    // Refs for real-time tracking (avoid stale state inside RAF loop)
    const livenessLoopRef = useRef(null);
    const livenessTimerRef = useRef(null);
    const livenessRef = useRef({ turnLeft: false, turnRight: false, done: false });

    // ── Oval overlay ──────────────────────────────────────────────────────────
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
            ctx.fillText('Face detected \u2713', cx, cy + ry + 22);
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
            } catch (_) { }
            animRef.current = requestAnimationFrame(detect);
        };
        animRef.current = requestAnimationFrame(detect);
    }, [drawOverlay]);

    // ── Load models + camera ──────────────────────────────────────────────────
    useEffect(() => {
        const load = async () => {
            try {
                await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
                await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
                await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
                setModelsLoaded(true);
                setStatus('Camera ready. Click Verify Face when ready.');
                startLiveDetection();
            } catch {
                setPopup({ type: 'error', message: 'Failed to load face models. Please refresh the page.' });
            }
        };
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (videoRef.current) videoRef.current.srcObject = stream;
                setTimeout(() => setReady(true), 3000);
            } catch {
                setPopup({ type: 'error', message: 'Camera access denied. Please allow camera permissions and refresh.' });
            }
        };
        startCamera();
        load();
        return () => {
            if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop());
            if (animRef.current) cancelAnimationFrame(animRef.current);
        };
    }, [startLiveDetection]);

    // ── Liveness loop ─────────────────────────────────────────────────────────
    const stopLivenessLoop = useCallback(() => {
        if (livenessLoopRef.current) { cancelAnimationFrame(livenessLoopRef.current); livenessLoopRef.current = null; }
        if (livenessTimerRef.current) { clearInterval(livenessTimerRef.current); livenessTimerRef.current = null; }
    }, []);

    const runLivenessLoop = useCallback(() => {
        livenessRef.current = { turnLeft: false, turnRight: false, done: false };
        const loop = async () => {
            if (livenessRef.current.done) return;
            if (!videoRef.current || videoRef.current.readyState < 2) {
                livenessLoopRef.current = requestAnimationFrame(loop);
                return;
            }
            try {
                const d = await faceapi
                    .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                    .withFaceLandmarks();
                if (d) {
                    drawOverlay(1);
                    const lm = d.landmarks;
                    const noseTip = lm.getNose()[3];
                    const box = d.detection.box;
                    const centerX = box.x + box.width / 2;
                    const offset = (noseTip.x - centerX) / box.width;
                    if (offset > TURN_THRESHOLD && !livenessRef.current.turnLeft) {
                        livenessRef.current.turnLeft = true;
                        setTurnLeftDone(true);
                    }
                    if (offset < -TURN_THRESHOLD && !livenessRef.current.turnRight) {
                        livenessRef.current.turnRight = true;
                        setTurnRightDone(true);
                    }
                    if (livenessRef.current.turnLeft && livenessRef.current.turnRight) {
                        livenessRef.current.done = true;
                        onLivenessPassed();
                        return;
                    }
                } else {
                    drawOverlay(0);
                }
            } catch (_) { }
            livenessLoopRef.current = requestAnimationFrame(loop);
        };
        livenessLoopRef.current = requestAnimationFrame(loop);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [drawOverlay]);

    // After liveness passes → silently capture descriptor + verify (existing flow)
    const onLivenessPassed = useCallback(async () => {
        stopLivenessLoop();
        setPhase('capturing');
        setVerifying(true);
        setStatus('Liveness confirmed. Verifying your face…');
        try {
            const detection = await faceapi.detectSingleFace(videoRef.current).withFaceLandmarks().withFaceDescriptor();
            if (!detection) {
                setVerifying(false);
                setPhase('idle');
                setStatus('Click Verify Face to try again.');
                startLiveDetection();
                setPopup({ type: 'error', message: 'Could not read face data clearly. Ensure your face is well-lit and centered.' });
                return;
            }
            const descriptor = Array.from(detection.descriptor);
            await api.post('/admin/auth/verify-face', { descriptor });
            localStorage.setItem('face_verified', 'true');
            setPopup({ type: 'success', message: 'Identity verified successfully. Redirecting to your dashboard…' });
            setTimeout(() => {
                if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop());
                navigate('/dashboard');
            }, 1800);
        } catch (err) {
            setVerifying(false);
            setPhase('idle');
            setStatus('Click Verify Face to try again.');
            startLiveDetection();
            const msg = err.response?.data?.detail || 'Verification failed. Please try again.';
            setPopup({ type: 'error', message: typeof msg === 'string' ? msg : 'Verification failed. Please try again.' });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate, startLiveDetection, stopLivenessLoop]);

    // Liveness timeout / failure
    const onLivenessFailed = useCallback(() => {
        stopLivenessLoop();
        setPhase('idle');
        const next = livenessAttempts + 1;
        setLivenessAttempts(next);
        if (next >= MAX_LIVENESS_ATTEMPTS) {
            setStatus('Liveness check failed too many times.');
            setPopup({ type: 'error', message: 'Liveness check failed multiple times. For your security, please return to login and try again.' });
        } else {
            setStatus(`Liveness check timed out. ${MAX_LIVENESS_ATTEMPTS - next} attempt${MAX_LIVENESS_ATTEMPTS - next === 1 ? '' : 's'} left.`);
            startLiveDetection();
        }
    }, [livenessAttempts, startLiveDetection, stopLivenessLoop]);

    // ── Verify ────────────────────────────────────────────────────────────────
    const handleVerify = async () => {
        if (!modelsLoaded || verifying || phase !== 'idle') return;

        const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }));
        if (detections.length === 0) {
            setPopup({ type: 'error', message: 'No face detected. Make sure your face is clearly visible inside the oval and lighting is adequate.' });
            return;
        }
        if (detections.length > 1) {
            setPopup({ type: 'error', message: `Multiple faces detected (${detections.length}). Only 1 face is allowed. Please ensure you are alone in the frame.` });
            return;
        }

        // ── Start liveness challenge (head turn only) ────────────────────────
        setTurnLeftDone(false);
        setTurnRightDone(false);
        setPhase('liveness');
        setLivenessTimeLeft(LIVENESS_DURATION);
        setStatus('Please turn your head left, then right.');
        if (animRef.current) cancelAnimationFrame(animRef.current);
        runLivenessLoop();
        livenessTimerRef.current = setInterval(() => {
            setLivenessTimeLeft(t => {
                if (t <= 1) {
                    onLivenessFailed();
                    return 0;
                }
                return t - 1;
            });
        }, 1000);
    };

    const handleBack = () => {
        if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop());
        if (animRef.current) cancelAnimationFrame(animRef.current);
        stopLivenessLoop();
        localStorage.removeItem('face_verified');
        localStorage.removeItem('admin_user');
        navigate('/');
    };

    const closePopup = () => {
        setPopup(null);
        if (!verifying && phase === 'idle') startLiveDetection();
    };

    const cancelLiveness = () => {
        stopLivenessLoop();
        setPhase('idle');
        setStatus('Click Verify Face when ready.');
        startLiveDetection();
    };

    return (
        <div style={S.page}>
            <div style={S.card}>

                {/* Header */}
                <div style={S.header}>
                    <div style={S.logoWrap}>
                        <IconFace size={22} color="#9B4DAB" />
                    </div>
                    <div>
                        <h1 style={S.title}>Face Verification</h1>
                        <p style={S.subtitle}>Step 2 of 2 - Confirm your identity</p>
                    </div>
                </div>

                {/* Lighting / positioning tip */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#FFF3E0', border: '1.5px solid #FFCC99', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontFamily: "'DM Sans', sans-serif" }}>
                    <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: '#F47920', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="4" stroke="#fff" strokeWidth="2" />
                            <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </span>
                    <div>
                        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: '#9A3412' }}>
                            For best results:
                        </p>
                        <p style={{ margin: '1px 0 0', fontSize: 12.5, color: '#7C2D12', lineHeight: 1.5 }}>
                            Ensure your face is <strong>well-lit</strong> and <strong>facing the camera directly</strong>. Remove glasses or hats if scan keeps failing.
                        </p>
                    </div>
                </div>

                {/* Camera */}
                <div style={S.cameraWrap}>
                    <video ref={videoRef} autoPlay muted style={S.video} />
                    <canvas ref={overlayRef} width={640} height={480} style={S.overlayCanvas} />

                    {verifying && (
                        <div style={S.scanWrap}>
                            <div style={S.scanLine} />
                        </div>
                    )}

                    {!ready && (
                        <div style={S.warmingOverlay}>
                            <div style={S.warmingSpinner} />
                            <p style={S.warmingText}>Warming up camera…</p>
                        </div>
                    )}
                </div>

                {/* Status */}
                <p style={S.status}>{status}</p>

                {/* ── Liveness challenge panel ── */}
                {phase === 'liveness' && (
                    <div style={{ background: '#F3E5F5', border: '2px solid #9B4DAB', borderRadius: 10, padding: '14px 16px', marginBottom: 12, fontFamily: "'DM Sans', sans-serif", animation: 'fadeIn 0.2s ease' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#4A1259', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                Liveness Check
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: livenessTimeLeft <= 3 ? '#C62828' : '#7B2D8B', background: '#fff', padding: '2px 10px', borderRadius: 9999, border: `1.5px solid ${livenessTimeLeft <= 3 ? '#FECACA' : '#E1BEE7'}` }}>
                                {livenessTimeLeft}s
                            </span>
                        </div>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#4A1259', lineHeight: 1.35 }}>
                            Turn your head left, then right
                        </p>
                        <p style={{ margin: '3px 0 10px', fontSize: 12, color: '#6B2078' }}>
                            Slowly rotate your head to each side, keeping your face in frame.
                        </p>
                        {/* Progress chips */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 9999, background: turnLeftDone ? '#2E7D32' : '#fff', color: turnLeftDone ? '#fff' : '#7B2D8B', border: `1.5px solid ${turnLeftDone ? '#2E7D32' : '#E1BEE7'}`, fontSize: 12, fontWeight: 700 }}>
                                {turnLeftDone ? '✓' : '○'} Turn Left
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 9999, background: turnRightDone ? '#2E7D32' : '#fff', color: turnRightDone ? '#fff' : '#7B2D8B', border: `1.5px solid ${turnRightDone ? '#2E7D32' : '#E1BEE7'}`, fontSize: 12, fontWeight: 700 }}>
                                {turnRightDone ? '✓' : '○'} Turn Right
                            </span>
                        </div>
                    </div>
                )}

                {/* Verify / Cancel button */}
                {phase === 'liveness' ? (
                    <button
                        type="button"
                        onClick={cancelLiveness}
                        style={{ ...S.verifyBtn, backgroundColor: '#fff', color: '#7B2D8B', border: '1.5px solid #E1BEE7', boxShadow: 'none' }}
                    >
                        Cancel liveness check
                    </button>
                ) : (
                    <button
                        className="verify-btn"
                        style={{ ...S.verifyBtn, opacity: (!modelsLoaded || verifying || !ready) ? 0.6 : 1 }}
                        onClick={handleVerify}
                        disabled={!modelsLoaded || verifying || !ready}
                    >
                        {verifying ? (
                            <>
                                <span style={S.spinner} />
                                Verifying…
                            </>
                        ) : !ready ? (
                            <>
                                <span style={S.spinner} />
                                Camera warming up…
                            </>
                        ) : (
                            <>
                                <IconFace size={16} color="#fff" />
                                Verify Face
                            </>
                        )}
                    </button>
                )}

                {/* Back link */}
                <button style={S.backBtn} onClick={handleBack}>
                    <IconBack size={13} color="#94A3B8" />
                    Back to Login
                </button>

                {/* ── TEMPORARY BYPASS - remove when camera is working ── */}
                {/* ── TEMPORARY BYPASS - remove when camera is working ── */}
                <button
                    onClick={async () => {
                        try {
                            await api.post('/admin/auth/skip-verify');
                            localStorage.setItem('face_verified', 'true');
                            if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop());
                            navigate('/dashboard');
                        } catch {
                            localStorage.setItem('face_verified', 'true');
                            navigate('/dashboard');
                        }
                    }}
                    style={{ marginTop: 8, width: '100%', padding: '10px 0', borderRadius: 4, border: '1.5px dashed #E1BEE7', background: 'transparent', color: '#9B4DAB', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                >
                    Skip Face Verification (Temporary)
                </button>
            </div>

            {/* Result popup */}
            {popup && (
                <div style={S.backdrop}>
                    <div style={S.modal}>

                        {/* Icon */}
                        <div style={{ ...S.modalIconWrap, backgroundColor: popup.type === 'success' ? '#ECFDF5' : '#FFF1F2' }}>
                            {popup.type === 'success'
                                ? <IconShield size={28} color="#059669" />
                                : <IconX size={28} color="#E11D48" />
                            }
                        </div>

                        <h2 style={{ ...S.modalTitle, color: popup.type === 'success' ? '#059669' : '#BE123C' }}>
                            {popup.type === 'success' ? 'Verified' : 'Verification Failed'}
                        </h2>
                        <p style={S.modalMsg}>{popup.message}</p>

                        {popup.type === 'error' && (
                            <div style={{ background: '#FFF3E0', border: '1.5px solid #FFCC99', borderRadius: 8, padding: '10px 12px', margin: '4px 0 14px', fontFamily: "'DM Sans', sans-serif" }}>
                                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: '#9A3412' }}>Tips before retrying</p>
                                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#7C2D12', lineHeight: 1.5 }}>
                                    Move to a brighter spot, face the camera directly, and keep your full face inside the oval. Remove glasses or face coverings.
                                </p>
                            </div>
                        )}

                        {popup.type === 'error' && (
                            <div style={S.modalBtns}>
                                <button
                                    className="verify-modal-btn"
                                    style={S.retryBtn}
                                    onClick={closePopup}
                                >
                                    <IconRefresh size={14} color="#fff" />
                                    Try Again
                                </button>
                                <button
                                    className="verify-modal-btn"
                                    style={S.returnBtn}
                                    onClick={handleBack}
                                >
                                    <IconBack size={14} color="#7B2D8B" />
                                    Return to Sign In
                                </button>
                            </div>
                        )}

                        {popup.type === 'success' && (
                            <div style={S.successLoader}>
                                <div style={S.successLoaderBar} />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

const S = {
    page: { minHeight: '100vh', backgroundColor: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: "'DM Sans', sans-serif" },
    card: { backgroundColor: '#fff', borderRadius: 12, padding: '32px', width: '100%', maxWidth: '480px', boxShadow: '0 4px 24px rgba(15,23,42,0.09)', border: '1px solid #E2E8F0' },

    header: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' },
    logoWrap: { width: '48px', height: '48px', borderRadius: 4, backgroundColor: '#F3E5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    title: { fontSize: '18px', fontWeight: '700', color: '#0F172A', marginBottom: '3px', fontFamily: "'DM Sans', sans-serif" },
    subtitle: { fontSize: '12.5px', color: '#94A3B8', fontFamily: "'DM Sans', sans-serif" },

    cameraWrap: { position: 'relative', width: '100%', aspectRatio: '4/3', backgroundColor: '#0F172A', borderRadius: 4, overflow: 'hidden', marginBottom: '16px' },
    video: { width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' },
    overlayCanvas: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' },

    scanWrap: { position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' },
    scanLine: { position: 'absolute', left: '10%', right: '10%', height: '2px', backgroundColor: '#9B4DAB', boxShadow: '0 0 10px #9B4DAB, 0 0 20px rgba(123,45,139,0.5)', animation: 'scanLine 2s ease-in-out infinite' },

    warmingOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(15,23,42,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' },
    warmingSpinner: { width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
    warmingText: { fontSize: '13px', fontWeight: '500', color: 'rgba(255,255,255,0.7)', fontFamily: "'DM Sans', sans-serif" },

    status: { fontSize: '13px', color: '#64748B', textAlign: 'center', marginBottom: '16px', lineHeight: '1.5', fontFamily: "'DM Sans', sans-serif" },

    verifyBtn: { width: '100%', padding: '13px', backgroundColor: '#9B4DAB', color: '#fff', fontSize: '14.5px', fontWeight: '600', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 2px 8px rgba(123,45,139,0.25)', marginBottom: '12px', fontFamily: "'DM Sans', sans-serif" },
    spinner: { width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block', flexShrink: 0 },

    backBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', padding: '10px 0', backgroundColor: 'transparent', color: '#94A3B8', fontSize: '13px', fontWeight: '500', border: '1.5px solid #E2E8F0', borderRadius: 10, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },

    // Modal
    backdrop: { position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' },
    modal: { backgroundColor: '#fff', borderRadius: 16, padding: '32px 28px', width: '100%', maxWidth: '360px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', animation: 'slideUp 0.2s ease' },
    modalIconWrap: { width: '64px', height: '64px', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' },
    modalTitle: { fontSize: '20px', fontWeight: '700', marginBottom: '10px', fontFamily: "'DM Sans', sans-serif" },
    modalMsg: { fontSize: '13.5px', color: '#64748B', lineHeight: '1.65', marginBottom: '22px', fontFamily: "'DM Sans', sans-serif" },

    modalBtns: { display: 'flex', flexDirection: 'column', gap: '10px' },
    retryBtn: { width: '100%', padding: '12px', backgroundColor: '#9B4DAB', color: '#fff', fontSize: '14px', fontWeight: '600', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', fontFamily: "'DM Sans', sans-serif" },
    returnBtn: { width: '100%', padding: '12px', backgroundColor: 'transparent', color: '#7B2D8B', fontSize: '14px', fontWeight: '600', border: '1.5px solid #E1BEE7', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', fontFamily: "'DM Sans', sans-serif" },

    successLoader: { height: '4px', backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
    successLoaderBar: { height: '100%', backgroundColor: '#059669', borderRadius: 4, animation: 'slideUp 1.8s linear forwards', width: '100%' },
};

export default FaceVerify;
