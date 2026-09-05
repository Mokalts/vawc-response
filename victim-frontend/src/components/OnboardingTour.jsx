import React, { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

/**
 * Lightweight first-time walkthrough. No external dependency (React 19 safe).
 *
 * Props:
 *   steps    - array of { target?: cssSelector, title, text }. Omit target for a
 *              centered welcome/finish card.
 *   run      - boolean; when it flips true the tour (re)starts from step 0.
 *   onClose  - called when the user finishes or skips.
 */
if (!document.getElementById('vawc-tour-css')) {
    const s = document.createElement('style'); s.id = 'vawc-tour-css';
    s.textContent = `
        @keyframes vtFade { from{opacity:0} to{opacity:1} }
        @keyframes vtPulse { 0%,100%{box-shadow:0 0 0 9999px rgba(24,12,28,0.66), 0 0 0 3px #F47920} 50%{box-shadow:0 0 0 9999px rgba(24,12,28,0.66), 0 0 0 6px rgba(244,121,32,0.5)} }
        .vt-tip { animation: vtFade 0.2s ease both; }
        .vt-btn { transition: filter 0.15s ease, transform 0.1s ease; }
        .vt-btn:active { transform: scale(0.96); }
        @media (prefers-reduced-motion: reduce) { .vt-spot { animation: none !important; } }
    `;
    document.head.appendChild(s);
}

const FF = "'Lexend', sans-serif";
const PAD = 8;
const GAP = 14;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

export default function OnboardingTour({ steps = [], run = false, onClose }) {
    const [index, setIndex] = useState(0);
    const [active, setActive] = useState(false);
    const [rect, setRect] = useState(null);   // target rect (viewport coords) or null (centered)
    const [pos, setPos] = useState(null);      // computed tooltip position
    const tipRef = useRef(null);

    useEffect(() => { if (run) { setIndex(0); setActive(true); } }, [run]);

    const step = steps[index] || null;

    const measure = useCallback(() => {
        if (!step) return;
        if (!step.target) { setRect(null); return; }
        const el = document.querySelector(step.target);
        if (!el) { setRect(null); return; }
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }, [step]);

    // On step change: scroll target into view, then measure (immediately + after scroll settles)
    useLayoutEffect(() => {
        if (!active || !step) return;
        if (step.target) {
            const el = document.querySelector(step.target);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        measure();
        const t = setTimeout(measure, 360);
        return () => clearTimeout(t);
    }, [active, index, step, measure]);

    // Keep aligned on resize / scroll
    useEffect(() => {
        if (!active) return;
        const h = () => measure();
        window.addEventListener('resize', h);
        window.addEventListener('scroll', h, true);
        return () => { window.removeEventListener('resize', h); window.removeEventListener('scroll', h, true); };
    }, [active, measure]);

    // Compute tooltip position from the real tooltip size (runs before paint → no flash)
    useLayoutEffect(() => {
        if (!active || !step) return;
        const vw = window.innerWidth, vh = window.innerHeight;
        const el = tipRef.current;
        const tipH = el ? el.offsetHeight : 190;
        const tipW = el ? el.offsetWidth : Math.min(320, vw - 32);

        if (!rect) { setPos({ centered: true }); return; }

        const belowTop = rect.top + rect.height + PAD + GAP;
        const aboveTop = rect.top - PAD - GAP - tipH;
        let top, arrow;
        if (belowTop + tipH <= vh - 10) { top = belowTop; arrow = 'top'; }
        else if (aboveTop >= 10) { top = aboveTop; arrow = 'bottom'; }
        else { top = clamp(belowTop, 10, vh - tipH - 10); arrow = null; }

        const left = clamp(rect.left + rect.width / 2 - tipW / 2, 12, vw - tipW - 12);
        const arrowLeft = clamp(rect.left + rect.width / 2 - left, 22, tipW - 22);
        setPos({ top, left, arrow, arrowLeft });
    }, [active, index, step, rect]);

    const finish = useCallback(() => { setActive(false); onClose && onClose(); }, [onClose]);
    const next = () => { if (index >= steps.length - 1) finish(); else setIndex(i => i + 1); };
    const back = () => setIndex(i => Math.max(0, i - 1));

    // Keyboard: Esc skips the whole tour. Move focus into the tooltip on each step.
    useEffect(() => {
        if (!active) return;
        const onKey = (e) => { if (e.key === 'Escape') finish(); };
        window.addEventListener('keydown', onKey);
        const t = setTimeout(() => { tipRef.current?.focus(); }, 30);
        return () => { window.removeEventListener('keydown', onKey); clearTimeout(t); };
    }, [active, index, finish]);

    if (!active || !step) return null;

    const isFirst = index === 0;
    const isLast = index === steps.length - 1;
    const vw = window.innerWidth;
    const TT_W = Math.min(320, vw - 32);
    const centered = !pos || pos.centered;

    const spot = rect ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + 2 * PAD, height: rect.height + 2 * PAD } : null;

    const tipStyle = centered
        ? { top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: TT_W }
        : { top: pos.top, left: pos.left, width: TT_W };

    return ReactDOM.createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, fontFamily: FF }}>
            {/* Click blocker (dims fully when there is no spotlight) */}
            <div style={{ position: 'fixed', inset: 0, background: spot ? 'transparent' : 'rgba(24,12,28,0.66)' }}
                 onClick={(e) => e.stopPropagation()} />

            {/* Spotlight */}
            {spot && (
                <div className="vt-spot" style={{
                    position: 'fixed', top: spot.top, left: spot.left, width: spot.width, height: spot.height,
                    borderRadius: 14, pointerEvents: 'none',
                    boxShadow: '0 0 0 9999px rgba(24,12,28,0.66), 0 0 0 3px #F47920',
                    animation: 'vtPulse 2s ease-in-out infinite',
                }} />
            )}

            {/* Tooltip card */}
            <div ref={tipRef} className="vt-tip" role="dialog" aria-modal="true" aria-label={`Gabay: ${step.title}`} tabIndex={-1} style={{
                position: 'fixed', ...tipStyle, background: 'var(--surface)', borderRadius: 18,
                padding: '18px 18px 16px', boxShadow: '0 18px 44px rgba(24,12,28,0.32)',
                border: '1px solid var(--border)', boxSizing: 'border-box', outline: 'none',
            }}>
                {/* Arrow */}
                {!centered && pos.arrow && (
                    <div style={{
                        position: 'absolute', left: pos.arrowLeft, width: 14, height: 14, background: 'var(--surface)',
                        transform: 'rotate(45deg)', marginLeft: -7,
                        top: pos.arrow === 'top' ? -7 : undefined,
                        bottom: pos.arrow === 'bottom' ? -7 : undefined,
                        borderLeft: pos.arrow === 'top' ? '1px solid var(--border)' : 'none',
                        borderTop: pos.arrow === 'top' ? '1px solid var(--border)' : 'none',
                        borderRight: pos.arrow === 'bottom' ? '1px solid var(--border)' : 'none',
                        borderBottom: pos.arrow === 'bottom' ? '1px solid var(--border)' : 'none',
                    }} />
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.5px', color: '#E8843C', textTransform: 'uppercase' }}>
                        Gabay {index + 1} / {steps.length}
                    </span>
                    <button className="vt-btn" onClick={finish} style={{
                        background: 'none', border: 'none', color: '#94A3B8', fontSize: 12.5, fontWeight: 700,
                        cursor: 'pointer', fontFamily: FF, padding: 4,
                    }}>Laktawan</button>
                </div>

                <p style={{ margin: '0 0 5px', fontSize: 16.5, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.2px' }}>
                    {step.title}
                </p>
                <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--text-body)', lineHeight: 1.55 }}>
                    {step.text}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 5 }}>
                        {steps.map((_, i) => (
                            <span key={i} style={{
                                width: i === index ? 18 : 6, height: 6, borderRadius: 3,
                                background: i === index ? '#F47920' : '#FFE0C2', transition: 'all 0.2s ease',
                            }} />
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {!isFirst && (
                            <button className="vt-btn" onClick={back} style={{
                                padding: '9px 14px', background: 'var(--surface-tint)', color: 'var(--accent-text)', border: 'none',
                                borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: FF,
                            }}>Balik</button>
                        )}
                        <button className="vt-btn" onClick={next} style={{
                            padding: '9px 18px', background: 'linear-gradient(135deg,#F47920,#E8641C)', color: '#fff',
                            border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: FF,
                            boxShadow: '0 4px 12px rgba(196,94,16,0.3)',
                        }}>{isLast ? 'Tapos' : 'Susunod'}</button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
