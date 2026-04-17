import { useState, useEffect, useRef } from "react";

// ════════════════════════════════════════════════════════════
//  CONFIGURATION — paste your Google Apps Script URLs here
// ════════════════════════════════════════════════════════════
const CONFIG = {
  REIMBURSEMENT_URL: "YOUR_REIMBURSEMENT_SCRIPT_URL_HERE",
  CONTRACT_URL:      "YOUR_CONTRACT_SCRIPT_URL_HERE",
  ADMIN_PIN:         "1234",
};

// ════════════════════════════════════════════════════════════
//  CONSTANTS
// ════════════════════════════════════════════════════════════
const REIMB_TYPES = [
  "Meals – Breakfast","Meals – Lunch","Meals – Dinner",
  "Air Travel","Checked Luggage","Refreshments",
];

const DEPARTMENTS = [
  "Food & Beverage","Housekeeping","Guest Services","Entertainment",
  "Shore Excursions","Spa & Fitness","Casino","Retail",
  "Navigation & Deck","Engineering","Medical","Safety & Security",
  "Human Resources","Finance","IT","Other",
];

const NCL_SHIPS = [
  "Norwegian Aqua","Norwegian Bliss","Norwegian Breakaway","Norwegian Dawn",
  "Norwegian Encore","Norwegian Epic","Norwegian Escape","Norwegian Getaway",
  "Norwegian Gem","Norwegian Jade","Norwegian Joy","Norwegian Pearl",
  "Norwegian Prima","Norwegian Sky","Norwegian Spirit","Norwegian Star",
  "Norwegian Sun","Norwegian Viva","Pride of America",
];

const CONTRACT_REASONS = [
  "Family emergency","Personal health","Work performance","Crew agreement",
  "Visa / documentation","Voluntary request","Other",
];

const REQUEST_STATUSES = ["New","Approved","Done","Denied"];

const REQ_STATUS_META = {
  New:      { bg:"#EBF5F5", text:"#00484F" },
  Approved: { bg:"#EAF4F0", text:"#1A6645" },
  Done:     { bg:"#F0EDE6", text:"#5C4A1E" },
  Denied:   { bg:"#FDEEED", text:"#8B1A1A" },
};

const STATUS_META = {
  Pending:  { bg:"#FEF9EC", text:"#7A5C0A", dot:"#C9A84C" },
  Approved: { bg:"#EAF4F0", text:"#1A6645", dot:"#68ACAA" },
  Rejected: { bg:"#FDEEED", text:"#8B1A1A", dot:"#C0392B" },
};

const FONT = "https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300&family=Besley:ital@1&display=swap";

// ════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════
const uid  = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const fmt  = v  => `$${parseFloat(v||0).toFixed(2)}`;
const fmtD = ts => new Date(ts).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});

function readFile(f) {
  return new Promise(res => { const r=new FileReader(); r.onload=e=>res(e.target.result); r.readAsDataURL(f); });
}

// Google Sheets write — submits as URL-encoded params via no-cors fetch
async function writeToSheet(url, payload) {
  if (!url || url.startsWith("YOUR_")) return { ok: false, demo: true };
  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: JSON.stringify(payload) }).toString(),
    });
    return { ok: true };
  } catch (e) {
    console.error("Sheet write error:", e);
    return { ok: false };
  }
}

// Google Sheets read
async function readFromSheet(url) {
  if (!url || url.startsWith("YOUR_")) return null;
  try {
    const r = await fetch(url + "?action=read", { mode: "cors" });
    return await r.json();
  } catch { return null; }
}

// Local fallback store (demo mode when no script URL set)
const LS = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)||"[]"); } catch { return []; } },
  set: (k,v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ════════════════════════════════════════════════════════════
//  ICONS
// ════════════════════════════════════════════════════════════
const Ic = {
  anchor:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{width:22,height:22}}><circle cx="12" cy="5" r="3"/><line x1="12" y1="8" x2="12" y2="21"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg>,
  receipt:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{width:28,height:28}}><path d="M14 2H6a2 2 0 0 0-2 2v16l3-2 2 2 2-2 2 2 2-2 3 2V4a2 2 0 0 0-2-2z"/><line x1="16" y1="8" x2="8" y2="8"/><line x1="16" y1="12" x2="8" y2="12"/></svg>,
  contract: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{width:28,height:28}}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="8" y1="17" x2="14" y2="17"/></svg>,
  admin:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{width:20,height:20}}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
  check:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:18,height:18}}><polyline points="20 6 9 17 4 12"/></svg>,
  plus:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  trash:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{width:14,height:14}}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>,
  upload:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{width:22,height:22}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  download: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{width:15,height:15}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  eye:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{width:13,height:13}}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  close:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  arrow:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  back:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  lock:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{width:36,height:36}}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  warn:     <svg viewBox="0 0 16 16" fill="currentColor" style={{width:12,height:12,flexShrink:0}}><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 3.5a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 4.5zm0 6.5a.875.875 0 1 1 0-1.75A.875.875 0 0 1 8 11z"/></svg>,
  ship:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{width:22,height:22}}><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2"/><path d="M22 20l-2-10H4L2 20"/><path d="M12 2v8"/><path d="M8 10V6h8v4"/></svg>,
  refresh:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{width:15,height:15}}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
};

