import { useState, useEffect } from 'react'
import { Bell, Info, AlertTriangle, Megaphone, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/lib/AuthContext'
import { useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import type { AppNotification } from '@/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

export function NotificationCenter() {
  const { profile } = useAuthContext()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!profile) return

    fetchNotifications()

    // Real-time subscription
    const channel = supabase
      .channel(`user-notifications-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`
        },
        () => {
          fetchNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile])

  async function fetchNotifications() {
    if (!profile) return
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (data) {
      setNotifications(data)
      setUnreadCount(data.filter(n => !n.is_read).length)
    }
    if (error) console.error('Error fetching notifications:', error.message)
  }

  async function markAsRead(id: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)

    if (!error) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
  }

  async function markAllAsRead() {
    if (!profile) return
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profile.id)
      .eq('is_read', false)

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    }
  }

  async function deleteNotification(id: string) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)

    if (!error) {
      setNotifications(prev => prev.filter(n => n.id !== id))
      const wasUnread = !notifications.find(n => n.id === id)?.is_read
      if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1))
    }
  }

  const handleNotificationClick = (notification: AppNotification) => {
    markAsRead(notification.id)
    if (notification.link) {
      navigate({ to: notification.link as any })
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'escalation': return <AlertTriangle size={16} className="text-red-500" />
      case 'directive': return <Megaphone size={16} className="text-amber-500" />
      case 'mention': return <Info size={16} className="text-blue-500" />
      default: return <Info size={16} className="text-zinc-500" />
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 focus:outline-none">
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-[#C41E3A] text-[10px] font-bold text-white ring-2 ring-white animate-in zoom-in duration-300">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0 shadow-xl overflow-hidden rounded-xl border-zinc-200">
        <div className="flex items-center justify-between bg-zinc-50 px-4 py-3 border-b border-zinc-100">
          <h3 className="text-sm font-semibold text-zinc-900">Notifications</h3>
          {unreadCount > 0 && (
            <button 
              onClick={markAllAsRead}
              className="text-[11px] font-medium text-[#C41E3A] hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center px-4">
              <div className="h-12 w-12 rounded-full bg-zinc-50 flex items-center justify-center mb-3">
                <Bell size={20} className="text-zinc-300" />
              </div>
              <p className="text-sm font-medium text-zinc-500">No notifications yet</p>
              <p className="text-xs text-zinc-400 mt-1">We'll alert you when something important happens.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {notifications.map((n) => (
                <div 
                  key={n.id} 
                  className={cn(
                    "relative group flex gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 cursor-pointer",
                    !n.is_read && "bg-[#C41E3A]/5 hover:bg-[#C41E3A]/10"
                  )}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="mt-0.5 shrink-0">
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm leading-tight mb-0.5",
                      !n.is_read ? "font-semibold text-zinc-900" : "font-medium text-zinc-700"
                    )}>
                      {n.title}
                    </p>
                    <p className="text-xs text-zinc-500 line-clamp-2 leading-normal">
                      {n.message}
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-1.5 flex items-center gap-1.5">
                      {new Date(n.created_at).toLocaleDateString() === new Date().toLocaleDateString() 
                        ? 'Today' 
                        : new Date(n.created_at).toLocaleDateString()}
                      <span className="h-0.5 w-0.5 rounded-full bg-zinc-300" />
                      {new Date(n.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteNotification(n.id)
                      }}
                      className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                    {!n.is_read && (
                      <div className="h-1.5 w-1.5 rounded-full bg-[#C41E3A] mb-1" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-zinc-100 p-2 bg-zinc-50">
          <Button variant="ghost" className="w-full h-8 text-xs font-medium text-zinc-500 hover:text-zinc-900" onClick={() => navigate({ to: '/dashboard' as any })}>
            View Dashboard
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
