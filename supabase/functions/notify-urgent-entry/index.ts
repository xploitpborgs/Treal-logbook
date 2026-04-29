import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RESEND_API_KEY          = Deno.env.get("RESEND_API_KEY")!
const SUPABASE_URL            = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const APP_URL                 = Deno.env.get("APP_URL") ?? "https://treal.vercel.app"

const DEPT_MAP: Record<string, string> = {
  front_desk:   "Front Desk",
  housekeeping: "Housekeeping",
  maintenance:  "Maintenance",
  management:   "Management",
  security:     "Security",
  restaurant:   "Restaurant",
}

const SHIFT_MAP: Record<string, string> = {
  morning:   "Morning",
  afternoon: "Afternoon",
  night:     "Night",
}

const CATEGORY_MAP: Record<string, string> = {
  incident:        "Incident",
  maintenance:     "Maintenance",
  guest_complaint: "Guest Complaint",
  handover:        "Handover",
  general:         "General",
}

function label(map: Record<string, string>, key: string) {
  return map[key] ?? key
}

function buildHtml(entry: Record<string, string>, authorName: string, authorDept: string) {
  const entryUrl = `${APP_URL}/entries/${entry.id}`
  const createdAt = new Date(entry.created_at).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Africa/Lagos",
  })

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#0a0a0a;padding:28px 32px;text-align:center;border-radius:8px 8px 0 0;">
            <p style="color:#a31e22;font-size:22px;font-weight:700;letter-spacing:6px;margin:0;">TREAL</p>
            <p style="color:#71717a;font-size:11px;letter-spacing:2px;margin:6px 0 0;">Hotels &amp; Suites — Staff Operations Portal</p>
          </td>
        </tr>

        <!-- Urgent banner -->
        <tr>
          <td style="background:#fff1f2;border-left:4px solid #a31e22;padding:14px 32px;">
            <p style="color:#a31e22;font-weight:600;font-size:13px;margin:0;">&#x1F6A8; URGENT ENTRY LOGGED</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:28px 32px;border:1px solid #e4e4e7;border-top:none;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:9px 0;color:#71717a;font-size:13px;width:110px;vertical-align:top;">Title</td>
                <td style="padding:9px 0;color:#09090b;font-size:13px;font-weight:600;">${entry.title}</td>
              </tr>
              <tr>
                <td style="padding:9px 0;color:#71717a;font-size:13px;vertical-align:top;">Department</td>
                <td style="padding:9px 0;color:#09090b;font-size:13px;">${label(DEPT_MAP, entry.department)}</td>
              </tr>
              <tr>
                <td style="padding:9px 0;color:#71717a;font-size:13px;vertical-align:top;">Shift</td>
                <td style="padding:9px 0;color:#09090b;font-size:13px;">${label(SHIFT_MAP, entry.shift)}</td>
              </tr>
              <tr>
                <td style="padding:9px 0;color:#71717a;font-size:13px;vertical-align:top;">Category</td>
                <td style="padding:9px 0;color:#09090b;font-size:13px;">${label(CATEGORY_MAP, entry.category)}</td>
              </tr>
              <tr>
                <td style="padding:9px 0;color:#71717a;font-size:13px;vertical-align:top;">Logged by</td>
                <td style="padding:9px 0;color:#09090b;font-size:13px;">${authorName} &mdash; ${label(DEPT_MAP, authorDept)}</td>
              </tr>
              <tr>
                <td style="padding:9px 0;color:#71717a;font-size:13px;vertical-align:top;">Time</td>
                <td style="padding:9px 0;color:#09090b;font-size:13px;">${createdAt}</td>
              </tr>
              <tr>
                <td style="padding:9px 0;color:#71717a;font-size:13px;vertical-align:top;">Details</td>
                <td style="padding:9px 0;color:#09090b;font-size:13px;line-height:1.6;white-space:pre-wrap;">${entry.body}</td>
              </tr>
            </table>

            <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e4e4e7;">
              <a href="${entryUrl}"
                 style="display:inline-block;background:#a31e22;color:#ffffff;padding:10px 22px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:500;">
                View Full Entry &rarr;
              </a>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#fafafa;padding:16px 32px;border:1px solid #e4e4e7;border-top:none;border-radius:0 0 8px 8px;text-align:center;">
            <p style="color:#a1a1aa;font-size:12px;margin:0;line-height:1.6;">
              Automated alert from Treal Hotels &amp; Suites Staff Operations Portal.<br>
              You are receiving this because you are a Supervisor or General Manager.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

serve(async (req) => {
  try {
    const payload = await req.json()
    const entry = payload.record as Record<string, string>

    if (entry.priority !== "urgent") {
      return new Response(JSON.stringify({ message: "Not urgent, skipping" }), { status: 200 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Fetch supervisors and GMs
    const { data: recipients, error: recipientsError } = await supabase
      .from("profiles")
      .select("id, full_name, department")
      .in("role", ["supervisor", "gm"])
      .eq("is_active", true)

    if (recipientsError) {
      console.error("Failed to fetch recipients:", recipientsError)
      return new Response(JSON.stringify({ error: recipientsError.message }), { status: 500 })
    }

    if (!recipients || recipients.length === 0) {
      return new Response(JSON.stringify({ message: "No active supervisors or GMs found" }), { status: 200 })
    }

    // Fetch emails from auth.users
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
    if (usersError) {
      console.error("Failed to fetch users:", usersError)
      return new Response(JSON.stringify({ error: usersError.message }), { status: 500 })
    }

    const recipientsWithEmail = recipients
      .map((r: Record<string, string>) => {
        const user = users.find((u) => u.id === r.id)
        return { ...r, email: user?.email }
      })
      .filter((r): r is typeof r & { email: string } => Boolean(r.email))

    if (recipientsWithEmail.length === 0) {
      return new Response(JSON.stringify({ message: "No recipient emails resolved" }), { status: 200 })
    }

    // Fetch author profile
    const { data: author } = await supabase
      .from("profiles")
      .select("full_name, department")
      .eq("id", entry.author_id)
      .single()

    const authorName = author?.full_name ?? "Unknown Staff"
    const authorDept = author?.department ?? ""
    const html = buildHtml(entry, authorName, authorDept)

    // Send emails in parallel via Resend
    const results = await Promise.allSettled(
      recipientsWithEmail.map((recipient) =>
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Treal Logbook <onboarding@resend.dev>",
            to: recipient.email,
            subject: `\u{1F6A8} Urgent Entry: ${entry.title}`,
            html,
          }),
        }).then(async (res) => {
          const body = await res.json()
          if (!res.ok) throw new Error(JSON.stringify(body))
          return body
        })
      )
    )

    const failed = results.filter((r) => r.status === "rejected")
    if (failed.length > 0) {
      console.error("Some emails failed:", failed.map((f) => (f as PromiseRejectedResult).reason))
    }

    const sent = results.length - failed.length
    console.log(`Sent ${sent}/${results.length} emails for entry ${entry.id}`)

    return new Response(
      JSON.stringify({ message: `Emails sent: ${sent}/${results.length}` }),
      { status: 200 }
    )
  } catch (err) {
    console.error("Edge function error:", err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
