import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import api from "../api";
import { spreadCode } from '../components/otpBoxes';

if (!document.getElementById('vawc-font')) {
    const l = document.createElement('link'); l.id='vawc-font'; l.rel='stylesheet';
    l.href='https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}
if (!document.getElementById('vawc-victim-css')) {
    const s = document.createElement('style'); s.id='vawc-victim-css';
    s.textContent=`
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      /* The box she is typing in is the only thing on this screen that moves. */
      .vi-otp{transition:border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;}
      .vi-otp:focus{border-color:#F47920!important;box-shadow:0 0 0 3px rgba(244,121,32,0.18)!important;outline:none;}
      /* Darkens on hover rather than lifting. Buttons that rise off the page are
         the same costume as a gradient: decoration standing in for hierarchy. */
      .vi-btn{transition:background-color 0.15s ease;}
      .vi-btn:hover:not([disabled]){background:#C45E10!important;}
      .vi-ghost{transition:background-color 0.15s ease, border-color 0.15s ease;}
      .vi-ghost:hover:not([disabled]){background:var(--surface-tint)!important;border-color:#F0B27A!important;}
      .vi-link{transition:opacity 0.15s ease;}
      .vi-link:hover{opacity:0.72;}
      @media (prefers-reduced-motion: reduce){ .vi-otp,.vi-btn,.vi-ghost,.vi-link{transition:none} }
    `;
    document.head.appendChild(s);
}

const IcoShield = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#F47920" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoWarn   = ({ c='#92400E' }) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke={c} strokeWidth="1.8" strokeLinecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke={c} strokeWidth="2.4" strokeLinecap="round"/></svg>);
const IcoCheck  = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoPhone  = ({ c='#475569' }) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const Spinner   = () => (<span style={{width:14,height:14,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius: '50%',animation:'spin 0.7s linear infinite',display:'inline-block',flexShrink:0}} />);

function OTP() {
    const navigate = useNavigate();
    const location = useLocation();
    const isPending = location.state?.pendingVerification || false;

    const [otp,           setOtp]           = useState(['','','','','','']);
    const [countdown,     setCountdown]     = useState(45);
    const [canResend,     setCanResend]     = useState(false);
    const [loading,       setLoading]       = useState(false);
    const [channel,       setChannel]       = useState('email');
    const [switchLoading, setSwitchLoading] = useState(false);
    const [error,         setError]         = useState('');
    const [resendSuccess, setResendSuccess] = useState(false);
    // Hide the "send to mobile" route unless the server can deliver SMS.
    const [smsAvailable,  setSmsAvailable]  = useState(false);
    const inputs = useRef([]);

    const phone = localStorage.getItem("pending_phone") || "";
    const email = localStorage.getItem("pending_email") || "";
    const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
    const maskedPhone = phone.length >= 7 ? phone.slice(0,3)+"****"+phone.slice(-4) : phone;

    useEffect(() => {
        api.get("/auth/channels")
            .then(r => setSmsAvailable(!!r.data?.sms))
            .catch(() => setSmsAvailable(false));
    }, []);

    useEffect(() => {
        if (countdown > 0) { const t = setTimeout(()=>setCountdown(c=>c-1),1000); return ()=>clearTimeout(t); }
        else setCanResend(true);
    }, [countdown]);

    const handleChange = (val, i) => {
        // More than one character means a paste the browser routed through
        // onChange, or an autofilled code dropped whole into the first box.
        if (val.length > 1) { spreadCode(val, i, otp, setOtp, inputs); return; }
        if (!/^\d*$/.test(val)) return;
        const n=[...otp]; n[i]=val; setOtp(n);
        if (val && i<5) inputs.current[i+1]?.focus();
    };
    const handleKeyDown = (e, i) => { if (e.key==='Backspace' && !otp[i] && i>0) inputs.current[i-1]?.focus(); };
    const handlePaste = (e, i) => {
        if (spreadCode(e.clipboardData?.getData('text'), i, otp, setOtp, inputs)) e.preventDefault();
    };

    const handleSwitch = async () => {
        if (channel==='phone') return;
        setSwitchLoading(true); setError(''); setResendSuccess(false);
        try { await api.post("/auth/otp/send",{phone_number:phone}); setChannel('phone'); setOtp(['','','','','','']); setCountdown(45); setCanResend(false); }
        catch { setError("Failed to send code to mobile. Please try again."); }
        finally { setSwitchLoading(false); }
    };

    const handleResend = async () => {
        if (!canResend) return;
        setError(''); setResendSuccess(false);
        try {
            if (channel==='email') await api.post("/auth/otp/send-email",{phone_number:phone});
            else                   await api.post("/auth/otp/send",{phone_number:phone});
            setCountdown(45); setCanResend(false); setOtp(['','','','','','']); setResendSuccess(true);
        } catch { setError("Failed to resend OTP. Please try again."); }
    };

    const handleVerify = async () => {
        const code = otp.join("");
        if (code.length<6) { setError("Please enter the complete 6-digit code."); return; }
        setLoading(true); setError('');
        try {
            const res = await api.post("/auth/otp/verify",{phone_number:phone,code});
            localStorage.setItem("token",res.data.access_token);
            localStorage.removeItem("pending_phone"); localStorage.removeItem("pending_email");
            navigate('/',{state:{accountCreated:true}});
        } catch (err) { setError(err.response?.data?.detail||"Invalid or expired OTP."); }
        finally { setLoading(false); }
    };

    return (
        <div style={S.page}>
            <div style={{ position: 'fixed', top: 14, right: 14, zIndex: 50 }}><ThemeToggle size={44} /></div>
            <div style={S.brand}>
                <div style={S.brandIcon}><IcoShield /></div>
                <div>
                    <h1 style={S.brandTitle}>Verify Your Account</h1>
                    <p style={S.brandSub}>
                        {/* Themed, not a fixed dark green: on the dark background that colour
                            sat almost on top of it, and the address is the one thing here
                            she needs to read back to herself. */}
                        {channel==='email' ? <>Code sent to <strong style={{color:'var(--text)'}}>{maskedEmail}</strong></> : <>Code sent to <strong style={{color:'var(--text)'}}>{maskedPhone}</strong></>}
                    </p>
                </div>
            </div>

            {isPending && (
                <div style={{...S.banner, backgroundColor:'#FFFBEB', borderColor:'#FDE68A', maxWidth:420, width:'100%', marginBottom:14}}>
                    <IcoWarn />
                    <div>
                        <p style={S.bannerTitle}>Your previous code may have expired</p>
                        <p style={S.bannerText}>Please request a new code using the <strong>Resend</strong> button below.</p>
                    </div>
                </div>
            )}

            <div style={S.card}>
                {/* One line, not four bullets in a third colour. Three of them said
                    what the screen already shows, and a wall of instructions above
                    an input is the thing people scroll past to reach the input. */}
                <p style={S.lead}>
                    Enter the 6-digit code. It expires in 5 minutes.
                </p>

                {/* OTP boxes */}
                <div style={S.otpRow} role="group" aria-label="6-digit verification code">
                    {otp.map((digit,i)=>(
                        <input key={i} className="vi-otp" ref={el=>inputs.current[i]=el}
                            type="text" inputMode="numeric" autoComplete={i===0?'one-time-code':'off'}
                            aria-label={`Digit ${i+1} of 6`} maxLength={1} value={digit}
                            onChange={e=>handleChange(e.target.value,i)}
                            onKeyDown={e=>handleKeyDown(e,i)}
                            onPaste={e=>handlePaste(e,i)}
                            style={{...S.otpBox, borderColor:digit?'#F47920':'var(--border)'}} />
                    ))}
                </div>

                {error && (
                    <div style={{display:'flex',alignItems:'center',gap:8,backgroundColor:'#FFF1F2',border:'1px solid #FECDD3',borderRadius:10,padding:'10px 13px',marginBottom:14,animation:'fadeUp 0.2s ease'}}>
                        <IcoWarn c="#BE123C" />
                        <p style={{margin:0,fontSize:13,color:'#BE123C',fontFamily:"'Lexend', sans-serif"}}>{error}</p>
                    </div>
                )}
                {resendSuccess && (
                    <div style={{display:'flex',alignItems:'center',gap:8,backgroundColor:'#ECFDF5',border:'1px solid #A7F3D0',borderRadius:10,padding:'10px 13px',marginBottom:14,animation:'fadeUp 0.2s ease'}}>
                        <IcoCheck />
                        <p style={{margin:0,fontSize:13,color:'#065F46',fontFamily:"'Lexend', sans-serif"}}>New code sent. Check your {channel==='email'?'email (and spam folder)':'mobile number'}.</p>
                    </div>
                )}

                <button className="vi-btn" style={{...S.verifyBtn,opacity:loading?0.75:1}} onClick={handleVerify} disabled={loading}>
                    {loading?<><Spinner /> Verifying…</>:'Verify Account'}
                </button>

                <div style={S.divider} />

                <p style={S.foot}>
                    Didn't receive a code?{' '}
                    {canResend
                        ? <button type="button" className="vi-link" style={S.link} onClick={handleResend}>Resend</button>
                        : <span style={{color:'var(--text-muted)',fontWeight:600}}>Resend in 0:{countdown<10?`0${countdown}`:countdown}</span>
                    }
                </p>

                {channel==='email' && (
                    <p style={{...S.foot, fontSize:12.5, marginTop:4}}>
                        Check your spam folder. The email also carries a link that works for an hour.
                    </p>
                )}

                {/* Asking for the text is what sends it. Nothing was texted at
                    registration, so this is not a duplicate of something she
                    already has. */}
                {channel==='email' && smsAvailable && (
                    <button className="vi-ghost" style={{...S.switchBtn,opacity:switchLoading?0.7:1}} onClick={handleSwitch} disabled={switchLoading}>
                        <IcoPhone />
                        {switchLoading?"Sending…":"Text it to me instead"}
                    </button>
                )}
                {channel==='phone' && (
                    <p style={{...S.foot, marginTop:12}}>
                        Wrong number?{' '}
                        <button type="button" className="vi-link" style={S.link} onClick={()=>{setChannel('email');setOtp(['','','','','','']);setCountdown(45);setCanResend(false);setError('');setResendSuccess(false);}}>Use email instead</button>
                    </p>
                )}
            </div>
        </div>
    );
}

const S = {
    page:       {minHeight:'100vh',background:'var(--page-grad)',color:'var(--text)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px',fontFamily:"'Lexend', sans-serif"},
    brand:      {display:'flex',alignItems:'center',gap:14,marginBottom:16,width:'100%',maxWidth:420},
    brandIcon:  {width:44,height:44,borderRadius:12,backgroundColor:'var(--surface)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0},
    brandTitle: {fontSize:18,fontWeight:800,color:'var(--accent-text)',margin:'0 0 3px',fontFamily:"'Lexend', sans-serif"},
    brandSub:   {fontSize:13,color:'var(--text-body)',margin:0,fontFamily:"'Lexend', sans-serif"},
    banner:     {display:'flex',alignItems:'flex-start',gap:10,borderRadius:12,padding:'13px 15px',border:'1px solid',boxSizing:'border-box'},
    bannerTitle:{fontSize:13.5,fontWeight:700,color:'#92400E',margin:'0 0 3px',fontFamily:"'Lexend', sans-serif"},
    bannerText: {fontSize:12.5,color:'#78350F',margin:0,lineHeight:1.5,fontFamily:"'Lexend', sans-serif"},
    // One radius scale, 12 for anything that holds something and 10 for
    // controls, instead of the 4 / 12 / 50% mixture that was here. A surface
    // that cannot decide how round it is looks assembled rather than designed.
    card:       {backgroundColor:'var(--surface)',borderRadius:14,padding:'22px 20px',width:'100%',maxWidth:420,boxShadow:'0 1px 3px rgba(15,23,42,0.06)',border:'1px solid var(--border)'},
    lead:       {margin:'0 0 16px',fontSize:13,lineHeight:1.55,color:'var(--text-muted)',textAlign:'center',fontFamily:"'Lexend', sans-serif"},
    otpRow:     {display:'flex',justifyContent:'space-between',gap:8,marginBottom:18},
    // Taller and quieter. A filled box used to go pink behind an orange border,
    // two accents on the same 50px of screen; now only the border answers.
    otpBox:     {width:'100%',maxWidth:54,height:62,borderRadius:10,border:'1.5px solid var(--border)',backgroundColor:'var(--surface-alt)',fontSize:24,fontWeight:700,textAlign:'center',color:'var(--text)',outline:'none',fontFamily:"'Lexend', sans-serif",caretColor:'#F47920'},
    verifyBtn:  {width:'100%',padding:'14px 16px',backgroundColor:'#F47920',color:'#fff',fontSize:15,fontWeight:700,border:'none',borderRadius:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontFamily:"'Lexend', sans-serif"},
    divider:    {height:1,backgroundColor:'var(--border-soft)',margin:'18px 0 14px'},
    foot:       {textAlign:'center',fontSize:13.5,lineHeight:1.55,color:'var(--text-muted)',margin:0,fontFamily:"'Lexend', sans-serif"},
    link:       {color:'var(--accent-text)',fontWeight:700,cursor:'pointer',fontFamily:"'Lexend', sans-serif",background:'none',border:'none',padding:0,fontSize:'inherit'},
    switchBtn:  {width:'100%',padding:'12px 14px',backgroundColor:'var(--surface)',color:'var(--text-body)',fontSize:13.5,fontWeight:600,border:'1.5px solid var(--border)',borderRadius:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontFamily:"'Lexend', sans-serif",marginTop:14},
};

export default OTP;