// ════════════════════════════════════════════════════════════
//  CSS
// ════════════════════════════════════════════════════════════
const CSS = `
@import url('${FONT}');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  /* NCL Primary Palette */
  --sand:   #EBE7DF;
  --yellow: #E6CD88;
  --aqua:   #A7CAC6;
  --med-blue:#8EBFC2;
  --teal:   #68ACAA;
  /* NCL Secondary Palette */
  --turq:   #00484F;
  --ocean:  #006099;
  --ncl-blue:#0A84BD;
  --salmon: #FF938A;
  --black:  #1A1A18;
  /* App tokens */
  --bg:     #EBE7DF;
  --surface:#F7F5F1;
  --white:  #FAFAF8;
  --border: #D8D3C8;
  --muted:  #7A7469;
  --red:    #C0392B;
  --r:      0px;
  --sh:     0 2px 12px rgba(0,72,79,.08);
  --sh-lg:  0 12px 40px rgba(0,72,79,.16);
}
html,body{height:100%;margin:0}
body{font-family:'Poppins',sans-serif;background:var(--bg);color:var(--black);-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;overflow-x:hidden}
.app{min-height:100vh;min-height:100dvh;display:flex;flex-direction:column}

/* ── Header ── */
.hdr{background:var(--turq);height:56px;padding:0 28px;display:flex;align-items:center;
  justify-content:space-between;position:sticky;top:0;z-index:200;
  border-bottom:1px solid rgba(168,202,198,.25);box-shadow:0 2px 16px rgba(0,72,79,.2)}
.brand{display:flex;align-items:center;gap:10px;font-family:'Poppins',sans-serif;
  color:var(--sand);font-size:13px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;
  cursor:pointer;flex-shrink:0}
.brand-pill{background:var(--yellow);color:var(--turq);font-family:'Poppins',sans-serif;
  font-size:9px;font-weight:700;padding:2px 8px;border-radius:0;
  letter-spacing:.8px;text-transform:uppercase}
.hdr-right{display:flex;align-items:center;gap:6px;flex-shrink:0}
.hdr-btn{display:flex;align-items:center;gap:5px;padding:6px 14px;border-radius:0;border:none;
  background:rgba(255,255,255,.08);color:rgba(235,231,223,.7);font-family:'Poppins',sans-serif;
  font-size:11px;font-weight:600;cursor:pointer;transition:all .2s;white-space:nowrap;
  text-transform:uppercase;letter-spacing:.4px}
.hdr-btn:hover{background:rgba(255,255,255,.15);color:var(--sand)}
.hdr-btn.active{background:var(--yellow);color:var(--turq)}

/* ── Main ── */
.main{flex:1;padding:36px 28px;max-width:900px;margin:0 auto;width:100%}
.main.wide{max-width:1180px}

/* ── Page heading ── */
.ph{margin-bottom:24px;border-bottom:1px solid var(--border);padding-bottom:18px}
.ph h2{font-family:'Poppins',sans-serif;font-size:20px;font-weight:600;color:var(--black);
  letter-spacing:.4px;text-transform:uppercase;margin-bottom:4px}
.ph p{color:var(--muted);font-size:12px;font-weight:300;font-family:'Besley',serif;font-style:italic}

/* ── Cards ── */
.card{background:var(--white);border-radius:var(--r);border:1px solid var(--border);
  box-shadow:var(--sh);padding:24px}
.card-sm{padding:16px}

/* ── Landing page ── */
.landing{display:flex;flex-direction:column;align-items:center;padding:48px 20px 40px;width:100%}
.landing-logo{width:60px;height:60px;background:var(--turq);border-radius:0;
  display:flex;align-items:center;justify-content:center;color:var(--yellow);
  margin-bottom:20px;flex-shrink:0}
.landing-eyebrow{font-family:'Besley',serif;font-style:italic;font-size:15px;
  color:var(--teal);margin-bottom:6px;letter-spacing:.3px}
.landing h1{font-family:'Poppins',sans-serif;font-size:22px;font-weight:600;color:var(--black);
  margin-bottom:10px;text-align:center;letter-spacing:.6px;text-transform:uppercase;line-height:1.3}
.landing-sub{color:var(--muted);font-size:13px;margin-bottom:36px;text-align:center;
  max-width:360px;font-weight:300;line-height:1.7}
.landing-cards{display:grid;grid-template-columns:1fr 1fr;gap:16px;width:100%;max-width:560px}
.landing-card{background:var(--white);border:1px solid var(--border);border-radius:0;
  padding:28px 22px;cursor:pointer;transition:all .2s;text-align:center;
  box-shadow:var(--sh);position:relative;overflow:hidden;-webkit-tap-highlight-color:transparent;
  border-top:3px solid transparent}
.landing-card:hover{border-top-color:var(--teal);transform:translateY(-2px);box-shadow:var(--sh-lg)}
.landing-card:active{transform:scale(.99)}
.landing-card-icon{width:50px;height:50px;background:var(--aqua);border-radius:0;
  display:flex;align-items:center;justify-content:center;color:var(--turq);
  margin:0 auto 16px;transition:background .2s}
.landing-card:hover .landing-card-icon{background:var(--teal);color:var(--white)}
.landing-card h3{font-family:'Poppins',sans-serif;font-size:13px;font-weight:600;color:var(--black);
  margin-bottom:7px;letter-spacing:.4px;text-transform:uppercase}
.landing-card p{font-size:12px;color:var(--muted);font-weight:300;line-height:1.6}
.arrow-hint{display:flex;align-items:center;justify-content:center;gap:4px;
  margin-top:14px;font-size:9px;font-weight:700;color:var(--teal);
  letter-spacing:.8px;text-transform:uppercase}

/* ── Steps ── */
.steps{display:flex;align-items:center;margin-bottom:20px}
.step-item{display:flex;align-items:center;gap:7px;font-size:9px;font-weight:700;
  letter-spacing:.7px;text-transform:uppercase;color:var(--muted);white-space:nowrap}
.step-item.active{color:var(--turq)}
.step-item.done{color:var(--teal)}
.step-num{width:22px;height:22px;border-radius:0;border:2px solid currentColor;
  display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;flex-shrink:0}
.step-item.active .step-num{background:var(--turq);color:var(--white);border-color:var(--turq)}
.step-item.done .step-num{background:var(--teal);color:var(--white);border-color:var(--teal)}
.step-line{flex:1;height:1px;background:var(--border);margin:0 10px;min-width:12px}

/* ── Form ── */
.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
.full{grid-column:1/-1}
.fg{display:flex;flex-direction:column;gap:5px}
.fg label{font-size:9px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;
  color:var(--black);opacity:.55}
.fg input,.fg select,.fg textarea{
  height:46px;padding:0 14px;border:1px solid var(--border);border-radius:0;
  border-bottom:2px solid var(--border);
  font-family:'Poppins',sans-serif;font-size:14px;color:var(--black);background:var(--white);
  outline:none;transition:border-color .2s,box-shadow .2s;appearance:none;-webkit-appearance:none;width:100%}
.fg textarea{height:84px;padding:12px 14px;resize:vertical;font-size:13px}
.fg input:focus,.fg select:focus,.fg textarea:focus{
  border-bottom-color:var(--teal);box-shadow:0 2px 0 var(--teal)}
.fg input.err,.fg select.err{border-bottom-color:var(--red);box-shadow:0 2px 0 var(--red)}
.fg select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='7' viewBox='0 0 11 7'%3E%3Cpath d='M1 1l4.5 4.5L10 1' stroke='%231A1A18' stroke-width='1.6' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 14px center;padding-right:36px}
.field-err{font-size:10px;color:var(--red);font-weight:600;margin-top:3px;display:flex;align-items:center;gap:4px}
.amt-wrap{position:relative}
.amt-pre{position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:14px;color:var(--muted);pointer-events:none}
.amt-wrap input{padding-left:26px!important}
.form-divider{height:1px;background:var(--border);margin:20px 0}
.form-section-label{font-size:9px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;
  color:var(--muted);margin-bottom:14px}

/* ── Buttons ── */
.btn{display:inline-flex;align-items:center;gap:7px;font-family:'Poppins',sans-serif;
  font-weight:600;cursor:pointer;border:none;border-radius:0;transition:all .2s;
  white-space:nowrap;-webkit-tap-highlight-color:transparent;letter-spacing:.4px;text-transform:uppercase;font-size:11px}
.btn-primary{background:var(--turq);color:var(--yellow);padding:0 28px;height:48px;font-size:11px}
.btn-primary:hover{background:var(--ocean);box-shadow:0 4px 16px rgba(0,72,79,.3)}
.btn-primary:active{transform:scale(.99)}
.btn-primary:disabled{opacity:.4;cursor:not-allowed;transform:none;box-shadow:none}
.btn-ghost{background:transparent;border:1.5px solid var(--turq);color:var(--turq);
  padding:0 20px;height:48px}
.btn-ghost:hover{background:rgba(0,72,79,.06)}
.btn-ghost:active{transform:scale(.99)}
.btn-sm{font-size:10px;padding:0 11px;height:28px;border-radius:0;border:none;letter-spacing:.3px}
.btn-outline{background:transparent;border:1.5px solid var(--border);color:var(--black);
  font-size:10px;padding:0 16px;height:34px;letter-spacing:.4px}
.btn-outline:hover{border-color:var(--turq);color:var(--turq);background:transparent}
.btn-add{background:rgba(104,172,170,.1);color:var(--turq);border:1.5px dashed rgba(104,172,170,.5);
  border-radius:0;padding:14px;width:100%;font-size:11px;
  justify-content:center;margin-top:10px}
.btn-add:hover{background:rgba(104,172,170,.18);border-color:var(--teal)}
.btn-approve{background:rgba(104,172,170,.15);color:var(--turq);border:1px solid rgba(104,172,170,.4)}
.btn-approve:hover{background:rgba(104,172,170,.25)}
.btn-reject{background:rgba(192,57,43,.08);color:var(--red);border:1px solid rgba(192,57,43,.25)}
.btn-reject:hover{background:rgba(192,57,43,.15)}
.btn-view-r{background:var(--bg);color:var(--black);border:1px solid var(--border)}
.btn-view-r:hover{background:var(--aqua);color:var(--turq);border-color:var(--aqua)}
.btn-del{background:transparent;color:var(--muted);border:none;padding:0 4px;height:26px}
.btn-del:hover{color:var(--red)}
.form-actions{display:flex;justify-content:space-between;align-items:center;margin-top:22px;gap:10px}

/* ── Upload ── */
.uzone{border:1px dashed var(--border);border-radius:0;padding:22px 16px;text-align:center;
  cursor:pointer;transition:all .2s;background:var(--surface);position:relative;
  -webkit-tap-highlight-color:transparent}
.uzone:hover,.uzone.drag{border-color:var(--teal);background:rgba(104,172,170,.06)}
.uzone:active{transform:scale(.99)}
.uzone input[type=file]{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.uzone-text{font-size:11px;color:var(--muted);margin-top:5px;font-weight:300}
.upreview{display:flex;align-items:center;gap:8px;background:rgba(104,172,170,.12);
  border:1px solid rgba(104,172,170,.35);border-radius:0;padding:10px 14px;
  font-size:12px;color:var(--turq);font-weight:500}
.upreview .rm{margin-left:auto;background:none;border:none;cursor:pointer;
  color:var(--turq);font-size:10px;font-weight:700;font-family:'Poppins',sans-serif;padding:4px 8px}

/* ── Line item ── */
.line-card{background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--aqua);
  border-radius:0;padding:18px;margin-bottom:10px}
.line-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.line-label{font-size:9px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;
  color:var(--muted);display:flex;align-items:center;gap:8px}
.line-badge{background:var(--turq);color:var(--white);width:20px;height:20px;border-radius:0;
  display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:800}
.btn-remove{background:none;border:none;cursor:pointer;color:var(--muted);
  padding:6px;border-radius:0;display:flex;transition:color .15s;-webkit-tap-highlight-color:transparent}
.btn-remove:hover{color:var(--red)}

/* ── Identity chip ── */
.id-chip{display:flex;align-items:center;gap:8px;background:rgba(0,72,79,.05);
  border:1px solid rgba(0,72,79,.15);border-radius:0;padding:10px 16px;
  font-size:12px;margin-bottom:14px;flex-wrap:wrap;row-gap:4px;border-left:3px solid var(--teal)}
.mpill{font-size:10px;background:var(--yellow);color:var(--turq);padding:2px 8px;border-radius:0;font-weight:700;letter-spacing:.3px}

/* ── Summary table ── */
.stbl{width:100%;border-collapse:collapse;font-size:12px}
.stbl th{text-align:left;font-size:9px;font-weight:700;letter-spacing:.7px;
  text-transform:uppercase;color:var(--muted);padding:5px 10px;border-bottom:1px solid var(--border)}
.stbl td{padding:9px 10px;border-bottom:1px solid var(--border);vertical-align:middle}
.stbl tr:last-child td{border-bottom:none}
.stbl-total{display:flex;justify-content:space-between;padding:12px 10px 0;
  font-weight:700;font-size:14px;border-top:2px solid var(--turq);margin-top:4px;color:var(--turq)}

/* ── Admin stats ── */
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.stat{background:var(--white);border:1px solid var(--border);border-radius:0;
  padding:16px 18px;border-top:3px solid var(--aqua)}
.stat-lbl{font-size:9px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;
  color:var(--muted);display:block;margin-bottom:6px}
.stat-val{font-family:'Poppins',sans-serif;font-size:24px;font-weight:600;color:var(--turq);display:block}
.stat-sub{font-size:10px;color:var(--muted);display:block;margin-top:2px;font-style:italic;font-family:'Besley',serif}

/* ── Admin tabs ── */
.view-tabs{display:flex;gap:0;background:var(--white);padding:0;border-radius:0;
  width:100%;margin-bottom:18px;border:1px solid var(--border);border-bottom:2px solid var(--teal)}
.view-tab{flex:1;padding:10px 14px;border-radius:0;border:none;background:transparent;
  color:var(--muted);font-family:'Poppins',sans-serif;font-size:10px;font-weight:700;
  cursor:pointer;transition:all .2s;letter-spacing:.5px;text-align:center;text-transform:uppercase;
  border-bottom:2px solid transparent;margin-bottom:-2px}
.view-tab.active{background:var(--white);color:var(--turq);border-bottom-color:var(--turq)}
.view-tab:not(.active):hover{background:var(--surface);color:var(--turq)}

/* ── Filters ── */
.filters{display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap}
.fsel{height:34px;padding:0 28px 0 10px;border:1px solid var(--border);border-radius:0;
  font-family:'Poppins',sans-serif;font-size:10px;font-weight:500;color:var(--black);
  background:var(--white) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='7' viewBox='0 0 11 7'%3E%3Cpath d='M1 1l4.5 4.5L10 1' stroke='%231A1A18' stroke-width='1.6' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 10px center;
  appearance:none;outline:none;cursor:pointer;-webkit-appearance:none;letter-spacing:.2px}
.flbl{font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.7px}
.sp{flex:1}

/* ── Table ── */
.tbl-wrap{overflow-x:auto;border-radius:0;border:1px solid var(--border);
  -webkit-overflow-scrolling:touch}
table{width:100%;border-collapse:collapse;font-size:11px}
thead{background:var(--turq);color:var(--sand)}
thead th{padding:11px 13px;text-align:left;font-size:9px;font-weight:700;
  letter-spacing:.6px;text-transform:uppercase;white-space:nowrap}
tbody tr{border-bottom:1px solid var(--border);transition:background .12s}
tbody tr:last-child{border-bottom:none}
tbody tr:hover{background:rgba(167,202,198,.1)}
tbody td{padding:10px 13px;vertical-align:middle}
.sbadge{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:0;
  font-size:9px;font-weight:700;letter-spacing:.4px;white-space:nowrap}
.sdot{width:5px;height:5px;border-radius:50%;flex-shrink:0}
.act{display:flex;gap:4px;align-items:center}
.empty-tbl{text-align:center;padding:52px 20px;color:var(--muted);font-size:12px;
  font-family:'Besley',serif;font-style:italic}

/* ── Inline request status select ── */
.req-sel{height:26px;padding:0 22px 0 8px;border-radius:0;border:none;
  font-family:'Poppins',sans-serif;font-size:9px;font-weight:700;cursor:pointer;
  letter-spacing:.3px;text-transform:uppercase;
  outline:none;appearance:none;-webkit-appearance:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='6' viewBox='0 0 9 6'%3E%3Cpath d='M1 1l3.5 3.5L8 1' stroke='currentColor' stroke-width='1.4' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 7px center;transition:filter .15s}
.req-sel:hover{filter:brightness(.92)}

/* ── Send notification checkbox ── */
.notif-wrap{display:flex;align-items:center;justify-content:center}
.notif-cb{width:18px;height:18px;border:2px solid var(--border);border-radius:0;
  cursor:pointer;accent-color:var(--turq);flex-shrink:0}

/* ── Admin PIN gate ── */
.pin-gate{display:flex;flex-direction:column;align-items:center;
  padding:72px 20px 40px;min-height:60vh;justify-content:center}
.pin-icon{color:var(--turq);margin-bottom:20px;opacity:.2}
.pin-gate h3{font-family:'Poppins',sans-serif;font-size:16px;font-weight:600;
  letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px}
.pin-gate p{color:var(--muted);font-size:12px;margin-bottom:28px;text-align:center;
  font-family:'Besley',serif;font-style:italic}
.pin-input-wrap{display:flex;gap:12px;margin-bottom:12px}
.pin-input{width:56px;height:64px;border:1px solid var(--border);border-bottom:3px solid var(--border);
  border-radius:0;text-align:center;font-size:26px;font-weight:700;
  font-family:'Poppins',sans-serif;color:var(--turq);outline:none;
  transition:border-color .2s;background:var(--white);-webkit-text-security:disc}
.pin-input:focus{border-bottom-color:var(--teal);box-shadow:0 3px 0 var(--teal)}
.pin-input.pin-err{border-bottom-color:var(--red);animation:shake .35s}
.pin-hint{font-size:11px;color:var(--red);font-weight:600;min-height:18px;text-align:center}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}

/* ── Modal ── */
.overlay{position:fixed;inset:0;background:rgba(0,72,79,.55);backdrop-filter:blur(4px);
  z-index:300;display:flex;align-items:flex-end;justify-content:center}
.modal{background:var(--white);border-radius:0;width:100%;
  box-shadow:var(--sh-lg);overflow:hidden;max-height:85vh;display:flex;flex-direction:column}
.modal-hdr{background:var(--turq);color:var(--yellow);padding:16px 22px;display:flex;
  align-items:center;justify-content:space-between;font-family:'Poppins',sans-serif;
  font-size:13px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;flex-shrink:0}
.modal-body{padding:22px;overflow-y:auto;-webkit-overflow-scrolling:touch}
.modal-body img{width:100%;border-radius:0;border:1px solid var(--border)}
.modal-close{background:none;border:none;cursor:pointer;color:rgba(235,231,223,.6);
  display:flex;transition:color .2s;padding:4px}
.modal-close:hover{color:var(--sand)}

/* ── Toast ── */
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);
  background:var(--turq);color:var(--sand);border-left:4px solid var(--yellow);
  border-radius:0;padding:13px 20px;box-shadow:var(--sh-lg);
  display:flex;align-items:center;gap:10px;font-size:12px;font-weight:600;z-index:400;
  white-space:nowrap;animation:toastIn .3s ease;max-width:calc(100vw - 32px);
  letter-spacing:.3px;text-transform:uppercase}
@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}

/* ── Success ── */
.success-wrap{text-align:center;padding:52px 28px}
.success-icon{width:56px;height:56px;background:rgba(104,172,170,.2);border-radius:0;display:flex;
  align-items:center;justify-content:center;margin:0 auto 18px;color:var(--turq)}
.success-wrap h3{font-family:'Poppins',sans-serif;font-size:16px;font-weight:600;
  letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px}
.success-wrap p{color:var(--muted);font-size:13px;max-width:300px;margin:0 auto 24px;
  line-height:1.7;font-family:'Besley',serif;font-style:italic}

/* ── Demo banner ── */
.demo-banner{background:rgba(230,205,136,.18);border:1px solid rgba(230,205,136,.5);
  border-left:3px solid var(--yellow);border-radius:0;padding:10px 16px;font-size:11px;
  color:var(--turq);display:flex;align-items:flex-start;gap:8px;margin-bottom:18px;
  font-weight:600;line-height:1.5;letter-spacing:.2px;text-transform:uppercase}

/* ── Refresh btn ── */
.refresh-btn{display:flex;align-items:center;gap:6px;background:none;
  border:1.5px solid var(--turq);border-radius:0;padding:6px 14px;
  font-family:'Poppins',sans-serif;font-size:10px;font-weight:700;
  color:var(--turq);cursor:pointer;transition:all .2s;letter-spacing:.4px;text-transform:uppercase}
.refresh-btn:hover{background:var(--turq);color:var(--sand)}

/* ════ RESPONSIVE ════ */
@media(max-width:768px){
  .stats-grid{grid-template-columns:1fr 1fr}
  .main{padding:24px 18px}
  .hdr{padding:0 18px}
}

@media(max-width:540px){
  .hdr{height:52px;padding:0 14px}
  .brand{font-size:11px;gap:6px}
  .brand-pill{display:none}
  .hdr-btn{padding:6px 10px;font-size:10px;gap:4px}
  .main{padding:16px 12px}
  .landing{padding:24px 12px 28px}
  .landing h1{font-size:17px}
  .landing-sub{font-size:12px;margin-bottom:20px}
  .landing-cards{grid-template-columns:1fr;gap:10px;max-width:100%}
  .landing-card{padding:16px;display:flex;flex-direction:row;text-align:left;align-items:center;gap:14px}
  .landing-card-icon{width:44px;height:44px;margin:0;flex-shrink:0}
  .landing-card h3{font-size:12px;margin-bottom:3px}
  .landing-card p{font-size:11px;line-height:1.4}
  .arrow-hint{justify-content:flex-start;margin-top:6px}
  .g2,.g3{grid-template-columns:1fr;gap:10px}
  .card{padding:14px}
  .card-sm{padding:12px}
  .form-footer{display:flex;flex-direction:column-reverse;gap:8px}
  .form-footer .btn{width:100%;justify-content:center}
  .fg input,.fg select,.fg textarea{height:50px;font-size:16px}
  .fg textarea{height:80px}
  .stats-grid{grid-template-columns:1fr 1fr;gap:8px}
  .stat{padding:12px 14px}
  .stat-val{font-size:20px}
  .pin-gate{padding:40px 16px}
  .pin-input{width:50px;height:58px;font-size:22px}
  .pin-input-wrap{gap:10px}
}`;

