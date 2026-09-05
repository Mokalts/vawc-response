import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";

// ─── Barangay constants ──────────────────────────────────────────────────────
const BARANGAY = {
    municipality: "Municipality of Iba",
    logo: "/barangay-logo.png",
};
const MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

const blankRow = () => ({ case_number: "", date: "", complainant: "", respondent: "", title: "", remark: "Pending" });
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" }) : "";

// ─── CSS - print-aware ───────────────────────────────────────────────────────
const CSS = `
    .mr-wrap { background: #E2E8F0; min-height: 100vh; padding: 24px 16px 60px; font-family: 'Lexend', sans-serif; }
    .mr-toolbar {
        max-width: 11in; margin: 0 auto 16px;
        display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
    }
    .mr-toolbar h1 { margin: 0; font-size: 18px; font-weight: 700; color: #0F172A; }
    .mr-toolbar p { margin: 2px 0 0; font-size: 12.5px; color: #475569; }
    .mr-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .mr-select { padding: 9px 12px; border-radius: 8px; border: 1.5px solid #CBD5E1; background: #fff; color: #0F172A; font-size: 13px; font-family: 'Lexend', sans-serif; }
    .mr-btn {
        padding: 10px 18px; border-radius: 8px; border: none; background: #F47920; color: #fff;
        font-size: 13.5px; font-weight: 700; cursor: pointer; font-family: 'Lexend', sans-serif;
        display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 2px 6px rgba(244,121,32,0.3);
    }
    .mr-btn:hover { background: #C45E10; }
    .mr-btn-ghost { padding: 10px 16px; border-radius: 8px; border: 1.5px solid #CBD5E1; background: #fff; color: #475569; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Lexend', sans-serif; }

    .mr-paper {
        background: #fff; max-width: 11in; margin: 0 auto; padding: 0.6in 0.6in;
        box-shadow: 0 4px 20px rgba(15,23,42,0.12); color: #000;
        font-family: 'Times New Roman', Times, serif;
    }
    .mr-head { display: flex; align-items: center; justify-content: center; gap: 16px; text-align: center; margin-bottom: 18px; }
    .mr-head img { width: 82px; height: 82px; border-radius: 50%; object-fit: cover; background: #fff; }
    .mr-head-text p { margin: 0; line-height: 1.35; }
    .mr-muni { font-size: 13px; }
    .mr-office { font-size: 15px; font-weight: 700; }
    .mr-title { font-size: 15px; font-weight: 700; }
    .mr-month { font-size: 14px; font-weight: 700; }

    .mr-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    .mr-table th, .mr-table td { border: 1px solid #000; padding: 4px 6px; font-size: 12px; vertical-align: middle; }
    .mr-table th { background: #F1F5F9; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 0.02em; }
    .mr-cell { width: 100%; box-sizing: border-box; border: none; background: transparent; font-family: 'Times New Roman', Times, serif; font-size: 12px; color: #000; outline: none; padding: 2px; }
    .mr-cell:focus { background: #FFF3E0; }
    .mr-cell.center { text-align: center; }
    .mr-col-no { width: 12%; } .mr-col-date { width: 13%; } .mr-col-title { width: 12%; } .mr-col-rem { width: 11%; }
    .mr-del { width: 26px; border: none; background: none; color: #DC2626; cursor: pointer; font-size: 15px; line-height: 1; }
    .mr-delcol { width: 30px; border: none !important; text-align: center; }

    .mr-addrow { margin-top: 10px; padding: 7px 14px; border-radius: 7px; border: 1.5px dashed #CBD5E1; background: #fff; color: #475569; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: 'Lexend', sans-serif; }
    .mr-empty { text-align: center; padding: 18px; font-size: 12.5px; color: #475569; font-style: italic; }

    .mr-signs { display: flex; justify-content: space-between; gap: 40px; margin-top: 46px; }
    .mr-sign { flex: 1; text-align: center; }
    .mr-sign-label { font-size: 12px; font-style: italic; margin-bottom: 28px; text-align: left; }
    .mr-signname { width: 100%; box-sizing: border-box; border: none; border-bottom: 1px dashed #B0B0B0; background: transparent; text-align: center; font-weight: 700; font-size: 13px; font-family: 'Times New Roman', Times, serif; outline: none; }
    .mr-signname:focus { background: #FFF3E0; }
    .mr-signtitle { width: 100%; box-sizing: border-box; border: none; background: transparent; text-align: center; font-style: italic; font-size: 12px; font-family: 'Times New Roman', Times, serif; outline: none; margin-top: 2px; }

    @media print {
        /* margin:0 removes the browser's auto date/URL/page-number header & footer */
        @page { size: A4 landscape; margin: 0; }
        html, body { background: #fff !important; margin: 0 !important; }
        .mr-wrap { background: #fff !important; padding: 0 !important; }
        .mr-toolbar, .no-print { display: none !important; }
        /* page padding lives on the paper so the @page margin can stay 0 */
        .mr-paper { box-shadow: none !important; margin: 0 !important; max-width: none !important; padding: 0.5in 0.55in !important; }
        .mr-cell:focus, .mr-signname:focus { background: transparent !important; }
        .mr-signname { border-bottom: none !important; }
        .mr-delcol, .mr-del { display: none !important; }
        .mr-addrow { display: none !important; }
        .mr-table { break-inside: auto; }
        .mr-table thead { display: table-header-group; }  /* repeat column headers on each page */
        .mr-table tr { break-inside: avoid; }
        .mr-signs { break-inside: avoid; margin-top: 34px; }
        .mr-table th { background: #F1F5F9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
`;

