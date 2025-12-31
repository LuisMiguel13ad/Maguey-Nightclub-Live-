import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Eye,
  X,
} from 'lucide-react';
import {
  getPendingDiscrepancies,
  getEventDiscrepancies,
  resolveDiscrepancy,
  type CountDiscrepancy,
} from '@/lib/door-counter-service';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface DiscrepancyAlertsProps {
  eventId?: string; // If provided, show only discrepancies for this event
  showResolved?: boolean; // Whether to show resolved discrepancies
}

export function DiscrepancyAlerts({
  eventId,
  showResolved = false,
}: DiscrepancyAlertsProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [discrepancies, setDiscrepancies] = useState<CountDiscrepancy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<CountDiscrepancy | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [resolutionStatus, setResolutionStatus] = useState<'resolved' | 'ignored'>('resolved');
  const [resolutionNotes, setResolutionNotes] = useState('');

  const loadDiscrepancies = async () => {
    setIsLoading(true);
    try {
      let data: CountDiscrepancy[];
      if (eventId) {
        data = await getEventDiscrepancies(eventId);
      } else {
        data = await getPendingDiscrepancies();
      }

      // Filter by status if needed
      if (!showResolved) {
        data = data.filter(d => d.status === 'pending' || d.status === 'investigating');
      }

      setDiscrepancies(data);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error loading discrepancies',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedDiscrepancy || !user?.id) return;

    try {
      await resolveDiscrepancy(
        selectedDiscrepancy.id,
        resolutionStatus,
        resolutionNotes,
        user.id
      );
      toast({
        title: 'Discrepancy resolved',
        description: 'The discrepancy has been marked as resolved.',
      });
      setIsDialogOpen(false);
      setResolutionNotes('');
      loadDiscrepancies();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    }
  };

  const handleOpenDialog = (discrepancy: CountDiscrepancy) => {
    setSelectedDiscrepancy(discrepancy);
    setResolutionNotes('');
    setResolutionStatus('resolved');
    setIsDialogOpen(true);
  };

  useEffect(() => {
    loadDiscrepancies();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('discrepancies_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'count_discrepancies',
        },
        () => {
          loadDiscrepancies();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [eventId, showResolved]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="default" className="bg-yellow-500">Pending</Badge>;
      case 'investigating':
        return <Badge variant="default" className="bg-blue-500">Investigating</Badge>;
      case 'resolved':
        return <Badge variant="default" className="bg-green-500">Resolved</Badge>;
      case 'ignored':
        return <Badge variant="secondary">Ignored</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const pendingCount = discrepancies.filter(d => d.status === 'pending').length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Count Discrepancies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-yellow-500/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Count Discrepancies
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {pendingCount} Pending
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Discrepancies between physical and digital counts
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadDiscrepancies}>
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {discrepancies.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-muted-foreground">No discrepancies found</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Physical</TableHead>
                  <TableHead>Digital</TableHead>
                  <TableHead>Difference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discrepancies.map((discrepancy) => (
                  <TableRow key={discrepancy.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {new Date(discrepancy.check_time).toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {discrepancy.physical_count}
                    </TableCell>
                    <TableCell className="font-medium">
                      {discrepancy.digital_count}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {discrepancy.discrepancy > 0 ? (
                          <>
                            <TrendingUp className="h-4 w-4 text-yellow-500" />
                            <span className="text-yellow-600 font-semibold">
                              +{discrepancy.discrepancy}
                            </span>
                          </>
                        ) : discrepancy.discrepancy < 0 ? (
                          <>
                            <TrendingDown className="h-4 w-4 text-red-500" />
                            <span className="text-red-600 font-semibold">
                              {discrepancy.discrepancy}
                            </span>
                          </>
                        ) : (
                          <span className="text-green-600">0</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(discrepancy.status)}</TableCell>
                    <TableCell>
                      {discrepancy.status === 'pending' || discrepancy.status === 'investigating' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(discrepancy)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          {discrepancy.resolved_at
                            ? `Resolved ${new Date(discrepancy.resolved_at).toLocaleDateString()}`
                            : '-'}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Resolution Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resolve Discrepancy</DialogTitle>
              <DialogDescription>
                Record resolution details for this count discrepancy.
              </DialogDescription>
            </DialogHeader>
            {selectedDiscrepancy && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <Label className="text-xs text-muted-foreground">Physical Count</Label>
                    <p className="text-lg font-bold">{selectedDiscrepancy.physical_count}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Digital Count</Label>
                    <p className="text-lg font-bold">{selectedDiscrepancy.digital_count}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Difference</Label>
                    <p className={`text-lg font-bold ${
                      selectedDiscrepancy.discrepancy > 0 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {selectedDiscrepancy.discrepancy > 0 ? '+' : ''}
                      {selectedDiscrepancy.discrepancy}
                    </p>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="resolution_status">Resolution Status</Label>
                  <Select
                    value={resolutionStatus}
                    onValueChange={(value: 'resolved' | 'ignored') => setResolutionStatus(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="ignored">Ignored</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="resolution_notes">Resolution Notes *</Label>
                  <Textarea
                    id="resolution_notes"
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Explain how this discrepancy was resolved..."
                    rows={4}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleResolve}
                disabled={!resolutionNotes.trim()}
              >
                Resolve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

