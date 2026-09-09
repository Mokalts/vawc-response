import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/api";

// ─── Barangay constants ──────────────────────────────────────────────────────
const BARANGAY = {
    name: "BARANGAY PALANGINAN",
    province: "Province of Zambales",
    municipality: "Municipality of Iba",
    logo: "/barangay-logo.png",
};

// ─── CSS — mirrors the barangay's paper forms ───────────────────────────────
const CSS = `
    @page { size: A4; margin: 0.6in 0.7in; }

    .pd-wrap { background: #E2E8F0; min-height: 100vh; padding: 24px 16px 60px; font-family: 'Lexend', sans-serif; }
    .pd-toolbar { max-width: 8.27in; margin: 0 auto 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .pd-toolbar h1 { margin: 0; font-size: 18px; font-weight: 700; color: #0F172A; }
    .pd-toolbar p  { margin: 2px 0 0; font-size: 12.5px; color: #475569; }
    .pd-btn { padding: 10px 18px; border-radius: 8px; border: none; background: #F47920; color: #fff; font-size: 13.5px; font-weight: 700; cursor: pointer; font-family: 'Lexend', sans-serif; display: inline-flex; align-items: center; gap: 8px; }
    .pd-btn:hover { background: #C45E10; }
    .pd-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .pd-btn-ghost { padding: 10px 16px; border-radius: 8px; border: 1.5px solid #CBD5E1; background: #fff; color: #475569; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Lexend', sans-serif; }
    .pd-banner { max-width: 8.27in; margin: 0 auto 16px; background: #FFF3E0; border: 1.5px solid #FFCC99; border-radius: 8px; padding: 12px 16px; font-size: 12.5px; color: #C45E10; font-family: 'Lexend', sans-serif; }

    /* One sheet of paper */
    .pd-paper {
        background: #fff; max-width: 8.27in; min-height: 11.2in; margin: 0 auto 22px;
        padding: 0.6in 0.7in; box-shadow: 0 4px 20px rgba(15,23,42,0.12);
        font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 12.5px; line-height: 1.45;
        box-sizing: border-box;
    }
    .pd-page-break { break-after: page; page-break-after: always; }

    /* Header block — matches the paper exactly */
    .pd-head { display: grid; grid-template-columns: 78px 1fr 78px; align-items: center; margin-bottom: 12px; }
    .pd-head img { width: 74px; height: 74px; object-fit: contain; }
    .pd-head-txt { text-align: center; line-height: 1.35; }
    .pd-head-txt p { margin: 0; font-size: 12.5px; }
    .pd-head-txt .brgy { font-weight: 700; }
    .pd-office { text-align: center; font-weight: 700; font-size: 13px; margin: 10px 0 4px; }
    .pd-formtitle { text-align: center; font-weight: 700; font-size: 13px; margin: 10px 0 14px; }

    /* Fill-in fields */
    .fill { border: none; border-bottom: 1px solid #000; background: transparent; font-family: inherit; font-size: 12.5px; padding: 0 3px; outline: none; }
    .fill:focus { background: #FFF3E0; }
    .fill.b { font-weight: 700; }
    .fill.c { text-align: center; }
    .ta { width: 100%; box-sizing: border-box; border: none; background: transparent; font-family: inherit; font-size: 12.5px; line-height: 1.9; outline: none; resize: vertical;
          background-image: repeating-linear-gradient(transparent, transparent 27px, #000 27px, #000 28px); }
    .ta:focus { background-color: #FFF9F0; }
    .cap { font-size: 11px; text-align: center; display: block; }

    .row { margin-bottom: 7px; }
    .lbl { font-weight: 400; }
    .b { font-weight: 700; }

    /* ( ) checkbox exactly like the form */
    .cb { cursor: pointer; user-select: none; font-family: inherit; }
    .cbx { display: inline-block; min-width: 20px; }

    .sig-line { border-top: 1px solid #000; width: 260px; margin-top: 2px; }
    .center { text-align: center; }
    .right { text-align: right; }
    .mt24 { margin-top: 24px; } .mt16 { margin-top: 16px; } .mt40 { margin-top: 40px; }

    .tbl3 { width: 100%; border-collapse: collapse; margin: 4px 0 10px; }
    .tbl3 td { padding: 2px 4px; }
    .tbl3 .u { border-bottom: 1px solid #000; }

    @media print {
        @page { size: A4; margin: 0.6in 0.7in; }
        html, body { background: #fff !important; margin: 0 !important; }
        .pd-wrap { background: #fff !important; padding: 0 !important; }
        .pd-toolbar, .pd-banner, .no-print { display: none !important; }
        .pd-paper { box-shadow: none !important; margin: 0 !important; padding: 0 !important; max-width: none !important; min-height: 0 !important; }
        .fill, .ta { background: transparent !important; }
        .ta { background-image: repeating-linear-gradient(transparent, transparent 27px, #000 27px, #000 28px) !important; }
    }
`;