// ════════════════════════════════════════════════════════════
//  ROOT APP
// ════════════════════════════════════════════════════════════
export default function App() {
  const [view, setView]     = useState("landing"); // landing | reimb | contract | admin
  const [toast, setToast]   = useState(null);
  const [modal, setModal]   = useState(null);

  // Local cache (demo mode when no script URL)
  const [reimbData, setReimbData]     = useState([]);
  const [contractData, setContractData] = useState([]);

  useEffect(() => {
    setReimbData(LS.get("ncl_reimb"));
    setContractData(LS.get("ncl_contract"));
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3400); }

  async function saveReimb(entries) {
    const isDemoMode = !CONFIG.REIMBURSEMENT_URL || CONFIG.REIMBURSEMENT_URL.startsWith("YOUR_");
    if (isDemoMode) {
      const next = [...entries, ...reimbData];
      setReimbData(next);
      LS.set("ncl_reimb", next);
    } else {
      for (const e of entries) {
        await writeToSheet(CONFIG.REIMBURSEMENT_URL, e);
      }
    }
  }

  async function saveContract(entry) {
    const isDemoMode = !CONFIG.CONTRACT_URL || CONFIG.CONTRACT_URL.startsWith("YOUR_");
    if (isDemoMode) {
      const next = [entry, ...contractData];
      setContractData(next);
      LS.set("ncl_contract", next);
    } else {
      await writeToSheet(CONFIG.CONTRACT_URL, entry);
    }
  }

  async function updateReimbStatus(id, status) {
    const next = reimbData.map(r => r.id === id ? { ...r, status } : r);
    setReimbData(next); LS.set("ncl_reimb", next);
  }

  async function updateContractStatus(id, status) {
    const next = contractData.map(r => r.id === id ? { ...r, status } : r);
    setContractData(next); LS.set("ncl_contract", next);
  }

  function updateReimbField(id, field, value) {
    const next = reimbData.map(r => r.id === id ? { ...r, [field]: value } : r);
    setReimbData(next); LS.set("ncl_reimb", next);
  }

  function updateContractField(id, field, value) {
    const next = contractData.map(r => r.id === id ? { ...r, [field]: value } : r);
    setContractData(next); LS.set("ncl_contract", next);
  }

  function deleteReimb(id) {
    const next = reimbData.filter(r => r.id !== id);
    setReimbData(next); LS.set("ncl_reimb", next);
  }

  function deleteContract(id) {
    const next = contractData.filter(r => r.id !== id);
    setContractData(next); LS.set("ncl_contract", next);
  }

  const isDemo = CONFIG.REIMBURSEMENT_URL.startsWith("YOUR_");

  return (
    <>
      <style>{CSS}</style>
      <div className="app">

        {/* ── Header ── */}
        <header className="hdr">
          <div className="brand" onClick={() => setView("landing")} style={{cursor:"pointer"}}>
            {Ic.anchor}
            Norwegian Cruise Line
            <span className="brand-pill">Crew Portal</span>
          </div>
          <div className="hdr-right">
            {view !== "landing" && (
              <button className="hdr-btn" onClick={() => setView("landing")}>
                {Ic.back} <span>Home</span>
              </button>
            )}
            <button className={`hdr-btn${view==="admin"?" active":""}`} onClick={() => setView("admin")}>
              {Ic.admin} <span>Admin</span>
            </button>
          </div>
        </header>

        {/* ── Views ── */}
        <main className={`main${view==="admin"?" wide":""}`}>
          {view === "landing" && (
            <LandingPage onSelect={setView} />
          )}
          {view === "reimb" && (
            <ReimbursementForm
              onSubmit={saveReimb}
              showToast={showToast}
              onBack={() => setView("landing")}
              isDemo={isDemo}
            />
          )}
          {view === "contract" && (
            <ContractForm
              onSubmit={saveContract}
              showToast={showToast}
              onBack={() => setView("landing")}
              isDemo={isDemo}
            />
          )}
          {view === "admin" && (
            <AdminDashboard
              reimbData={reimbData}
              contractData={contractData}
              onUpdateReimb={updateReimbStatus}
              onUpdateContract={updateContractStatus}
              onUpdateReimbField={updateReimbField}
              onUpdateContractField={updateContractField}
              onDeleteReimb={deleteReimb}
              onDeleteContract={deleteContract}
              onViewReceipt={setModal}
              showToast={showToast}
              isDemo={isDemo}
              onRefresh={() => {
                setReimbData(LS.get("ncl_reimb"));
                setContractData(LS.get("ncl_contract"));
                showToast("Dashboard refreshed.");
              }}
            />
          )}
        </main>

        {/* ── Toast ── */}
        {toast && <div className="toast">{Ic.check} {toast}</div>}

        {/* ── Receipt Modal ── */}
        {modal && (
          <div className="overlay" onClick={() => setModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-hdr">
                Receipt Preview
                <button className="modal-close" onClick={() => setModal(null)}>{Ic.close}</button>
              </div>
              <div className="modal-body">
                {modal.startsWith("data:image")
                  ? <img src={modal} alt="Receipt" />
                  : <p style={{color:"var(--muted)",fontSize:13}}>Cannot preview this file type. <a href={modal} download style={{color:"var(--teal)"}}>Download</a></p>
                }
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  LANDING PAGE
// ════════════════════════════════════════════════════════════
function LandingPage({ onSelect }) {
  return (
    <div className="landing">
      <div className="landing-logo">{Ic.ship}</div>
      <div className="landing-eyebrow">It's Different Out Here</div>
      <h1>Crew Services Portal</h1>
      <p className="landing-sub">Select a service below to get started. All submissions are reviewed by the Hotel Operations team.</p>
      <div className="landing-cards">
        <div className="landing-card" onClick={() => onSelect("reimb")}>
          <div className="landing-card-icon">{Ic.receipt}</div>
          <h3>Reimbursement Request</h3>
          <p>Submit expense receipts for meals, travel, luggage, and other approved categories.</p>
          <div className="arrow-hint">{Ic.arrow} Get started</div>
        </div>
        <div className="landing-card" onClick={() => onSelect("contract")}>
          <div className="landing-card-icon">{Ic.contract}</div>
          <h3>Contract Request</h3>
          <p>Request an extension or reduction to your current contract end date.</p>
          <div className="arrow-hint">{Ic.arrow} Get started</div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  REIMBURSEMENT FORM
// ════════════════════════════════════════════════════════════
function blankLine() {
  return { id: uid(), type:"", amount:"", fileName:"", fileData:"", drag:false };
}

function ReimbursementForm({ onSubmit, showToast, onBack, isDemo }) {
  const [step, setStep]           = useState(1);
  const [info, setInfo]           = useState({ mapsId:"", firstName:"", lastName:"", email:"", department:"", ship:"" });
  const [lines, setLines]         = useState([blankLine()]);
  const [done, setDone]           = useState(false);
  const [busy, setBusy]           = useState(false);
  const [mapsTouch, setMapsTouch] = useState(false);

  const setI = (k,v) => setInfo(p => ({ ...p, [k]:v }));
  const mapsOk  = /^\d{7}$/.test(info.mapsId.trim());
  const mapsErr = mapsTouch && !mapsOk;

  function infoValid() {
    return mapsOk && info.firstName.trim() && info.lastName.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email) && info.department && info.ship;
  }

  const setLine = (id,k,v) => setLines(p => p.map(l => l.id===id ? {...l,[k]:v} : l));
  const addLine    = () => setLines(p => [...p, blankLine()]);
  const removeLine = id => { if (lines.length>1) setLines(p => p.filter(l=>l.id!==id)); };

  async function handleFile(id, f) {
    if (!f) return;
    const data = await readFile(f);
    setLines(p => p.map(l => l.id===id ? {...l, fileName:f.name, fileData:data} : l));
  }

  const linesOk = lines.every(l => l.type && l.amount && l.fileData);
  const total   = lines.reduce((a,l) => a + parseFloat(l.amount||0), 0);

  async function submit() {
    if (!linesOk) return;
    setBusy(true);
    const now = Date.now();
    const entries = lines.map(l => ({
      id: uid(),
      dateSubmitted: fmtD(now),
      mapsId: info.mapsId.trim(),
      firstName: info.firstName.trim(),
      lastName: info.lastName.trim(),
      email: info.email.trim(),
      department: info.department,
      ship: info.ship,
      type: l.type,
      amount: parseFloat(l.amount),
      fileName: l.fileName,
      receiptData: l.fileData,
      status: "Pending",
      submittedAt: now,
    }));
    await onSubmit(entries);
    showToast(`${entries.length} reimbursement${entries.length>1?"s":""} submitted successfully.`);
    setDone(true);
    setBusy(false);
  }

  function reset() {
    setInfo({ mapsId:"", firstName:"", lastName:"", email:"", department:"", ship:"" });
    setLines([blankLine()]); setStep(1); setDone(false); setMapsTouch(false);
  }

  if (done) return (
    <div>
      <div className="ph"><h2>Reimbursement Request</h2></div>
      <div className="card">
        <div className="success-wrap">
          <div className="success-icon">{Ic.check}</div>
          <h3>Request Submitted</h3>
          <p>Your reimbursement has been received and is pending administrative review.</p>
          <div className="form-footer" style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <button className="btn btn-ghost" onClick={onBack}>Back to Home</button>
            <button className="btn btn-primary" onClick={reset}>Submit Another</button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="ph">
        <h2>Reimbursement Request</h2>
        <p>Enter your details, then add one or more expense items.</p>
      </div>
      {isDemo && <div className="demo-banner">⚡ Demo mode — records save locally in this browser. Connect Google Sheets for permanent storage.</div>}

      <div className="steps">
        <div className={`step-item${step===1?" active":step>1?" done":""}`}>
          <div className="step-num">{step>1 ? Ic.check : "1"}</div>Your Information
        </div>
        <div className="step-line"/>
        <div className={`step-item${step===2?" active":""}`}>
          <div className="step-num">2</div>Expense Items
        </div>
      </div>

      {step===1 && (
        <div className="card">
          <div className="g2">
            <div className="fg">
              <label>MAPS ID <span style={{opacity:.6,fontWeight:400,letterSpacing:0,textTransform:"none",fontSize:10}}>(7 digits)</span></label>
              <input placeholder="e.g. 1234567" value={info.mapsId} maxLength={7}
                className={mapsErr?"err":""}
                onChange={e => setI("mapsId", e.target.value.replace(/\D/g,""))}
                onBlur={() => setMapsTouch(true)} />
              {mapsErr && <span className="field-err">{Ic.warn} MAPS ID must be exactly 7 digits</span>}
            </div>
            <div className="fg"/>
            <div className="fg"><label>First Name</label>
              <input placeholder="First name" value={info.firstName} onChange={e=>setI("firstName",e.target.value)}/>
            </div>
            <div className="fg"><label>Last Name</label>
              <input placeholder="Last name" value={info.lastName} onChange={e=>setI("lastName",e.target.value)}/>
            </div>
            <div className="fg full"><label>Email Address</label>
              <input type="email" placeholder="you@ncl.com" value={info.email} onChange={e=>setI("email",e.target.value)}/>
            </div>
            <div className="fg"><label>Department</label>
              <select value={info.department} onChange={e=>setI("department",e.target.value)}>
                <option value="">Select department…</option>
                {DEPARTMENTS.map(d=><option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="fg"><label>Ship</label>
              <select value={info.ship} onChange={e=>setI("ship",e.target.value)}>
                <option value="">Select ship…</option>
                {NCL_SHIPS.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-footer" style={{display:"flex",justifyContent:"space-between",marginTop:20,gap:10}}>
            <button className="btn btn-ghost" onClick={onBack}>{Ic.back} Back</button>
            <button className="btn btn-primary" disabled={!infoValid()} onClick={()=>setStep(2)}>
              Continue {Ic.arrow}
            </button>
          </div>
        </div>
      )}

      {step===2 && (
        <div>
          <div className="id-chip">
            <span style={{color:"var(--muted)",fontSize:11}}>Filing as</span>
            <strong style={{fontSize:13}}>{info.firstName} {info.lastName}</strong>
            <span className="mpill">{info.mapsId}</span>
            <span style={{color:"var(--muted)",fontSize:11}}>{info.department} · {info.ship}</span>
            <button onClick={()=>setStep(1)} style={{marginLeft:"auto",background:"none",border:"none",
              cursor:"pointer",color:"var(--muted)",fontSize:11,fontWeight:700,
              display:"flex",alignItems:"center",gap:3,fontFamily:"'Poppins',sans-serif"}}>
              {Ic.back} Edit
            </button>
          </div>

          {lines.map((line,idx) => (
            <ReimbLineItem key={line.id} line={line} index={idx} total={lines.length}
              onChange={(k,v)=>setLine(line.id,k,v)}
              onFile={f=>handleFile(line.id,f)}
              onRemove={()=>removeLine(line.id)}
              onDrag={v=>setLine(line.id,"drag",v)} />
          ))}

          <button className="btn btn-add" onClick={addLine}>{Ic.plus} Add Another Expense</button>

          {lines.some(l=>l.amount||l.type) && (
            <div className="card card-sm" style={{marginTop:12}}>
              <div style={{fontSize:9,fontWeight:700,letterSpacing:".6px",textTransform:"uppercase",color:"var(--muted)",marginBottom:10}}>Summary</div>
              <table className="stbl">
                <thead><tr><th>#</th><th>Type</th><th>Amount</th><th>Receipt</th></tr></thead>
                <tbody>
                  {lines.map((l,i)=>(
                    <tr key={l.id}>
                      <td style={{color:"var(--muted)",fontWeight:700,fontSize:11}}>{i+1}</td>
                      <td>{l.type||"—"}</td>
                      <td style={{fontWeight:700}}>{l.amount?fmt(l.amount):"—"}</td>
                      <td style={{fontSize:11,color:l.fileName?"var(--turq)":"var(--border)"}}>{l.fileName||"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="stbl-total"><span>Total</span><span>{fmt(total)}</span></div>
            </div>
          )}

          <div className="form-footer" style={{display:"flex",justifyContent:"space-between",marginTop:16,gap:10}}>
            <button className="btn btn-ghost" onClick={()=>setStep(1)}>{Ic.back} Back</button>
            <button className="btn btn-primary" disabled={!linesOk||busy} onClick={submit}>
              {busy?"Submitting…":`Submit ${lines.length} Request${lines.length>1?"s":""}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReimbLineItem({ line, index, total, onChange, onFile, onRemove, onDrag }) {
  return (
    <div className="line-card">
      <div className="line-hdr">
        <span className="line-label"><span className="line-badge">{index+1}</span>Expense Item</span>
        {total>1 && <button className="btn-remove" onClick={onRemove}>{Ic.trash}</button>}
      </div>
      <div className="g2">
        <div className="fg"><label>Reimbursement Type</label>
          <select value={line.type} onChange={e=>onChange("type",e.target.value)}>
            <option value="">Select a type…</option>
            {REIMB_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="fg"><label>Amount</label>
          <div className="amt-wrap">
            <span className="amt-pre">$</span>
            <input type="number" min="0" step="0.01" placeholder="0.00"
              value={line.amount} onChange={e=>onChange("amount",e.target.value)}/>
          </div>
        </div>
        <div className="fg full"><label>Receipt</label>
          {line.fileData ? (
            <div className="upreview">
              {Ic.check} {line.fileName}
              <button className="rm" onClick={()=>{onChange("fileName","");onChange("fileData","");}}>Remove</button>
            </div>
          ) : (
            <div className={`uzone${line.drag?" drag":""}`}
              onDragOver={e=>{e.preventDefault();onDrag(true);}}
              onDragLeave={()=>onDrag(false)}
              onDrop={e=>{e.preventDefault();onDrag(false);onFile(e.dataTransfer.files[0]);}}>
              <input type="file" accept="image/*,.pdf" onChange={e=>onFile(e.target.files[0])}/>
              <div style={{color:"var(--muted)",display:"flex",justifyContent:"center",marginBottom:4}}>{Ic.upload}</div>
              <p><strong style={{color:"var(--black)",fontSize:13}}>Click to upload</strong> or drag and drop</p>
              <p className="uzone-text">PNG, JPG, PDF accepted</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  CONTRACT FORM
// ════════════════════════════════════════════════════════════
function ContractForm({ onSubmit, showToast, onBack, isDemo }) {
  const blank = { mapsId:"", firstName:"", lastName:"", email:"", department:"", ship:"",
    requestType:"", currentEndDate:"", requestedEndDate:"", managerName:"", reason:"", notes:"" };
  const [form, setForm]           = useState(blank);
  const [done, setDone]           = useState(false);
  const [busy, setBusy]           = useState(false);
  const [mapsTouch, setMapsTouch] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const setF = (k,v) => setForm(p=>({...p,[k]:v}));
  const mapsOk  = /^\d{7}$/.test(form.mapsId.trim());
  const mapsErr = mapsTouch && !mapsOk;

  function isValid() {
    return mapsOk && form.firstName.trim() && form.lastName.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
      form.department && form.ship && form.requestType &&
      form.currentEndDate && form.requestedEndDate && form.managerName.trim() && form.reason;
  }

  async function submit() {
    if (!isValid()) { setSubmitted(true); return; }
    setBusy(true);
    const entry = {
      id: uid(),
      dateSubmitted: fmtD(Date.now()),
      ...form,
      mapsId: form.mapsId.trim(),
      status: "Pending",
      submittedAt: Date.now(),
    };
    await onSubmit(entry);
    showToast("Contract request submitted successfully.");
    setDone(true);
    setBusy(false);
  }

  function reset() { setForm(blank); setDone(false); setMapsTouch(false); setSubmitted(false); }

  if (done) return (
    <div>
      <div className="ph"><h2>Contract Request</h2></div>
      <div className="card">
        <div className="success-wrap">
          <div className="success-icon">{Ic.check}</div>
          <h3>Request Submitted</h3>
          <p>Your contract request has been received and is pending administrative review.</p>
          <div className="form-footer" style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <button className="btn btn-ghost" onClick={onBack}>Back to Home</button>
            <button className="btn btn-primary" onClick={reset}>Submit Another</button>
          </div>
        </div>
      </div>
    </div>
  );

  const req = submitted;

  return (
    <div>
      <div className="ph">
        <h2>Contract Extension / Reduction Request</h2>
        <p>Complete all fields to submit your contract change request for review.</p>
      </div>
      {isDemo && <div className="demo-banner">⚡ Demo mode — records save locally in this browser. Connect Google Sheets for permanent storage.</div>}

      <div className="card">
        {/* Personal info */}
        <div style={{fontSize:10,fontWeight:800,letterSpacing:".7px",textTransform:"uppercase",
          color:"var(--muted)",marginBottom:14}}>Personal Information</div>
        <div className="g2" style={{marginBottom:18}}>
          <div className="fg">
            <label>MAPS ID <span style={{opacity:.6,fontWeight:400,letterSpacing:0,textTransform:"none",fontSize:10}}>(7 digits)</span></label>
            <input placeholder="e.g. 1234567" value={form.mapsId} maxLength={7}
              className={mapsErr?"err":""}
              onChange={e=>setF("mapsId",e.target.value.replace(/\D/g,""))}
              onBlur={()=>setMapsTouch(true)}/>
            {mapsErr && <span className="field-err">{Ic.warn} MAPS ID must be exactly 7 digits</span>}
          </div>
          <div className="fg"/>
          <div className="fg"><label>First Name</label>
            <input placeholder="First name" value={form.firstName} onChange={e=>setF("firstName",e.target.value)}/>
          </div>
          <div className="fg"><label>Last Name</label>
            <input placeholder="Last name" value={form.lastName} onChange={e=>setF("lastName",e.target.value)}/>
          </div>
          <div className="fg full"><label>Email Address</label>
            <input type="email" placeholder="you@ncl.com" value={form.email} onChange={e=>setF("email",e.target.value)}/>
          </div>
          <div className="fg"><label>Department</label>
            <select value={form.department} onChange={e=>setF("department",e.target.value)}>
              <option value="">Select department…</option>
              {DEPARTMENTS.map(d=><option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="fg"><label>Ship</label>
            <select value={form.ship} onChange={e=>setF("ship",e.target.value)}>
              <option value="">Select ship…</option>
              {NCL_SHIPS.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div style={{height:1,background:"var(--border)",marginBottom:20}}/>

        {/* Contract details */}
        <div style={{fontSize:10,fontWeight:800,letterSpacing:".7px",textTransform:"uppercase",
          color:"var(--muted)",marginBottom:14}}>Contract Details</div>
        <div className="g2">
          <div className="fg full"><label>Request Type</label>
            <select value={form.requestType} onChange={e=>setF("requestType",e.target.value)}
              className={req&&!form.requestType?"err":""}>
              <option value="">Select request type…</option>
              <option value="Extension">Extension — extend my current contract end date</option>
              <option value="Reduction">Reduction — shorten my current contract end date</option>
            </select>
          </div>
          <div className="fg"><label>Current Contract End Date</label>
            <input type="date" value={form.currentEndDate}
              className={req&&!form.currentEndDate?"err":""}
              onChange={e=>setF("currentEndDate",e.target.value)}/>
          </div>
          <div className="fg"><label>Requested New End Date</label>
            <input type="date" value={form.requestedEndDate}
              className={req&&!form.requestedEndDate?"err":""}
              onChange={e=>setF("requestedEndDate",e.target.value)}/>
          </div>
          <div className="fg"><label>Manager / Supervisor Name</label>
            <input placeholder="Full name" value={form.managerName}
              className={req&&!form.managerName.trim()?"err":""}
              onChange={e=>setF("managerName",e.target.value)}/>
          </div>
          <div className="fg"><label>Reason</label>
            <select value={form.reason} onChange={e=>setF("reason",e.target.value)}
              className={req&&!form.reason?"err":""}>
              <option value="">Select a reason…</option>
              {CONTRACT_REASONS.map(r=><option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="fg full"><label>Additional Notes <span style={{opacity:.5,fontWeight:300,letterSpacing:0,textTransform:"none",fontSize:10}}>(optional)</span></label>
            <textarea placeholder="Any additional context or information…" value={form.notes}
              onChange={e=>setF("notes",e.target.value)}/>
          </div>
        </div>

        {submitted && !isValid() && (
          <div className="field-err" style={{marginTop:12,fontSize:12}}>
            {Ic.warn} Please complete all required fields before submitting.
          </div>
        )}

        <div className="form-footer" style={{display:"flex",justifyContent:"space-between",marginTop:22,gap:10}}>
          <button className="btn btn-ghost" onClick={onBack}>{Ic.back} Back</button>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>
            {busy?"Submitting…":"Submit Request"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  ADMIN DASHBOARD
// ════════════════════════════════════════════════════════════
const ADMIN_PIN = CONFIG.ADMIN_PIN;

function AdminDashboard({ reimbData, contractData, onUpdateReimb, onUpdateContract,
  onUpdateReimbField, onUpdateContractField,
  onDeleteReimb, onDeleteContract, onViewReceipt, showToast, isDemo, onRefresh }) {

  const [authed, setAuthed]   = useState(false);
  const [pins, setPins]       = useState(["","","",""]); 
  const [pinErr, setPinErr]   = useState(false);
  const [activeView, setView] = useState("reimb");
  const refs = [useRef(),useRef(),useRef(),useRef()];

  // PIN logic
  function handlePin(i, val) {
    if (!/^\d?$/.test(val)) return;
    const next = [...pins]; next[i] = val; setPins(next);
    if (val && i < 3) refs[i+1].current?.focus();
    if (next.every(p=>p) && next.join("").length === 4) {
      if (next.join("") === ADMIN_PIN) { setAuthed(true); setPinErr(false); }
      else { setPinErr(true); setTimeout(()=>{ setPins(["","","",""]); setPinErr(false); refs[0].current?.focus(); }, 600); }
    }
  }

  if (!authed) return (
    <div className="pin-gate">
      <div className="pin-icon">{Ic.lock}</div>
      <h3>Admin Access</h3>
      <p>Enter your 4-digit PIN to access the dashboard.</p>
      <div className="pin-input-wrap">
        {[0,1,2,3].map(i => (
          <input key={i} ref={refs[i]} className={`pin-input${pinErr?" pin-err":""}`}
            type="password" maxLength={1} value={pins[i]} inputMode="numeric"
            onChange={e=>handlePin(i,e.target.value)}
            onKeyDown={e=>{ if(e.key==="Backspace"&&!pins[i]&&i>0){refs[i-1].current?.focus();} }}/>
        ))}
      </div>
      <div className="pin-hint">{pinErr?"Incorrect PIN — try again":""}</div>
    </div>
  );

  return (
    <div>
      <div className="ph" style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        <div>
          <h2>Admin Dashboard</h2>
          <p>Manage reimbursement and contract requests across the fleet.</p>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button className="refresh-btn" onClick={onRefresh}>{Ic.refresh} Refresh</button>
        </div>
      </div>

      {isDemo && <div className="demo-banner">⚡ Demo mode — data is stored locally in this browser session. Connect Google Sheets for fleet-wide permanent records.</div>}

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat">
          <span className="stat-lbl">Reimbursements</span>
          <span className="stat-val">{reimbData.length}</span>
          <span className="stat-sub">{reimbData.filter(r=>r.status==="Pending").length} pending</span>
        </div>
        <div className="stat">
          <span className="stat-lbl">Contract Requests</span>
          <span className="stat-val">{contractData.length}</span>
          <span className="stat-sub">{contractData.filter(r=>r.status==="Pending").length} pending</span>
        </div>
        <div className="stat">
          <span className="stat-lbl">Approved Amount</span>
          <span className="stat-val">{fmt(reimbData.filter(r=>r.status==="Approved").reduce((a,r)=>a+r.amount,0))}</span>
          <span className="stat-sub">of {fmt(reimbData.reduce((a,r)=>a+r.amount,0))} submitted</span>
        </div>
        <div className="stat">
          <span className="stat-lbl">Total Pending</span>
          <span className="stat-val" style={{color:"var(--red)"}}>
            {reimbData.filter(r=>r.status==="Pending").length + contractData.filter(r=>r.status==="Pending").length}
          </span>
          <span className="stat-sub">across all requests</span>
        </div>
      </div>

      {/* View switcher */}
      <div className="view-tabs">
        <button className={`view-tab${activeView==="reimb"?" active":""}`} onClick={()=>setView("reimb")}>
          Reimbursements ({reimbData.length})
        </button>
        <button className={`view-tab${activeView==="contract"?" active":""}`} onClick={()=>setView("contract")}>
          Contract Requests ({contractData.length})
        </button>
      </div>

      {activeView==="reimb"
        ? <ReimbTable data={reimbData} onUpdateStatus={onUpdateReimb} onDelete={onDeleteReimb}
            onUpdateField={onUpdateReimbField}
            onViewReceipt={onViewReceipt} showToast={showToast} />
        : <ContractTable data={contractData} onUpdateStatus={onUpdateContract}
            onUpdateField={onUpdateContractField}
            onDelete={onDeleteContract} showToast={showToast} />
      }
    </div>
  );
}

// ── Reimbursement Table ───────────────────────────────────────
function ReimbTable({ data, onUpdateStatus, onUpdateField, onDelete, onViewReceipt, showToast }) {
  const [sf, setSf] = useState("All");
  const [tf, setTf] = useState("All");
  const [rsf, setRsf] = useState("All");

  const rows = data.filter(r =>
    (sf==="All"||r.status===sf) &&
    (tf==="All"||r.type===tf) &&
    (rsf==="All"||r.requestStatus===rsf)
  );

  function exportCSV() {
    const cols = ["Date Submitted","MAPS ID","First Name","Last Name","Email","Department","Ship",
      "Type","Amount","Approval Status","Request Status","Send Notification","Receipt"];
    const csv = [cols,...rows.map(r=>[
      r.dateSubmitted||fmtD(r.submittedAt),r.mapsId,r.firstName,r.lastName,r.email,
      r.department||"",r.ship||"",r.type,r.amount?.toFixed(2),r.status,
      r.requestStatus||"New", r.sendNotification?"Yes":"No", r.fileName
    ])].map(r=>r.map(c=>`"${String(c??"").replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download = "ncl_reimbursements.csv"; a.click();
    showToast("Reimbursements exported.");
  }

  return (
    <>
      <div className="filters">
        <span className="flbl">Filter</span>
        <select className="fsel" value={sf} onChange={e=>setSf(e.target.value)}>
          <option value="All">All Approval</option>
          <option>Pending</option><option>Approved</option><option>Rejected</option>
        </select>
        <select className="fsel" value={rsf} onChange={e=>setRsf(e.target.value)}>
          <option value="All">All Request Status</option>
          {REQUEST_STATUSES.map(s=><option key={s}>{s}</option>)}
        </select>
        <select className="fsel" value={tf} onChange={e=>setTf(e.target.value)}>
          <option value="All">All Types</option>
          {REIMB_TYPES.map(t=><option key={t}>{t}</option>)}
        </select>
        <span className="sp"/>
        <span style={{fontSize:11,color:"var(--muted)"}}>{rows.length} record{rows.length!==1?"s":""}</span>
        <button className="btn btn-outline" onClick={exportCSV}>{Ic.download} Export CSV</button>
      </div>

      {rows.length===0 ? <div className="empty-tbl">No reimbursement records found.</div> : (
        <div className="tbl-wrap">
          <table>
            <thead><tr>
              <th>Request Status</th>
              <th>Send Notif.</th>
              <th>Date Submitted</th>
              <th>MAPS ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Dept</th>
              <th>Ship</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Receipt</th>
              <th>Approval</th>
              <th>Actions</th>
            </tr></thead>
            <tbody>
              {rows.map(r=>{
                const sc  = STATUS_META[r.status]||STATUS_META.Pending;
                const rsc = REQ_STATUS_META[r.requestStatus||"New"];
                return (
                  <tr key={r.id}>
                    {/* Request Status dropdown */}
                    <td>
                      <select
                        className="req-sel"
                        style={{background:rsc.bg, color:rsc.text}}
                        value={r.requestStatus||"New"}
                        onChange={e=>onUpdateField(r.id,"requestStatus",e.target.value)}>
                        {REQUEST_STATUSES.map(s=><option key={s}>{s}</option>)}
                      </select>
                    </td>
                    {/* Send Notification checkbox */}
                    <td>
                      <div className="notif-wrap">
                        <input type="checkbox" className="notif-cb"
                          checked={!!r.sendNotification}
                          onChange={e=>onUpdateField(r.id,"sendNotification",e.target.checked)}/>
                      </div>
                    </td>
                    <td style={{whiteSpace:"nowrap",color:"var(--muted)",fontSize:11}}>{r.dateSubmitted||fmtD(r.submittedAt)}</td>
                    <td><span className="mpill">{r.mapsId}</span></td>
                    <td style={{fontWeight:600,fontSize:12}}>{r.firstName} {r.lastName}</td>
                    <td style={{color:"var(--muted)",fontSize:11}}>{r.email}</td>
                    <td style={{fontSize:11}}>{r.department||"—"}</td>
                    <td style={{fontSize:11,whiteSpace:"nowrap"}}>{r.ship||"—"}</td>
                    <td style={{fontSize:11}}>{r.type}</td>
                    <td style={{fontWeight:700}}>{fmt(r.amount)}</td>
                    <td>{r.receiptData
                      ? <button className="btn btn-sm btn-view-r" onClick={()=>onViewReceipt(r.receiptData)}>{Ic.eye} View</button>
                      : <span style={{color:"var(--muted)"}}>—</span>}
                    </td>
                    <td><span className="sbadge" style={{background:sc.bg,color:sc.text}}>
                      <span className="sdot" style={{background:sc.dot}}/>{r.status}
                    </span></td>
                    <td><div className="act">
                      {r.status!=="Approved"&&<button className="btn btn-sm btn-approve"
                        onClick={async()=>{await onUpdateStatus(r.id,"Approved");showToast("Approved.");}}>Approve</button>}
                      {r.status!=="Rejected"&&<button className="btn btn-sm btn-reject"
                        onClick={async()=>{await onUpdateStatus(r.id,"Rejected");showToast("Rejected.");}}>Reject</button>}
                      <button className="btn btn-sm btn-del" onClick={()=>onDelete(r.id)}>{Ic.trash}</button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ── Contract Table ────────────────────────────────────────────
function ContractTable({ data, onUpdateStatus, onUpdateField, onDelete, showToast }) {
  const [sf, setSf]   = useState("All");
  const [tf, setTf]   = useState("All");
  const [rsf, setRsf] = useState("All");

  const rows = data.filter(r =>
    (sf==="All"||r.status===sf) &&
    (tf==="All"||r.requestType===tf) &&
    (rsf==="All"||r.requestStatus===rsf)
  );

  function exportCSV() {
    const cols = ["Date Submitted","MAPS ID","First Name","Last Name","Email","Department","Ship",
      "Request Type","Current End Date","Requested End Date","Manager","Reason","Notes",
      "Approval Status","Request Status","Send Notification"];
    const csv = [cols,...rows.map(r=>[
      r.dateSubmitted||fmtD(r.submittedAt),r.mapsId,r.firstName,r.lastName,r.email,
      r.department||"",r.ship||"",r.requestType,r.currentEndDate,r.requestedEndDate,
      r.managerName,r.reason,r.notes||"",r.status,
      r.requestStatus||"New", r.sendNotification?"Yes":"No"
    ])].map(r=>r.map(c=>`"${String(c??"").replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download = "ncl_contract_requests.csv"; a.click();
    showToast("Contract requests exported.");
  }

  return (
    <>
      <div className="filters">
        <span className="flbl">Filter</span>
        <select className="fsel" value={sf} onChange={e=>setSf(e.target.value)}>
          <option value="All">All Approval</option>
          <option>Pending</option><option>Approved</option><option>Rejected</option>
        </select>
        <select className="fsel" value={rsf} onChange={e=>setRsf(e.target.value)}>
          <option value="All">All Request Status</option>
          {REQUEST_STATUSES.map(s=><option key={s}>{s}</option>)}
        </select>
        <select className="fsel" value={tf} onChange={e=>setTf(e.target.value)}>
          <option value="All">All Types</option>
          <option>Extension</option><option>Reduction</option>
        </select>
        <span className="sp"/>
        <span style={{fontSize:11,color:"var(--muted)"}}>{rows.length} record{rows.length!==1?"s":""}</span>
        <button className="btn btn-outline" onClick={exportCSV}>{Ic.download} Export CSV</button>
      </div>

      {rows.length===0 ? <div className="empty-tbl">No contract requests found.</div> : (
        <div className="tbl-wrap">
          <table>
            <thead><tr>
              <th>Request Status</th>
              <th>Send Notif.</th>
              <th>Date Submitted</th>
              <th>MAPS ID</th>
              <th>Name</th>
              <th>Dept</th>
              <th>Ship</th>
              <th>Type</th>
              <th>Current End</th>
              <th>Requested End</th>
              <th>Manager</th>
              <th>Reason</th>
              <th>Approval</th>
              <th>Actions</th>
            </tr></thead>
            <tbody>
              {rows.map(r=>{
                const sc  = STATUS_META[r.status]||STATUS_META.Pending;
                const rsc = REQ_STATUS_META[r.requestStatus||"New"];
                return (
                  <tr key={r.id}>
                    {/* Request Status dropdown */}
                    <td>
                      <select
                        className="req-sel"
                        style={{background:rsc.bg, color:rsc.text}}
                        value={r.requestStatus||"New"}
                        onChange={e=>onUpdateField(r.id,"requestStatus",e.target.value)}>
                        {REQUEST_STATUSES.map(s=><option key={s}>{s}</option>)}
                      </select>
                    </td>
                    {/* Send Notification checkbox */}
                    <td>
                      <div className="notif-wrap">
                        <input type="checkbox" className="notif-cb"
                          checked={!!r.sendNotification}
                          onChange={e=>onUpdateField(r.id,"sendNotification",e.target.checked)}/>
                      </div>
                    </td>
                    <td style={{whiteSpace:"nowrap",color:"var(--muted)",fontSize:11}}>{r.dateSubmitted||fmtD(r.submittedAt)}</td>
                    <td><span className="mpill">{r.mapsId}</span></td>
                    <td style={{fontWeight:600,fontSize:12}}>{r.firstName} {r.lastName}</td>
                    <td style={{fontSize:11}}>{r.department||"—"}</td>
                    <td style={{fontSize:11,whiteSpace:"nowrap"}}>{r.ship||"—"}</td>
                    <td>
                      <span className="sbadge" style={{
                        background: r.requestType==="Extension"?"rgba(142,191,194,.2)":"rgba(230,205,136,.2)",
                        color:      r.requestType==="Extension"?"var(--turq)":"#7A5C0A",
                      }}>{r.requestType}</span>
                    </td>
                    <td style={{fontSize:11,whiteSpace:"nowrap"}}>{r.currentEndDate}</td>
                    <td style={{fontSize:11,whiteSpace:"nowrap"}}>{r.requestedEndDate}</td>
                    <td style={{fontSize:11}}>{r.managerName}</td>
                    <td style={{fontSize:11}}>{r.reason}</td>
                    <td><span className="sbadge" style={{background:sc.bg,color:sc.text}}>
                      <span className="sdot" style={{background:sc.dot}}/>{r.status}
                    </span></td>
                    <td><div className="act">
                      {r.status!=="Approved"&&<button className="btn btn-sm btn-approve"
                        onClick={async()=>{await onUpdateStatus(r.id,"Approved");showToast("Approved.");}}>Approve</button>}
                      {r.status!=="Rejected"&&<button className="btn btn-sm btn-reject"
                        onClick={async()=>{await onUpdateStatus(r.id,"Rejected");showToast("Rejected.");}}>Reject</button>}
                      <button className="btn btn-sm btn-del" onClick={()=>onDelete(r.id)}>{Ic.trash}</button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
