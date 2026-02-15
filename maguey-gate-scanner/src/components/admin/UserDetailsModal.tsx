import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { type UserProfile } from "@/hooks/useUserManagement";
import {
  User,
  Mail,
  Calendar,
  Shield,
  Activity,
  Clock,
  Scan,
} from "lucide-react";

interface UserDetailsModalProps {
  user: UserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UserDetailsModal = ({ user, open, onOpenChange }: UserDetailsModalProps) => {
  if (!user) return null;

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateShort = (dateString?: string) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const accountAge = user.created_at
    ? Math.floor((new Date().getTime() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Details
          </DialogTitle>
          <DialogDescription>
            Complete information for {user.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Basic Information
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium">{user.email}</p>
                </div>
              </div>

              {user.full_name && (
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Full Name</p>
                    <p className="font-medium">{user.full_name}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Shield className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Role</p>
                  <Badge variant={user.role === 'owner' ? 'default' : 'secondary'} className="mt-1">
                    {user.role === 'owner' && <Shield className="h-3 w-3 mr-1" />}
                    {user.role}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Account Activity */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Account Activity
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Account Created</p>
                  <p className="font-medium">{formatDateShort(user.created_at)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{accountAge} days ago</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Last Sign In</p>
                  <p className="font-medium">{formatDate(user.last_sign_in_at)}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Scan className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Total Scans</p>
                  <p className="font-medium text-lg">{user.scan_count || 0}</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* User ID (for debugging/admin purposes) */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              System Information
            </h3>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">User ID</p>
              <p className="font-mono text-xs break-all">{user.id}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