// ─── Helpers ────────────────────────────────────────────────────────────────
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const today = () => { const d = new Date(); return { day: String(d.getDate()), month: MONTHS[d.getMonth()], year: String(d.getFullYear()) }; };
const fmtDate = (d) => !d ? "" : new Date(d).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
const fmtTime = (d) => !d ? "" : new Date(d).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
const ageFrom = (dob) => !dob ? "" : String(Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000));
const INCIDENT_LABEL = { physical: "Physical Abuse", sexual: "Sexual Abuse", psychological: "Psychological Abuse", economic: "Economic Abuse", others: "Other" };
const abuseText = (r) => {
    if (!r) return "";
    const l = (r.incident_types && r.incident_types.length) ? r.incident_types : (r.incident_type ? [r.incident_type] : []);
    return l.map(t => INCIDENT_LABEL[t] || t).join(", ");
};

const Head = ({ office }) => (
    <>
        <div className="pd-head">
            <img src={BARANGAY.logo} alt="" onError={(e) => { e.target.style.visibility = "hidden"; }} />
            <div className="pd-head-txt">
                <p>Republic of the Philippines</p>
                <p>{BARANGAY.province}</p>
                <p>{BARANGAY.municipality}</p>
                <p className="brgy">{BARANGAY.name}</p>
            </div>
            <div />
        </div>
        <p className="pd-office">{office}</p>
    </>
);

// Inline fill-in blank
const F = ({ v, on, w = 200, b, c, ph }) => (
    <input className={`fill${b ? " b" : ""}${c ? " c" : ""}`} style={{ width: w }} value={v || ""} placeholder={ph || ""} onChange={e => on(e.target.value)} />
);
// ( ) checkbox that prints as ( ) or (✓)
const CB = ({ on, checked, children }) => (
    <span className="cb" onClick={() => on(!checked)}>
        <span className="cbx">({checked ? "✓" : "  "})</span> {children}
    </span>
);

// ─── 1. BLOTTER FORM ─────────────────────────────────────────────────────────
const BlotterForm = ({ f, set }) => (
    <div className="pd-paper">
        <Head office="OFFICE OF THE SANGGUNIANG BARANGAY" />
        <p className="pd-formtitle">BLOTTER FORM</p>

        <div className="row">Blotter Date: <F v={f.blotterDate} on={v => set({ blotterDate: v })} w={200} /></div>
        <div className="row mt16">Date &amp; Place of Incident: <F v={f.incidentWhen} on={v => set({ incidentWhen: v })} w={420} /></div>

        <div className="row mt16" style={{ marginLeft: 18 }}>
            <div className="row">A. Name of reporter/complainant: <F v={f.complainantName} on={v => set({ complainantName: v })} w={330} /></div>
            <div className="row">Address: <F v={f.complainantAddress} on={v => set({ complainantAddress: v })} w={430} /></div>
            <div className="row">Contact No. <F v={f.complainantContact} on={v => set({ complainantContact: v })} w={200} /> &nbsp; Edad: <F v={f.complainantAge} on={v => set({ complainantAge: v })} w={60} /></div>
        </div>

        <div className="row mt16" style={{ marginLeft: 18 }}>
            <div className="row">B. Name of the respondent: <F v={f.respondentName} on={v => set({ respondentName: v })} w={360} /></div>
            <div className="row">Address: <F v={f.respondentAddress} on={v => set({ respondentAddress: v })} w={430} /></div>
            <div className="row">Contact No. <F v={f.respondentContact} on={v => set({ respondentContact: v })} w={200} /> &nbsp; Edad: <F v={f.respondentAge} on={v => set({ respondentAge: v })} w={60} /></div>
        </div>

        <div className="row mt16" style={{ marginLeft: 18 }}>C. Complaint: <F v={f.complaint} on={v => set({ complaint: v })} w={420} /></div>

        <div className="row mt16" style={{ marginLeft: 18 }}>D. Description of Incident:</div>
        <textarea className="ta" rows={13} value={f.narrative} onChange={e => set({ narrative: e.target.value })} />

        <div className="mt24" style={{ marginLeft: 18 }}>
            <div className="row">Signature of reporter/complainant: <F v={f.sigName} on={v => set({ sigName: v })} w={330} /></div>
            <div className="row">Name of reporter/complainant: <F v={f.complainantName} on={v => set({ complainantName: v })} w={340} /></div>
            <div className="row">Date: <F v={f.sigDate} on={v => set({ sigDate: v })} w={200} /> &nbsp; Time: <F v={f.sigTime} on={v => set({ sigTime: v })} w={140} /></div>
        </div>

        <div className="mt16">
            <p style={{ margin: "0 0 4px", fontStyle: "italic" }}>Purpose ng pagpa Blotter:</p>
            <ol style={{ margin: 0, paddingLeft: 20 }}>
                <li><CB checked={f.p1} on={v => set({ p1: v })}>Blotter purpose lang, pero hindi ipapatawag ang attention ng respondent(s).</CB></li>
                <li><CB checked={f.p2} on={v => set({ p2: v })}>Blotter purpose lang, kasi hindi pa identified o hindi pa kilala ang respondent(s).</CB></li>
                <li><CB checked={f.p3} on={v => set({ p3: v })}>Blotter purpose lang, para maimbistigahan o ma identify o makilala ang respondent(s).</CB></li>
                {/* Item 4 ("...for settlement") is intentionally NOT rendered for VAWC cases:
                    RA 9262 / JMC 2010-2 prohibit mediation, conciliation and settlement. */}
            </ol>
        </div>

        <div className="mt24" style={{ marginLeft: 18 }}>
            Assisted by: <F v={f.assistedBy} on={v => set({ assistedBy: v })} w={300} />
            <div style={{ marginLeft: 90 }}><span className="cap">Tanod On Duty</span></div>
        </div>
    </div>
);