export default function MonthlyReport() {
    const navigate = useNavigate();
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [prepared, setPrepared] = useState({ name: "", title: "Lupon Secretary" });
    const [attested, setAttested] = useState({ name: "", title: "Punong Barangay" });

    const load = useCallback(async () => {
        setLoading(true); setError("");
        try {
            const res = await api.get("/admin/monthly-report", { params: { year, month } });
            setRows((res.data.rows || []).map(r => ({
                case_number: r.case_number || "",
                date:        fmtDate(r.date),
                complainant: r.complainant || "",
                respondent:  r.respondent || "",
                title:       r.title || "",
                remark:      r.remark || "Pending",
            })));
        } catch (e) {
            setError(e.response?.data?.detail || "Failed to load the report.");
            setRows([]);
        } finally { setLoading(false); }
    }, [year, month]);

    useEffect(() => { load(); }, [load]);

    const setCell = (i, k, v) => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
    const addRow = () => setRows(rs => [...rs, blankRow()]);
    const delRow = (i) => setRows(rs => rs.filter((_, idx) => idx !== i));

    const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2, now.getFullYear() - 3];

    return (
        <div className="mr-wrap">
            <style>{CSS}</style>

            <div className="mr-toolbar">
                <div>
                    <h1>Monthly Accomplishment Report</h1>
                    <p>Auto-filled from cases filed in the selected month. Every field is editable, correct anything before printing.</p>
                </div>
                <div className="mr-controls">
                    <select className="mr-select" value={month} onChange={e => setMonth(Number(e.target.value))}>
                        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                    </select>
                    <select className="mr-select" value={year} onChange={e => setYear(Number(e.target.value))}>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <button className="mr-btn-ghost" onClick={() => navigate("/dashboard")}>Back</button>
                    <button className="mr-btn" onClick={() => window.print()} disabled={loading}>Print</button>
                </div>
            </div>

            {error && <div className="mr-banner no-print" style={{ maxWidth: "11in", margin: "0 auto 16px", background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 8, padding: "12px 16px", fontSize: 12.5, color: "#991B1B" }}>{error}</div>}

            <div className="mr-paper">
                <div className="mr-head">
                    <img src={BARANGAY.logo} alt="Barangay Palanginan Seal" onError={(e) => { e.target.style.display = "none"; }} />
                    <div className="mr-head-text">
                        <p className="mr-muni">{BARANGAY.municipality}</p>
                        <p className="mr-office">OFFICE OF THE LUPON TAGAPAMAYAPA</p>
                        <p className="mr-title">MONTHLY ACCOMPLISHMENT REPORT</p>
                        <p className="mr-month">FOR THE MONTH OF {MONTHS[month - 1].toUpperCase()} {year}</p>
                    </div>
                </div>

                <table className="mr-table">
                    <thead>
                        <tr>
                            <th className="mr-col-no">Case No.</th>
                            <th className="mr-col-date">Date</th>
                            <th>Complainant/s</th>
                            <th>Respondent/s</th>
                            <th className="mr-col-title">Title</th>
                            <th className="mr-col-rem">Remarks</th>
                            <th className="mr-delcol no-print"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} className="mr-empty">Loading…</td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={7} className="mr-empty">No cases filed in {MONTHS[month - 1]} {year}. You can add rows manually below.</td></tr>
                        ) : rows.map((r, i) => (
                            <tr key={i}>
                                <td><input className="mr-cell center" value={r.case_number} onChange={e => setCell(i, "case_number", e.target.value)} /></td>
                                <td><input className="mr-cell center" value={r.date} onChange={e => setCell(i, "date", e.target.value)} /></td>
                                <td><input className="mr-cell" value={r.complainant} onChange={e => setCell(i, "complainant", e.target.value)} /></td>
                                <td><input className="mr-cell" value={r.respondent} onChange={e => setCell(i, "respondent", e.target.value)} /></td>
                                <td><input className="mr-cell" value={r.title} onChange={e => setCell(i, "title", e.target.value)} /></td>
                                <td><input className="mr-cell center" value={r.remark} onChange={e => setCell(i, "remark", e.target.value)} /></td>
                                <td className="mr-delcol no-print"><button className="mr-del" title="Remove row" onClick={() => delRow(i)}>&times;</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <button className="mr-addrow no-print" onClick={addRow}>+ Add row</button>

                <div className="mr-signs">
                    <div className="mr-sign">
                        <p className="mr-sign-label">Prepared by:</p>
                        <input className="mr-signname" value={prepared.name} placeholder="Name" onChange={e => setPrepared(p => ({ ...p, name: e.target.value }))} />
                        <input className="mr-signtitle" value={prepared.title} onChange={e => setPrepared(p => ({ ...p, title: e.target.value }))} />
                    </div>
                    <div className="mr-sign">
                        <p className="mr-sign-label">Attested by:</p>
                        <input className="mr-signname" value={attested.name} placeholder="Name" onChange={e => setAttested(p => ({ ...p, name: e.target.value }))} />
                        <input className="mr-signtitle" value={attested.title} onChange={e => setAttested(p => ({ ...p, title: e.target.value }))} />
                    </div>
                </div>
            </div>
        </div>
    );
}
