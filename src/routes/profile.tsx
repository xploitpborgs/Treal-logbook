import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { useAuthContext } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { DEPT_LABELS } from '@/lib/constants'
import { getInitials } from '@/lib/utils'

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
})

function ProfilePage() {
  const { profile, userEmail, refreshProfile } = useAuthContext()
  const [isUpdating, setIsUpdating] = useState(false)
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name)
    }
  }, [profile])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setIsUpdating(true)

    try {
      // 1. Update Profile (Name)
      if (fullName !== profile.full_name) {
        const { error } = await supabase
          .from('profiles')
          .update({ full_name: fullName })
          .eq('id', profile.id)
          
        if (error) throw error
      }

      // 2. Update Password if provided
      if (newPassword) {
        const { error } = await supabase.auth.updateUser({
          password: newPassword
        })
        if (error) throw error
        setNewPassword('')
      }

      await refreshProfile()
      toast.success('Profile updated successfully')
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile')
    } finally {
      setIsUpdating(false)
    }
  }

  if (!profile) return null

  return (
    <AppLayout title="Profile Settings">
      <div className="mx-auto max-w-2xl space-y-6 pb-12">
        <div className="hidden sm:flex items-center justify-between">
          <p className="text-sm text-zinc-500">Manage your personal information and password</p>
        </div>

        <Card className="border-zinc-200 shadow-none">
          <CardContent className="p-4 sm:p-6">
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              
              {/* Avatar / Identity Section */}
              <div className="flex items-center gap-4 border-b border-zinc-100 pb-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-xl font-semibold text-brand">
                  {getInitials(profile.full_name)}
                </div>
                <div>
                  <h2 className="text-lg font-medium text-zinc-900">{profile.full_name}</h2>
                  <p className="text-sm text-zinc-500">{userEmail}</p>
                </div>
              </div>

              {/* Editable Fields */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input 
                    id="fullName"
                    value={fullName} 
                    onChange={(e) => setFullName(e.target.value)} 
                    required 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password (optional)</Label>
                  <Input 
                    id="newPassword"
                    type="password"
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
                    placeholder="Leave blank to keep current password"
                  />
                </div>
              </div>

              {/* Read-Only Meta Information */}
              <div className="rounded-lg bg-zinc-50 p-4 space-y-3">
                <h3 className="text-sm font-medium text-zinc-900">Work Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-zinc-500">Department</p>
                    <p className="text-sm font-medium text-zinc-900 mt-0.5">
                      {DEPT_LABELS[profile.department] || profile.department}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Role</p>
                    <p className="text-sm font-medium text-zinc-900 mt-0.5 capitalize">
                      {profile.role === 'gm' ? 'General Manager' : profile.role}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button 
                  type="submit" 
                  disabled={isUpdating || (!newPassword && fullName === profile.full_name)}
                  className="bg-[#a31e22] hover:bg-[#82181b] text-white shadow-none"
                >
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
