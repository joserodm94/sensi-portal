import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabaseClient.js';

const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DEFAULT_VACATION_DAYS = 14;

function fmtDate(iso){ if(!iso) return ''; const d=new Date(iso+'T00:00:00'); return d.toLocaleDateString('es-DO',{day:'2-digit',month:'2-digit',year:'numeric'}); }
function fmtMonth(ym){ if(!ym) return ''; const [y,m]=ym.split('-').map(Number); return `${MONTHS_ES[m-1]} ${y}`; }
function fmtMoney(n){ const num=Number(n)||0; return 'RD$ ' + num.toLocaleString('es-DO',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtNum(n){ const num=Number(n)||0; return num.toLocaleString('es-DO',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function todayStr(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function downloadCSV(filename, headers, rows){
  const esc = v => `"${String(v==null?'':v).replace(/"/g,'""')}"`;
  const csv = [headers.map(esc).join(','), ...rows.map(r=>r.map(esc).join(','))].join('\r\n');
  const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function tiempoEnEmpresa(hireDateStr){
  if(!hireDateStr) return null;
  const start = new Date(hireDateStr+'T00:00:00');
  const now = new Date();
  let months = (now.getFullYear()-start.getFullYear())*12 + (now.getMonth()-start.getMonth());
  if(now.getDate() < start.getDate()) months--;
  if(months < 0) return null;
  const years = Math.floor(months/12);
  const rem = months%12;
  if(years===0) return `${rem} mes${rem===1?'':'es'}`;
  if(rem===0) return `${years} año${years===1?'':'s'}`;
  return `${years} año${years===1?'':'s'}, ${rem} mes${rem===1?'':'es'}`;
}

const BRAND_STRIP_HTML = `
  <table width="100%" style="margin-top:24px;"><tr>
    <td style="background:#D2564F; height:6px; width:20%;"></td>
    <td style="background:#E58A32; height:6px; width:20%;"></td>
    <td style="background:#EAB13B; height:6px; width:20%;"></td>
    <td style="background:#A6C548; height:6px; width:20%;"></td>
    <td style="background:#4A93C9; height:6px; width:20%;"></td>
  </tr></table>`;

function buildReminderHtml(inv){
  const items = inv.items_snapshot || [];
  const rows = items.map(it=>`
    <tr>
      <td style="padding:8px 6px; border-bottom:1px solid #eee; font-size:13px;">${it.child_name} - ${it.program}</td>
      <td style="padding:8px 6px; border-bottom:1px solid #eee; font-size:13px; text-align:right;">${fmtNum(it.amount)}</td>
    </tr>`).join('');
  return `
  <div style="border:1px solid #999; padding:20px; font-family:Georgia,serif; max-width:600px;">
    <div style="font-weight:bold; color:#2B2B2B; font-size:16px;">Sensi SRL</div>
    <div style="font-size:20px; color:#B23A48; margin-top:8px;">Recordatorio de pago</div>
    <p style="font-size:14px; color:#2B2B2B; margin-top:14px;">Hola ${inv.tutor_name_snapshot},</p>
    <p style="font-size:14px; color:#2B2B2B;">Te recordamos que la factura <strong>${inv.invoice_number}</strong> (${fmtMonth(inv.billing_month)}) con vencimiento el <strong>${fmtDate(inv.due_date)}</strong> sigue pendiente de pago.</p>
    <table width="100%" style="border-collapse:collapse; margin-top:14px;">
      <tr style="background:#DCE3EA;">
        <td style="padding:6px; font-size:11px; font-weight:bold; color:#2B2B2B;">DESCRIPCIÓN</td>
        <td style="padding:6px; font-size:11px; font-weight:bold; color:#2B2B2B; text-align:right;">IMPORTE (RD$)</td>
      </tr>
      ${rows}
    </table>
    <p style="font-size:20px; font-weight:bold; color:#B23A48; margin-top:14px;">Total pendiente: RD$ ${fmtNum(inv.total)}</p>
    <div style="margin-top:12px; font-size:13px; color:#2B2B2B;">
      <b>Métodos de pago:</b> Transferencia bancaria — Banco BHD, cuenta de ahorros 12804400012, cédula 402-2267095-8
    </div>
    ${BRAND_STRIP_HTML}
  </div>`;
}

function buildReceiptHtml(r){
  const items = r.items_snapshot || [];
  const rows = items.map(it=>`
    <tr>
      <td style="padding:10px 8px; border-bottom:1px solid #eee; font-size:14px;">
        ${it.child_name} - ${fmtMonth(r.billing_month)}<br>
        <span style="font-size:11px; color:#888888;">${it.schedule||''}</span>
      </td>
      <td style="padding:10px 8px; border-bottom:1px solid #eee; font-size:14px; text-align:center;">${it.program}</td>
      <td style="padding:10px 8px; border-bottom:1px solid #eee; font-size:14px; text-align:right;">${fmtNum(it.amount)}</td>
    </tr>`).join('');
  return `
  <div style="border:1px solid #999; padding:20px; font-family:Georgia,serif; max-width:600px;">
    <table width="100%" style="border-collapse:collapse;">
      <tr>
        <td style="vertical-align:top;">
          <div style="font-weight:bold; color:#2B2B2B; font-size:16px;">Sensi SRL</div>
          <div style="color:#6E6E6E; font-size:12px;">RNC: 1-3359263-2</div>
          <div style="color:#6E6E6E; font-size:12px;">Santo Domingo, República Dominicana</div>
        </td>
        <td style="vertical-align:top; text-align:right;">
          <div style="font-size:26px; color:#2B2B2B;">RECIBO DE PAGO</div>
          <div style="font-size:13px; color:#6E6E6E;">N&deg;: <b style="color:#2B2B2B;">${r.receipt_number}</b></div>
          <div style="font-size:13px; color:#6E6E6E;">Ref. factura: <b style="color:#2B2B2B;">${r.invoice_number}</b></div>
          <div style="font-size:13px; color:#6E6E6E;">Fecha de pago: <b style="color:#2B2B2B;">${fmtDate(r.payment_date)}</b></div>
        </td>
      </tr>
    </table>
    <hr style="border:none; border-top:1px solid #ddd; margin:16px 0;">
    <div style="font-size:12px; color:#6E6E6E; font-weight:bold;">RECIBIMOS DE</div>
    <div style="font-size:14px; color:#2B2B2B;">${r.tutor_name}</div>
    <table width="100%" style="border-collapse:collapse; margin-top:16px;">
      <tr style="background:#DCE3EA;">
        <td style="padding:8px; font-size:12px; font-weight:bold; color:#2B2B2B;">DESCRIPCIÓN</td>
        <td style="padding:8px; font-size:12px; font-weight:bold; color:#2B2B2B; text-align:center;">PROGRAMA</td>
        <td style="padding:8px; font-size:12px; font-weight:bold; color:#2B2B2B; text-align:right;">IMPORTE (RD$)</td>
      </tr>
      ${rows}
    </table>
    <table width="100%" style="margin-top:10px;">
      <tr><td style="font-size:20px; font-weight:bold; color:#2B2B2B; border-top:1px solid #bbb; padding-top:10px;" colspan="2">TOTAL PAGADO (RD$)</td>
          <td style="font-size:20px; font-weight:bold; color:#3B7A57; text-align:right; border-top:1px solid #bbb; padding-top:10px;">${fmtMoney(r.total)}</td></tr>
    </table>
    ${BRAND_STRIP_HTML}
  </div>`;
}

async function sendNotification(to, subject, html){
  if(!to) return false;
  try{
    const { error } = await supabase.functions.invoke('send-mail', {
      body: { to, subject, html },
      headers: { 'x-portal-secret': import.meta.env.VITE_PORTAL_SHARED_SECRET || '' },
    });
    if(error){ console.error('email error', error); return false; }
    return true;
  }catch(e){ console.error('email error', e); return false; }
}

// Deducciones de nómina, República Dominicana (vigentes 2026)
const AFP_RATE = 0.0287;
const SFS_RATE = 0.0304;
function calcularDeduccionesRD(brutoMensual, otrasDeducciones){
  const bruto = Number(brutoMensual) || 0;
  const otras = Number(otrasDeducciones) || 0;
  const afp = bruto * AFP_RATE;
  const sfs = bruto * SFS_RATE;
  const gravableMensual = bruto - afp - sfs;
  const anual = gravableMensual * 12;
  let isrAnual;
  if (anual <= 416220) isrAnual = 0;
  else if (anual <= 624329) isrAnual = (anual - 416220) * 0.15;
  else if (anual <= 867123) isrAnual = 31216 + (anual - 624329) * 0.20;
  else isrAnual = 79776 + (anual - 867123) * 0.25;
  const isr = isrAnual / 12;
  const deducciones = afp + sfs + isr + otras;
  const neto = bruto - deducciones;
  return { afp, sfs, isr, otras, deducciones, neto };
}

const ICONS = {
  home:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9"/>',
  sun:'<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7"/>',
  calendar:'<rect x="3.5" y="5" width="17" height="16" rx="2.2"/><path d="M8 3v4M16 3v4M3.5 10h17"/><path d="m8.5 15 2 2 4-4"/>',
  receipt:'<path d="M6 3h12v18l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5V3Z"/><path d="M9 8h6M9 12h6M9 16h3.5"/>',
  inbox:'<path d="M3.5 12h4.6l1.4 2.6h5l1.4-2.6h4.6"/><path d="M5 5.5h14L21 12v6a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 18v-6L5 5.5Z"/>',
  users:'<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.6-3.2 2.9-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9.5" r="2.3"/><path d="M15.8 14.2c2 .3 3.6 1.9 4 4.3"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.1a2 2 0 1 1-4.1 0v-.2a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1h-.1a2 2 0 1 1 0-4.1h.2a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.6v-.1a2 2 0 1 1 4.1 0v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1h.1a2 2 0 1 1 0 4.1h-.2a1.7 1.7 0 0 0-1.6 1Z"/>',
  logout:'<path d="M9 19H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3"/><path d="M16 16l4-4-4-4"/><path d="M20 12H9"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  check:'<path d="M5 13l4 4L19 7"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  chevron:'<path d="M9 6l6 6-6 6"/>',
  edit:'<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/>',
  trash:'<path d="M4.5 7h15M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2M7 7l1 12.5A1.5 1.5 0 0 0 9.5 21h5a1.5 1.5 0 0 0 1.5-1.5L17 7"/>',
  user:'<circle cx="12" cy="8.2" r="3.6"/><path d="M4.8 20c1.1-4.2 4-6.4 7.2-6.4s6.1 2.2 7.2 6.4"/>'
};
function Icon({ name, sw=1.8 }){
  return <span className="icon" dangerouslySetInnerHTML={{__html:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]||''}</svg>`}} />;
}
function BrandStrip(){ return <div className="brand-strip"><span className="c1"/><span className="c2"/><span className="c3"/><span className="c4"/><span className="c5"/></div>; }

function useToast(){
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const fire = useCallback((m)=>{
    setMsg(m); setShow(true);
    setTimeout(()=>setShow(false), 2400);
  },[]);
  const Toast = () => <div className={`toast${show?' show':''}`}>{msg}</div>;
  return [fire, Toast];
}

export default function App(){
  const [user, setUser] = useState(null); // {role, id, name}
  const [loading, setLoading] = useState(true);
  const [toast, Toast] = useToast();

  if (loading) {
    // brief splash while fonts/css settle; login screen handles its own state
    setTimeout(()=>setLoading(false), 0);
  }

  if (!user) return <Login onLogin={setUser} toast={toast} Toast={Toast} />;
  if (user.role === 'teacher') return <TeacherApp user={user} onLogout={()=>setUser(null)} toast={toast} Toast={Toast} />;
  return <AdminApp user={user} onLogout={()=>setUser(null)} toast={toast} Toast={Toast} />;
}

// ---------------- LOGIN ----------------
function Login({ onLogin, toast, Toast }){
  const [role, setRole] = useState('teacher');
  const [teachers, setTeachers] = useState([]);
  const [teacherId, setTeacherId] = useState('');
  const [pin, setPin] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recoverBusy, setRecoverBusy] = useState(false);

  useEffect(()=>{
    supabase.rpc('list_active_teacher_names').then(({data, error})=>{
      if(!error && data){ setTeachers(data); if(data[0]) setTeacherId(data[0].id); }
    });
  },[]);

  async function doTeacherLogin(e){
    e.preventDefault();
    setError(''); setBusy(true);
    const t = teachers.find(t=>t.id===teacherId);
    const { data, error } = await supabase.rpc('login_teacher', { p_name: t?.name || '', p_pin: pin.trim() });
    setBusy(false);
    if(error){ setError('No se pudo conectar. Intenta de nuevo.'); return; }
    if(!data || !data.length){ setError('PIN incorrecto.'); return; }
    const row = data[0];
    onLogin({ role:'teacher', id: row.id, name: row.name });
  }

  async function doAdminLogin(e){
    e.preventDefault();
    setError(''); setBusy(true);
    const { data, error } = await supabase.rpc('login_admin', { p_pin: adminPin.trim() });
    setBusy(false);
    if(error){ setError('No se pudo conectar. Intenta de nuevo.'); return; }
    if(!data){ setError('PIN incorrecto.'); return; }
    onLogin({ role:'admin', name:'Administración' });
  }

  async function recoverTeacherPin(){
    if(!teacherId){ toast('Selecciona tu nombre primero.'); return; }
    setRecoverBusy(true);
    const { data, error } = await supabase.rpc('request_teacher_pin_reset', { p_teacher_id: teacherId });
    const r = data && data[0];
    if(error || !r || !r.ok){ setRecoverBusy(false); toast((r && r.message) || 'No se pudo procesar la solicitud.'); return; }
    await sendNotification(r.email, 'Tu nuevo PIN de acceso a Sensi Portal',
      `<p>Hola ${r.teacher_name},</p><p>Tu nuevo PIN de acceso es: <strong style="font-size:20px;">${r.new_pin}</strong></p><p>— Sensi Portal</p>`);
    setRecoverBusy(false);
    toast('Te enviamos un nuevo PIN a tu correo.');
  }

  async function recoverAdminPin(){
    setRecoverBusy(true);
    const { data, error } = await supabase.rpc('request_admin_pin_reset');
    const r = data && data[0];
    if(error || !r || !r.ok){ setRecoverBusy(false); toast((r && r.message) || 'No se pudo procesar la solicitud.'); return; }
    await sendNotification(r.email, 'Nuevo PIN de administración de Sensi Portal',
      `<p>Tu nuevo PIN de administración es: <strong style="font-size:20px;">${r.new_pin}</strong></p><p>— Sensi Portal</p>`);
    setRecoverBusy(false);
    toast('Te enviamos un nuevo PIN al correo de recuperación.');
  }

  return (
    <div className="app-shell login-screen">
      <BrandStrip />
      <div className="login-hero">
        <img src="/sensi-logo.png" alt="Sensi" className="login-logo" />
        <h1>Sensi Portal</h1>
        <p className="login-subtitle">Portal Extranet</p>
      </div>
      <div className="login-body">
        <div className="role-tabs">
          <button className={`role-tab${role==='teacher'?' active':''}`} onClick={()=>{setRole('teacher'); setError('');}}>Maestra</button>
          <button className={`role-tab${role==='admin'?' active':''}`} onClick={()=>{setRole('admin'); setError('');}}>Administración</button>
        </div>
        {role==='teacher' ? (
          <form onSubmit={doTeacherLogin}>
            <div className="field">
              <label>Tu nombre</label>
              <select value={teacherId} onChange={e=>setTeacherId(e.target.value)}>
                {teachers.length ? teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>) : <option value="">No hay maestras registradas</option>}
              </select>
            </div>
            <div className="field">
              <label>PIN de 4 dígitos</label>
              <input className="pin-input" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e=>setPin(e.target.value)} placeholder="••••" required />
            </div>
            {error && <p className="error-msg">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={!teachers.length || busy}>{busy?'Entrando…':'Entrar'}</button>
            <button type="button" className="link-btn" style={{marginTop:12}} disabled={recoverBusy} onClick={recoverTeacherPin}>¿Olvidaste tu PIN?</button>
            <p className="hint" style={{marginTop:14}}>¿No apareces en la lista o no tienes PIN? Pídele a la administración que te registre.</p>
          </form>
        ) : (
          <form onSubmit={doAdminLogin}>
            <div className="field">
              <label>PIN de administración</label>
              <input className="pin-input" type="password" inputMode="numeric" maxLength={4} value={adminPin} onChange={e=>setAdminPin(e.target.value)} placeholder="••••" required />
            </div>
            {error && <p className="error-msg">{error}</p>}
            <button className="btn btn-warm" type="submit" disabled={busy}>{busy?'Entrando…':'Entrar'}</button>
            <button type="button" className="link-btn" style={{marginTop:12}} disabled={recoverBusy} onClick={recoverAdminPin}>¿Olvidó el PIN de administración?</button>
          </form>
        )}
      </div>
      <Toast />
    </div>
  );
}

function weekDatesFor(dateStr){
  const d = new Date(dateStr+'T00:00:00');
  const day = d.getDay(); // 0=Dom .. 6=Sáb
  const mondayOffset = day===0 ? -6 : 1-day;
  const monday = new Date(d);
  monday.setDate(d.getDate()+mondayOffset);
  const days = [];
  for(let i=0;i<7;i++){
    const dt = new Date(monday);
    dt.setDate(monday.getDate()+i);
    days.push(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`);
  }
  return days;
}
const WEEKDAY_LETTERS = ['L','M','M','J','V','S','D'];

function WeekDayPicker({ value, onChange }){
  const week = weekDatesFor(value);
  const today = todayStr();
  return (
    <div className="week-strip">
      {week.map((d,i)=>{
        const dayNum = Number(d.slice(8,10));
        const isSel = d===value;
        return (
          <button key={d} type="button" className={`week-pill${isSel?' active':''}${d===today?' today':''}`} onClick={()=>onChange(d)}>
            <span className="week-pill-letter">{WEEKDAY_LETTERS[i]}</span>
            <span className="week-pill-num">{dayNum}</span>
          </button>
        );
      })}
      <div className="date-icon-wrap">
        <input type="date" className="date-icon-input" value={value} onChange={e=>onChange(e.target.value)} />
        <span className="date-icon-visual"><Icon name="calendar" sw={1.6} /></span>
      </div>
    </div>
  );
}

function Header({ user, subtitle, onLogout }){
  return (
    <header className="app-header">
      <BrandStrip />
      <div className="header-row">
        <div>
          <p className="header-org">Sensi · {subtitle}</p>
          <h2>{user.name}</h2>
        </div>
        <button className="icon-btn" onClick={onLogout} aria-label="Salir"><Icon name="logout" /></button>
      </div>
    </header>
  );
}

function RequestItem({ r, showActions, onReview, teacherName }){
  const isVac = r.type==='vacacion';
  const title = isVac ? `Vacaciones · ${r.days} día${r.days===1?'':'s'}` : `Permiso · ${r.perm_type}`;
  const sub = isVac ? `${fmtDate(r.start_date)} – ${fmtDate(r.end_date)}` : fmtDate(r.perm_date);
  return (
    <div className={`list-item st-${r.status}`}>
      <div className="li-top">
        <div>
          <p className="li-title">{teacherName ? `${teacherName} · ${title}` : title}</p>
          <p className="li-sub">{sub}</p>
        </div>
        <span className={`badge badge-${r.status}`}>{r.status==='pendiente'?'Pendiente':r.status==='aprobado'?'Aprobado':'Rechazado'}</span>
      </div>
      {r.reason && <p className="li-reason">{r.reason}</p>}
      {showActions && r.status==='pendiente' && (
        <div className="li-actions">
          <button className="btn btn-outline btn-sm" onClick={()=>onReview(r.id,'rechazado')}><Icon name="x" sw={2}/> Rechazar</button>
          <button className="btn btn-primary btn-sm" onClick={()=>onReview(r.id,'aprobado')}><Icon name="check" sw={2}/> Aprobar</button>
        </div>
      )}
    </div>
  );
}

// ---------------- TEACHER APP ----------------
function TeacherApp({ user, onLogout, toast, Toast }){
  const [view, setView] = useState('inicio');
  const [balance, setBalance] = useState({ vacation_days_total:0, vacation_days_used:0 });
  const [requests, setRequests] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [openNomina, setOpenNomina] = useState(null);
  const [vacationEnabled, setVacationEnabled] = useState(false);
  const [calDate, setCalDate] = useState(todayStr());
  const [calEntries, setCalEntries] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [attBusy, setAttBusy] = useState(false);
  const [profile, setProfile] = useState(null);
  const [assignedChildren, setAssignedChildren] = useState([]);

  const reload = useCallback(async ()=>{
    const [b, r, p, s, a] = await Promise.all([
      supabase.rpc('get_teacher_balance', { p_teacher_id: user.id }),
      supabase.rpc('get_teacher_requests', { p_teacher_id: user.id }),
      supabase.rpc('get_teacher_payroll', { p_teacher_id: user.id }),
      supabase.rpc('get_public_settings'),
      supabase.rpc('get_teacher_attendance', { p_teacher_id: user.id, p_date: todayStr() }),
    ]);
    if(b.data && b.data[0]) setBalance(b.data[0]);
    if(r.data) setRequests(r.data);
    if(p.data) setPayroll(p.data);
    if(s.data && s.data[0]) setVacationEnabled(!!s.data[0].vacation_requests_enabled);
    if(a.data) setAttendance(a.data);
  },[user.id]);

  useEffect(()=>{ reload(); },[reload]);

  useEffect(()=>{
    if(view!=='calendario') return;
    supabase.rpc('get_calendar_day', { p_date: calDate }).then(({data})=>{ if(data) setCalEntries(data); });
  },[view, calDate]);

  useEffect(()=>{
    if(view!=='perfil') return;
    supabase.rpc('get_teacher_profile', { p_teacher_id: user.id }).then(({data})=>{ if(data && data[0]) setProfile(data[0]); });
    supabase.rpc('get_teacher_assigned_children', { p_teacher_id: user.id }).then(({data})=>{ if(data) setAssignedChildren(data); });
  },[view, user.id]);

  async function changeOwnPin(e){
    e.preventDefault();
    const f = e.target;
    const p1 = f.newPin.value.trim(), p2 = f.confirmPin.value.trim();
    if(!/^\d{4}$/.test(p1)){ toast('El PIN debe ser de 4 dígitos.'); return; }
    if(p1!==p2){ toast('Los PIN no coinciden.'); return; }
    const { error } = await supabase.rpc('teacher_change_own_pin', { p_teacher_id:user.id, p_new_pin:p1 });
    if(error){ toast('No se pudo guardar. Intenta de nuevo.'); return; }
    toast('PIN actualizado.');
    f.reset();
  }

  async function markAttendance(type){
    setAttBusy(true);
    const { data, error } = await supabase.rpc('log_attendance', { p_teacher_id:user.id, p_type:type });
    setAttBusy(false);
    const result = data && data[0];
    if(error || !result || !result.ok){ toast((result && result.message) || 'No se pudo registrar.'); return; }
    toast(type==='entrada' ? 'Entrada registrada.' : 'Salida registrada.');
    reload();
  }

  const entradaHoy = attendance.find(a=>a.type==='entrada');
  const salidaHoy = attendance.find(a=>a.type==='salida');
  const fmtHora = iso => iso ? new Date(iso).toLocaleTimeString('es-DO',{hour:'2-digit',minute:'2-digit'}) : '';


  const disponibles = Math.max((balance.vacation_days_total||0)-(balance.vacation_days_used||0),0);
  const pct = balance.vacation_days_total ? Math.min(100, Math.round(((balance.vacation_days_used||0)/balance.vacation_days_total)*100)) : 0;

  async function submitVacation(e){
    e.preventDefault();
    const start = e.target.vacStart.value, end = e.target.vacEnd.value, reason = e.target.vacReason.value.trim();
    if(!start||!end){ toast('Completa las fechas.'); return; }
    const { error } = await supabase.rpc('submit_vacation_request', { p_teacher_id:user.id, p_start_date:start, p_end_date:end, p_reason:reason });
    if(error){ toast(error.message.includes('posterior') ? 'La fecha final debe ser igual o posterior a la inicial.' : 'No se pudo enviar. Intenta de nuevo.'); return; }
    toast('Solicitud de vacaciones enviada.');
    e.target.reset();
    reload();
  }

  async function submitPermission(e){
    e.preventDefault();
    const date = e.target.permDate.value, permType = e.target.permType.value, reason = e.target.permReason.value.trim();
    if(!date){ toast('Selecciona la fecha.'); return; }
    if(!reason){ toast('Describe el motivo del permiso.'); return; }
    const { error } = await supabase.rpc('submit_permission_request', { p_teacher_id:user.id, p_date:date, p_perm_type:permType, p_reason:reason });
    if(error){ toast('No se pudo enviar. Intenta de nuevo.'); return; }
    toast('Solicitud de permiso enviada.');
    e.target.reset();
    reload();
  }

  let content;
  if(view==='inicio'){
    const recent = requests.slice(0,3);
    content = (
      <>
        {vacationEnabled && (
          <div className="hero-card">
            <p className="hero-label">Días de vacaciones</p>
            <div className="hero-figure"><span className="hero-number">{disponibles}</span><span className="hero-unit">disponibles de {balance.vacation_days_total||0}</span></div>
            <div className="hero-bar"><div className="hero-bar-fill" style={{width:`${pct}%`}} /></div>
            <p className="hero-note">{balance.vacation_days_used||0} días tomados este período</p>
          </div>
        )}
        <div className="form-card" style={{marginTop: vacationEnabled ? 16 : 0}}>
          <p style={{fontWeight:600, fontSize:14.5, marginBottom:10}}>Asistencia de hoy</p>
          <div className="quick-actions" style={{marginTop:0}}>
            <button className="btn btn-primary" disabled={attBusy || !!entradaHoy} onClick={()=>markAttendance('entrada')}>
              {entradaHoy ? `Entrada ${fmtHora(entradaHoy.logged_at)}` : 'Marcar entrada'}
            </button>
            <button className="btn btn-outline" disabled={attBusy || !entradaHoy || !!salidaHoy} onClick={()=>markAttendance('salida')}>
              {salidaHoy ? `Salida ${fmtHora(salidaHoy.logged_at)}` : 'Marcar salida'}
            </button>
          </div>
          <p className="hint" style={{marginTop:10}}>Solo funciona conectada al wifi de Sensi.</p>
        </div>
        <div className="quick-actions">
          {vacationEnabled && <button className="btn btn-primary" onClick={()=>setView('vacaciones')}>Pedir vacaciones</button>}
          <button className="btn btn-outline" onClick={()=>setView('permisos')}>Pedir permiso</button>
        </div>
        <p className="section-title">Últimas solicitudes</p>
        {recent.length ? recent.map(r=><RequestItem key={r.id} r={r} />) : <div className="empty-state">Aún no has hecho ninguna solicitud.</div>}
      </>
    );
  } else if(view==='vacaciones'){
    const vacs = requests.filter(r=>r.type==='vacacion');
    content = (
      <>
        <p className="section-title">Nueva solicitud</p>
        <form className="form-card" onSubmit={submitVacation}>
          <div className="two-col">
            <div className="field"><label>Desde</label><input name="vacStart" type="date" required /></div>
            <div className="field"><label>Hasta</label><input name="vacEnd" type="date" required /></div>
          </div>
          <div className="field"><label>Motivo (opcional)</label><textarea name="vacReason" placeholder="Ej. viaje familiar" /></div>
          <button className="btn btn-primary" type="submit">Enviar solicitud</button>
        </form>
        <p className="section-title">Historial</p>
        {vacs.length ? vacs.map(r=><RequestItem key={r.id} r={r} />) : <div className="empty-state">No has solicitado vacaciones todavía.</div>}
      </>
    );
  } else if(view==='permisos'){
    const perms = requests.filter(r=>r.type==='permiso');
    content = (
      <>
        <p className="section-title">Nueva solicitud</p>
        <form className="form-card" onSubmit={submitPermission}>
          <div className="field"><label>Fecha</label><input name="permDate" type="date" required /></div>
          <div className="field"><label>Tipo</label>
            <select name="permType" defaultValue="Día completo">
              <option>Día completo</option><option>Medio día</option><option>Horas específicas</option>
            </select>
          </div>
          <div className="field"><label>Motivo</label><textarea name="permReason" placeholder="Ej. cita médica" required /></div>
          <button className="btn btn-primary" type="submit">Enviar solicitud</button>
        </form>
        <p className="section-title">Historial</p>
        {perms.length ? perms.map(r=><RequestItem key={r.id} r={r} />) : <div className="empty-state">No has solicitado permisos todavía.</div>}
      </>
    );
  } else if(view==='nomina'){
    content = !payroll.length ? (
      <><p className="section-title">Nómina</p><div className="empty-state">Aún no hay nóminas registradas. Cuando la administración la ingrese, aparecerá aquí.</div></>
    ) : (
      <>
        <p className="section-title">Nómina mensual</p>
        <div className="export-row">
          <button className="btn btn-outline btn-sm" onClick={()=>downloadCSV(`nomina_${user.name}.csv`, ['Mes','Bruto','AFP','SFS','ISR','Otras deducciones','Neto','Fecha de pago','Nota'], payroll.map(p=>[fmtMonth(p.month), p.bruto, p.afp, p.sfs, p.isr, p.other_deductions, p.neto, fmtDate(p.fecha_pago), p.nota||'']))}>Exportar CSV</button>
          <button className="btn btn-outline btn-sm" onClick={()=>window.print()}>Imprimir / PDF</button>
        </div>
        {payroll.map(p=>(
          <div key={p.id} className={`nomina-row${openNomina===p.id?' open':''}`}>
            <div className="nomina-row-head" onClick={()=>setOpenNomina(openNomina===p.id?null:p.id)}>
              <div><p className="li-title" style={{textTransform:'capitalize'}}>{fmtMonth(p.month)}</p><p className="li-sub">Pagado {fmtDate(p.fecha_pago)}</p></div>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <strong style={{color:'var(--accent-dark)'}}>{fmtMoney(p.neto)}</strong>
                <Icon name="chevron" />
              </div>
            </div>
            {openNomina===p.id && (
              <div className="nomina-detail">
                <div className="nomina-line"><span>Salario bruto</span><span>{fmtMoney(p.bruto)}</span></div>
                {(p.afp||p.sfs||p.isr||p.other_deductions) ? (
                  <>
                    <div className="nomina-line"><span>AFP</span><span>-{fmtMoney(p.afp)}</span></div>
                    <div className="nomina-line"><span>SFS</span><span>-{fmtMoney(p.sfs)}</span></div>
                    <div className="nomina-line"><span>ISR</span><span>-{fmtMoney(p.isr)}</span></div>
                    {p.other_deductions>0 && <div className="nomina-line"><span>Otras deducciones</span><span>-{fmtMoney(p.other_deductions)}</span></div>}
                  </>
                ) : (
                  <div className="nomina-line"><span>Deducciones</span><span>-{fmtMoney(p.deducciones)}</span></div>
                )}
                <div className="nomina-line total"><span>Neto pagado</span><span>{fmtMoney(p.neto)}</span></div>
                {p.nota && <p className="li-reason" style={{marginTop:10}}>{p.nota}</p>}
              </div>
            )}
          </div>
        ))}
      </>
    );
  } else if(view==='calendario'){
    content = (
      <>
        <p className="section-title">Calendario del día</p>
        <WeekDayPicker value={calDate} onChange={setCalDate} />
        {calEntries.length ? calEntries.map(c=>(
          <div key={c.id} className="cal-entry">
            <p className="li-title">{c.teacher_name}</p>
            <p className="li-sub">{c.child_name}{c.horario ? ` · ${c.horario}` : ''}</p>
            {c.notes && <p className="li-reason">{c.notes}</p>}
          </div>
        )) : <div className="empty-state">No hay nada programado para este día todavía.</div>}
      </>
    );
  } else if(view==='perfil'){
    const tiempo = profile ? tiempoEnEmpresa(profile.hire_date) : null;
    content = (
      <>
        <p className="section-title">Mi perfil</p>
        <div className="form-card">
          <p style={{fontWeight:600, fontSize:17, fontFamily:'Fredoka'}}>{profile?.name || user.name}</p>
          {profile?.email && <p className="teacher-meta" style={{marginTop:4}}>{profile.email}</p>}
          <p className="teacher-meta" style={{marginTop:8}}>
            {profile?.hire_date ? `Desde ${fmtDate(profile.hire_date)}` : 'Fecha de entrada no registrada'}
            {tiempo ? ` · ${tiempo} en Sensi` : ''}
          </p>
          <p className="teacher-meta" style={{marginTop:4}}>
            {profile?.monthly_salary ? `Sueldo actual: ${fmtMoney(profile.monthly_salary)} /mes` : 'Sueldo no registrado'}
          </p>
        </div>
        <p className="section-title">Niños asignados</p>
        {assignedChildren.length ? assignedChildren.map((c,i)=>(
          <div key={i} className="list-item">
            <p className="li-title">{c.child_name}</p>
            {c.horario && <p className="li-sub">{c.horario}</p>}
          </div>
        )) : <div className="empty-state">No tienes niños asignados en el calendario todavía.</div>}
        <p className="section-title">Cambiar mi PIN</p>
        <form className="form-card" onSubmit={changeOwnPin}>
          <div className="field"><label>Nuevo PIN (4 dígitos)</label><input name="newPin" inputMode="numeric" maxLength={4} required /></div>
          <div className="field"><label>Confirmar PIN</label><input name="confirmPin" inputMode="numeric" maxLength={4} required /></div>
          <button className="btn btn-primary" type="submit">Actualizar PIN</button>
        </form>
      </>
    );
  }

  return (
    <div className="app-shell">
      <Header user={user} subtitle="Maestra" onLogout={onLogout} />
      <div className="content">{content}</div>
      <nav className="bottom-nav">
        <button className={`nav-btn${view==='inicio'?' active':''}`} onClick={()=>setView('inicio')}><Icon name="home"/><span>Inicio</span></button>
        {vacationEnabled && <button className={`nav-btn${view==='vacaciones'?' active':''}`} onClick={()=>setView('vacaciones')}><Icon name="sun"/><span>Vacaciones</span></button>}
        <button className={`nav-btn${view==='permisos'?' active':''}`} onClick={()=>setView('permisos')}><Icon name="calendar"/><span>Permisos</span></button>
        <button className={`nav-btn${view==='nomina'?' active':''}`} onClick={()=>setView('nomina')}><Icon name="receipt"/><span>Nómina</span></button>
        <button className={`nav-btn${view==='calendario'?' active':''}`} onClick={()=>setView('calendario')}><Icon name="users"/><span>Calendario</span></button>
        <button className={`nav-btn${view==='perfil'?' active':''}`} onClick={()=>setView('perfil')}><Icon name="user"/><span>Perfil</span></button>
      </nav>
      <Toast />
    </div>
  );
}

function PayrollFormFields({ f, teachers, onSubmit, onCancel }){
  const [bruto, setBruto] = useState(f.bruto || '');
  const [otras, setOtras] = useState(f.otras || '');
  const calc = calcularDeduccionesRD(Number(bruto)||0, Number(otras)||0);
  return (
    <form className="form-card" style={{marginBottom:16}} onSubmit={onSubmit}>
      <div className="field"><label>Maestra</label>
        <select name="teacherId" defaultValue={f.teacherId}>
          {teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div className="field"><label>Mes</label><input name="month" type="month" defaultValue={f.month} required /></div>
      <div className="two-col">
        <div className="field"><label>Salario bruto</label><input name="bruto" type="number" step="0.01" value={bruto} onChange={e=>setBruto(e.target.value)} required /></div>
        <div className="field"><label>Otras deducciones (opcional)</label><input name="otras" type="number" step="0.01" value={otras} onChange={e=>setOtras(e.target.value)} placeholder="0" /></div>
      </div>
      {Number(bruto)>0 && (
        <div className="form-card" style={{background:'var(--bg)', marginBottom:16}}>
          <div className="nomina-line"><span>AFP (2.87%)</span><span>{fmtMoney(calc.afp)}</span></div>
          <div className="nomina-line"><span>SFS (3.04%)</span><span>{fmtMoney(calc.sfs)}</span></div>
          <div className="nomina-line"><span>ISR (DGII)</span><span>{fmtMoney(calc.isr)}</span></div>
          {Number(otras)>0 && <div className="nomina-line"><span>Otras deducciones</span><span>{fmtMoney(calc.otras)}</span></div>}
          <div className="nomina-line total"><span>Neto</span><span>{fmtMoney(calc.neto)}</span></div>
        </div>
      )}
      <div className="field"><label>Fecha de pago</label><input name="fechaPago" type="date" defaultValue={f.fechaPago} /></div>
      <div className="field"><label>Nota (opcional)</label><textarea name="nota" defaultValue={f.nota} /></div>
      <div className="li-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn-primary">Guardar</button>
      </div>
    </form>
  );
}

// ---------------- ADMIN APP ----------------
function AdminApp({ user, onLogout, toast, Toast }){
  const [view, setView] = useState('solicitudes');
  const [requests, setRequests] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [reqFilter, setReqFilter] = useState('pendientes');
  const [showSummary, setShowSummary] = useState(false);
  const [summaryMonth, setSummaryMonth] = useState(new Date().toISOString().slice(0,7));
  const [addingTeacher, setAddingTeacher] = useState(false);
  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [payrollForm, setPayrollForm] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkMonth, setBulkMonth] = useState(new Date().toISOString().slice(0,7));
  const [bulkFecha, setBulkFecha] = useState(todayStr());
  const [bulkPreview, setBulkPreview] = useState(null); // array of parsed rows before saving
  const [bulkBusy, setBulkBusy] = useState(false);
  const [vacationEnabled, setVacationEnabled] = useState(false);
  const [calDate, setCalDate] = useState(todayStr());
  const [calEntries, setCalEntries] = useState([]);
  const [calForm, setCalForm] = useState(null);
  const [families, setFamilies] = useState([]);
  const [invoicesList, setInvoicesList] = useState([]);
  const [ninosView, setNinosView] = useState('familias');
  const [invoiceSummaryMonth, setInvoiceSummaryMonth] = useState(new Date().toISOString().slice(0,7));
  const [addingFamily, setAddingFamily] = useState(false);
  const [editingFamilyId, setEditingFamilyId] = useState(null);
  const [openFamilyId, setOpenFamilyId] = useState(null);
  const [familyItemForm, setFamilyItemForm] = useState(null); // {id, familyId, ...}
  const [sendingInvoiceFor, setSendingInvoiceFor] = useState(null);
  const [officeIp, setOfficeIp] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [showAttendance, setShowAttendance] = useState(false);
  const [attendanceDay, setAttendanceDay] = useState([]);
  const [calBulkOpen, setCalBulkOpen] = useState(false);
  const [calBulkStart, setCalBulkStart] = useState(todayStr());
  const [calBulkEnd, setCalBulkEnd] = useState(todayStr());
  const [calBulkDays, setCalBulkDays] = useState([1,2,3,4,5]); // 0=Dom ... 6=Sáb, default L-V
  const [calBulkText, setCalBulkText] = useState('');
  const [calBulkPreview, setCalBulkPreview] = useState(null);
  const [calBulkBusy, setCalBulkBusy] = useState(false);

  const reload = useCallback(async ()=>{
    const [r, t, p, s] = await Promise.all([
      supabase.rpc('admin_list_requests'),
      supabase.rpc('admin_list_teachers'),
      supabase.rpc('admin_list_payroll'),
      supabase.rpc('get_public_settings'),
    ]);
    if(r.data) setRequests(r.data);
    if(t.data) setTeachers(t.data);
    if(p.data) setPayroll(p.data);
    if(s.data && s.data[0]){ setVacationEnabled(!!s.data[0].vacation_requests_enabled); setOfficeIp(s.data[0].office_ip||''); setAdminEmail(s.data[0].admin_email||''); }
  },[]);

  const reloadCalendar = useCallback(async ()=>{
    const { data } = await supabase.rpc('get_calendar_day', { p_date: calDate });
    if(data) setCalEntries(data);
  },[calDate]);

  useEffect(()=>{ if(view==='calendario') reloadCalendar(); },[view, calDate, reloadCalendar]);

  useEffect(()=>{
    if(view==='calendario' && showAttendance){
      supabase.rpc('admin_list_attendance_day', { p_date: calDate }).then(({data})=>{ if(data) setAttendanceDay(data); });
    }
  },[view, calDate, showAttendance]);

  async function detectMyIp(){
    const { data, error } = await supabase.rpc('get_my_ip');
    if(error || !data){ toast('No se pudo detectar la IP.'); return; }
    setOfficeIp(data);
  }

  const reloadNinos = useCallback(async ()=>{
    const [f, i] = await Promise.all([
      supabase.rpc('admin_list_families'),
      supabase.rpc('admin_list_invoices'),
    ]);
    if(f.data) setFamilies(f.data);
    if(i.data) setInvoicesList(i.data);
  },[]);

  useEffect(()=>{ if(view==='ninos') reloadNinos(); },[view, reloadNinos]);

  async function saveFamily(e){
    e.preventDefault();
    const f = e.target;
    const tutorName = f.tutorName.value.trim(), emails = f.emails.value.trim();
    const discount = Number(f.discount.value)||0;
    const override = f.override.value.trim() ? Number(f.override.value) : null;
    if(!tutorName || !emails){ toast('Completa el nombre del tutor y el correo.'); return; }
    const { error } = await supabase.rpc('admin_save_family', {
      p_family_id: editingFamilyId, p_tutor_name: tutorName, p_emails: emails,
      p_discount_percent: discount, p_total_override: override
    });
    if(error){ toast('No se pudo guardar. Intenta de nuevo.'); return; }
    toast('Familia guardada.');
    setAddingFamily(false); setEditingFamilyId(null);
    reloadNinos();
  }

  async function toggleFamilyActive(id){
    const { error } = await supabase.rpc('admin_toggle_family_active', { p_family_id:id });
    if(error){ toast('No se pudo guardar.'); return; }
    reloadNinos();
  }

  async function deleteFamily(id){
    const { error } = await supabase.rpc('admin_delete_family', { p_family_id:id });
    if(error){ toast('No se pudo eliminar.'); return; }
    toast('Familia eliminada.');
    reloadNinos();
  }

  async function saveFamilyItem(e, familyId){
    e.preventDefault();
    const f = e.target;
    const childName = f.childName.value.trim(), program = f.program.value.trim();
    const schedule = f.schedule.value.trim(), amount = Number(f.amount.value)||0;
    const teacherId = f.teacherId.value || null;
    if(!childName || !program){ toast('Completa nombre del niño y programa.'); return; }
    const { error } = await supabase.rpc('admin_save_family_item', {
      p_item_id: familyItemForm.id, p_family_id: familyId, p_child_name: childName,
      p_program: program, p_schedule: schedule, p_amount: amount, p_teacher_id: teacherId
    });
    if(error){ toast('No se pudo guardar.'); return; }
    setFamilyItemForm(null);
    reloadNinos();
  }

  async function deleteFamilyItem(id){
    const { error } = await supabase.rpc('admin_delete_family_item', { p_item_id:id });
    if(error){ toast('No se pudo eliminar.'); return; }
    reloadNinos();
  }

  async function toggleFamilyItemActive(id){
    const { error } = await supabase.rpc('admin_toggle_family_item_active', { p_item_id:id });
    if(error){ toast('No se pudo guardar.'); return; }
    reloadNinos();
  }

  async function sendInvoiceNow(familyId){
    setSendingInvoiceFor(familyId);
    const { data, error } = await supabase.functions.invoke('send-invoice', {
      body: { family_id: familyId },
      headers: { 'x-portal-secret': import.meta.env.VITE_PORTAL_SHARED_SECRET || '' },
    });
    setSendingInvoiceFor(null);
    if(error || !data){ toast('No se pudo enviar la factura.'); return; }
    if(data.sent>0) toast('Factura enviada.');
    else toast((data.details && data.details[0] && data.details[0].error) || 'No se pudo enviar.');
    reloadNinos();
  }

  async function markPaidAndSendReceipt(invoiceId){
    const { data, error } = await supabase.rpc('admin_mark_invoice_paid', { p_invoice_id: invoiceId });
    const r = data && data[0];
    if(error || !r || !r.ok){ toast('No se pudo procesar.'); return; }
    const html = buildReceiptHtml(r);
    const ok = await sendNotification(r.emails, `Recibo de Pago Sensi SRL - ${fmtMonth(r.billing_month)}`, html);
    toast(ok ? 'Recibo enviado.' : 'Se marcó como pagada, pero el correo del recibo no se pudo enviar. Revisa el correo de la familia.');
    reloadNinos();
  }

  async function sendReminder(inv){
    const html = buildReminderHtml(inv);
    const ok = await sendNotification(inv.emails_snapshot, `Recordatorio de pago — Factura ${inv.invoice_number}`, html);
    if(!ok){ toast('No se pudo enviar el recordatorio. Revisa el correo de la familia.'); return; }
    const { error } = await supabase.rpc('admin_mark_reminder_sent', { p_invoice_id: inv.id });
    if(error){ toast('Se envió, pero no se pudo guardar la fecha.'); reloadNinos(); return; }
    toast('Recordatorio enviado.');
    reloadNinos();
  }

  async function saveOfficeIp(){
    const { error } = await supabase.rpc('admin_set_office_ip', { p_ip: officeIp.trim() });
    if(error){ toast('No se pudo guardar. Intenta de nuevo.'); return; }
    toast('IP del centro guardada.');
  }

  async function saveAdminEmail(){
    const { error } = await supabase.rpc('admin_set_recovery_email', { p_email: adminEmail.trim() });
    if(error){ toast('No se pudo guardar. Intenta de nuevo.'); return; }
    toast('Correo de recuperación guardado.');
  }

  async function toggleVacationEnabled(){
    const next = !vacationEnabled;
    const { error } = await supabase.rpc('admin_set_vacation_requests_enabled', { p_enabled: next });
    if(error){ toast('No se pudo guardar. Intenta de nuevo.'); return; }
    setVacationEnabled(next);
    toast(next ? 'Vacaciones activadas para las maestras.' : 'Vacaciones ocultas para las maestras.');
  }

  async function saveCalEntry(e){
    e.preventDefault();
    const f = e.target;
    const teacherId = f.teacherId.value, childName = f.childName.value.trim(), horario = f.horario.value.trim(), notes = f.notes.value.trim();
    if(!teacherId || !childName){ toast('Completa maestra y niño.'); return; }
    const { error } = await supabase.rpc('admin_save_calendar_entry', {
      p_entry_id: calForm.id || null, p_entry_date: calDate, p_teacher_id: teacherId,
      p_child_name: childName, p_horario: horario, p_notes: notes
    });
    if(error){ toast('No se pudo guardar. Intenta de nuevo.'); return; }
    toast('Guardado.');
    setCalForm(null);
    reloadCalendar();
  }

  async function deleteCalEntry(id){
    const { error } = await supabase.rpc('admin_delete_calendar_entry', { p_entry_id:id });
    if(error){ toast('No se pudo eliminar.'); return; }
    reloadCalendar();
  }

  const WEEKDAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  function toggleCalBulkDay(d){
    setCalBulkDays(prev => prev.includes(d) ? prev.filter(x=>x!==d) : [...prev, d].sort());
  }

  function parseCalBulk(){
    const lines = calBulkText.split('\n').map(l=>l.trim()).filter(Boolean);
    const parsedLines = lines.map(line=>{
      const parts = line.split(',');
      const rawName = (parts[0]||'').trim();
      const childName = (parts[1]||'').trim();
      const horario = (parts[2]||'').trim();
      const nameLower = rawName.toLowerCase();
      let teacher = teachers.find(t=>t.name.toLowerCase()===nameLower);
      if(!teacher) teacher = teachers.find(t=>t.name.toLowerCase().includes(nameLower) || nameLower.includes(t.name.toLowerCase()));
      return { rawName, childName, horario, teacher };
    });
    const dates = [];
    if(calBulkStart && calBulkEnd && calBulkEnd>=calBulkStart){
      let d = new Date(calBulkStart+'T00:00:00');
      const end = new Date(calBulkEnd+'T00:00:00');
      while(d<=end){
        if(calBulkDays.includes(d.getDay())) dates.push(d.toISOString().slice(0,10));
        d.setDate(d.getDate()+1);
      }
    }
    setCalBulkPreview({ lines: parsedLines, dates });
  }

  async function saveCalBulk(){
    if(!calBulkPreview) return;
    const { lines, dates } = calBulkPreview;
    const validLines = lines.filter(l=>l.teacher && l.childName);
    if(!validLines.length || !dates.length){ toast('Revisa la lista y el rango de fechas.'); return; }
    setCalBulkBusy(true);
    let ok=0, fail=0;
    for(const date of dates){
      for(const l of validLines){
        const { error } = await supabase.rpc('admin_save_calendar_entry', {
          p_entry_id: null, p_entry_date: date, p_teacher_id: l.teacher.id,
          p_child_name: l.childName, p_horario: l.horario, p_notes: ''
        });
        if(error) fail++; else ok++;
      }
    }
    setCalBulkBusy(false);
    toast(fail ? `${ok} guardadas, ${fail} con error.` : `${ok} entradas guardadas en el calendario.`);
    setCalBulkOpen(false);
    setCalBulkPreview(null);
    setCalBulkText('');
    reloadCalendar();
  }

  useEffect(()=>{ reload(); },[reload]);

  useEffect(()=>{
    const id = setInterval(reload, 20000);
    return ()=>clearInterval(id);
  },[reload]);

  async function reviewRequest(id, decision){
    const req = requests.find(r=>r.id===id);
    const { error } = await supabase.rpc('admin_review_request', { p_request_id:id, p_decision:decision });
    if(error){ toast('No se pudo guardar. Intenta de nuevo.'); return; }
    toast(decision==='aprobado' ? 'Solicitud aprobada.' : 'Solicitud rechazada.');
    if(req){
      const teacher = teachers.find(t=>t.id===req.teacher_id);
      const tipo = req.type==='vacacion' ? 'solicitud de vacaciones' : 'solicitud de permiso';
      const rango = req.type==='vacacion' ? `${fmtDate(req.start_date)} – ${fmtDate(req.end_date)}` : fmtDate(req.perm_date);
      const estado = decision==='aprobado' ? 'aprobada' : 'rechazada';
      sendNotification(teacher?.email, `Tu ${tipo} fue ${estado}`,
        `<p>Hola ${teacher?.name||''},</p><p>Tu ${tipo} para <strong>${rango}</strong> fue <strong>${estado}</strong>.</p><p>— Sensi Portal</p>`);
    }
    reload();
  }

  async function saveNewTeacher(e){
    e.preventDefault();
    const f = e.target;
    const name = f.name.value.trim(), pin = f.pin.value.trim(), vac = Number(f.vacDays.value)||DEFAULT_VACATION_DAYS;
    const email = f.email.value.trim(), salary = f.salary.value ? Number(f.salary.value) : null, hireDate = f.hireDate.value || null;
    const cedula = f.cedula.value.trim(), workSchedule = f.workSchedule.value.trim();
    if(!name){ toast('Escribe el nombre.'); return; }
    if(!/^\d{4}$/.test(pin)){ toast('El PIN debe ser de 4 dígitos.'); return; }
    const { error } = await supabase.rpc('admin_add_teacher', { p_name:name, p_pin:pin, p_vacation_days_total:vac, p_email:email||null, p_monthly_salary:salary, p_hire_date:hireDate, p_cedula:cedula||null, p_work_schedule:workSchedule||null });
    if(error){ toast('No se pudo guardar. Intenta de nuevo.'); return; }
    toast('Maestra agregada.');
    setAddingTeacher(false);
    reload();
  }

  async function saveEditedTeacher(e, id){
    e.preventDefault();
    const f = e.target;
    const name=f.name.value.trim(), pin=f.pin.value.trim(), vac=Number(f.vacDays.value), used=Number(f.vacUsed.value);
    const email = f.email.value.trim(), salary = f.salary.value ? Number(f.salary.value) : null, hireDate = f.hireDate.value || null;
    const cedula = f.cedula.value.trim(), workSchedule = f.workSchedule.value.trim();
    if(!name){ toast('Escribe el nombre.'); return; }
    if(!/^\d{4}$/.test(pin)){ toast('El PIN debe ser de 4 dígitos.'); return; }
    const { error } = await supabase.rpc('admin_edit_teacher', { p_teacher_id:id, p_name:name, p_pin:pin, p_vacation_days_total:vac||0, p_vacation_days_used:used||0, p_email:email||null, p_monthly_salary:salary, p_hire_date:hireDate, p_cedula:cedula||null, p_work_schedule:workSchedule||null });
    if(error){ toast('No se pudo guardar. Intenta de nuevo.'); return; }
    toast('Cambios guardados.');
    setEditingTeacherId(null);
    reload();
  }

  async function toggleActive(id){
    const { error } = await supabase.rpc('admin_toggle_teacher_active', { p_teacher_id:id });
    if(error){ toast('No se pudo guardar. Intenta de nuevo.'); return; }
    reload();
  }

  async function savePayrollForm(e){
    e.preventDefault();
    const f = e.target;
    const teacherId = f.teacherId.value, month = f.month.value;
    const bruto = Number(f.bruto.value)||0, otras = Number(f.otras.value)||0;
    const calc = calcularDeduccionesRD(bruto, otras);
    const fechaPago = f.fechaPago.value, nota = f.nota.value.trim();
    if(!teacherId||!month){ toast('Selecciona maestra y mes.'); return; }
    const { error } = await supabase.rpc('admin_save_payroll', {
      p_payroll_id: payrollForm.id || null, p_teacher_id:teacherId, p_month:month,
      p_bruto:bruto, p_afp:calc.afp, p_sfs:calc.sfs, p_isr:calc.isr, p_other_deductions:otras,
      p_neto:calc.neto, p_fecha_pago:fechaPago||null, p_nota:nota
    });
    if(error){ toast(error.message.includes('duplicate') ? 'Ya existe una nómina para esa maestra en ese mes.' : 'No se pudo guardar. Intenta de nuevo.'); return; }
    toast('Nómina guardada.');
    setPayrollForm(null);
    const teacher = teachers.find(t=>t.id===teacherId);
    sendNotification(teacher?.email, `Tu nómina de ${fmtMonth(month)} ya está disponible`,
      `<p>Hola ${teacher?.name||''},</p><p>Tu nómina de <strong>${fmtMonth(month)}</strong> ya está disponible en el Portal de Personal. Neto: <strong>${fmtMoney(calc.neto)}</strong>.</p><p>— Sensi Portal</p>`);
    reload();
  }

  function parseBulk(){
    const lines = bulkText.split('\n').map(l=>l.trim()).filter(Boolean);
    const rows = lines.map(line=>{
      const parts = line.split(',');
      const rawName = (parts[0]||'').trim();
      const bruto = Number((parts[1]||'').replace(/[^\d.]/g,'')) || 0;
      const otras = Number((parts[2]||'').replace(/[^\d.]/g,'')) || 0;
      const nameLower = rawName.toLowerCase();
      let teacher = teachers.find(t=>t.name.toLowerCase()===nameLower);
      if(!teacher) teacher = teachers.find(t=>t.name.toLowerCase().includes(nameLower) || nameLower.includes(t.name.toLowerCase()));
      const calc = bruto ? calcularDeduccionesRD(bruto, otras) : null;
      return { rawName, bruto, otras, teacher, calc };
    });
    setBulkPreview(rows);
  }

  async function saveBulk(){
    if(!bulkPreview) return;
    setBulkBusy(true);
    let ok=0, fail=0;
    for(const row of bulkPreview){
      if(!row.teacher || !row.bruto){ fail++; continue; }
      const nota = row.otras ? `Otras deducciones: ${fmtMoney(row.otras)}` : '';
      const { error } = await supabase.rpc('admin_save_payroll', {
        p_payroll_id: null, p_teacher_id: row.teacher.id, p_month: bulkMonth,
        p_bruto: row.bruto, p_afp: row.calc.afp, p_sfs: row.calc.sfs, p_isr: row.calc.isr,
        p_other_deductions: row.otras, p_neto: row.calc.neto, p_fecha_pago: bulkFecha || null, p_nota: nota
      });
      if(error){ fail++; continue; }
      ok++;
      sendNotification(row.teacher.email, `Tu nómina de ${fmtMonth(bulkMonth)} ya está disponible`,
        `<p>Hola ${row.teacher.name},</p><p>Tu nómina de <strong>${fmtMonth(bulkMonth)}</strong> ya está disponible en el Portal de Personal. Neto: <strong>${fmtMoney(row.calc.neto)}</strong>.</p><p>— Sensi Portal</p>`);
    }
    setBulkBusy(false);
    toast(fail ? `${ok} guardadas, ${fail} con error (revisa nombres no encontrados).` : `${ok} nóminas guardadas.`);
    setBulkPreview(null);
    setBulkText('');
    setBulkOpen(false);
    reload();
  }

  async function deletePayroll(id){
    const { error } = await supabase.rpc('admin_delete_payroll', { p_payroll_id:id });
    if(error){ toast('No se pudo eliminar.'); return; }
    reload();
  }

  async function changeAdminPin(e){
    e.preventDefault();
    const f = e.target;
    const p1 = f.newPin.value.trim(), p2 = f.confirmPin.value.trim();
    if(!/^\d{4}$/.test(p1)){ toast('El PIN debe ser de 4 dígitos.'); return; }
    if(p1!==p2){ toast('Los PIN no coinciden.'); return; }
    const { error } = await supabase.rpc('admin_change_pin', { p_new_pin:p1 });
    if(error){ toast('No se pudo guardar. Intenta de nuevo.'); return; }
    toast('PIN de administración actualizado.');
    f.reset();
  }

  const pendingCount = requests.filter(r=>r.status==='pendiente').length;
  const teacherName = id => teachers.find(t=>t.id===id)?.name || 'Maestra';

  let content;
  if(view==='solicitudes'){
    let list = [...requests];
    if(reqFilter==='pendientes') list = list.filter(r=>r.status==='pendiente');
    else if(reqFilter==='vacaciones') list = list.filter(r=>r.type==='vacacion');
    else if(reqFilter==='permisos') list = list.filter(r=>r.type==='permiso');

    if(showSummary){
      const inMonth = d => d && d.slice(0,7)===summaryMonth;
      const rows = teachers.map(t=>{
        const vac = requests.filter(r=>r.teacher_id===t.id && r.type==='vacacion' && r.status==='aprobado' && inMonth(r.start_date));
        const perm = requests.filter(r=>r.teacher_id===t.id && r.type==='permiso' && r.status==='aprobado' && inMonth(r.perm_date));
        const vacDays = vac.reduce((s,r)=>s+(r.days||0),0);
        return { name:t.name, vacDays, permCount:perm.length };
      });
      content = (
        <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <p className="section-title" style={{margin:0}}>Resumen mensual</p>
            <button className="link-btn" onClick={()=>setShowSummary(false)}>Volver a solicitudes</button>
          </div>
          <div className="field"><label>Mes</label><input type="month" value={summaryMonth} onChange={e=>setSummaryMonth(e.target.value)} /></div>
          <div className="export-row">
            <button className="btn btn-outline btn-sm" onClick={()=>downloadCSV(`resumen_${summaryMonth}.csv`, ['Maestra','Días de vacaciones aprobados','Permisos aprobados'], rows.map(r=>[r.name, r.vacDays, r.permCount]))}>Exportar CSV</button>
            <button className="btn btn-outline btn-sm" onClick={()=>window.print()}>Imprimir / PDF</button>
          </div>
          {rows.map(r=>(
            <div key={r.name} className="summary-row">
              <span>{r.name}</span>
              <span style={{color:'var(--text-muted)',fontSize:13}}>{r.vacDays} día{r.vacDays===1?'':'s'} vac. · {r.permCount} permiso{r.permCount===1?'':'s'}</span>
            </div>
          ))}
        </>
      );
    } else {
      content = (
        <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div className="chip-row" style={{marginBottom:0}}>
              {['pendientes','todas','vacaciones','permisos'].map(f=>(
                <button key={f} className={`chip${reqFilter===f?' active':''}`} onClick={()=>setReqFilter(f)}>{f[0].toUpperCase()+f.slice(1)}</button>
              ))}
            </div>
          </div>
          <div className="export-row">
            <button className="link-btn" onClick={()=>setShowSummary(true)}>Ver resumen mensual</button>
            <button className="link-btn" onClick={()=>{setView('ninos'); setNinosView('facturas');}}>Ver facturas</button>
          </div>
          {list.length ? list.map(r=><RequestItem key={r.id} r={r} showActions onReview={reviewRequest} teacherName={r.teacher_name} />) : <div className="empty-state">No hay solicitudes en esta vista.</div>}
        </>
      );
    }
  } else if(view==='maestras'){
    content = (
      <>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <p className="section-title" style={{margin:0}}>Maestras ({teachers.length})</p>
          <button className="btn btn-warm btn-sm" onClick={()=>{setAddingTeacher(true); setEditingTeacherId(null);}}><Icon name="plus" sw={2}/> Agregar</button>
        </div>
        {addingTeacher && (
          <form className="form-card" style={{marginBottom:14}} onSubmit={saveNewTeacher}>
            <div className="field"><label>Nombre completo</label><input name="name" placeholder="Ej. Ana Pérez" required /></div>
            <div className="two-col">
              <div className="field"><label>PIN (4 dígitos)</label><input name="pin" inputMode="numeric" maxLength={4} placeholder="1234" required /></div>
              <div className="field"><label>Días de vacaciones/año</label><input name="vacDays" type="number" min="0" defaultValue={DEFAULT_VACATION_DAYS} /></div>
            </div>
            <div className="field"><label>Cédula</label><input name="cedula" placeholder="402-0000000-0" /></div>
            <div className="field"><label>Correo (para notificaciones, opcional)</label><input name="email" type="email" placeholder="maestra@correo.com" /></div>
            <div className="two-col">
              <div className="field"><label>Salario mensual (opcional)</label><input name="salary" type="number" step="0.01" placeholder="25000" /></div>
              <div className="field"><label>Fecha de entrada</label><input name="hireDate" type="date" /></div>
            </div>
            <div className="field"><label>Horario laboral</label><input name="workSchedule" placeholder="Ej. Lunes a Viernes AM y PM" /></div>
            <div className="li-actions">
              <button type="button" className="btn btn-ghost" onClick={()=>setAddingTeacher(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Guardar maestra</button>
            </div>
          </form>
        )}
        {teachers.map(t=>{
          if(editingTeacherId===t.id) return (
            <form key={t.id} className="form-card" style={{marginBottom:10}} onSubmit={(e)=>saveEditedTeacher(e,t.id)}>
              <div className="field"><label>Nombre</label><input name="name" defaultValue={t.name} required /></div>
              <div className="two-col">
                <div className="field"><label>PIN (4 dígitos)</label><input name="pin" defaultValue={t.pin} inputMode="numeric" maxLength={4} /></div>
                <div className="field"><label>Días de vacaciones/año</label><input name="vacDays" type="number" min="0" defaultValue={t.vacation_days_total||0} /></div>
              </div>
              <div className="field"><label>Días ya usados</label><input name="vacUsed" type="number" min="0" defaultValue={t.vacation_days_used||0} /></div>
              <div className="field"><label>Cédula</label><input name="cedula" defaultValue={t.cedula||''} placeholder="402-0000000-0" /></div>
              <div className="field"><label>Correo (para notificaciones)</label><input name="email" type="email" defaultValue={t.email||''} placeholder="maestra@correo.com" /></div>
              <div className="two-col">
                <div className="field"><label>Salario mensual</label><input name="salary" type="number" step="0.01" defaultValue={t.monthly_salary||''} /></div>
                <div className="field"><label>Fecha de entrada</label><input name="hireDate" type="date" defaultValue={t.hire_date||''} /></div>
              </div>
              <div className="field"><label>Horario laboral</label><input name="workSchedule" defaultValue={t.work_schedule||''} placeholder="Ej. Lunes a Viernes AM y PM" /></div>
              <div className="li-actions">
                <button type="button" className="btn btn-ghost" onClick={()=>setEditingTeacherId(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar</button>
              </div>
            </form>
          );
          const disponibles = Math.max((t.vacation_days_total||0)-(t.vacation_days_used||0),0);
          const tiempo = tiempoEnEmpresa(t.hire_date);
          return (
            <div key={t.id} className={`teacher-row${t.active?'':' inactive'}`}>
              <div className="teacher-row-top">
                <div>
                  <p className="teacher-name">{t.name}</p>
                  <p className="teacher-meta">{disponibles} de {t.vacation_days_total||0} días disponibles {t.active?'':'· inactiva'}</p>
                  {t.work_schedule && <p className="teacher-meta">{t.work_schedule}</p>}
                  {t.cedula && <p className="teacher-meta">Cédula {t.cedula}</p>}
                  <p className="teacher-meta">
                    {t.monthly_salary ? fmtMoney(t.monthly_salary)+' /mes' : 'Salario no registrado'}
                    {t.hire_date ? ` · Desde ${fmtDate(t.hire_date)}` : ''}
                    {tiempo ? ` · ${tiempo} en Sensi` : ''}
                  </p>
                  {t.email && <p className="teacher-meta">{t.email}</p>}
                </div>
                <div className="row-actions">
                  <button className="mini-btn" onClick={()=>{setEditingTeacherId(t.id); setAddingTeacher(false);}} aria-label="Editar"><Icon name="edit" sw={1.6}/></button>
                  <button className="mini-btn" onClick={()=>toggleActive(t.id)} aria-label="Activar o desactivar"><Icon name={t.active?'x':'check'} sw={1.8}/></button>
                </div>
              </div>
            </div>
          );
        })}
        {!teachers.length && !addingTeacher && <div className="empty-state">Aún no has agregado maestras.</div>}
      </>
    );
  } else if(view==='nomina'){
    const f = payrollForm;
    content = (
      <>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14, gap:8}}>
          <p className="section-title" style={{margin:0}}>Registros de nómina</p>
          {!f && !bulkOpen && (
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-outline btn-sm" onClick={()=>{setBulkOpen(true); setBulkPreview(null);}}>Carga masiva</button>
              <button className="btn btn-warm btn-sm" onClick={()=>setPayrollForm({ id:null, teacherId:teachers[0]?.id||'', month:new Date().toISOString().slice(0,7), bruto:'', otras:'', fechaPago:todayStr(), nota:'' })}><Icon name="plus" sw={2}/> Nueva</button>
            </div>
          )}
        </div>
        {!f && !bulkOpen && payroll.length>0 && (
          <div className="export-row">
            <button className="btn btn-outline btn-sm" onClick={()=>downloadCSV('nomina_sensi.csv', ['Maestra','Mes','Bruto','AFP','SFS','ISR','Otras deducciones','Neto','Fecha de pago','Nota'], payroll.map(p=>[p.teacher_name, fmtMonth(p.month), p.bruto, p.afp, p.sfs, p.isr, p.other_deductions, p.neto, fmtDate(p.fecha_pago), p.nota||'']))}>Exportar CSV</button>
            <button className="btn btn-outline btn-sm" onClick={()=>window.print()}>Imprimir / PDF</button>
          </div>
        )}
        {bulkOpen && (
          <div className="form-card" style={{marginBottom:16}}>
            <p className="hint" style={{marginBottom:10}}>Pega una línea por maestra: <strong>Nombre, sueldo bruto, otras deducciones (opcional)</strong>. Ejemplo: <em>Rossella, 25000, 500</em>. AFP (2.87%), SFS (3.04%) e ISR (tabla DGII 2026) se calculan solos.</p>
            <div className="two-col">
              <div className="field"><label>Mes</label><input type="month" value={bulkMonth} onChange={e=>setBulkMonth(e.target.value)} /></div>
              <div className="field"><label>Fecha de pago</label><input type="date" value={bulkFecha} onChange={e=>setBulkFecha(e.target.value)} /></div>
            </div>
            <div className="field">
              <label>Lista (una maestra por línea)</label>
              <textarea rows={5} value={bulkText} onChange={e=>{setBulkText(e.target.value); setBulkPreview(null);}} placeholder={'Rossella, 25000, 500\nAna Pérez, 30000'} />
            </div>
            {!bulkPreview ? (
              <div className="li-actions">
                <button className="btn btn-ghost" onClick={()=>{setBulkOpen(false); setBulkText(''); setBulkPreview(null);}}>Cancelar</button>
                <button className="btn btn-primary" onClick={parseBulk} disabled={!bulkText.trim()}>Calcular</button>
              </div>
            ) : (
              <>
                <p className="section-title" style={{marginTop:18}}>Revisa antes de guardar</p>
                {bulkPreview.map((row,i)=>(
                  <div key={i} className="list-item" style={{borderLeftColor: row.teacher && row.bruto ? 'var(--success)' : 'var(--danger)'}}>
                    <div className="li-top">
                      <div>
                        <p className="li-title">{row.rawName || '(sin nombre)'}{row.teacher ? ` → ${row.teacher.name}` : ' — no encontrada'}</p>
                        {row.calc && <p className="li-sub">Bruto {fmtMoney(row.bruto)}{row.otras>0?` · Otras ${fmtMoney(row.otras)}`:''} · Neto {fmtMoney(row.calc.neto)}</p>}
                      </div>
                    </div>
                    {row.calc && <p className="li-reason">AFP {fmtMoney(row.calc.afp)} · SFS {fmtMoney(row.calc.sfs)} · ISR {fmtMoney(row.calc.isr)}</p>}
                    {!row.teacher && <p className="li-reason" style={{color:'var(--danger)'}}>No coincide con ninguna maestra registrada — se omitirá.</p>}
                  </div>
                ))}
                <div className="li-actions">
                  <button className="btn btn-ghost" onClick={()=>setBulkPreview(null)}>Editar lista</button>
                  <button className="btn btn-primary" onClick={saveBulk} disabled={bulkBusy}>{bulkBusy?'Guardando…':'Confirmar y guardar todo'}</button>
                </div>
              </>
            )}
          </div>
        )}
        {f && (
          <PayrollFormFields f={f} teachers={teachers} onSubmit={savePayrollForm} onCancel={()=>setPayrollForm(null)} />
        )}
        {payroll.length ? payroll.map(p=>(
          <div key={p.id} className="list-item">
            <div className="li-top">
              <div>
                <p className="li-title">{p.teacher_name}</p>
                <p className="li-sub" style={{textTransform:'capitalize'}}>{fmtMonth(p.month)} · Neto {fmtMoney(p.neto)}</p>
              </div>
              <div className="row-actions">
                <button className="mini-btn" onClick={()=>setPayrollForm({ id:p.id, teacherId:p.teacher_id, month:p.month, bruto:p.bruto, otras:p.other_deductions||0, fechaPago:p.fecha_pago, nota:p.nota||'' })}><Icon name="edit" sw={1.6}/></button>
                <button className="mini-btn" onClick={()=>deletePayroll(p.id)}><Icon name="trash" sw={1.6}/></button>
              </div>
            </div>
          </div>
        )) : <div className="empty-state">No hay nóminas registradas todavía.</div>}
      </>
    );
  } else if(view==='calendario'){
    content = (
      <>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:0}}>
          <p className="section-title" style={{margin:0}}>{showAttendance ? 'Asistencia del día' : 'Calendario'}</p>
          <button className="link-btn" onClick={()=>setShowAttendance(!showAttendance)}>{showAttendance ? 'Ver horarios' : 'Ver asistencia'}</button>
        </div>
        <WeekDayPicker value={calDate} onChange={setCalDate} />
        {!showAttendance && !calForm && !calBulkOpen && (
          <div style={{display:'flex',gap:8, marginBottom:16, marginTop:-8}}>
            <button className="btn btn-outline btn-sm" onClick={()=>{setCalBulkOpen(true); setCalBulkPreview(null);}}>Carga masiva</button>
            <button className="btn btn-warm btn-sm" onClick={()=>setCalForm({ id:null, teacherId:teachers[0]?.id||'' })}><Icon name="plus" sw={2}/> Agregar</button>
          </div>
        )}
        {showAttendance ? (
          attendanceDay.length ? attendanceDay.map((a,i)=>(
            <div key={i} className="summary-row">
              <span>{a.teacher_name}</span>
              <span style={{color:'var(--text-muted)',fontSize:13}}>{a.type==='entrada'?'Entrada':'Salida'} · {new Date(a.logged_at).toLocaleTimeString('es-DO',{hour:'2-digit',minute:'2-digit'})}</span>
            </div>
          )) : <div className="empty-state">Nadie ha marcado entrada o salida este día.</div>
        ) : (
        <>
        {calBulkOpen && (
          <div className="form-card" style={{marginBottom:16}}>
            <p className="hint" style={{marginBottom:10}}>Define el rango de fechas y los días que se repite, y pega una línea por niño: <strong>Maestra, Niño, Horario</strong>. Ejemplo: <em>Rossella, Piero, 9:00am-10:00am</em>. Se crea automático para cada día del rango que coincida.</p>
            <div className="two-col">
              <div className="field"><label>Desde</label><input type="date" value={calBulkStart} onChange={e=>{setCalBulkStart(e.target.value); setCalBulkPreview(null);}} /></div>
              <div className="field"><label>Hasta</label><input type="date" value={calBulkEnd} onChange={e=>{setCalBulkEnd(e.target.value); setCalBulkPreview(null);}} /></div>
            </div>
            <div className="field">
              <label>Repetir en estos días</label>
              <div className="chip-row" style={{marginBottom:0}}>
                {WEEKDAYS.map((label,i)=>(
                  <button key={i} type="button" className={`chip${calBulkDays.includes(i)?' active':''}`} onClick={()=>{toggleCalBulkDay(i); setCalBulkPreview(null);}}>{label}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Lista (una fila por niño)</label>
              <textarea rows={5} value={calBulkText} onChange={e=>{setCalBulkText(e.target.value); setCalBulkPreview(null);}} placeholder={'Rossella, Piero, 9:00am-10:00am\nAna Pérez, Sofía, 10:00am-11:00am'} />
            </div>
            {!calBulkPreview ? (
              <div className="li-actions">
                <button className="btn btn-ghost" onClick={()=>{setCalBulkOpen(false); setCalBulkText('');}}>Cancelar</button>
                <button className="btn btn-primary" onClick={parseCalBulk} disabled={!calBulkText.trim()}>Calcular</button>
              </div>
            ) : (
              <>
                <p className="section-title" style={{marginTop:18}}>Revisa antes de guardar</p>
                {calBulkPreview.lines.map((l,i)=>(
                  <div key={i} className="list-item" style={{borderLeftColor: l.teacher && l.childName ? 'var(--success)' : 'var(--danger)'}}>
                    <p className="li-title">{l.rawName || '(sin nombre)'}{l.teacher ? ` → ${l.teacher.name}` : ' — no encontrada'} · {l.childName || '(sin niño)'}</p>
                    {l.horario && <p className="li-sub">{l.horario}</p>}
                  </div>
                ))}
                <p className="hint" style={{margin:'10px 0'}}>{calBulkPreview.dates.length} día{calBulkPreview.dates.length===1?'':'s'} en el rango × {calBulkPreview.lines.filter(l=>l.teacher&&l.childName).length} fila{calBulkPreview.lines.length===1?'':'s'} válida{calBulkPreview.lines.length===1?'':'s'} = {calBulkPreview.dates.length * calBulkPreview.lines.filter(l=>l.teacher&&l.childName).length} entradas se van a crear.</p>
                <div className="li-actions">
                  <button className="btn btn-ghost" onClick={()=>setCalBulkPreview(null)}>Editar</button>
                  <button className="btn btn-primary" onClick={saveCalBulk} disabled={calBulkBusy}>{calBulkBusy?'Guardando…':'Confirmar y guardar todo'}</button>
                </div>
              </>
            )}
          </div>
        )}
        {calForm && (
          <form className="form-card" style={{marginBottom:16}} onSubmit={saveCalEntry}>
            <div className="field"><label>Maestra</label>
              <select name="teacherId" defaultValue={calForm.teacherId}>
                {teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Niño/a</label><input name="childName" defaultValue={calForm.childName||''} placeholder="Ej. Piero Rodríguez" required /></div>
            <div className="field"><label>Horario</label><input name="horario" defaultValue={calForm.horario||''} placeholder="Ej. 9:00am - 10:00am" /></div>
            <div className="field"><label>Nota (opcional)</label><textarea name="notes" defaultValue={calForm.notes||''} /></div>
            <div className="li-actions">
              <button type="button" className="btn btn-ghost" onClick={()=>setCalForm(null)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Guardar</button>
            </div>
          </form>
        )}
        {calEntries.length ? calEntries.map(c=>(
          <div key={c.id} className="cal-entry">
            <div className="li-top">
              <div>
                <p className="li-title">{c.teacher_name}</p>
                <p className="li-sub">{c.child_name}{c.horario ? ` · ${c.horario}` : ''}</p>
                {c.notes && <p className="li-reason">{c.notes}</p>}
              </div>
              <div className="row-actions">
                <button className="mini-btn" onClick={()=>setCalForm({ id:c.id, teacherId:c.teacher_id, childName:c.child_name, horario:c.horario, notes:c.notes })}><Icon name="edit" sw={1.6}/></button>
                <button className="mini-btn" onClick={()=>deleteCalEntry(c.id)}><Icon name="trash" sw={1.6}/></button>
              </div>
            </div>
          </div>
        )) : <div className="empty-state">No hay nada programado para este día todavía.</div>}
        </>
        )}
      </>
    );
  } else if(view==='ninos'){
    content = (
      <>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:0}}>
          <p className="section-title" style={{margin:0}}>{ninosView==='familias' ? 'Niños y facturación' : 'Facturas'}</p>
          <button className="link-btn" onClick={()=>setNinosView(ninosView==='familias'?'facturas':'familias')}>{ninosView==='familias' ? 'Ver facturas' : 'Ver familias'}</button>
        </div>
        {ninosView==='facturas' ? (
          <>
            {(()=>{
              const inMonth = invoicesList.filter(inv=>inv.issue_date && inv.issue_date.slice(0,7)===invoiceSummaryMonth);
              const facturado = inMonth.reduce((s,i)=>s+Number(i.total),0);
              const cobrado = inMonth.filter(i=>i.status==='pagada').reduce((s,i)=>s+Number(i.total),0);
              const pendiente = facturado - cobrado;
              return (
                <div className="form-card" style={{marginBottom:16}}>
                  <div className="field" style={{marginBottom:12}}><label>Mes</label><input type="month" value={invoiceSummaryMonth} onChange={e=>setInvoiceSummaryMonth(e.target.value)} /></div>
                  <div className="nomina-line"><span>Facturado</span><span>{fmtMoney(facturado)}</span></div>
                  <div className="nomina-line"><span>Cobrado</span><span>{fmtMoney(cobrado)}</span></div>
                  <div className="nomina-line total"><span>Pendiente</span><span>{fmtMoney(pendiente)}</span></div>
                  <p className="hint" style={{marginTop:8}}>{inMonth.length} factura{inMonth.length===1?'':'s'} emitida{inMonth.length===1?'':'s'} este mes ({inMonth.filter(i=>i.status==='pagada').length} pagada{inMonth.filter(i=>i.status==='pagada').length===1?'':'s'})</p>
                </div>
              );
            })()}
            <div className="export-row">
              <button className="btn btn-outline btn-sm" onClick={()=>downloadCSV('facturas_sensi.csv',
                ['Familia','N° factura','Mes facturado','Emisión','Vencimiento','Subtotal','Descuento','Total','Estado','N° recibo','Fecha de pago'],
                invoicesList.map(i=>[i.tutor_name_snapshot, i.invoice_number, fmtMonth(i.billing_month), fmtDate(i.issue_date), fmtDate(i.due_date), i.subtotal, i.discount_amount, i.total, i.status, i.receipt_number||'', i.payment_date?fmtDate(i.payment_date):''])
              )}>Exportar CSV</button>
              <button className="btn btn-outline btn-sm" onClick={()=>window.print()}>Imprimir / PDF</button>
            </div>
          </>
        ) : null}
        {ninosView==='facturas' ? (
          invoicesList.length ? invoicesList.map(inv=>{
            const isOverdue = inv.status==='emitida' && inv.due_date < todayStr();
            return (
            <div key={inv.id} className={`list-item st-${inv.status==='pagada'?'aprobado':isOverdue?'rechazado':'pendiente'}`}>
              <div className="li-top">
                <div>
                  <p className="li-title">{inv.tutor_name_snapshot} · {inv.invoice_number}</p>
                  <p className="li-sub" style={{textTransform:'capitalize'}}>{fmtMonth(inv.billing_month)} · {fmtMoney(inv.total)}</p>
                  {inv.status==='pagada' && <p className="li-sub">Recibo {inv.receipt_number} · Pagado {fmtDate(inv.payment_date)}</p>}
                  {inv.status==='emitida' && <p className="li-sub">Vence {fmtDate(inv.due_date)}</p>}
                  {inv.reminder_sent_at && <p className="li-sub">Último recordatorio: {fmtDate(inv.reminder_sent_at.slice(0,10))}</p>}
                </div>
                <span className={`badge badge-${inv.status==='pagada'?'aprobado':isOverdue?'rechazado':'pendiente'}`}>{inv.status==='pagada'?'Pagada':isOverdue?'Vencida':'Emitida'}</span>
              </div>
              {inv.status==='emitida' && (
                <div className="li-actions">
                  <button className="btn btn-outline btn-sm" onClick={()=>sendReminder(inv)}>Recordatorio</button>
                  <button className="btn btn-primary btn-sm" onClick={()=>markPaidAndSendReceipt(inv.id)}>Enviar recibo</button>
                </div>
              )}
            </div>
          );}) : <div className="empty-state">Aún no se ha emitido ninguna factura.</div>
        ) : (
          <>
            <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14, marginTop:14}}>
              {!addingFamily && !editingFamilyId && <button className="btn btn-warm btn-sm" onClick={()=>setAddingFamily(true)}><Icon name="plus" sw={2}/> Agregar familia</button>}
            </div>
            {addingFamily && (
              <form className="form-card" style={{marginBottom:14}} onSubmit={saveFamily}>
                <div className="field"><label>Nombre del tutor/madre</label><input name="tutorName" placeholder="Ej. Maria Alejandra Segura" required /></div>
                <div className="field"><label>Correo(s) — separados por coma si son varios</label><input name="emails" placeholder="correo@ejemplo.com" required /></div>
                <div className="two-col">
                  <div className="field"><label>Descuento (%)</label><input name="discount" type="number" step="0.01" defaultValue="0" /></div>
                  <div className="field"><label>Monto fijo total (opcional)</label><input name="override" type="number" step="0.01" placeholder="Deja vacío si no aplica" /></div>
                </div>
                <p className="hint" style={{marginBottom:12}}>Si pones un "monto fijo total", se factura ese monto exacto en vez de sumar los niños de abajo (útil para paquetes familiares negociados).</p>
                <div className="li-actions">
                  <button type="button" className="btn btn-ghost" onClick={()=>setAddingFamily(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Guardar familia</button>
                </div>
              </form>
            )}
            {families.map(fam=>{
              if(editingFamilyId===fam.id) return (
                <form key={fam.id} className="form-card" style={{marginBottom:10}} onSubmit={saveFamily}>
                  <div className="field"><label>Nombre del tutor/madre</label><input name="tutorName" defaultValue={fam.tutor_name} required /></div>
                  <div className="field"><label>Correo(s)</label><input name="emails" defaultValue={fam.emails} required /></div>
                  <div className="two-col">
                    <div className="field"><label>Descuento (%)</label><input name="discount" type="number" step="0.01" defaultValue={fam.discount_percent||0} /></div>
                    <div className="field"><label>Monto fijo total</label><input name="override" type="number" step="0.01" defaultValue={fam.total_override||''} /></div>
                  </div>
                  <div className="li-actions">
                    <button type="button" className="btn btn-ghost" onClick={()=>setEditingFamilyId(null)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary">Guardar</button>
                  </div>
                </form>
              );
              const subtotal = (fam.items||[]).reduce((s,it)=>s+Number(it.amount||0),0);
              const total = fam.total_override!=null ? Number(fam.total_override) : subtotal*(1-(Number(fam.discount_percent)||0)/100);
              const isOpen = openFamilyId===fam.id;
              return (
                <div key={fam.id} className={`teacher-row${fam.active?'':' inactive'}`}>
                  <div className="teacher-row-top" style={{cursor:'pointer'}} onClick={()=>setOpenFamilyId(isOpen?null:fam.id)}>
                    <div>
                      <p className="teacher-name">{fam.tutor_name}</p>
                      <p className="teacher-meta">{(fam.items||[]).length} niño{(fam.items||[]).length===1?'':'s'} · {fmtMoney(total)}/mes {fam.active?'':'· inactiva'}</p>
                      <p className="teacher-meta">{fam.emails}</p>
                    </div>
                    <div className="row-actions">
                      <button className="mini-btn" onClick={(e)=>{e.stopPropagation(); setEditingFamilyId(fam.id); setAddingFamily(false);}} aria-label="Editar"><Icon name="edit" sw={1.6}/></button>
                      <button className="mini-btn" onClick={(e)=>{e.stopPropagation(); toggleFamilyActive(fam.id);}} aria-label="Activar o desactivar"><Icon name={fam.active?'x':'check'} sw={1.8}/></button>
                    </div>
                  </div>
                  {isOpen && (
                    <div style={{marginTop:12, borderTop:'1px solid var(--border)', paddingTop:12}}>
                      {(fam.items||[]).map(it=>(
                        <div key={it.id} className={`list-item${it.active===false?' inactive':''}`} style={{marginBottom:6, opacity: it.active===false?0.55:1}}>
                          <div className="li-top">
                            <div>
                              <p className="li-title">{it.child_name}{it.active===false?' · inactivo':''}</p>
                              <p className="li-sub">{it.program}{it.schedule?` · ${it.schedule}`:''} · {fmtMoney(it.amount)}</p>
                              <p className="li-sub">{it.teacher_name ? `Maestra: ${it.teacher_name}` : 'Sin maestra asignada'}</p>
                            </div>
                            <div className="row-actions">
                              <button className="mini-btn" onClick={()=>setFamilyItemForm({ id:it.id, familyId:fam.id, childName:it.child_name, program:it.program, schedule:it.schedule, amount:it.amount, teacherId:it.teacher_id })}><Icon name="edit" sw={1.6}/></button>
                              <button className="mini-btn" onClick={()=>toggleFamilyItemActive(it.id)} aria-label="Activar o desactivar">{it.active===false?<Icon name="check" sw={1.8}/>:<Icon name="x" sw={1.8}/>}</button>
                              <button className="mini-btn" onClick={()=>deleteFamilyItem(it.id)}><Icon name="trash" sw={1.6}/></button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {familyItemForm && familyItemForm.familyId===fam.id ? (
                        <form className="form-card" style={{marginTop:8}} onSubmit={(e)=>saveFamilyItem(e,fam.id)}>
                          <div className="field"><label>Nombre del niño/a</label><input name="childName" defaultValue={familyItemForm.childName||''} required /></div>
                          <div className="two-col">
                            <div className="field"><label>Programa</label><input name="program" defaultValue={familyItemForm.program||''} placeholder="Ej. Sensi Steps" required /></div>
                            <div className="field"><label>Monto</label><input name="amount" type="number" step="0.01" defaultValue={familyItemForm.amount||''} required /></div>
                          </div>
                          <div className="field"><label>Día y horario</label><input name="schedule" defaultValue={familyItemForm.schedule||''} placeholder="Ej. Martes y Jueves 3:00-6:00" /></div>
                          <div className="field"><label>Maestra asignada</label>
                            <select name="teacherId" defaultValue={familyItemForm.teacherId||''}>
                              <option value="">Sin asignar</option>
                              {teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          </div>
                          <div className="li-actions">
                            <button type="button" className="btn btn-ghost" onClick={()=>setFamilyItemForm(null)}>Cancelar</button>
                            <button type="submit" className="btn btn-primary">Guardar</button>
                          </div>
                        </form>
                      ) : (
                        <button className="btn btn-outline btn-sm" onClick={()=>setFamilyItemForm({ id:null, familyId:fam.id })}><Icon name="plus" sw={2}/> Agregar niño</button>
                      )}
                      <div className="li-actions" style={{marginTop:14}}>
                        <button className="btn btn-danger-outline btn-sm" onClick={()=>{if(confirm('¿Eliminar esta familia y todos sus niños?')) deleteFamily(fam.id);}}>Eliminar familia</button>
                        <button className="btn btn-primary btn-sm" disabled={sendingInvoiceFor===fam.id} onClick={()=>sendInvoiceNow(fam.id)}>{sendingInvoiceFor===fam.id?'Enviando…':'Enviar factura ahora'}</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {!families.length && <div className="empty-state">Aún no has agregado familias.</div>}
          </>
        )}
      </>
    );
  } else if(view==='ajustes'){
    content = (
      <>
        <p className="section-title">Solicitudes de vacaciones</p>
        <div className="form-card" style={{marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <p style={{fontWeight:600, fontSize:14.5}}>Visible para las maestras</p>
            <p className="hint" style={{marginTop:4}}>{vacationEnabled ? 'Las maestras pueden pedir vacaciones ahora mismo.' : 'Está oculta — las maestras no ven la pestaña de Vacaciones.'}</p>
          </div>
          <button className={`btn btn-sm ${vacationEnabled?'btn-outline':'btn-warm'}`} onClick={toggleVacationEnabled}>{vacationEnabled ? 'Ocultar' : 'Activar'}</button>
        </div>
        <p className="section-title">Cambiar PIN de administración</p>
        <form className="form-card" onSubmit={changeAdminPin}>
          <div className="field"><label>Nuevo PIN (4 dígitos)</label><input name="newPin" inputMode="numeric" maxLength={4} required /></div>
          <div className="field"><label>Confirmar PIN</label><input name="confirmPin" inputMode="numeric" maxLength={4} required /></div>
          <button className="btn btn-primary" type="submit">Actualizar PIN</button>
        </form>
        <p className="section-title">Correo de recuperación del PIN de administración</p>
        <div className="form-card">
          <div className="field"><label>Correo</label><input type="email" value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} placeholder="admin@correo.com" /></div>
          <p className="hint" style={{marginBottom:12}}>Si olvidas el PIN de administración, el nuevo se envía a este correo.</p>
          <button className="btn btn-primary" onClick={saveAdminEmail}>Guardar</button>
        </div>
        <p className="section-title">Red de Sensi (para el log de entrada/salida)</p>
        <div className="form-card">
          <div className="field"><label>IP pública del centro</label><input value={officeIp} onChange={e=>setOfficeIp(e.target.value)} placeholder="Ej. 190.123.45.67" /></div>
          <p className="hint" style={{marginBottom:12}}>Estando conectado al wifi de Sensi, dale "Detectar mi IP" para llenarlo solo.</p>
          <div className="li-actions">
            <button className="btn btn-ghost" onClick={detectMyIp}>Detectar mi IP</button>
            <button className="btn btn-primary" onClick={saveOfficeIp}>Guardar</button>
          </div>
        </div>
        <p className="hint" style={{marginTop:18}}>Los datos se guardan en una base de datos de Supabase propia de este proyecto — no dependen de Claude ni de ninguna cuenta para funcionar.</p>
      </>
    );
  }

  return (
    <div className="app-shell">
      <Header user={user} subtitle="Administración" onLogout={onLogout} />
      <div className="content">{content}</div>
      <nav className="bottom-nav">
        <button className={`nav-btn${view==='solicitudes'?' active':''}`} onClick={()=>{setView('solicitudes'); setShowSummary(false);}} style={{position:'relative'}}>
          {pendingCount>0 && <span className="nav-dot" />}<Icon name="inbox"/><span>Solicitudes</span>
        </button>
        <button className={`nav-btn${view==='maestras'?' active':''}`} onClick={()=>setView('maestras')}><Icon name="users"/><span>Maestras</span></button>
        <button className={`nav-btn${view==='nomina'?' active':''}`} onClick={()=>setView('nomina')}><Icon name="receipt"/><span>Nómina</span></button>
        <button className={`nav-btn${view==='calendario'?' active':''}`} onClick={()=>setView('calendario')}><Icon name="calendar"/><span>Calendario</span></button>
        <button className={`nav-btn${view==='ninos'?' active':''}`} onClick={()=>setView('ninos')}><Icon name="receipt"/><span>Niños</span></button>
        <button className={`nav-btn${view==='ajustes'?' active':''}`} onClick={()=>setView('ajustes')}><Icon name="settings"/><span>Ajustes</span></button>
      </nav>
      <Toast />
    </div>
  );
}