// ─── 2. PORMAL NA REKLAMO ────────────────────────────────────────────────────
const ReklamoForm = ({ f, set }) => (
    <div className="pd-paper">
        <Head office="OFFICE OF THE KATARUNGANG PAMBARANGAY" />
        <p className="pd-formtitle">PORMAL NA REKLAMO LABAN SA PANG-AABUSO SA KABABAIHAN AT<br />SA KANILANG ANAK</p>

        <div style={{ marginLeft: 24 }}>
            <div className="row">Kasalukuyang Petsa: <F v={f.petsa} on={v => set({ petsa: v })} w={160} /> &nbsp;&nbsp; Kasalukuyang Oras: <F v={f.oras} on={v => set({ oras: v })} w={150} /></div>
            <div className="row mt16">Pangalan ng Nagrereklamo: <F v={f.complainantName} on={v => set({ complainantName: v })} w={250} /> &nbsp; Edad: <F v={f.complainantAge} on={v => set({ complainantAge: v })} w={80} /></div>
            <div className="row mt16">Tirahan: <F v={f.complainantAddress} on={v => set({ complainantAddress: v })} w={450} /></div>
            <div className="row mt16">Pangalan ng Inirereklamo: <F v={f.respondentName} on={v => set({ respondentName: v })} w={250} /> &nbsp; Edad: <F v={f.respondentAge} on={v => set({ respondentAge: v })} w={70} /></div>
            <div className="row mt16">
                Relasyon sa Inerereklamo: &nbsp;
                <CB checked={f.rel_asawa} on={v => set({ rel_asawa: v })}>Asawa(kasal)</CB> &nbsp;&nbsp;
                <CB checked={f.rel_livein} on={v => set({ rel_livein: v })}>Live-in Partner</CB>
                <div style={{ marginLeft: 150, marginTop: 4 }}>
                    <CB checked={f.rel_kasintahan} on={v => set({ rel_kasintahan: v })}>Kasintahan</CB> &nbsp;&nbsp;
                    <CB checked={f.rel_kasambahay} on={v => set({ rel_kasambahay: v })}>Kasambahay</CB>
                </div>
            </div>
            <p className="row mt16 b">SALAYSAY/BUOD NG BUONG PANGYAYARI:</p>
        </div>
        <textarea className="ta" rows={16} value={f.narrative} onChange={e => set({ narrative: e.target.value })} />

        <div className="mt40" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
                <div className="sig-line" style={{ width: 220 }} />
                <span className="cap" style={{ width: 220 }}>Lagda ng Nagsasalaysay</span>
                <div style={{ height: 34 }} />
                <div className="sig-line" style={{ width: 220 }} />
                <span className="cap" style={{ width: 220 }}>BSDO/Desk Officer</span>
            </div>
            <div style={{ border: "1px solid #000", padding: "8px 10px", minWidth: 150 }}>
                VAWC Complaint<br />No. <F v={f.vawcNo} on={v => set({ vawcNo: v })} w={80} />
            </div>
        </div>
    </div>
);

