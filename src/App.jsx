import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabaseClient.js';

const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DEFAULT_VACATION_DAYS = 14;

function fmtDate(iso){ if(!iso) return ''; const d=new Date(iso+'T00:00:00'); return d.toLocaleDateString('es-DO',{day:'2-digit',month:'2-digit',year:'numeric'}); }
function fmtMonth(ym){ if(!ym) return ''; const [y,m]=ym.split('-').map(Number); return `${MONTHS_ES[m-1]} ${y}`; }
function fmtMoney(n){ const num=Number(n)||0; return 'RD$ ' + num.toLocaleString('es-DO',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function todayStr(){ return new Date().toISOString().slice(0,10); }

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
  trash:'<path d="M4.5 7h15M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2M7 7l1 12.5A1.5 1.5 0 0 0 9.5 21h5a1.5 1.5 0 0 0 1.5-1.5L17 7"/>'
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

  return (
    <div className="app-shell login-screen">
      <BrandStrip />
      <div className="login-hero">
        <h1>Portal de Personal</h1>
        <p>Centro de Estimulación Temprana Sensi</p>
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
          </form>
        )}
      </div>
      <Toast />
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

  const reload = useCallback(async ()=>{
    const [b, r, p] = await Promise.all([
      supabase.rpc('get_teacher_balance', { p_teacher_id: user.id }),
      supabase.rpc('get_teacher_requests', { p_teacher_id: user.id }),
      supabase.rpc('get_teacher_payroll', { p_teacher_id: user.id }),
    ]);
    if(b.data && b.data[0]) setBalance(b.data[0]);
    if(r.data) setRequests(r.data);
    if(p.data) setPayroll(p.data);
  },[user.id]);

  useEffect(()=>{ reload(); },[reload]);

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
        <div className="hero-card">
          <p className="hero-label">Días de vacaciones</p>
          <div className="hero-figure"><span className="hero-number">{disponibles}</span><span className="hero-unit">disponibles de {balance.vacation_days_total||0}</span></div>
          <div className="hero-bar"><div className="hero-bar-fill" style={{width:`${pct}%`}} /></div>
          <p className="hero-note">{balance.vacation_days_used||0} días tomados este período</p>
        </div>
        <div className="quick-actions">
          <button className="btn btn-primary" onClick={()=>setView('vacaciones')}>Pedir vacaciones</button>
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
                <div className="nomina-line"><span>Deducciones</span><span>-{fmtMoney(p.deducciones)}</span></div>
                <div className="nomina-line total"><span>Neto pagado</span><span>{fmtMoney(p.neto)}</span></div>
                {p.nota && <p className="li-reason" style={{marginTop:10}}>{p.nota}</p>}
              </div>
            )}
          </div>
        ))}
      </>
    );
  }

  return (
    <div className="app-shell">
      <Header user={user} subtitle="Maestra" onLogout={onLogout} />
      <div className="content">{content}</div>
      <nav className="bottom-nav">
        <button className={`nav-btn${view==='inicio'?' active':''}`} onClick={()=>setView('inicio')}><Icon name="home"/><span>Inicio</span></button>
        <button className={`nav-btn${view==='vacaciones'?' active':''}`} onClick={()=>setView('vacaciones')}><Icon name="sun"/><span>Vacaciones</span></button>
        <button className={`nav-btn${view==='permisos'?' active':''}`} onClick={()=>setView('permisos')}><Icon name="calendar"/><span>Permisos</span></button>
        <button className={`nav-btn${view==='nomina'?' active':''}`} onClick={()=>setView('nomina')}><Icon name="receipt"/><span>Nómina</span></button>
      </nav>
      <Toast />
    </div>
  );
}

