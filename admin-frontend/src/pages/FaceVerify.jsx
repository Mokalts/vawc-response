import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as faceapi from 'face-api.js';
import api from '../api/api';
import { drawFaceGuide, evaluateFraming, guideState } from '../components/FaceGuide';

// ─── Font injection ───────────────────────────────────────────────────────────
if (!document.getElementById('vawc-font')) {
    const l = document.createElement('link');
    l.id = 'vawc-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
if (!document.getElementById('vawc-verify-css')) {
    const s = document.createElement('style');
    s.id = 'vawc-verify-css';
    s.textContent = `
        @keyframes spin     { to { transform: rotate(360deg); } }
        @keyframes scanLine {
            0%   { top: 18%; opacity: 0.75; }
            50%  { top: 78%; opacity: 1;    }
            100% { top: 18%; opacity: 0.75; }
        }
        @keyframes slideUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn   { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes nudgeL   { 0%,100%{transform:translateX(0);opacity:0.45} 50%{transform:translateX(-5px);opacity:1} }
        @keyframes nudgeR   { 0%,100%{transform:translateX(0);opacity:0.45} 50%{transform:translateX(5px);opacity:1} }
        .fv-btn { transition: background-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease; }
        .fv-btn:hover:not([disabled]) { transform: translateY(-1px); }
        .fv-primary:hover:not([disabled]) { background: #A34D0D !important; box-shadow: 0 6px 16px rgba(196,94,16,0.30) !important; }
        .fv-ghost:hover { background: var(--adm-muted) !important; }
        .fv-nudge-l { animation: nudgeL 1.1s ease-in-out infinite; }
        .fv-nudge-r { animation: nudgeR 1.1s ease-in-out infinite; }
        /* Motion here is decoration on top of a security step; anyone who has
           asked their system to calm animations should not get a pulsing frame. */
        @media (prefers-reduced-motion: reduce) {
            .fv-scan, .fv-nudge-l, .fv-nudge-r { animation: none !important; }
        }
    `;
    document.head.appendChild(s);
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const IconFace = ({ size = 22, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M12 3a5 5 0 015 5v1a5 5 0 01-10 0V8a5 5 0 015-5z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
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
const IconChevron = ({ dir = 'left', size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ transform: dir === 'right' ? 'scaleX(-1)' : 'none' }}>
        <path d="M15 5l-7 7 7 7" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
const IconTick = ({ size = 13, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// ─── Liveness constants ───────────────────────────────────────────────────────
// NOTE: blink detection was removed - see git history. Browser webcams have
// frame rates and landmark precision too low to reliably detect blinks. Head
// turn alone still defeats photo spoofing (a printed face can't rotate).
const LIVENESS_DURATION = 10;       // seconds per attempt
const MAX_LIVENESS_ATTEMPTS = 3;    // before forcing return to login
const MAX_MATCH_FAILS = 3;          // non-matching faces before forcing a re-login

// After the turns, give the head time to come back to centre before the frame
// that actually gets compared is taken. Capturing on the instant the second turn
// registers means comparing a three-quarter view against a forward-facing
// enrolment, which is a poor match even when it is the right person.
const SETTLE_SECONDS = 3;
const SETTLE_GRACE = 5;             // extra seconds to wait for a straight view
const STRAIGHT_OFFSET = 0.08;       // nose within 8% of face centre = facing forward
const TURN_THRESHOLD = 0.16;        // nose-from-face-center offset (~16% of face width)

// What the live guide says. One line, plain language, tied to what the camera
// can actually see right now.
// "Face detected" is not the same as "framed correctly": the detector finds a
// face anywhere in the frame, including in a corner. These messages are driven
// by where the face actually sits against the outline.
const GUIDE_TEXT = {
    idle:      { text: 'Fit your head and shoulders inside the outline', tone: 'neutral' },
    searching: { text: 'No face detected yet. Fit your head and shoulders in the outline', tone: 'neutral' },
    ok:        { text: 'Good. Your face is in the outline', tone: 'good' },
    multi:     { text: 'More than one person is in frame. Only you should be visible', tone: 'warn' },
    busy:      { text: 'Hold still', tone: 'neutral' },
    far:       { text: 'Move closer to the camera', tone: 'warn' },
    near:      { text: 'Move back a little', tone: 'warn' },
    left:      { text: 'Move a little to your left', tone: 'warn' },
    right:     { text: 'Move a little to your right', tone: 'warn' },
    up:        { text: 'Raise your face into the outline', tone: 'warn' },
    down:      { text: 'Lower your face into the outline', tone: 'warn' },
};

const TIPS = [
    'Face a window or lamp, not away from it',
    'Hold the camera at eye level',
    'Remove hats, sunglasses or a face covering',
];

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
    const [phase, setPhase] = useState('idle');                  // 'idle' | 'liveness' | 'settle' | 'capturing'
    const [livenessTimeLeft, setLivenessTimeLeft] = useState(0);
    const [livenessAttempts, setLivenessAttempts] = useState(0);
    // Repeated non-matches are either bad conditions or someone trying faces.
    // Either way, stop after a few and send them back to sign in. A ref, not
    // state: it is read inside a memoised callback, where state would be stale.
    const matchFailsRef = useRef(0);
    const [turnLeftDone, setTurnLeftDone] = useState(false);
    const [turnRightDone, setTurnRightDone] = useState(false);

    // ── Settle state (between the turns and the capture) ──────────────────────
    const [settleLeft, setSettleLeft] = useState(0);
    const [settleStraight, setSettleStraight] = useState(false);

    // Refs for real-time tracking (avoid stale state inside RAF loop)
    const livenessLoopRef = useRef(null);
    const livenessTimerRef = useRef(null);
    const livenessRef = useRef({ turnLeft: false, turnRight: false, done: false });
    const settleLoopRef = useRef(null);
    const settleTimerRef = useRef(null);
    const settleRef = useRef({ captureAt: 0, deadline: 0, straight: false, done: false });

    // ── Guide overlay ─────────────────────────────────────────────────────────
    // The guide is redrawn every animation frame, but React only hears about it
    // when the state actually changes: re-rendering the page 60 times a second
    // to retype the same sentence would make the camera stutter.
    const guideRef = useRef('idle');
    const [guide, setGuide] = useState('idle');

    const setGuideKey = useCallback((key, outline) => {
        drawFaceGuide(overlayRef.current, outline);
        if (guideRef.current !== key) {
            guideRef.current = key;
            setGuide(key);
        }
    }, []);

    // Outline only, by face count. Used during the liveness challenge, where the
    // band is showing turn instructions and framing hints would fight with them.
    const drawOverlay = useCallback((count, busy = false) => {
        setGuideKey(count === 0 ? 'searching' : count > 1 ? 'multi' : 'ok',
                    guideState(count, { state: 'ok' }, busy));
    }, [setGuideKey]);

    // Outline AND message, measured against the guide.
    const drawFramed = useCallback((detections) => {
        const video = videoRef.current;
        const count = detections.length;
        const framing = (count === 1 && video)
            ? evaluateFraming(detections[0].box, video.videoWidth, video.videoHeight)
            : null;
        const key = count === 0 ? 'searching' : count > 1 ? 'multi' : framing.state;
        setGuideKey(key, guideState(count, framing));
    }, [setGuideKey]);

    useEffect(() => {
        if (overlayRef.current) drawFaceGuide(overlayRef.current, 'idle');
    }, []);

    // ── Live detection ────────────────────────────────────────────────────────
    const startLiveDetection = useCallback(() => {
        if (animRef.current) cancelAnimationFrame(animRef.current);
        const detect = async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) {
                animRef.current = requestAnimationFrame(detect); return;
            }
            try {
                const d = await faceapi.detectAllFaces(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }));
                drawFramed(d);
            } catch (_) { }
            animRef.current = requestAnimationFrame(detect);
        };
        animRef.current = requestAnimationFrame(detect);
    }, [drawFramed]);

    // ── Load models + camera ──────────────────────────────────────────────────
    useEffect(() => {
        const load = async () => {
            try {
                await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
                await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
                await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
                setModelsLoaded(true);
                setStatus('Ready when you are.');
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
                        startSettle();   // let the head come back to centre first
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

    const stopSettleLoop = useCallback(() => {
        if (settleLoopRef.current) { cancelAnimationFrame(settleLoopRef.current); settleLoopRef.current = null; }
        if (settleTimerRef.current) { clearInterval(settleTimerRef.current); settleTimerRef.current = null; }
    }, []);

    /**
     * The pause between the turns and the capture.
     *
     * Counts down from SETTLE_SECONDS while the person straightens up, then
     * takes the frame as soon as they are facing forward and inside the guide.
     * The countdown alone is not enough — someone slow to turn back would still
     * be captured mid-turn — so the straightness test is what actually gates it,
     * with the countdown as the visible cue and SETTLE_GRACE as the backstop.
     */
    const startSettle = useCallback(() => {
        stopLivenessLoop();
        const now = Date.now();
        settleRef.current = {
            captureAt: now + SETTLE_SECONDS * 1000,
            deadline:  now + (SETTLE_SECONDS + SETTLE_GRACE) * 1000,
            straight:  false,
            done:      false,
        };
        setPhase('settle');
        setSettleLeft(SETTLE_SECONDS);
        setSettleStraight(false);
        setStatus('Face the camera again.');

        settleTimerRef.current = setInterval(() => {
            setSettleLeft(t => (t > 0 ? t - 1 : 0));
        }, 1000);

        const loop = async () => {
            if (settleRef.current.done) return;
            const video = videoRef.current;
            if (!video || video.readyState < 2) {
                settleLoopRef.current = requestAnimationFrame(loop);
                return;
            }
            try {
                const d = await faceapi
                    .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                    .withFaceLandmarks();

                let straight = false;
                if (d) {
                    const box = d.detection.box;
                    const noseTip = d.landmarks.getNose()[3];
                    const offset = (noseTip.x - (box.x + box.width / 2)) / box.width;
                    const framing = evaluateFraming(box, video.videoWidth, video.videoHeight);
                    straight = Math.abs(offset) < STRAIGHT_OFFSET && framing.state === 'ok';
                    setGuideKey(straight ? 'ok' : 'adjust', straight ? 'ok' : 'adjust');
                } else {
                    setGuideKey('searching', 'searching');
                }

                if (straight !== settleRef.current.straight) {
                    settleRef.current.straight = straight;
                    setSettleStraight(straight);
                }

                const t = Date.now();
                if (straight && t >= settleRef.current.captureAt) {
                    settleRef.current.done = true;
                    stopSettleLoop();
                    onLivenessPassed();
                    return;
                }
                if (t > settleRef.current.deadline) {
                    settleRef.current.done = true;
                    stopSettleLoop();
                    setPhase('idle');
                    setStatus('Ready when you are.');
                    startLiveDetection();
                    setPopup({
                        type: 'error',
                        message: 'Could not get a clear straight-on view after the head turns. '
                               + 'Face the camera directly, then start the check again.',
                    });
                    return;
                }
            } catch (_) { }
            settleLoopRef.current = requestAnimationFrame(loop);
        };
        settleLoopRef.current = requestAnimationFrame(loop);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setGuideKey, startLiveDetection, stopLivenessLoop, stopSettleLoop]);

    // Straight-on again → capture the descriptor and verify.
    const onLivenessPassed = useCallback(async () => {
        stopLivenessLoop();
        stopSettleLoop();
        setPhase('capturing');
        setVerifying(true);
        setStatus('Liveness confirmed. Checking your face…');
        drawFaceGuide(overlayRef.current, 'busy');
        try {
            const detection = await faceapi.detectSingleFace(videoRef.current).withFaceLandmarks().withFaceDescriptor();
            if (!detection) {
                setVerifying(false);
                setPhase('idle');
                setStatus('Ready when you are.');
                startLiveDetection();
                setPopup({ type: 'error', message: 'Could not read face data clearly. Ensure your face is well-lit and centered.' });
                return;
            }
            const descriptor = Array.from(detection.descriptor);
            await api.post('/admin/auth/verify-face', { descriptor });
            localStorage.setItem('face_verified', 'true');
            setPopup({ type: 'success', message: 'Identity verified. Taking you to your dashboard…' });
            setTimeout(() => {
                if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop());
                navigate('/dashboard');
            }, 1800);
        } catch (err) {
            setVerifying(false);
            setPhase('idle');
            const msg = err.response?.data?.detail || 'Verification failed. Please try again.';
            const noMatch = err.response?.status === 401;
            if (noMatch) matchFailsRef.current += 1;
            const fails = matchFailsRef.current;

            if (noMatch && fails >= MAX_MATCH_FAILS) {
                setStatus('Face check failed too many times.');
                setPopup({
                    type: 'error',
                    message: 'The face check failed several times. For security, please sign in again. '
                           + 'If this keeps happening, ask a Super Admin to reset your face enrollment.',
                });
                return;   // no restart: this attempt is over
            }

            setStatus('Ready when you are.');
            startLiveDetection();
            setPopup({ type: 'error', message: typeof msg === 'string' ? msg : 'Verification failed. Please try again.' });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate, startLiveDetection, stopLivenessLoop, stopSettleLoop]);

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
            setStatus(`Timed out. ${MAX_LIVENESS_ATTEMPTS - next} attempt${MAX_LIVENESS_ATTEMPTS - next === 1 ? '' : 's'} left.`);
            startLiveDetection();
        }
    }, [livenessAttempts, startLiveDetection, stopLivenessLoop]);

    // ── Verify ────────────────────────────────────────────────────────────────
    const handleVerify = async () => {
        if (!modelsLoaded || verifying || phase !== 'idle') return;

        const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }));
        if (detections.length === 0) {
            setPopup({ type: 'error', message: 'No face detected. Make sure your face is clearly visible inside the outline and lighting is adequate.' });
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
        setStatus('Turn your head left, then right.');
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
        settleRef.current.done = true;
        stopSettleLoop();
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
        livenessRef.current.done = true;
        settleRef.current.done = true;
        stopLivenessLoop();
        stopSettleLoop();
        setPhase('idle');
        setStatus('Ready when you are.');
        startLiveDetection();
    };

    // What the status band shows right now.
    const band = !ready
        ? { text: 'Starting the camera…', tone: 'neutral' }
        : verifying
            ? { text: 'Checking your face…', tone: 'neutral' }
            : phase === 'liveness'
                ? { text: 'Turn your head slowly, left then right', tone: 'neutral' }
                : phase === 'settle'
                    ? (settleStraight
                        ? { text: 'Hold it there', tone: 'good' }
                        : { text: 'Face the camera again, straight on', tone: 'neutral' })
                    : (GUIDE_TEXT[guide] || GUIDE_TEXT.idle);

    const toneColor = { good: '#047857', warn: '#B45309', neutral: 'var(--adm-text-2)' }[band.tone];
    const toneBg = { good: '#ECFDF5', warn: '#FFFBEB', neutral: 'var(--adm-muted)' }[band.tone];
    const toneBorder = { good: '#A7F3D0', warn: '#FDE68A', neutral: 'var(--adm-border)' }[band.tone];

    const livenessPct = Math.max(0, Math.min(100, (livenessTimeLeft / LIVENESS_DURATION) * 100));

    return (
        <div style={S.page}>
            <div style={S.card}>

                {/* Header */}
                <div style={S.header}>
                    <div style={S.logoWrap}>
                        <IconFace size={22} color="#C45E10" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h1 style={S.title}>Face verification</h1>
                        <p style={S.subtitle}>Confirm it is you before opening case records</p>
                    </div>
                </div>

                {/* Step indicator: password is done, this is the second factor. */}
                <div style={S.steps}>
                    <span style={S.stepDone}><IconTick size={11} color="#fff" /></span>
                    <span style={S.stepLabelDone}>Password</span>
                    <span style={S.stepBar} />
                    <span style={S.stepCurrent}>2</span>
                    <span style={S.stepLabel}>Face check</span>
                </div>

                {/* Camera */}
                <div style={S.cameraWrap}>
                    <video ref={videoRef} autoPlay muted playsInline style={S.video} />
                    <canvas ref={overlayRef} width={640} height={480} style={S.overlayCanvas} />

                    {verifying && (
                        <div style={S.scanWrap}>
                            <div className="fv-scan" style={S.scanLine} />
                        </div>
                    )}

                    {!ready && (
                        <div style={S.warmingOverlay}>
                            <div style={S.warmingSpinner} />
                            <p style={S.warmingText}>Starting the camera…</p>
                        </div>
                    )}
                </div>

                {/* Live status band. aria-live so a screen reader hears the same
                    framing feedback that the outline colour gives visually. */}
                <div role="status" aria-live="polite"
                    style={{ ...S.band, background: toneBg, borderColor: toneBorder, color: toneColor }}>
                    {band.tone === 'good'
                        ? <IconTick size={14} color="#047857" />
                        : <span style={{ ...S.bandDot, background: toneColor }} />}
                    <span style={S.bandText}>{band.text}</span>
                </div>

                {/* ── Liveness challenge ── */}
                {phase === 'liveness' && (
                    <div style={S.liveness}>
                        <div style={S.livenessHead}>
                            <span style={S.livenessLabel}>Liveness check</span>
                            <span style={{ ...S.livenessTime, color: livenessTimeLeft <= 3 ? '#B91C1C' : '#C45E10' }}>
                                {livenessTimeLeft}s
                            </span>
                        </div>
                        <div style={S.livenessTrack}>
                            <div style={{ ...S.livenessFill, width: `${livenessPct}%`, background: livenessTimeLeft <= 3 ? '#B91C1C' : '#F47920' }} />
                        </div>

                        <div style={S.turnRow}>
                            <div style={{ ...S.turnCard, ...(turnLeftDone ? S.turnCardDone : null) }}>
                                {turnLeftDone
                                    ? <IconTick size={16} color="#047857" />
                                    : <span className="fv-nudge-l" style={{ display: 'inline-flex' }}><IconChevron dir="left" color="#C45E10" /></span>}
                                <span style={{ ...S.turnText, color: turnLeftDone ? '#047857' : 'var(--adm-text)' }}>Turn left</span>
                            </div>
                            <div style={{ ...S.turnCard, ...(turnRightDone ? S.turnCardDone : null) }}>
                                {turnRightDone
                                    ? <IconTick size={16} color="#047857" />
                                    : <span className="fv-nudge-r" style={{ display: 'inline-flex' }}><IconChevron dir="right" color="#C45E10" /></span>}
                                <span style={{ ...S.turnText, color: turnRightDone ? '#047857' : 'var(--adm-text)' }}>Turn right</span>
                            </div>
                        </div>
                        <p style={S.livenessHint}>Keep your face in the outline while you turn. This proves you are here in person, not a photo.</p>
                    </div>
                )}

                {/* ── Settle: head back to centre before the frame is taken ── */}
                {phase === 'settle' && (
                    <div style={S.liveness}>
                        <div style={S.livenessHead}>
                            <span style={S.livenessLabel}>Almost done</span>
                            <span style={{ ...S.livenessTime, color: '#C45E10' }}>
                                {settleLeft > 0 ? `${settleLeft}s` : 'now'}
                            </span>
                        </div>
                        <div style={S.livenessTrack}>
                            <div style={{
                                ...S.livenessFill,
                                width: `${Math.max(0, Math.min(100, ((SETTLE_SECONDS - settleLeft) / SETTLE_SECONDS) * 100))}%`,
                                background: settleStraight ? '#047857' : '#F47920',
                            }} />
                        </div>

                        <div style={{ ...S.turnCard, ...(settleStraight ? S.turnCardDone : null) }}>
                            {settleStraight
                                ? <IconTick size={16} color="#047857" />
                                : <span style={{ ...S.bandDot, background: '#C45E10' }} />}
                            <span style={{ ...S.turnText, color: settleStraight ? '#047857' : 'var(--adm-text)' }}>
                                {settleStraight ? 'Looking straight ahead' : 'Turn back to the camera'}
                            </span>
                        </div>
                        <p style={S.livenessHint}>
                            Your photo is taken once you are facing the camera again. Comparing a
                            half-turned face against your enrolled one is what makes a scan fail.
                        </p>
                    </div>
                )}

                {/* Tips — only while idle, so they do not compete with the
                    live instructions during the check. */}
                {phase === 'idle' && !verifying && (
                    <ul style={S.tips}>
                        {TIPS.map(t => (
                            <li key={t} style={S.tip}>
                                <span style={S.tipDot} />
                                <span>{t}</span>
                            </li>
                        ))}
                    </ul>
                )}

                {/* Verify / Cancel button */}
                {(phase === 'liveness' || phase === 'settle') ? (
                    <button type="button" className="fv-btn fv-ghost" onClick={cancelLiveness} style={S.secondaryBtn}>
                        Cancel check
                    </button>
                ) : (
                    <button
                        className="fv-btn fv-primary"
                        style={{ ...S.primaryBtn, opacity: (!modelsLoaded || verifying || !ready) ? 0.6 : 1 }}
                        onClick={handleVerify}
                        disabled={!modelsLoaded || verifying || !ready}
                    >
                        {verifying ? (
                            <><span style={S.spinner} />Checking…</>
                        ) : !ready ? (
                            <><span style={S.spinner} />Starting camera…</>
                        ) : (
                            <><IconFace size={16} color="#fff" />Start face check</>
                        )}
                    </button>
                )}

                <p style={S.processNote}>{status}</p>

                {/* Back link */}
                <button className="fv-btn fv-ghost" style={S.backBtn} onClick={handleBack}>
                    <IconBack size={13} color="var(--adm-text-muted)" />
                    Back to sign in
                </button>

                {/* ── TEMPORARY BYPASS - remove when camera is working ──
                    This skips the second factor entirely. It must not survive
                    into real use: anyone with a stolen password walks straight
                    into the case records. */}
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
                    style={S.bypassBtn}
                >
                    Skip face verification (temporary)
                </button>
            </div>

            {/* Result popup */}
            {popup && (
                <div style={S.backdrop}>
                    <div style={S.modal}>

                        <div style={{ ...S.modalIconWrap, backgroundColor: popup.type === 'success' ? '#ECFDF5' : '#FFF1F2' }}>
                            {popup.type === 'success'
                                ? <IconShield size={28} color="#047857" />
                                : <IconX size={28} color="#B91C1C" />
                            }
                        </div>

                        <h2 style={{ ...S.modalTitle, color: popup.type === 'success' ? '#047857' : '#B91C1C' }}>
                            {popup.type === 'success' ? 'Verified' : 'Verification failed'}
                        </h2>
                        <p style={S.modalMsg}>{popup.message}</p>

                        {popup.type === 'error' && (
                            <ul style={{ ...S.tips, textAlign: 'left', marginBottom: 16 }}>
                                {TIPS.map(t => (
                                    <li key={t} style={S.tip}>
                                        <span style={S.tipDot} />
                                        <span>{t}</span>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {popup.type === 'error' && (
                            <div style={S.modalBtns}>
                                <button className="fv-btn fv-primary" style={S.primaryBtn} onClick={closePopup}>
                                    <IconRefresh size={14} color="#fff" />
                                    Try again
                                </button>
                                <button className="fv-btn fv-ghost" style={S.secondaryBtn} onClick={handleBack}>
                                    <IconBack size={14} color="var(--adm-text-2)" />
                                    Return to sign in
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

const FF = "'Lexend', sans-serif";
const S = {
    // Surfaces use the shared --adm-* tokens so this page follows the theme.
    // It sits between Login and Dashboard, and hardcoded light values made the
    // admin flash white mid-flow in dark mode. The video letterbox stays dark on
    // purpose: it is a camera frame, not a surface.
    page: { minHeight: '100vh', backgroundColor: 'var(--adm-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: FF },
    card: { backgroundColor: 'var(--adm-card)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 460, boxShadow: 'var(--adm-card-shadow)', border: '1px solid var(--adm-border)' },

    header: { display: 'flex', alignItems: 'center', gap: 13, marginBottom: 16 },
    logoWrap: { width: 46, height: 46, borderRadius: 12, backgroundColor: '#FDF3EA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    title: { fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--adm-text)', margin: 0, fontFamily: FF },
    subtitle: { fontSize: 12.5, color: 'var(--adm-text-muted)', margin: '3px 0 0', fontFamily: FF },

    steps: { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16 },
    stepDone: { width: 18, height: 18, borderRadius: '50%', background: '#047857', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    stepLabelDone: { fontSize: 11.5, fontWeight: 600, color: 'var(--adm-text-muted)', fontFamily: FF },
    stepBar: { flex: 1, height: 2, background: 'var(--adm-border)', borderRadius: 2 },
    stepCurrent: { width: 18, height: 18, borderRadius: '50%', background: '#C45E10', color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: FF },
    stepLabel: { fontSize: 11.5, fontWeight: 700, color: 'var(--adm-text)', fontFamily: FF },

    cameraWrap: { position: 'relative', width: '100%', aspectRatio: '4/3', backgroundColor: '#12100E', borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
    video: { width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' },
    overlayCanvas: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' },

    scanWrap: { position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' },
    scanLine: { position: 'absolute', left: '8%', right: '8%', height: 2, backgroundColor: '#F47920', boxShadow: '0 0 10px #F47920, 0 0 22px rgba(244,121,32,0.5)', animation: 'scanLine 2s ease-in-out infinite' },

    warmingOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(12,10,9,0.72)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 },
    warmingSpinner: { width: 30, height: 30, border: '3px solid rgba(255,255,255,0.18)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
    warmingText: { fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.78)', margin: 0, fontFamily: FF },

    band: { display: 'flex', alignItems: 'center', gap: 9, border: '1px solid', borderRadius: 10, padding: '11px 13px', marginBottom: 12, minHeight: 44, boxSizing: 'border-box' },
    bandDot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
    bandText: { fontSize: 13, fontWeight: 600, lineHeight: 1.45, fontFamily: FF },

    liveness: { background: 'var(--adm-muted)', border: '1px solid var(--adm-border)', borderRadius: 12, padding: '14px 15px', marginBottom: 12, animation: 'fadeIn 0.2s ease' },
    livenessHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    livenessLabel: { fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--adm-text-muted)', fontFamily: FF },
    livenessTime: { fontSize: 12.5, fontWeight: 700, fontFamily: FF },
    livenessTrack: { height: 4, background: 'var(--adm-border)', borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
    livenessFill: { height: '100%', borderRadius: 4, transition: 'width 1s linear' },
    turnRow: { display: 'flex', gap: 10 },
    turnCard: { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 44, borderRadius: 10, border: '1.5px solid var(--adm-border)', background: 'var(--adm-card)' },
    turnCardDone: { borderColor: '#A7F3D0', background: '#ECFDF5' },
    turnText: { fontSize: 13, fontWeight: 700, fontFamily: FF },
    livenessHint: { margin: '10px 0 0', fontSize: 12, lineHeight: 1.55, color: 'var(--adm-text-muted)', fontFamily: FF },

    tips: { listStyle: 'none', margin: '0 0 14px', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 },
    tip: { display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 12.5, lineHeight: 1.5, color: 'var(--adm-text-2)', fontFamily: FF },
    tipDot: { width: 5, height: 5, borderRadius: '50%', background: '#F47920', flexShrink: 0, marginTop: 6 },

    primaryBtn: { width: '100%', minHeight: 46, padding: '12px', backgroundColor: '#C45E10', color: '#fff', fontSize: 14.5, fontWeight: 700, border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 2px 8px rgba(196,94,16,0.22)', fontFamily: FF },
    secondaryBtn: { width: '100%', minHeight: 46, padding: '12px', backgroundColor: 'transparent', color: 'var(--adm-text-2)', fontSize: 14, fontWeight: 600, border: '1.5px solid var(--adm-border)', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: FF },
    spinner: { width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block', flexShrink: 0 },

    processNote: { fontSize: 12, color: 'var(--adm-text-muted)', textAlign: 'center', margin: '10px 0 12px', minHeight: 16, fontFamily: FF },

    backBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', minHeight: 44, padding: '10px 0', backgroundColor: 'transparent', color: 'var(--adm-text-muted)', fontSize: 13, fontWeight: 500, border: '1.5px solid var(--adm-border)', borderRadius: 10, cursor: 'pointer', fontFamily: FF },
    bypassBtn: { marginTop: 8, width: '100%', minHeight: 40, borderRadius: 10, border: '1.5px dashed var(--adm-border)', background: 'transparent', color: 'var(--adm-text-muted)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: FF },

    // Modal
    backdrop: { position: 'fixed', inset: 0, backgroundColor: 'rgba(18,16,14,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 },
    modal: { backgroundColor: 'var(--adm-card)', borderRadius: 16, padding: '30px 26px', width: '100%', maxWidth: 360, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', animation: 'slideUp 0.2s ease' },
    modalIconWrap: { width: 62, height: 62, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' },
    modalTitle: { fontSize: 19, fontWeight: 700, marginBottom: 10, fontFamily: FF },
    modalMsg: { fontSize: 13.5, color: 'var(--adm-text-2)', lineHeight: 1.65, marginBottom: 18, fontFamily: FF },
    modalBtns: { display: 'flex', flexDirection: 'column', gap: 10 },

    successLoader: { height: 4, backgroundColor: 'var(--adm-border)', borderRadius: 4, overflow: 'hidden' },
    successLoaderBar: { height: '100%', backgroundColor: '#047857', borderRadius: 4, animation: 'slideUp 1.8s linear forwards', width: '100%' },
};

export default FaceVerify;
