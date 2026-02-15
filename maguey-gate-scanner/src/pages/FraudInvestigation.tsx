/**
 * Fraud Investigation Center Page
 * 
 * Comprehensive fraud investigation dashboard with filtering, timeline, and analysis tools
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import OwnerPortalLayout from '@/components/layout/OwnerPortalLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  Shield,
  AlertTriangle,
  Search,
  Filter,
  MapPin,
  Globe,
  Smartphone,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { FraudAnalysisModal } from '@/components/FraudAnalysisModal';
import { confirmFraud, whitelistFraudDetection, getHighRiskAlerts } from '@/lib/fraud-detection-service';

interface FraudLog {
  id: string;
  scan_log_id: string;
  ticket_id: string;
  risk_score: number;
  fraud_indicators: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    score: number;
    metadata?: Record<string, any>;
  }>;
  ip_address: string;
  device_fingerprint: string;
  geolocation: any;
  created_at: string;
  is_confirmed_fraud: boolean;
  is_whitelisted: boolean;
  investigation_notes?: string;
  tickets?: {
    ticket_id: string;
    event_name: string;
  };
  scan_logs?: {
    scanned_at: string;
    scan_result: string;
    scanned_by: string;
  };
}

const FraudInvestigation = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const [fraudLogs, setFraudLogs] = useState<FraudLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<FraudLog | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Filters
  const [riskScoreFilter, setRiskScoreFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<string>('7d');

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      toast({
        variant: 'destructive',
        title: 'Not Configured',
        description: 'Fraud investigation requires Supabase connection',
      });
      navigate('/dashboard');
      return;
    }

    loadFraudLogs();
    
    // Check if alert ID is in URL params
    const alertId = searchParams.get('alert');
    if (alertId) {
      // Load specific alert
      loadSpecificAlert(alertId);
    }
  }, [riskScoreFilter, statusFilter, dateRange]);

  const loadSpecificAlert = async (alertId: string) => {
    try {
      const { data, error } = await supabase
        .from('fraud_detection_logs')
        .select(`
          *,
          tickets (
            ticket_id,
            event_name
          ),
          scan_logs (
            scanned_at,
            scan_result,
            scanned_by
          )
        `)
        .eq('id', alertId)
        .single();

      if (!error && data) {
        setSelectedLog(data as FraudLog);
        setIsModalOpen(true);
      }
    } catch (error) {
      console.error('[fraud-investigation] Error loading specific alert:', error);
    }
  };

  const loadFraudLogs = async () => {
    try {
      setIsLoading(true);
      
      // Build query
      let query = supabase
        .from('fraud_detection_logs')
        .select(`
          *,
          tickets (
            ticket_id,
            event_name
          ),
          scan_logs (
            scanned_at,
            scan_result,
            scanned_by
          )
        `)
        .order('created_at', { ascending: false });

      // Apply risk score filter
      if (riskScoreFilter !== 'all') {
        if (riskScoreFilter === 'critical') {
          query = query.gte('risk_score', 90);
        } else if (riskScoreFilter === 'high') {
          query = query.gte('risk_score', 80).lt('risk_score', 90);
        } else if (riskScoreFilter === 'medium') {
          query = query.gte('risk_score', 50).lt('risk_score', 80);
        } else if (riskScoreFilter === 'low') {
          query = query.lt('risk_score', 50);
        }
      }

      // Apply status filter
      if (statusFilter === 'confirmed') {
        query = query.eq('is_confirmed_fraud', true);
      } else if (statusFilter === 'whitelisted') {
        query = query.eq('is_whitelisted', true);
      } else if (statusFilter === 'pending') {
        query = query.eq('is_confirmed_fraud', false).eq('is_whitelisted', false);
      }

      // Apply date range filter
      const dateThreshold = new Date();
      if (dateRange === '1d') {
        dateThreshold.setDate(dateThreshold.getDate() - 1);
      } else if (dateRange === '7d') {
        dateThreshold.setDate(dateThreshold.getDate() - 7);
      } else if (dateRange === '30d') {
        dateThreshold.setDate(dateThreshold.getDate() - 30);
      } else if (dateRange === 'all') {
        // No date filter
      }
      if (dateRange !== 'all') {
        query = query.gte('created_at', dateThreshold.toISOString());
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;

      // Apply search filter
      let filteredData = (data || []) as FraudLog[];
      if (searchQuery) {
        const queryLower = searchQuery.toLowerCase();
        filteredData = filteredData.filter(
          (log) =>
            log.tickets?.ticket_id?.toLowerCase().includes(queryLower) ||
            log.ip_address?.toLowerCase().includes(queryLower) ||
            log.device_fingerprint?.toLowerCase().includes(queryLower) ||
            log.fraud_indicators?.some((ind) =>
              ind.description.toLowerCase().includes(queryLower)
            )
        );
      }

      setFraudLogs(filteredData);
    } catch (error: any) {
      console.error('[fraud-investigation] Error loading fraud logs:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load fraud logs',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDetails = (log: FraudLog) => {
    setSelectedLog(log);
    setIsModalOpen(true);
  };

  const handleConfirmFraud = async (logId: string) => {
    if (!user?.id) return;

    try {
      await confirmFraud(logId, user.id, 'Confirmed via investigation center');
      toast({
        title: 'Success',
        description: 'Fraud confirmed',
      });
      await loadFraudLogs();
      if (selectedLog?.id === logId) {
        await loadSpecificAlert(logId);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to confirm fraud',
      });
    }
  };

  const handleWhitelist = async (logId: string) => {
    if (!user?.id) return;

    try {
      await whitelistFraudDetection(logId, user.id);
      toast({
        title: 'Success',
        description: 'Marked as false positive',
      });
      await loadFraudLogs();
      if (selectedLog?.id === logId) {
        await loadSpecificAlert(logId);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to whitelist',
      });
    }
  };

  const getRiskColor = (score: number): string => {
    if (score >= 90) return 'text-red-600 bg-red-500/10 border-red-500/30';
    if (score >= 80) return 'text-orange-600 bg-orange-500/10 border-orange-500/30';
    if (score >= 50) return 'text-yellow-600 bg-yellow-500/10 border-yellow-500/30';
    return 'text-green-600 bg-green-500/10 border-green-500/30';
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return 'bg-red-600';
      case 'high':
        return 'bg-orange-600';
      case 'medium':
        return 'bg-yellow-600';
      default:
        return 'bg-blue-600';
    }
  };

  if (!isSupabaseConfigured()) {
    return null;
  }

  return (
    <OwnerPortalLayout
      title="Security Alerts"
      subtitle="SECURITY"
      description="Review flagged scan attempts and fraud indicators"
    >
      <div className="space-y-6">

        {/* Filters */}
        <Card className="mb-6 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Ticket ID, IP, device..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        loadFraudLogs();
                      }
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Risk Score</label>
                <Select value={riskScoreFilter} onValueChange={setRiskScoreFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="critical">Critical (90+)</SelectItem>
                    <SelectItem value="high">High (80-89)</SelectItem>
                    <SelectItem value="medium">Medium (50-79)</SelectItem>
                    <SelectItem value="low">Low (&lt;50)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed Fraud</SelectItem>
                    <SelectItem value="whitelisted">Whitelisted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Date Range</label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1d">Last 24 Hours</SelectItem>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={loadFraudLogs}
              className="mt-4"
              variant="outline"
            >
              Apply Filters
            </Button>
          </CardContent>
        </Card>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{fraudLogs.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">
                {fraudLogs.filter((l) => !l.is_confirmed_fraud && !l.is_whitelisted).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Confirmed Fraud
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {fraudLogs.filter((l) => l.is_confirmed_fraud).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                False Positives
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {fraudLogs.filter((l) => l.is_whitelisted).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fraud Logs Table */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>Fraud Detection Logs</CardTitle>
            <CardDescription>
              {fraudLogs.length} log{fraudLogs.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading fraud logs...
              </div>
            ) : fraudLogs.length === 0 ? (
              <div className="text-center py-8">
                <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No fraud logs found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try adjusting your filters
                </p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Ticket ID</TableHead>
                      <TableHead>Risk Score</TableHead>
                      <TableHead>Indicators</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fraudLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {new Date(log.created_at).toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {log.tickets?.ticket_id || log.ticket_id?.substring(0, 8) || 'Unknown'}
                        </TableCell>
                        <TableCell>
                          <Badge className={getRiskColor(log.risk_score)}>
                            {log.risk_score}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {log.fraud_indicators?.slice(0, 2).map((ind, idx) => (
                              <Badge
                                key={idx}
                                className={`text-xs ${getSeverityColor(ind.severity)}`}
                              >
                                {ind.type}
                              </Badge>
                            ))}
                            {log.fraud_indicators && log.fraud_indicators.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{log.fraud_indicators.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.ip_address || 'Unknown'}
                        </TableCell>
                        <TableCell>
                          {log.is_confirmed_fraud ? (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Confirmed
                            </Badge>
                          ) : log.is_whitelisted ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Whitelisted
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(log)}
                            >
                              View
                            </Button>
                            {!log.is_confirmed_fraud && !log.is_whitelisted && (
                              <>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleConfirmFraud(log.id)}
                                >
                                  Confirm
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleWhitelist(log.id)}
                                >
                                  Whitelist
                                </Button>
                              </>
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

        {/* Fraud Analysis Modal */}
        {selectedLog && (
          <FraudAnalysisModal
            ticketId={selectedLog.ticket_id}
            scanLogId={selectedLog.scan_log_id}
            open={isModalOpen}
            onOpenChange={setIsModalOpen}
          />
        )}
      </div>
    </OwnerPortalLayout>
  );
};

export default FraudInvestigation;