// ─── 3. APPLICATION FOR BARANGAY PROTECTION ORDER ────────────────────────────
const BpoApplication = ({ f, set, kids }) => {
    const rows = (list, n) => {
        const out = [];
        for (let i = 0; i < n; i++) {
            const c = list[i];
            out.push(
                <tr key={i}>
                    <td className="u" style={{ width: "45%" }}>{c ? c.name : " "}</td>
                    <td className="u" style={{ width: "30%" }}>{c ? (c.date_of_birth || "") : " "}</td>
                    <td className="u" style={{ width: "25%" }}>{c ? (c.sex || "") : " "}</td>
                </tr>
            );
        }
        return out;
    };
    const own = (kids || []).filter(c => !c.under_her_care);
    const under = (kids || []).filter(c => c.under_her_care);
    const CS = ({ pfx }) => (
        <>
            CIVIL STATUS: <CB checked={f[pfx + "_single"]} on={v => set({ [pfx + "_single"]: v })}>Single</CB> &nbsp;
            <CB checked={f[pfx + "_married"]} on={v => set({ [pfx + "_married"]: v })}>Married</CB> &nbsp;
            <CB checked={f[pfx + "_widow"]} on={v => set({ [pfx + "_widow"]: v })}>Widow</CB> &nbsp;
            <CB checked={f[pfx + "_separated"]} on={v => set({ [pfx + "_separated"]: v })}>Separated</CB> &nbsp;
            <CB checked={f[pfx + "_legally"]} on={v => set({ [pfx + "_legally"]: v })}>Legally Separated</CB>
        </>
    );
    return (
        <div className="pd-paper">
            <Head office="" />
            <p className="right" style={{ margin: "-14px 0 6px" }}>Control No. <F v={f.controlNo} on={v => set({ controlNo: v })} w={170} /></p>
            <p className="pd-formtitle" style={{ marginTop: 0 }}>APPLICATION FOR BARANGAY PROTECTION ORDER</p>

            <ol style={{ margin: 0, paddingLeft: 22 }}>
                <li className="row">
                    NAME OF APPLICANT: <F v={f.applicantName} on={v => set({ applicantName: v })} w={250} /> Age: <F v={f.applicantAge} on={v => set({ applicantAge: v })} w={90} />
                    <div className="row">ADDRESS: <F v={f.applicantAddress} on={v => set({ applicantAddress: v })} w={300} /> CONTACT NO. <F v={f.applicantContact} on={v => set({ applicantContact: v })} w={140} /></div>
                    <div className="row">RELATIONSHIP TO VICTIM: <F v={f.applicantRelation} on={v => set({ applicantRelation: v })} w={160} /> OCCUPATION: <F v={f.applicantOccupation} on={v => set({ applicantOccupation: v })} w={130} /></div>
                </li>
                <li className="row">
                    NAME OF VICTIM/S: <F v={f.victimName} on={v => set({ victimName: v })} w={230} /> DATE OF BIRTH: <F v={f.victimDob} on={v => set({ victimDob: v })} w={130} />
                    <div className="row">ADDRESS: <F v={f.victimAddress} on={v => set({ victimAddress: v })} w={290} /> CONTACT NO. <F v={f.victimContact} on={v => set({ victimContact: v })} w={140} /></div>
                    <div className="row"><CS pfx="v" /></div>
                </li>
                <li className="row">OCCUPATION/SOURCE OF INCOME: <F v={f.victimOccupation} on={v => set({ victimOccupation: v })} w={300} /></li>
                <li className="row">
                    <table className="tbl3"><tbody>
                        <tr><td>NAME OF CHILDREN:</td><td>DATE OF BIRTH:</td><td>SEX:</td></tr>
                        {rows(own, 4)}
                    </tbody></table>
                </li>
            </ol>
            <div style={{ marginLeft: 22 }} className="row">4a. Other Children under her care:
                <table className="tbl3"><tbody>
                    <tr><td>NAME OF CHILDREN:</td><td>DATE OF BIRTH:</td><td>SEX:</td></tr>
                    {rows(under, 2)}
                </tbody></table>
            </div>
            <ol start={5} style={{ margin: 0, paddingLeft: 22 }}>
                <li className="row">
                    NAME OF RESPONDENT: <F v={f.respondentName} on={v => set({ respondentName: v })} w={220} /> Age: <F v={f.respondentAge} on={v => set({ respondentAge: v })} w={80} />
                    <div className="row">OCCUPATION/SOURCE OF INCOME: <F v={f.respondentOccupation} on={v => set({ respondentOccupation: v })} w={270} /></div>
                    <div className="row">ADDRESS: <F v={f.respondentAddress} on={v => set({ respondentAddress: v })} w={250} /> CONTACT NO. <F v={f.respondentContact} on={v => set({ respondentContact: v })} w={150} /></div>
                    <div className="row"><CS pfx="r" /></div>
                </li>
                <li className="row">Relationship of Complainant to Respondent:
                    <div className="center" style={{ marginTop: 2 }}>
                        <CB checked={f.rel_wife} on={v => set({ rel_wife: v })}>Wife</CB> &nbsp;
                        <CB checked={f.rel_formerwife} on={v => set({ rel_formerwife: v })}>Former Wife</CB> &nbsp;
                        <CB checked={f.rel_common} on={v => set({ rel_common: v })}>Common Law/Live-in Relationship</CB>
                    </div>
                    <div className="center">
                        <CB checked={f.rel_dating} on={v => set({ rel_dating: v })}>Dating Relationship</CB> &nbsp;
                        <CB checked={f.rel_sexual} on={v => set({ rel_sexual: v })}>Sexual Relationship</CB>
                    </div>
                </li>
                <li className="row">Acts Complained of: (Please Check)
                    <div className="center" style={{ marginTop: 2 }}>
                        <CB checked={f.act_threats} on={v => set({ act_threats: v })}>Threats</CB> &nbsp;
                        <CB checked={f.act_physical} on={v => set({ act_physical: v })}>Physical Relationship</CB>
                    </div>
                </li>
                <li className="row">Date of Commission of the Offense: <F v={f.offenseDate} on={v => set({ offenseDate: v })} w={330} /></li>
                <li className="row">Place Where the Offense was Committed: <F v={f.offensePlace} on={v => set({ offensePlace: v })} w={300} /></li>
                <li className="row">If the Applicant is not the Victim, state circumstances of consent of the victim:
                    <textarea className="ta" rows={2} value={f.consent} onChange={e => set({ consent: e.target.value })} />
                </li>
            </ol>

            <div className="mt24 right">
                <div className="sig-line" style={{ width: 300, marginLeft: "auto" }} />
                <span className="cap" style={{ width: 300, marginLeft: "auto" }}>Signature of Applicant Over Printed Name</span>
                <div style={{ marginTop: 4 }}>Date: <F v={f.appDate} on={v => set({ appDate: v })} w={230} /></div>
            </div>

            <p className="mt16" style={{ textIndent: "2em", textAlign: "justify" }}>
                I certify that the applicant for BPO who personally appeared before me is a bona fide resident of this
                barangay and is the same person that who supplied above information and attest to the said information.
            </p>

            <div className="mt24 right">
                <p style={{ margin: 0, fontWeight: 700 }}>{f.punongBarangay || " "}</p>
                <p style={{ margin: 0 }}>Punong Barangay</p>
            </div>
        </div>
    );
};

