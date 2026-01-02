import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useRole } from "@/contexts/AuthContext";
import OwnerPortalLayout from "@/components/layout/OwnerPortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Download,
  Search,
  Filter,
  Calendar,
  User,
  AlertCircle,
  Info,
  AlertTriangle,
  XCircle,
  RefreshCw,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import {
  getAuditLogs,
  exportAuditLogsCSV,
  type AuditLog,
  type AuditAction,
  type AuditSeverity,
} from "@/lib/audit-service";

const AuditLog = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const role = useRole();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterResourceType, setFilterResourceType] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);

  // Redirect employees
  useEffect(() => {
    if (role !== 'owner') {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "Audit logs are only available to owners.",
      });
      navigate("/scanner");
    }
  }, [role, navigate, toast]);

  useEffect(() => {
    if (role === 'owner') {
      loadLogs();
    }
  }, [role, startDate, endDate]);

  useEffect(() => {
    filterLogs();
  }, [logs, searchQuery, filterAction, filterSeverity, filterResourceType]);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const auditLogs = await getAuditLogs({
        startDate,
        endDate,
        limit: 5000,
      });
      setLogs(auditLogs);
    } catch (error: any) {
      console.error("Error loading audit logs:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load audit logs",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = [...logs];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log =>
        log.description.toLowerCase().includes(query) ||
        log.user_id?.toLowerCase().includes(query) ||
        log.resource_id?.toLowerCase().includes(query) ||
        log.action.toLowerCase().includes(query)
      );
    }

    if (filterAction !== 'all') {
      filtered = filtered.filter(log => log.action === filterAction);
    }

    if (filterSeverity !== 'all') {
      filtered = filtered.filter(log => log.severity === filterSeverity);
    }

    if (filterResourceType !== 'all') {
      filtered = filtered.filter(log => log.resource_type === filterResourceType);
    }

    setFilteredLogs(filtered);
  };

  const handleExport = () => {
    exportAuditLogsCSV(filteredLogs);
    toast({
      title: "Export Successful",
      description: `Exported ${filteredLogs.length} audit log entries`,
    });
  };

  const getSeverityIcon = (severity: AuditSeverity) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-4 w-4" />;
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: AuditSeverity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-600';
      case 'error':
        return 'bg-red-500';
      case 'warning':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  };

  // Get unique values for filters
  const uniqueActions = Array.from(new Set(logs.map(log => log.action))).sort();
  const uniqueResourceTypes = Array.from(new Set(logs.map(log => log.resource_type))).sort();

  if (role !== 'owner') {
    return null;
  }

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button
        onClick={loadLogs}
        variant="outline"
        className="border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20"
      >
        <RefreshCw className="mr-2 h-4 w-4" />
        Refresh
      </Button>
      <Button
        onClick={handleExport}
        className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
      >
        <Download className="mr-2 h-4 w-4" />
        Export CSV
      </Button>
    </div>
  );

  return (
    <OwnerPortalLayout
      title="Audit Log"
      description="Comprehensive activity log of all system actions"
      actions={headerActions}
    >

        {/* Filters - Blue Theme */}
        <div className="mb-6 p-4 bg-gradient-to-r from-indigo-500/10 via-blue-500/10 to-indigo-500/10 rounded-xl border border-indigo-500/20 backdrop-blur-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-300">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-indigo-500/20 border-indigo-500/30 text-white placeholder:text-slate-400 focus:border-indigo-400 focus:ring-indigo-500/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-300">Action</Label>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="bg-indigo-500/20 border-indigo-500/30 text-white hover:bg-indigo-500/30 focus:ring-indigo-500/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0b132f] border-indigo-500/30">
                  <SelectItem value="all" className="text-white hover:bg-indigo-500/20 focus:bg-indigo-500/20">All Actions</SelectItem>
                  {uniqueActions.map(action => (
                    <SelectItem key={action} value={action} className="text-white hover:bg-indigo-500/20 focus:bg-indigo-500/20">
                      {action.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-300">Severity</Label>
              <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                <SelectTrigger className="bg-indigo-500/20 border-indigo-500/30 text-white hover:bg-indigo-500/30 focus:ring-indigo-500/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0b132f] border-indigo-500/30">
                  <SelectItem value="all" className="text-white hover:bg-indigo-500/20 focus:bg-indigo-500/20">All Severities</SelectItem>
                  <SelectItem value="info" className="text-white hover:bg-indigo-500/20 focus:bg-indigo-500/20">Info</SelectItem>
                  <SelectItem value="warning" className="text-white hover:bg-indigo-500/20 focus:bg-indigo-500/20">Warning</SelectItem>
                  <SelectItem value="error" className="text-white hover:bg-indigo-500/20 focus:bg-indigo-500/20">Error</SelectItem>
                  <SelectItem value="critical" className="text-white hover:bg-indigo-500/20 focus:bg-indigo-500/20">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-300">Resource Type</Label>
              <Select value={filterResourceType} onValueChange={setFilterResourceType}>
                <SelectTrigger className="bg-indigo-500/20 border-indigo-500/30 text-white hover:bg-indigo-500/30 focus:ring-indigo-500/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0b132f] border-indigo-500/30">
                  <SelectItem value="all" className="text-white hover:bg-indigo-500/20 focus:bg-indigo-500/20">All Types</SelectItem>
                  {uniqueResourceTypes.map(type => (
                    <SelectItem key={type} value={type} className="text-white hover:bg-indigo-500/20 focus:bg-indigo-500/20">
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-300">Date Range</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal bg-indigo-500/20 border-indigo-500/30 text-white hover:bg-indigo-500/30"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {startDate && endDate
                      ? `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d')}`
                      : 'All time'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-[#0b132f] border-indigo-500/30">
                  <CalendarComponent
                    mode="range"
                    selected={{ from: startDate, to: endDate }}
                    onSelect={(range) => {
                      setStartDate(range?.from);
                      setEndDate(range?.to);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <Card className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#161d45] via-[#0b132f] to-[#050915] shadow-[0_45px_90px_rgba(3,7,23,0.7)]">
          <CardHeader>
            <CardTitle>Audit Logs</CardTitle>
            <CardDescription>
              Showing {filteredLogs.length} of {logs.length} total entries
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                Loading audit logs...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No audit logs found matching your filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>IP Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {log.created_at
                            ? format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {log.user_id ? (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-mono text-xs">
                                {log.user_id.substring(0, 8)}...
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">System</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {log.action.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm font-medium">{log.resource_type}</div>
                            {log.resource_id && (
                              <div className="text-xs text-muted-foreground font-mono">
                                {log.resource_id.substring(0, 20)}...
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getSeverityColor(log.severity)}>
                            {getSeverityIcon(log.severity)}
                            <span className="ml-1 capitalize">{log.severity}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <div className="truncate" title={log.description}>
                            {log.description}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {log.ip_address || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
    </OwnerPortalLayout>
  );
};

export default AuditLog;


