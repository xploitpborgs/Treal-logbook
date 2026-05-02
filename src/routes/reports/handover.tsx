import { useState, useEffect, useMemo } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { useRole } from '@/hooks/useRole'
import { AppLayout } from '@/components/layout/AppLayout'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { 
  ClipboardCheck, FileText, UserCheck, 
  Clock, ArrowRight, Printer 
} from 'lucide-react'
import { formatDepartment } from '@/lib/formatters'
import type { LogEntry, Shift } from '@/types'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

export const Route = createFileRoute('/reports/handover')({
  component: HandoverReportPage,
})

function HandoverReportPage() {
  const { profile, isSupervisor, isAdmin } = useRole()
  const navigate = useNavigate()
  
  const [, setLoading] = useState(true)
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [remarks, setRemarks] = useState('')
  const [shift, setShift] = useState<Shift>('morning')
  const [isSigning, setIsSigning] = useState(false)
  const [isSigned, setIsSigned] = useState(false)

  // Route Guard: Only supervisor and admin
  useEffect(() => {
    if (profile && !isSupervisor() && !isAdmin()) {
      navigate({ to: '/dashboard' as any })
    }
  }, [profile, isSupervisor, isAdmin, navigate])

  // Auto-detect shift based on time if not set
  useEffect(() => {
    const hour = new Date().getHours()
    if (hour >= 6 && hour < 14) setShift('morning')
    else if (hour >= 14 && hour < 22) setShift('afternoon')
    else setShift('night')
  }, [])

  useEffect(() => {
    if (profile) fetchShiftData()
  }, [profile, shift])

  async function fetchShiftData() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    
    // Fetch logs for this shift today
    const { data, error } = await supabase
      .from('log_entries')
      .select('*, author:profiles!author_id(full_name, department)')
      .eq('department', profile?.department)
      .eq('shift', shift)
      .gte('created_at', `${today}T00:00:00Z`)
      .order('created_at', { ascending: true })

    if (error) {
      toast.error('Failed to load shift data')
    } else {
      setEntries(data as LogEntry[])
    }
    setLoading(false)
  }

  const categorizedEntries = useMemo(() => {
    return {
      incidents: entries.filter(e => e.category === 'incident'),
      maintenance: entries.filter(e => e.category === 'maintenance'),
      guest: entries.filter(e => e.category === 'guest_complaint'),
      handovers: entries.filter(e => e.category === 'handover'),
      general: entries.filter(e => !['incident', 'maintenance', 'guest_complaint', 'handover'].includes(e.category))
    }
  }, [entries])

  async function handleSignOff() {
    if (!profile) return
    setIsSigning(true)
    
    const { error } = await supabase
      .from('handover_reports')
      .insert({
        date: new Date().toISOString().split('T')[0],
        shift,
        department: profile.department,
        supervisor_id: profile.id,
        remarks: remarks.trim(),
        is_signed_off: true,
        signed_at: new Date().toISOString(),
        entry_ids: entries.map(e => e.id)
      })

    setIsSigning(false)
    if (error) {
      toast.error(`Sign-off failed: ${error.message}`)
    } else {
      setIsSigned(true)
      toast.success('Shift Handover Report signed off successfully!')
    }
  }

  const generatePDF = () => {
    const doc = new jsPDF()
    const today = new Date().toLocaleDateString()
    
    // Header
    doc.setFontSize(22)
    doc.setTextColor(196, 30, 58) // Treal Red
    doc.text('Treal Hotels & Suites', 105, 20, { align: 'center' })
    
    doc.setFontSize(16)
    doc.setTextColor(0, 0, 0)
    doc.text('Digital Shift Handover Report', 105, 30, { align: 'center' })
    
    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, 38, { align: 'center' })
    
    // Meta Info
    doc.setDrawColor(200, 200, 200)
    doc.line(20, 45, 190, 45)
    
    doc.setFontSize(11)
    doc.setTextColor(0, 0, 0)
    doc.text(`Department: ${formatDepartment(profile?.department ?? '')}`, 20, 55)
    doc.text(`Shift: ${shift.toUpperCase()}`, 105, 55)
    doc.text(`Date: ${today}`, 20, 62)
    doc.text(`Supervisor: ${profile?.full_name}`, 105, 62)
    
    // Table
    const tableData = entries.map(e => [
      new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      e.category.toUpperCase(),
      e.title,
      e.status.toUpperCase(),
      e.author?.full_name ?? 'Unknown'
    ])
    
    ;(doc as any).autoTable({
      startY: 75,
      head: [['Time', 'Category', 'Subject', 'Status', 'Logged By']],
      body: tableData,
      headStyles: { fillColor: [196, 30, 58] },
      margin: { top: 75 }
    })
    
    const finalY = (doc as any).lastAutoTable.finalY + 15
    
    // Remarks
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Supervisor Remarks:', 20, finalY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const splitRemarks = doc.splitTextToSize(remarks || 'No additional remarks provided.', 170)
    doc.text(splitRemarks, 20, finalY + 7)
    
    // Signature
    const signY = finalY + 40
    doc.line(20, signY, 80, signY)
    doc.text('Digital Signature', 20, signY + 5)
    doc.setFontSize(9)
    doc.text(`Verified by: ${profile?.full_name}`, 20, signY + 10)
    doc.text(`Timestamp: ${new Date().toISOString()}`, 20, signY + 15)
    
    doc.save(`Handover_Report_${profile?.department}_${shift}_${today}.pdf`)
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl w-full pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 flex items-center gap-3">
              <ClipboardCheck className="h-8 w-8 text-[#C41E3A]" />
              Shift Handover Report
            </h1>
            <p className="text-zinc-500 mt-1">Aggregate your shift data for a formal transition.</p>
          </div>
          
          <div className="flex items-center gap-2">
            <SelectShift value={shift} onChange={setShift} disabled={isSigned} />
            <Button 
              variant="outline" 
              onClick={generatePDF}
              className="gap-2"
              disabled={entries.length === 0}
            >
              <Printer size={16} />
              Print PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm border-zinc-200">
              <CardHeader className="bg-zinc-50/50 border-b border-zinc-100">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-zinc-500" />
                  Shift Summary: {shift.charAt(0).toUpperCase() + shift.slice(1)}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {entries.length === 0 ? (
                  <div className="py-20 text-center px-4">
                    <div className="h-12 w-12 rounded-full bg-zinc-50 flex items-center justify-center mx-auto mb-4">
                      <Clock className="h-6 w-6 text-zinc-300" />
                    </div>
                    <p className="text-zinc-500 font-medium">No logs found for this shift today.</p>
                    <p className="text-zinc-400 text-sm mt-1">Log some entries to generate a report.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100">
                    {/* Render Categories */}
                    <ReportSection title="Critical Incidents" entries={categorizedEntries.incidents} icon={AlertTriangleIcon} color="text-red-600" />
                    <ReportSection title="Maintenance Logs" entries={categorizedEntries.maintenance} icon={WrenchIcon} color="text-blue-600" />
                    <ReportSection title="Guest Relations" entries={categorizedEntries.guest} icon={UserIcon} color="text-amber-600" />
                    <ReportSection title="Handover Points" entries={categorizedEntries.handovers} icon={ArrowRight} color="text-[#C41E3A]" />
                    <ReportSection title="General Logs" entries={categorizedEntries.general} icon={ClipboardCheck} color="text-zinc-500" />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-zinc-200">
              <CardHeader>
                <CardTitle className="text-base">Additional Remarks</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea 
                  placeholder="Summarize the shift, mention outstanding jobs, or leave instructions for the next supervisor..."
                  className="min-h-[120px] resize-none"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  disabled={isSigned}
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar / Actions */}
          <div className="space-y-6">
            <Card className="shadow-sm border-zinc-200 bg-zinc-50/50">
              <CardHeader>
                <CardTitle className="text-base">Digital Sign-off</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-white border border-zinc-200 rounded-lg">
                  <div className="h-10 w-10 rounded-full bg-[#C41E3A] flex items-center justify-center text-white font-bold shrink-0">
                    {profile?.full_name?.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{profile?.full_name}</p>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">{formatDepartment(profile?.department ?? '')}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    By signing off, you confirm that all critical information for this shift has been logged and the handover is complete.
                  </p>
                  <Button 
                    className="w-full bg-[#C41E3A] hover:bg-[#a01830] text-white gap-2 h-11"
                    disabled={isSigned || isSigning || entries.length === 0}
                    onClick={handleSignOff}
                  >
                    {isSigning ? 'Signing...' : isSigned ? 'Report Signed' : 'Sign Off Shift'}
                    {isSigned && <UserCheck size={18} />}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {isSigned && (
              <Button 
                variant="outline" 
                className="w-full gap-2 border-green-200 text-green-700 bg-green-50 hover:bg-green-100"
                onClick={() => navigate({ to: '/dashboard' as any })}
              >
                Return to Dashboard
              </Button>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

function ReportSection({ title, entries, icon: Icon, color }: any) {
  if (entries.length === 0) return null
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3 px-1">
        <Icon size={16} className={color} />
        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900">{title}</h4>
        <Badge variant="secondary" className="ml-auto h-5 text-[10px]">{entries.length}</Badge>
      </div>
      <div className="space-y-3">
        {entries.map((e: any) => (
          <div key={e.id} className="pl-4 border-l-2 border-zinc-100 py-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-medium text-zinc-400">
                {new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <div className={cn(
                "h-1.5 w-1.5 rounded-full",
                e.priority === 'urgent' ? "bg-red-500" : "bg-zinc-300"
              )} />
            </div>
            <p className="text-sm font-medium text-zinc-800 line-clamp-1">{e.title}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Logged by {e.author?.full_name}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function SelectShift({ value, onChange, disabled }: any) {
  return (
    <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg border border-zinc-200">
      {(['morning', 'afternoon', 'night'] as const).map(s => (
        <button
          key={s}
          onClick={() => onChange(s)}
          disabled={disabled}
          className={cn(
            "px-3 py-1.5 text-xs font-bold rounded-md transition-all uppercase tracking-tight",
            value === s
              ? "bg-white text-[#C41E3A] shadow-sm"
              : "text-zinc-500 hover:text-zinc-700 disabled:opacity-50"
          )}
        >
          {s}
        </button>
      ))}
    </div>
  )
}

// Minimal Icons for section
function AlertTriangleIcon(props: any) { return <ClipboardCheck {...props} className={cn(props.className, "text-red-500")} /> }
function WrenchIcon(props: any) { return <ClipboardCheck {...props} className={cn(props.className, "text-blue-500")} /> }
function UserIcon(props: any) { return <ClipboardCheck {...props} className={cn(props.className, "text-amber-500")} /> }