// ─── 4. BARANGAY PROTECTION ORDER ────────────────────────────────────────────
const BpoOrder = ({ f, set, bpo, showValidity }) => (
    <div className="pd-paper">
        <Head office="OFFICE OF THE PUNONG BARANGAY" />
        <p className="center" style={{ marginTop: 14 }}>BARANGAY CASE NO.: <F v={f.caseNo} on={v => set({ caseNo: v })} w={220} /></p>
        <p className="row mt16">IN RE: COMPLAINT AGAINST <F v={f.respondentName} on={v => set({ respondentName: v })} w={380} /></p>
        <div style={{ marginLeft: 250 }}><span className="cap" style={{ width: 160, textAlign: "left" }}>Respondent</span></div>

        <p className="pd-formtitle" style={{ fontSize: 14 }}>BARANGAY PROTECTION ORDER (BPO)</p>

        <p style={{ textIndent: "2em", textAlign: "justify" }}>BY VIRTUE OF THE AUTHORITY VESTED IN ME BY LAW, I HEREBY ORDER</p>
        <p style={{ margin: "2px 0 0" }}>
            <F v={f.respondentName} on={v => set({ respondentName: v })} w={280} /> of <F v={f.respondentAddress} on={v => set({ respondentAddress: v })} w={290} />
        </p>
        <div style={{ display: "flex", gap: 80 }}>
            <span className="cap" style={{ width: 280, textAlign: "center" }}>(Name of Respondent)</span>
            <span className="cap" style={{ width: 290, textAlign: "center" }}>(Address)</span>
        </div>

        <div className="mt24" style={{ marginLeft: 24 }}>
            <p className="row">
                <CB checked={f.a} on={v => set({ a: v })}>a. Desist/Refrain/Stop causing physical harm to <F v={f.complainantName} on={v => set({ complainantName: v })} w={230} /></CB>
                <br /><span style={{ marginLeft: 40 }}>and/or her children.</span>
                <span className="cap" style={{ display: "inline-block", width: 230, marginLeft: 130 }}>(Name of Complainant)</span>
            </p>
            <p className="row mt16">
                <CB checked={f.b} on={v => set({ b: v })}>b. Desist/Refrain/Stop threatening to cause physical harm to <F v={f.complainantName} on={v => set({ complainantName: v })} w={150} /></CB>
                <br /><span style={{ marginLeft: 40 }}>and /or her children.</span>
                <span className="cap" style={{ display: "inline-block", width: 230, marginLeft: 120 }}>(Name of Complainant)</span>
            </p>
            <p className="row mt16" style={{ textAlign: "justify" }}>
                <CB checked={f.c} on={v => set({ c: v })}>c. Desist from going near her and her children at a distance of 100 meters away.</CB>
            </p>
        </div>

        <p className="mt24" style={{ marginLeft: 24 }}>
            Issued this <F v={f.issueDay} on={v => set({ issueDay: v })} w={50} c /> day of <F v={f.issueMonth} on={v => set({ issueMonth: v })} w={170} />, <F v={f.issueYear} on={v => set({ issueYear: v })} w={80} c />.
        </p>

        {showValidity && (
            <p className="mt16" style={{ marginLeft: 24, fontWeight: 700 }}>
                This Order is effective for fifteen (15) days from the date of issue and shall expire on{" "}
                {bpo?.expires_at ? fmtDate(bpo.expires_at) : "____________________"}.
            </p>
        )}

        <div className="mt40 right" style={{ marginRight: 30 }}>
            <p style={{ margin: 0, fontWeight: 700 }}>{f.punongBarangay || " "}</p>
            <p style={{ margin: 0 }}>Punong Barangay</p>
        </div>

        <p className="center mt40 b">"VIOLATION OF THIS ORDER IS PUNISHABLE BY LAW"</p>
    </div>
);

