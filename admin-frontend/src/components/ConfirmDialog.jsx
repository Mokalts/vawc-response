import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";

// Promise-based confirm dialog. Usage:  if (!(await confirmDialog({...}))) return;
let _open = null;

export function confirmDialog(opts = {}) {
    return new Promise((resolve) => {
        if (_open) _open({ ...opts, resolve });
        else resolve(window.confirm(opts.message || "Are you sure?"));
    });
}

const FF = "'DM Sans', sans-serif";

// Mount <ConfirmHost /> once (in AdminLayout). It renders the dialog on demand.
export function ConfirmHost() {
    const [state, setState] = useState(null);

    useEffect(() => {
        _open = (s) => setState(s);
        return () => { _open = null; };
    }, []);

    useEffect(() => {
        if (!state) return;
        const onKey = (e) => {
            if (e.key === "Escape") { state.resolve(false); setState(null); }
            if (e.key === "Enter") { state.resolve(true); setState(null); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [state]);

    if (!state) return null;

    const done = (result) => { const r = state.resolve; setState(null); r(result); };
    const danger = !!state.danger;
    const accent       = danger ? "#DC2626" : "#F47920";
    const accentBg     = danger ? "#FEF2F2" : "#FFF3E0";
    const accentBorder = danger ? "#FECACA" : "#FFCC99";
    const shadow       = danger ? "rgba(220,38,38,0.3)" : "rgba(196,94,16,0.3)";

    return ReactDOM.createPortal(
        <div onClick={() => done(false)} style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: FF }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 420, padding: 26, boxShadow: "0 24px 64px rgba(15,23,42,0.3)", animation: "adm-popIn 0.2s ease" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 13 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 14, background: accentBg, border: `1px solid ${accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            <line x1="12" y1="9" x2="12" y2="13" stroke={accent} strokeWidth="1.8" strokeLinecap="round" />
                            <line x1="12" y1="17" x2="12.01" y2="17" stroke={accent} strokeWidth="2.4" strokeLinecap="round" />
                        </svg>
                    </div>
                    <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.2px" }}>{state.title || "Are you sure?"}</p>
                </div>
                <p style={{ margin: "0 0 22px", fontSize: 13.5, color: "#475569", lineHeight: 1.65, whiteSpace: "pre-line" }}>{state.message}</p>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                    <button onClick={() => done(false)} style={{ padding: "9px 18px", borderRadius: 10, border: "1.5px solid #E2E8F0", background: "#fff", color: "#475569", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: FF }}>
                        {state.cancelLabel || "Cancel"}
                    </button>
                    <button onClick={() => done(true)} autoFocus style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: accent, color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: FF, boxShadow: `0 4px 12px ${shadow}` }}>
                        {state.confirmLabel || "Confirm"}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
