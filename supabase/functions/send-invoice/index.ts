// Edge Function: send-invoice
// Genera y envía facturas de Sensi SRL.
// - Llamada sin "family_id" (o con mode:"all"): factura a TODAS las familias activas (la usa el Cron mensual).
// - Llamada con "family_id": factura solo esa familia (botón "Enviar factura ahora").
// Necesita los secrets: GMAIL_USER, GMAIL_APP_PASSWORD, PORTAL_SHARED_SECRET
// (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya los provee Supabase automáticamente).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-portal-secret",
};

const MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const BRAND_STRIP = `
  <table width="100%" style="margin-top:24px;"><tr>
    <td style="background:#D2564F; height:6px; width:20%;"></td>
    <td style="background:#E58A32; height:6px; width:20%;"></td>
    <td style="background:#EAB13B; height:6px; width:20%;"></td>
    <td style="background:#A6C548; height:6px; width:20%;"></td>
    <td style="background:#4A93C9; height:6px; width:20%;"></td>
  </tr></table>`;

function fmtMoney(n) {
  const num = Number(n) || 0;
  return num.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDateDMY(d) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}
function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function nextMonthLabel(issueDateStr) {
  const [y, m] = issueDateStr.split("-").map(Number);
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return { key: `${ny}-${String(nm).padStart(2, "0")}`, label: `${MONTHS_ES[nm - 1]} ${ny}` };
}
function guessGenderLabel(tutorName) {
  const first = (tutorName || "").trim().split(/\s+/)[0]?.toLowerCase() || "";
  const maleExceptions = ["luca", "joshua", "elias", "matias", "tobias"];
  if (maleExceptions.includes(first)) return "PADRE/TUTOR";
  if (first.endsWith("a") || first.endsWith("ia")) return "MADRE/TUTORA";
  return "PADRE/TUTOR";
}