// ─── 5. 1st ENDORSEMENT (form not yet supplied — kept from spec wording) ─────
const Endorsement1st = ({ f, set, endorsement }) => {
    const num = endorsement?.endorsement_number || 1;
    const ord = num === 1 ? "1st" : num === 2 ? "2nd" : num === 3 ? "3rd" : `${num}th`;
    return (
        <div className="pd-paper">
            <Head office="OFFICE OF THE PUNONG BARANGAY" />
            <p className="pd-formtitle">{ord.toUpperCase()} ENDORSEMENT</p>
            <p className="right">{endorsement?.date_endorsed ? fmtDate(endorsement.date_endorsed) : <F v={f.endorseDate} on={v => set({ endorseDate: v })} w={200} />}</p>

            <p className="mt16" style={{ textIndent: "2em", textAlign: "justify" }}>
                Respectfully endorsed to the <F v={f.toOffice} on={v => set({ toOffice: v })} w={280} /> the attached{" "}
                <F v={f.attachedDocs} on={v => set({ attachedDocs: v })} w={220} /> on the complaint of{" "}
                <F v={f.complainantName} on={v => set({ complainantName: v })} w={230} /> of <F v={f.complainantAddress} on={v => set({ complainantAddress: v })} w={220} /> against the respondent{" "}
                <F v={f.respondentName} on={v => set({ respondentName: v })} w={230} /> of <F v={f.respondentAddress} on={v => set({ respondentAddress: v })} w={220} /> for{" "}
                <F v={f.purpose} on={v => set({ purpose: v })} w={260} />.
            </p>

            <div className="mt40 right" style={{ marginRight: 30 }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{f.punongBarangay || " "}</p>
                <p style={{ margin: 0 }}>Punong Barangay</p>
            </div>

            <div className="mt40" style={{ borderTop: "1px dashed #000", paddingTop: 10 }}>
                <p className="b" style={{ margin: "0 0 10px" }}>ACKNOWLEDGMENT (to be completed by the receiving office)</p>
                <div className="row">Received by: <F v={f.receivedBy} on={v => set({ receivedBy: v })} w={250} /> &nbsp; Designation: <F v={f.receivedDesignation} on={v => set({ receivedDesignation: v })} w={180} /></div>
                <div className="row">Date &amp; Time: <F v={f.receivedAt} on={v => set({ receivedAt: v })} w={250} /></div>
            </div>
        </div>
    );
};

// ─── BPO packet: the 3 pages the barangay files together ────────────────────
const BpoPacket = (props) => (
    <>
        <div className="pd-page-break"><BpoApplication {...props} /></div>
        <div className="pd-page-break"><ReklamoForm {...props} /></div>
        <BpoOrder {...props} />
    </>
);

// ─── Main page ──────────────────────────────────────────────────────────────
const DOC_TYPES = {
    blotter:     { component: BlotterForm,    title: "Blotter Form",      office: "Sangguniang Barangay" },
    reklamo:     { component: ReklamoForm,    title: "Pormal na Reklamo", office: "Katarungang Pambarangay" },
    "bpo-app":   { component: BpoPacket,      title: "BPO Application (3 pages)", office: "Application + Reklamo + BPO" },
    bpo:         { component: BpoOrder,       title: "Barangay Protection Order", office: "Punong Barangay" },
    endorsement: { component: Endorsement1st, title: "1st Endorsement",   office: "Punong Barangay" },
};

export default function PrintDocument() {
    const { type, caseId } = useParams();
    const navigate = useNavigate();
    const [cas, setCas] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showValidity, setShowValidity] = useState(false);
    const t = today();
    const [f, setF] = useState({
        blotterDate: fmtDate(new Date()), incidentWhen: "", complaint: "VAWC (RA 9262)", narrative: "",
        complainantName: "", complainantAddress: "", complainantContact: "", complainantAge: "",
        respondentName: "", respondentAddress: "", respondentContact: "", respondentAge: "",
        sigName: "", sigDate: fmtDate(new Date()), sigTime: fmtTime(new Date()), assistedBy: "",
        p1: true, p2: false, p3: false,
        petsa: fmtDate(new Date()), oras: fmtTime(new Date()), vawcNo: "",
        rel_asawa: false, rel_livein: false, rel_kasintahan: false, rel_kasambahay: false,
        controlNo: "", applicantName: "", applicantAge: "", applicantAddress: "", applicantContact: "",
        applicantRelation: "", applicantOccupation: "",
        victimName: "", victimDob: "", victimAddress: "", victimContact: "", victimOccupation: "",
        respondentOccupation: "", consent: "", appDate: fmtDate(new Date()),
        v_single: false, v_married: false, v_widow: false, v_separated: false, v_legally: false,
        r_single: false, r_married: false, r_widow: false, r_separated: false, r_legally: false,
        rel_wife: false, rel_formerwife: false, rel_common: false, rel_dating: false, rel_sexual: false,
        act_threats: false, act_physical: false, offenseDate: "", offensePlace: "",
        caseNo: "", a: false, b: false, c: false,
        issueDay: t.day, issueMonth: t.month, issueYear: t.year,
        punongBarangay: "",
        toOffice: "PNP - Iba MPS (Women & Children Protection Desk)", attachedDocs: "blotter, complaint",
        purpose: "", endorseDate: fmtDate(new Date()), receivedBy: "", receivedDesignation: "", receivedAt: "",
    });
    const set = (patch) => setF(p => ({ ...p, ...patch }));

    useEffect(() => {
        Promise.all([
            api.get(`/admin/cases/${caseId}`),
            api.get(`/admin/officials`).catch(() => ({ data: { officials: [] } })),
        ]).then(([cr, or]) => {
            const c = cr.data; setCas(c);
            const offs = {};
            (or.data.officials || []).filter(o => o.is_active).forEach(o => { offs[o.role] = o.full_name; });
            const r = (c.reports || [])[0];
            const bpo = (c.bpos || []).slice().reverse().find(b => ["issued", "served"].includes(b.status)) || (c.bpos || [])[0];
            const v = c.victim || {};
            setF(p => ({
                ...p,
                caseNo: p.caseNo || c.case_number || "",
                controlNo: p.controlNo || bpo?.control_number || "",
                complainantName: p.complainantName || v.full_name || "",
                complainantAddress: p.complainantAddress || v.address || "",
                complainantContact: p.complainantContact || v.phone_number || "",
                complainantAge: p.complainantAge || ageFrom(v.date_of_birth),
                sigName: p.sigName || v.full_name || "",
                respondentName: p.respondentName || c.offender_name || "",
                applicantName: p.applicantName || c.applicant_name || v.full_name || "",
                applicantAddress: p.applicantAddress || c.applicant_address || v.address || "",
                applicantContact: p.applicantContact || c.applicant_contact || v.phone_number || "",
                applicantRelation: p.applicantRelation || c.applicant_relation || "Self (victim)",
                victimName: p.victimName || v.full_name || "",
                victimDob: p.victimDob || (v.date_of_birth ? fmtDate(v.date_of_birth) : ""),
                victimAddress: p.victimAddress || v.address || "",
                victimContact: p.victimContact || v.phone_number || "",
                incidentWhen: p.incidentWhen || [fmtDate(r?.incident_date), r?.address].filter(Boolean).join(" - "),
                offenseDate: p.offenseDate || fmtDate(r?.incident_date),
                offensePlace: p.offensePlace || (r?.address || ""),
                narrative: p.narrative || r?.statement || "",
                complaint: p.complaint || (abuseText(r) || "VAWC (RA 9262)"),
                consent: p.consent || c.applicant_consent_note || "",
                assistedBy: p.assistedBy || offs.bsdo || offs.vawc_officer || "",
                punongBarangay: p.punongBarangay || bpo?.issued_by_official || offs.punong_barangay || "",
                purpose: p.purpose || (c.endorsements || [])[0]?.purpose || "",
                // Reliefs a/b/c come straight from the recorded BPO
                a: bpo ? !!bpo.relief_stop_physical_harm : p.a,
                b: bpo ? !!bpo.relief_stop_threats : p.b,
                c: bpo ? !!bpo.relief_stay_away_100m : p.c,
                issueDay: bpo?.issued_at ? String(new Date(bpo.issued_at).getDate()) : p.issueDay,
                issueMonth: bpo?.issued_at ? MONTHS[new Date(bpo.issued_at).getMonth()] : p.issueMonth,
                issueYear: bpo?.issued_at ? String(new Date(bpo.issued_at).getFullYear()) : p.issueYear,
            }));
        }).catch(err => setError(err.response?.data?.detail || "Failed to load case."))
          .finally(() => setLoading(false));
    }, [caseId]);

    useEffect(() => {
        const prev = document.title;
        const cfg = DOC_TYPES[type];
        if (cfg && cas?.case_number) document.title = `${cfg.title} - ${cas.case_number}`.replace(/[\\/:*?"<>|]/g, "-");
        return () => { document.title = prev; };
    }, [type, cas]);

    const cfg = DOC_TYPES[type];
    if (!cfg) return <div style={{ padding: 40, textAlign: "center", fontFamily: "'Lexend',sans-serif" }}><p style={{ color: "#C62828" }}>Unknown document type: <code>{type}</code></p><button onClick={() => navigate(-1)}>Back</button></div>;
    if (loading) return <div style={{ padding: 40, textAlign: "center", fontFamily: "'Lexend',sans-serif" }}>Loading case…</div>;
    if (error)  return <div style={{ padding: 40, textAlign: "center", color: "#C62828", fontFamily: "'Lexend',sans-serif" }}>{error}</div>;
    if (!cas)   return null;

    const isRestricted = !!cas.restricted;
    const Doc = cfg.component;
    const bpo = (cas.bpos || []).slice().reverse().find(b => ["issued", "served"].includes(b.status)) || (cas.bpos || [])[0] || null;
    const endorsement = (cas.endorsements || [])[(cas.endorsements || []).length - 1] || null;

    return (
        <>
            <style>{CSS}</style>
            <div className="pd-wrap">
                <div className="pd-toolbar">
                    <div>
                        <h1>{cfg.title}</h1>
                        <p>{cfg.office} · Case {cas.case_number}</p>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        {(type === "bpo" || type === "bpo-app") && (
                            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#475569", fontFamily: "'Lexend',sans-serif" }}>
                                <input type="checkbox" checked={showValidity} onChange={e => setShowValidity(e.target.checked)} />
                                Add 15-day validity line
                            </label>
                        )}
                        <button className="pd-btn-ghost" onClick={() => navigate(`/reports/${caseId}`)}>← Back to case</button>
                        <button className="pd-btn" onClick={() => window.print()} disabled={isRestricted}>Print Document</button>
                    </div>
                </div>

                {isRestricted && <div className="pd-banner"><strong>Restricted view -</strong> Sensitive fields are masked. Super Admin access is required to produce a printable official document.</div>}
                {(type === "bpo" || type === "bpo-app") && !bpo && <div className="pd-banner">No BPO recorded for this case yet — the reliefs and issue date will print blank. Apply for a BPO from the case actions to auto-fill them.</div>}

                <Doc f={f} set={set} bpo={bpo} endorsement={endorsement} kids={cas.children || []} showValidity={showValidity} />
            </div>
        </>
    );
}
