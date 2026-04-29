import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.1"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")

// Initialize Supabase Service Client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function sendEmail(to: string[], subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.error("Missing RESEND_API_KEY")
    return false
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Hotel Logbook <notifications@resend.dev>",
      to,
      subject,
      html,
    }),
  })

  const data = await res.json()
  console.log("Resend API Response:", data)
  return res.ok
}

serve(async (req) => {
  try {
    const payload = await req.json()
    console.log("Received Webhook Payload:", payload)

    // 1. Escalated Issue
    if (payload.table === 'log_entries' && payload.type === 'UPDATE') {
      const newRecord = payload.record
      const oldRecord = payload.old_record

      if (newRecord.status === 'escalated' && oldRecord.status !== 'escalated') {
        console.log("Processing Escalation Alert...")
        
        // Fetch GM profiles
        const { data: gms } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'gm')

        if (!gms || gms.length === 0) return new Response("No GMs found", { status: 200 })

        // Retrieve actual emails from auth.users
        const gmEmails: string[] = []
        for (const gm of gms) {
          const { data: user } = await supabase.auth.admin.getUserById(gm.id)
          if (user?.user?.email) {
            gmEmails.push(user.user.email)
          }
        }

        if (gmEmails.length > 0) {
          await sendEmail(
            gmEmails,
            `[Escalated] Issue: ${newRecord.title}`,
            `<h2>Issue Escalated</h2>
             <p>A new issue has been escalated to the General Manager.</p>
             <p><b>Title:</b> ${newRecord.title}</p>
             <p><b>Department:</b> ${newRecord.department}</p>
             <p><b>Description:</b> ${newRecord.body}</p>
             <br />
             <p>Please log in to the dashboard to review and resolve.</p>`
          )
        }
      }
    }

    // 2. HR Update Posted
    if (payload.table === 'hr_updates' && payload.type === 'INSERT') {
      const newRecord = payload.record
      console.log("Processing HR Update Alert...")

      // Fetch Supervisor profiles
      const { data: supervisors } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'supervisor')

      if (!supervisors || supervisors.length === 0) return new Response("No supervisors found", { status: 200 })

      const supEmails: string[] = []
      
      for (const sup of supervisors) {
        const { data: user } = await supabase.auth.admin.getUserById(sup.id)
        if (user?.user?.email) {
          supEmails.push(user.user.email)
        }
      }

      if (supEmails.length > 0) {
        await sendEmail(
          supEmails,
          `[HR Update] ${newRecord.title}`,
          `<h2>New HR Update</h2>
           <p><b>Title:</b> ${newRecord.title}</p>
           <p><b>Message:</b><br/>${newRecord.body.replace(/\n/g, '<br/>')}</p>
           <br />
           <p>Please log in to the dashboard to view the full feed.</p>`
        )
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    })

  } catch (error) {
    console.error("Function error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