function buildInvoiceHtml({ invoiceNumber, issueDate, dueDate, tutorName, items, billingLabel, subtotal, discountAmount, total }) {
  const rows = items.map(it => `
    <tr>
      <td style="padding:10px 8px; border-bottom:1px solid #eee; font-size:14px;">
        ${it.child_name} - ${billingLabel}<br>
        <span style="font-size:11px; color:#888888;">${it.schedule || ""}</span>
      </td>
      <td style="padding:10px 8px; border-bottom:1px solid #eee; font-size:14px; text-align:center;">1 mes</td>
      <td style="padding:10px 8px; border-bottom:1px solid #eee; font-size:14px; text-align:center;">${it.program}</td>
      <td style="padding:10px 8px; border-bottom:1px solid #eee; font-size:14px; text-align:right;">${fmtMoney(it.amount)}</td>
    </tr>`).join("");

  const totalsBlock = discountAmount > 0 ? `
    <table width="100%" style="margin-top:10px;">
      <tr><td style="text-align:right; font-size:12px; color:#2B2B2B; border-top:1px solid #bbb; padding-top:6px;" colspan="3">Subtotal (RD$):</td>
          <td style="text-align:right; font-size:12px; color:#2B2B2B; border-top:1px solid #bbb; padding-top:6px;">RD$ ${fmtMoney(subtotal)}</td></tr>
      <tr><td style="text-align:right; font-size:12px; color:#B23A48; padding-top:4px;" colspan="3">Descuento:</td>
          <td style="text-align:right; font-size:12px; color:#B23A48; padding-top:4px;">-RD$ ${fmtMoney(discountAmount)}</td></tr>
      <tr><td style="font-size:20px; font-weight:bold; color:#2B2B2B; padding-top:8px;" colspan="3">TOTAL A PAGAR (RD$)</td>
          <td style="font-size:20px; font-weight:bold; color:#E58A32; text-align:right; padding-top:8px;">RD$ ${fmtMoney(total)}</td></tr>
    </table>` : `
    <table width="100%" style="margin-top:10px;">
      <tr><td style="font-size:20px; font-weight:bold; color:#2B2B2B; border-top:1px solid #bbb; padding-top:10px;" colspan="3">TOTAL A PAGAR (RD$)</td>
          <td style="font-size:20px; font-weight:bold; color:#E58A32; text-align:right; border-top:1px solid #bbb; padding-top:10px;">RD$ ${fmtMoney(total)}</td></tr>
    </table>`;

  return `
  <div style="border:1px solid #999; padding:20px; font-family:Georgia,serif; max-width:600px;">
    <table width="100%" style="border-collapse:collapse;">
      <tr>
        <td style="vertical-align:top;">
          <div style="font-weight:bold; color:#2B2B2B; font-size:16px;">Sensi SRL</div>
          <div style="color:#6E6E6E; font-size:12px;">RNC: 1-3359263-2</div>
          <div style="color:#6E6E6E; font-size:12px;">Santo Domingo, República Dominicana</div>
          <div style="color:#6E6E6E; font-size:12px;">Tel: 829-686-7561</div>
        </td>
        <td style="vertical-align:top; text-align:right;">
          <div style="font-size:28px; color:#2B2B2B;">FACTURA</div>
          <div style="font-size:13px; color:#6E6E6E;">N&deg; de factura: <b style="color:#2B2B2B;">${invoiceNumber}</b></div>
          <div style="font-size:13px; color:#6E6E6E;">Fecha: <b style="color:#2B2B2B;">${fmtDateDMY(issueDate)}</b></div>
          <div style="font-size:13px; color:#6E6E6E;">Vencimiento: <b style="color:#2B2B2B;">${fmtDateDMY(dueDate)}</b></div>
        </td>
      </tr>
    </table>
    <hr style="border:none; border-top:1px solid #ddd; margin:16px 0;">
    <div style="font-size:12px; color:#6E6E6E; font-weight:bold;">${guessGenderLabel(tutorName)}</div>
    <div style="font-size:14px; color:#2B2B2B;">${tutorName}</div>
    <table width="100%" style="border-collapse:collapse; margin-top:16px;">
      <tr style="background:#DCE3EA;">
        <td style="padding:8px; font-size:12px; font-weight:bold; color:#2B2B2B;">DESCRIPCIÓN</td>
        <td style="padding:8px; font-size:12px; font-weight:bold; color:#2B2B2B; text-align:center;">CANTIDAD</td>
        <td style="padding:8px; font-size:12px; font-weight:bold; color:#2B2B2B; text-align:center;">PROGRAMA</td>
        <td style="padding:8px; font-size:12px; font-weight:bold; color:#2B2B2B; text-align:right;">IMPORTE (RD$)</td>
      </tr>
      ${rows}
    </table>
    ${totalsBlock}
    <div style="margin-top:16px; font-size:13px; color:#2B2B2B;">
      <b>Métodos de pago:</b> Transferencia bancaria — Banco BHD, cuenta de ahorros 12804400012, cédula 402-2267095-8
    </div>
    ${BRAND_STRIP}
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const providedSecret = req.headers.get("x-portal-secret");
    const expectedSecret = Deno.env.get("PORTAL_SHARED_SECRET");
    if (!expectedSecret || providedSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let body = {};
    try { body = await req.json(); } catch (_) { /* body vacío, modo "todas" */ }
    const familyId = body?.family_id || null;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    let query = supabase.from("families").select("*, family_items(*)").eq("active", true);
    if (familyId) query = query.eq("id", familyId);
    const { data: families, error: famErr } = await query;
    if (famErr) throw famErr;
    if (!families || !families.length) {
      return new Response(JSON.stringify({ sent: 0, failed: 0, details: [], message: "No hay familias activas para facturar." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailPass = Deno.env.get("GMAIL_APP_PASSWORD");
    const smtp = new SMTPClient({ connection: { hostname: "smtp.gmail.com", port: 465, tls: true, auth: { username: gmailUser, password: gmailPass } } });

    const today = new Date().toISOString().slice(0, 10);
    const issueYearMonth = today.slice(0, 7);
    const { key: billingKey, label: billingLabel } = nextMonthLabel(today);
    const dueDate = addDays(today, 5);

    const results = [];
    let sent = 0, failed = 0;

    for (const fam of families) {
      try {
        const items = (fam.family_items || []).filter(it => Number(it.amount) > 0);
        if (!items.length) { results.push({ tutor: fam.tutor_name, ok: false, error: "sin items" }); failed++; continue; }

        // Siguiente número de factura para el mes de emisión actual
        const { data: maxRow } = await supabase
          .from("invoices")
          .select("invoice_number")
          .like("invoice_number", `${issueYearMonth}-%`)
          .order("invoice_number", { ascending: false })
          .limit(1)
          .maybeSingle();
        let nextSeq = 1;
        if (maxRow?.invoice_number) {
          const parts = maxRow.invoice_number.split("-");
          nextSeq = (parseInt(parts[2], 10) || 0) + 1;
        }
        const invoiceNumber = `${issueYearMonth}-${String(nextSeq).padStart(3, "0")}`;

        const subtotal = items.reduce((s, it) => s + Number(it.amount), 0);
        let discountAmount = 0, total = subtotal;
        if (fam.total_override != null) {
          total = Number(fam.total_override);
          discountAmount = subtotal - total;
        } else if (Number(fam.discount_percent) > 0) {
          discountAmount = subtotal * (Number(fam.discount_percent) / 100);
          total = subtotal - discountAmount;
        }

        const html = buildInvoiceHtml({
          invoiceNumber, issueDate: today, dueDate, tutorName: fam.tutor_name,
          items, billingLabel, subtotal, discountAmount, total
        });

        const toEmails = fam.emails.split(",").map(e => e.trim()).filter(Boolean);
        await smtp.send({
          from: `Sensi SRL <${gmailUser}>`,
          to: toEmails,
          subject: `Factura Sensi SRL - ${billingLabel}`,
          html,
        });

        await supabase.from("invoices").insert({
          family_id: fam.id, invoice_number: invoiceNumber, billing_month: billingKey,
          issue_date: today, due_date: dueDate, subtotal, discount_amount: discountAmount, total,
          status: "emitida", items_snapshot: items.map(it => ({ child_name: it.child_name, program: it.program, schedule: it.schedule, amount: it.amount })),
          tutor_name_snapshot: fam.tutor_name, emails_snapshot: fam.emails,
        });

        results.push({ tutor: fam.tutor_name, ok: true, invoice_number: invoiceNumber, total });
        sent++;
      } catch (e) {
        results.push({ tutor: fam.tutor_name, ok: false, error: String(e) });
        failed++;
      }
    }
    await smtp.close();

    return new Response(JSON.stringify({ sent, failed, details: results }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
