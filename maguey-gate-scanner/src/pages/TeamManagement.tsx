import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useRole } from "@/contexts/AuthContext";
import { useUserManagement, type UserProfile } from "@/hooks/useUserManagement";
import OwnerPortalLayout from "@/components/layout/OwnerPortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Shield,
  UserCog,
  Search,
  ChevronUp,
  ChevronDown,
  Trash2,
  Mail,
  Calendar,
  UserPlus,
  Copy,
  Link2,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { logAuditEvent } from "@/lib/audit-service";
import {
  createInvitation,
  getInvitationsByUser,
  revokeInvitation,
  getInvitationUrl,
  type Invitation,
} from "@/lib/invitation-service";
import { UserDetailsModal } from "@/components/admin/UserDetailsModal";

const TeamManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const role = useRole();
  const { getAllUsers, promoteToOwner, setRoleToPromoter, demoteToEmployee, deleteUser, loading } = useUserManagement();
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  
  // Invitation management state
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteExpiresIn, setInviteExpiresIn] = useState("168"); // 7 days default
  const [inviteRole, setInviteRole] = useState<'employee' | 'owner' | 'promoter'>('employee');
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);
  
  // User details modal state
  const [userDetailsOpen, setUserDetailsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Redirect employees
  useEffect(() => {
    if (role !== 'owner') {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "Team management is only available to owners.",
      });
      navigate("/scanner");
    }
  }, [role, navigate, toast]);

  // Load users and invitations
  useEffect(() => {
    loadUsers();
    loadInvitations();
  }, []);

  // Filter users based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = users.filter(u =>
      u.email.toLowerCase().includes(query) ||
      u.full_name?.toLowerCase().includes(query) ||
      u.role.toLowerCase().includes(query)
    );
    setFilteredUsers(filtered);
  }, [searchQuery, users]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const usersList = await getAllUsers();
      setUsers(usersList);
      setFilteredUsers(usersList);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load users.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadInvitations = async () => {
    if (!user) return;
    
    try {
      const invites = await getInvitationsByUser(user.id);
      setInvitations(invites);
    } catch (error) {
      console.error('Error loading invitations:', error);
    }
  };

  const handleCreateInvitation = async () => {
    if (!user) return;
    
    setCreatingInvite(true);
    try {
      const hours = parseInt(inviteExpiresIn);
      const result = await createInvitation(user.id, hours, { role: inviteRole });
      
      if (result.success && result.token) {
        const url = getInvitationUrl(result.token);
        setGeneratedInviteUrl(url);
        await loadInvitations();

        toast({
          title: "Invitation Created!",
          description: "Share this link with new team members.",
        });

        // Audit log: invitation created
        logAuditEvent('user_created', 'invitation', `Team invitation created for ${inviteRole} role`, {
          userId: user.id,
          severity: 'info',
          metadata: { expiresInHours: hours, role: inviteRole },
        }).catch(() => {});
      } else {
        throw new Error(result.error || "Failed to create invitation");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create invitation.",
      });
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleCopyInviteUrl = async () => {
    if (!generatedInviteUrl) return;
    
    try {
      await navigator.clipboard.writeText(generatedInviteUrl);
      toast({
        title: "Copied!",
        description: "Invitation link copied to clipboard.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to copy link to clipboard.",
      });
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      const result = await revokeInvitation(invitationId);
      if (result.success) {
        await loadInvitations();
        toast({
          title: "Invitation Revoked",
          description: "The invitation has been deleted.",
        });

        // Audit log: invitation revoked
        logAuditEvent('user_deleted', 'invitation', 'Team invitation revoked', {
          userId: user?.id,
          resourceId: invitationId,
          severity: 'info',
        }).catch(() => {});
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to revoke invitation.",
      });
    }
  };

  const openInviteDialog = () => {
    setGeneratedInviteUrl(null);
    setInviteExpiresIn("168"); // Reset to 7 days
    setInviteRole('employee'); // Reset to employee
    setInviteDialogOpen(true);
  };

  const handleViewUserDetails = (userProfile: UserProfile) => {
    setSelectedUser(userProfile);
    setUserDetailsOpen(true);
  };

  const handlePromoteToPromoter = async (userId: string) => {
    const success = await setRoleToPromoter(userId);
    if (success) {
      await loadUsers();

      // Audit log: user promoted to promoter
      logAuditEvent('user_role_changed', 'user', 'User promoted to promoter', {
        userId: user?.id,
        resourceId: userId,
        severity: 'info',
        metadata: { previousRole: 'employee', newRole: 'promoter' },
      }).catch(() => {});
    }
  };

  const handlePromoteToOwner = async (userId: string) => {
    const success = await promoteToOwner(userId);
    if (success) {
      await loadUsers();

      // Audit log: user promoted to owner
      logAuditEvent('user_role_changed', 'user', 'User promoted to owner', {
        userId: user?.id,
        resourceId: userId,
        severity: 'warning',
        metadata: { previousRole: 'promoter', newRole: 'owner' },
      }).catch(() => {});
    }
  };

  const handleDemoteToPromoter = async (userId: string) => {
    const success = await setRoleToPromoter(userId);
    if (success) {
      await loadUsers();

      // Audit log: user demoted to promoter
      logAuditEvent('user_role_changed', 'user', 'User demoted to promoter', {
        userId: user?.id,
        resourceId: userId,
        severity: 'info',
        metadata: { previousRole: 'owner', newRole: 'promoter' },
      }).catch(() => {});
    }
  };

  const handleDemoteToEmployee = async (userId: string) => {
    const success = await demoteToEmployee(userId);
    if (success) {
      await loadUsers();

      // Audit log: user demoted to employee
      logAuditEvent('user_role_changed', 'user', 'User demoted to employee', {
        userId: user?.id,
        resourceId: userId,
        severity: 'warning',
        metadata: { previousRole: 'promoter', newRole: 'employee' },
      }).catch(() => {});
    }
  };

  const handleDeleteClick = (userProfile: UserProfile) => {
    setUserToDelete(userProfile);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    const success = await deleteUser(userToDelete.id);
    if (success) {
      await loadUsers();

      // Audit log: user deleted
      logAuditEvent('user_deleted', 'user', `User deleted: ${userToDelete.email}`, {
        userId: user?.id,
        resourceId: userToDelete.id,
        severity: 'warning',
        metadata: { deletedEmail: userToDelete.email, deletedRole: userToDelete.role },
      }).catch(() => {});
    }
    setDeleteDialogOpen(false);
    setUserToDelete(null);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (role !== 'owner') {
    return null; // Will redirect via useEffect
  }

  const ownerCount = users.filter(u => u.role === 'owner').length;
  const promoterCount = users.filter(u => u.role === 'promoter').length;
  const employeeCount = users.filter(u => u.role === 'employee').length;

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button
        onClick={() => { loadUsers(); loadInvitations(); }}
        variant="outline"
        className="border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20"
      >
        <RefreshCw className="mr-2 h-4 w-4" />
        Refresh
      </Button>
    </div>
  );

  return (
    <OwnerPortalLayout
      title="Team Management"
      description="Manage user roles and access permissions"
      actions={headerActions}
    >

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#161d45] via-[#0b132f] to-[#050915]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{users.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Active accounts</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#161d45] via-[#0b132f] to-[#050915]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Shield className="h-4 w-4 text-purple-400" />
                Owners
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-400">{ownerCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Full access</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#161d45] via-[#0b132f] to-[#050915]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-blue-400" />
                Promoters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-400">{promoterCount}</div>
              <p className="text-xs text-muted-foreground mt-1">View analytics</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#161d45] via-[#0b132f] to-[#050915]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <UserCog className="h-4 w-4 text-slate-400" />
                Employees
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-400">{employeeCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Scanner only</p>
            </CardContent>
          </Card>
        </div>

        {/* Invitation Management */}
        <Card className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#161d45] via-[#0b132f] to-[#050915] shadow-[0_45px_90px_rgba(3,7,23,0.7)] mb-6">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Team Invitations
                </CardTitle>
                <CardDescription>Generate invitation links for new team members</CardDescription>
              </div>
              <Button
                onClick={openInviteDialog}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
              >
                <Link2 className="h-4 w-4 mr-2" />
                Create Invitation
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {invitations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No active invitations. Create one to invite team members.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {invitations.map((invitation) => {
                  const isExpired = new Date(invitation.expires_at) < new Date();
                  const isUsed = Boolean(invitation.used_at);
                  
                  return (
                    <div key={invitation.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {isUsed ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : isExpired ? (
                            <XCircle className="h-4 w-4 text-destructive" />
                          ) : (
                            <Clock className="h-4 w-4 text-accent" />
                          )}
                          <span className="font-mono text-sm">...{invitation.token.slice(-8)}</span>
                          <Badge variant={isUsed ? "default" : isExpired ? "destructive" : "secondary"}>
                            {isUsed ? "Used" : isExpired ? "Expired" : "Active"}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Created: {new Date(invitation.created_at).toLocaleDateString()} • 
                          Expires: {new Date(invitation.expires_at).toLocaleDateString()}
                          {invitation.used_at && ` • Used: ${new Date(invitation.used_at).toLocaleDateString()}`}
                        </div>
                      </div>
                      {!isUsed && !isExpired && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRevokeInvitation(invitation.id)}
                          className="border-destructive/20 text-destructive"
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Search and Actions */}
        <Card className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#161d45] via-[#0b132f] to-[#050915] shadow-[0_45px_90px_rgba(3,7,23,0.7)] mb-6">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>View and manage user accounts</CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-indigo-500/20 border-indigo-500/30 text-white placeholder:text-slate-400 focus:border-indigo-400 focus:ring-indigo-500/50"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-4">Loading users...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? "No users found matching your search." : "No users found."}
                </p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((userProfile) => (
                      <TableRow 
                        key={userProfile.id} 
                        className="hover:bg-muted/50"
                      >
                        <TableCell 
                          onClick={() => handleViewUserDetails(userProfile)}
                          className="cursor-pointer hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <span className="font-medium hover:text-primary transition-colors">{userProfile.email}</span>
                              {userProfile.id === user?.id && (
                                <Badge variant="outline" className="text-xs">You</Badge>
                              )}
                            </div>
                            {userProfile.full_name && (
                              <span className="text-sm text-muted-foreground">{userProfile.full_name}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={userProfile.role === 'owner' ? 'default' : 'secondary'}
                            className={
                              userProfile.role === 'owner'
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                : userProfile.role === 'promoter'
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                : 'bg-slate-500/20 text-slate-300 border-slate-500/30'
                            }
                          >
                            {userProfile.role === 'owner' && <Shield className="h-3 w-3 mr-1" />}
                            {userProfile.role === 'promoter' && <UserPlus className="h-3 w-3 mr-1" />}
                            {userProfile.role === 'employee' && <UserCog className="h-3 w-3 mr-1" />}
                            {userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDate(userProfile.created_at)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(userProfile.last_sign_in_at)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            {/* Employee: Can promote to Promoter */}
                            {userProfile.role === 'employee' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePromoteToPromoter(userProfile.id);
                                }}
                                disabled={loading}
                                className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                              >
                                <ChevronUp className="h-4 w-4 mr-1" />
                                Promoter
                              </Button>
                            )}
                            {/* Promoter: Can promote to Owner or demote to Employee */}
                            {userProfile.role === 'promoter' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePromoteToOwner(userProfile.id);
                                  }}
                                  disabled={loading}
                                  className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                                >
                                  <ChevronUp className="h-4 w-4 mr-1" />
                                  Owner
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDemoteToEmployee(userProfile.id);
                                  }}
                                  disabled={loading}
                                  className="border-slate-500/30 text-slate-400 hover:bg-slate-500/10"
                                >
                                  <ChevronDown className="h-4 w-4 mr-1" />
                                  Employee
                                </Button>
                              </>
                            )}
                            {/* Owner (not self): Can demote to Promoter */}
                            {userProfile.role === 'owner' && userProfile.id !== user?.id && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDemoteToPromoter(userProfile.id);
                                }}
                                disabled={loading}
                                className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                              >
                                <ChevronDown className="h-4 w-4 mr-1" />
                                Promoter
                              </Button>
                            )}
                            {/* Delete button (not self) */}
                            {userProfile.id !== user?.id && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClick(userProfile);
                                }}
                                disabled={loading}
                                className="border-destructive/20 text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{userToDelete?.email}</strong>?
                This action cannot be undone and will remove all associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-destructive hover:bg-destructive/90"
              >
                Delete User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* User Details Modal */}
        <UserDetailsModal
          user={selectedUser}
          open={userDetailsOpen}
          onOpenChange={setUserDetailsOpen}
        />

        {/* Invitation Creation Dialog */}
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Create Team Invitation
              </DialogTitle>
              <DialogDescription>
                Generate a secure invitation link for a new team member.
              </DialogDescription>
            </DialogHeader>
            
            {generatedInviteUrl ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Invitation Link</Label>
                  <div className="flex gap-2">
                    <Input
                      value={generatedInviteUrl}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button onClick={handleCopyInviteUrl} size="icon">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share this link with the new team member. They can use it to create their account.
                  </p>
                </div>
                
                <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                  <p className="text-sm font-medium mb-1">Important:</p>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    <li>This link expires in {parseInt(inviteExpiresIn) / 24} days</li>
                    <li>It can only be used once</li>
                    <li>New user will be assigned the "{inviteRole === 'owner' ? 'Owner' : inviteRole === 'promoter' ? 'Promoter' : 'Employee'}" role</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={inviteRole} onValueChange={(value: 'employee' | 'owner' | 'promoter') => setInviteRole(value)}>
                    <SelectTrigger className="bg-indigo-500/20 border-indigo-500/30 text-white hover:bg-indigo-500/30 focus:ring-indigo-500/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0b132f] border-indigo-500/30">
                      <SelectItem value="employee" className="text-white hover:bg-indigo-500/20 focus:bg-indigo-500/20">
                        <div className="flex items-center gap-2">
                          <UserCog className="h-4 w-4" />
                          Employee - Scanner access only
                        </div>
                      </SelectItem>
                      <SelectItem value="promoter" className="text-white hover:bg-indigo-500/20 focus:bg-indigo-500/20">
                        <div className="flex items-center gap-2">
                          <UserPlus className="h-4 w-4" />
                          Promoter - Scanner + view analytics
                        </div>
                      </SelectItem>
                      <SelectItem value="owner" className="text-white hover:bg-indigo-500/20 focus:bg-indigo-500/20">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Owner - Full admin access
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The access level for the new team member.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Expiration Time</Label>
                  <Select value={inviteExpiresIn} onValueChange={setInviteExpiresIn}>
                    <SelectTrigger className="bg-indigo-500/20 border-indigo-500/30 text-white hover:bg-indigo-500/30 focus:ring-indigo-500/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0b132f] border-indigo-500/30">
                      <SelectItem value="24" className="text-white hover:bg-indigo-500/20 focus:bg-indigo-500/20">24 hours</SelectItem>
                      <SelectItem value="72" className="text-white hover:bg-indigo-500/20 focus:bg-indigo-500/20">3 days</SelectItem>
                      <SelectItem value="168" className="text-white hover:bg-indigo-500/20 focus:bg-indigo-500/20">7 days (recommended)</SelectItem>
                      <SelectItem value="720" className="text-white hover:bg-indigo-500/20 focus:bg-indigo-500/20">30 days</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    How long the invitation link will remain valid.
                  </p>
                </div>
              </div>
            )}

            <DialogFooter>
              {generatedInviteUrl ? (
                <Button onClick={() => setInviteDialogOpen(false)} className="w-full">
                  Done
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setInviteDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateInvitation}
                    disabled={creatingInvite}
                    className="bg-gradient-green hover:shadow-glow-green"
                  >
                    {creatingInvite ? "Creating..." : "Generate Link"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </OwnerPortalLayout>
  );
};

export default TeamManagement;