// ---------------- ADMIN APP ----------------
function AdminApp({ user, onLogout, toast, Toast }){
  const [view, setView] = useState('solicitudes');
  const [requests, setRequests] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [reqFilter, setReqFilter] = useState('pendientes');
  const [addingTeacher, setAddingTeacher] = useState(false);
  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [payrollForm, setPayrollForm] = useState(null);

  const reload = useCallback(async ()=>{
    const [r, t, p] = await Promise.all([
      supabase.rpc('admin_list_requests'),
      supabase.rpc('admin_list_teachers'),
      supabase.rpc('admin_list_payroll'),
    ]);
    if(r.data) setRequests(r.data);
    if(t.data) setTeachers(t.data);
    if(p.data) setPayroll(p.data);
  },[]);

  useEffect(()=>{ reload(); },[reload]);

  async function reviewRequest(id, decision){
    const { error } = await supabase.rpc('admin_review_request', { p_request_id:id, p_decision:decision });
    if(error){ toast('No se pudo guardar. Intenta de nuevo.'); return; }
    toast(decision==='aprobado' ? 'Solicitud aprobada.' : 'Solicitud rechazada.');
    reload();
  }

  async function saveNewTeacher(e){
    e.preventDefault();
    const f = e.target;
    const name = f.name.value.trim(), pin = f.pin.value.trim(), vac = Number(f.vacDays.value)||DEFAULT_VACATION_DAYS;
    if(!name){ toast('Escribe el nombre.'); return; }
    if(!/^\d{4}$/.test(pin)){ toast('El PIN debe ser de 4 dígitos.'); return; }
    const { error } = await supabase.rpc('admin_add_teacher', { p_name:name, p_pin:pin, p_vacation_days_total:vac });
    if(error){ toast('No se pudo guardar. Intenta de nuevo.'); return; }
    toast('Maestra agregada.');
    setAddingTeacher(false);
    reload();
  }

  async function saveEditedTeacher(e, id){
    e.preventDefault();
    const f = e.target;
    const name=f.name.value.trim(), pin=f.pin.value.trim(), vac=Number(f.vacDays.value), used=Number(f.vacUsed.value);
    if(!name){ toast('Escribe el nombre.'); return; }
    if(!/^\d{4}$/.test(pin)){ toast('El PIN debe ser de 4 dígitos.'); return; }
    const { error } = await supabase.rpc('admin_edit_teacher', { p_teacher_id:id, p_name:name, p_pin:pin, p_vacation_days_total:vac||0, p_vacation_days_used:used||0 });
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
    const bruto = Number(f.bruto.value)||0, deducciones = Number(f.deducciones.value)||0;
    const neto = Number(f.neto.value)|| (bruto-deducciones);
    const fechaPago = f.fechaPago.value, nota = f.nota.value.trim();
    if(!teacherId||!month){ toast('Selecciona maestra y mes.'); return; }
    const { error } = await supabase.rpc('admin_save_payroll', {
      p_payroll_id: payrollForm.id || null, p_teacher_id:teacherId, p_month:month,
      p_bruto:bruto, p_deducciones:deducciones, p_neto:neto, p_fecha_pago:fechaPago||null, p_nota:nota
    });
    if(error){ toast(error.message.includes('duplicate') ? 'Ya existe una nómina para esa maestra en ese mes.' : 'No se pudo guardar. Intenta de nuevo.'); return; }
    toast('Nómina guardada.');
    setPayrollForm(null);
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
    content = (
      <>
        <div className="chip-row">
          {['pendientes','todas','vacaciones','permisos'].map(f=>(
            <button key={f} className={`chip${reqFilter===f?' active':''}`} onClick={()=>setReqFilter(f)}>{f[0].toUpperCase()+f.slice(1)}</button>
          ))}
        </div>
        {list.length ? list.map(r=><RequestItem key={r.id} r={r} showActions onReview={reviewRequest} teacherName={r.teacher_name} />) : <div className="empty-state">No hay solicitudes en esta vista.</div>}
      </>
    );
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
              <div className="li-actions">
                <button type="button" className="btn btn-ghost" onClick={()=>setEditingTeacherId(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar</button>
              </div>
            </form>
          );
          const disponibles = Math.max((t.vacation_days_total||0)-(t.vacation_days_used||0),0);
          return (
            <div key={t.id} className={`teacher-row${t.active?'':' inactive'}`}>
              <div className="teacher-row-top">
                <div>
                  <p className="teacher-name">{t.name}</p>
                  <p className="teacher-meta">{disponibles} de {t.vacation_days_total||0} días disponibles {t.active?'':'· inactiva'}</p>
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
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <p className="section-title" style={{margin:0}}>Registros de nómina</p>
          {!f && <button className="btn btn-warm btn-sm" onClick={()=>setPayrollForm({ id:null, teacherId:teachers[0]?.id||'', month:new Date().toISOString().slice(0,7), bruto:'', deducciones:'', neto:'', fechaPago:todayStr(), nota:'' })}><Icon name="plus" sw={2}/> Nueva</button>}
        </div>
        {f && (
          <form className="form-card" style={{marginBottom:16}} onSubmit={savePayrollForm} onChange={(e)=>{
            if(e.target.name==='bruto' || e.target.name==='deducciones'){
              const form = e.target.form;
              const bruto = Number(form.bruto.value)||0, ded = Number(form.deducciones.value)||0;
              form.neto.value = (bruto-ded).toFixed(2);
            }
          }}>
            <div className="field"><label>Maestra</label>
              <select name="teacherId" defaultValue={f.teacherId}>
                {teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Mes</label><input name="month" type="month" defaultValue={f.month} required /></div>
            <div className="two-col">
              <div className="field"><label>Salario bruto</label><input name="bruto" type="number" step="0.01" defaultValue={f.bruto} required /></div>
              <div className="field"><label>Deducciones</label><input name="deducciones" type="number" step="0.01" defaultValue={f.deducciones} /></div>
            </div>
            <div className="field"><label>Salario neto</label><input name="neto" type="number" step="0.01" defaultValue={f.neto} /></div>
            <div className="field"><label>Fecha de pago</label><input name="fechaPago" type="date" defaultValue={f.fechaPago} /></div>
            <div className="field"><label>Nota (opcional)</label><textarea name="nota" defaultValue={f.nota} /></div>
            <div className="li-actions">
              <button type="button" className="btn btn-ghost" onClick={()=>setPayrollForm(null)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Guardar</button>
            </div>
          </form>
        )}
        {payroll.length ? payroll.map(p=>(
          <div key={p.id} className="list-item">
            <div className="li-top">
              <div>
                <p className="li-title">{p.teacher_name}</p>
                <p className="li-sub" style={{textTransform:'capitalize'}}>{fmtMonth(p.month)} · Neto {fmtMoney(p.neto)}</p>
              </div>
              <div className="row-actions">
                <button className="mini-btn" onClick={()=>setPayrollForm({ id:p.id, teacherId:p.teacher_id, month:p.month, bruto:p.bruto, deducciones:p.deducciones, neto:p.neto, fechaPago:p.fecha_pago, nota:p.nota||'' })}><Icon name="edit" sw={1.6}/></button>
                <button className="mini-btn" onClick={()=>deletePayroll(p.id)}><Icon name="trash" sw={1.6}/></button>
              </div>
            </div>
          </div>
        )) : <div className="empty-state">No hay nóminas registradas todavía.</div>}
      </>
    );
  } else if(view==='ajustes'){
    content = (
      <>
        <p className="section-title">Cambiar PIN de administración</p>
        <form className="form-card" onSubmit={changeAdminPin}>
          <div className="field"><label>Nuevo PIN (4 dígitos)</label><input name="newPin" inputMode="numeric" maxLength={4} required /></div>
          <div className="field"><label>Confirmar PIN</label><input name="confirmPin" inputMode="numeric" maxLength={4} required /></div>
          <button className="btn btn-primary" type="submit">Actualizar PIN</button>
        </form>
        <p className="hint" style={{marginTop:18}}>Los datos se guardan en una base de datos de Supabase propia de este proyecto — no dependen de Claude ni de ninguna cuenta para funcionar.</p>
      </>
    );
  }

  return (
    <div className="app-shell">
      <Header user={user} subtitle="Administración" onLogout={onLogout} />
      <div className="content">{content}</div>
      <nav className="bottom-nav">
        <button className={`nav-btn${view==='solicitudes'?' active':''}`} onClick={()=>setView('solicitudes')} style={{position:'relative'}}>
          {pendingCount>0 && <span className="nav-dot" />}<Icon name="inbox"/><span>Solicitudes</span>
        </button>
        <button className={`nav-btn${view==='maestras'?' active':''}`} onClick={()=>setView('maestras')}><Icon name="users"/><span>Maestras</span></button>
        <button className={`nav-btn${view==='nomina'?' active':''}`} onClick={()=>setView('nomina')}><Icon name="receipt"/><span>Nómina</span></button>
        <button className={`nav-btn${view==='ajustes'?' active':''}`} onClick={()=>setView('ajustes')}><Icon name="settings"/><span>Ajustes</span></button>
      </nav>
      <Toast />
    </div>
  );
}
