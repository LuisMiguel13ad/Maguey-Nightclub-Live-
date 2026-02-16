/**
 * Error Dashboard Component
 * 
 * Displays error tracking dashboard with overview, error groups, and recent errors.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  RefreshCw, 
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
  Activity,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ErrorStorage, ErrorGroup, ErrorStats } from '@/lib/errors/error-storage';
import { ErrorSeverity, ErrorCategory } from '@/lib/errors/error-types';
import { ErrorDetails } from './ErrorDetails';

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString();
}

function getSeverityColor(severity: ErrorSeverity): string {
  switch (severity) {
    case ErrorSeverity.CRITICAL: return 'bg-red-600 text-white';
    case ErrorSeverity.HIGH: return 'bg-orange-500 text-white';
    case ErrorSeverity.MEDIUM: return 'bg-yellow-500 text-white';
    case ErrorSeverity.LOW: return 'bg-blue-500 text-white';
    default: return 'bg-gray-500 text-white';
  }
}

function getCategoryColor(category: ErrorCategory): string {
  const colors: Record<ErrorCategory, string> = {
    [ErrorCategory.VALIDATION]: 'bg-blue-100 text-blue-800',
    [ErrorCategory.PAYMENT]: 'bg-red-100 text-red-800',
    [ErrorCategory.INVENTORY]: 'bg-orange-100 text-orange-800',
    [ErrorCategory.DATABASE]: 'bg-purple-100 text-purple-800',
    [ErrorCategory.NETWORK]: 'bg-yellow-100 text-yellow-800',
    [ErrorCategory.AUTHENTICATION]: 'bg-pink-100 text-pink-800',
    [ErrorCategory.AUTHORIZATION]: 'bg-indigo-100 text-indigo-800',
    [ErrorCategory.EXTERNAL_SERVICE]: 'bg-cyan-100 text-cyan-800',
    [ErrorCategory.UNKNOWN]: 'bg-gray-100 text-gray-800',
  };
  return colors[category] || colors[ErrorCategory.UNKNOWN];
}

// ============================================
// COMPONENTS
// ============================================

interface ErrorGroupCardProps {
  group: ErrorGroup;
  onSelect: (fingerprint: string) => void;
}

function ErrorGroupCard({ group, onSelect }: ErrorGroupCardProps) {
  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-all"
      onClick={() => onSelect(group.fingerprint)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge className={getSeverityColor(group.severity as ErrorSeverity)}>
                {group.severity}
              </Badge>
              <Badge variant="outline" className={getCategoryColor(group.category as ErrorCategory)}>
                {group.category}
              </Badge>
              <Badge variant={group.status === 'open' ? 'destructive' : 'outline'}>
                {group.status}
              </Badge>
            </div>
            <div className="font-medium mb-2">{group.message}</div>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>Service: {group.service_name}</div>
              <div>First seen: {formatTimestamp(group.first_seen)}</div>
              <div>Last seen: {formatTimestamp(group.last_seen)}</div>
            </div>
          </div>
          <div className="text-right ml-4">
            <div className="text-2xl font-bold">{group.occurrence_count}</div>
            <div className="text-xs text-muted-foreground">occurrences</div>
            <div className="text-sm font-semibold mt-2">{group.affected_users}</div>
            <div className="text-xs text-muted-foreground">users</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ErrorDashboard() {
  const [selectedFingerprint, setSelectedFingerprint] = useState<string | null>(null);
  const [errorGroups, setErrorGroups] = useState<ErrorGroup[]>([]);
  const [errorStats, setErrorStats] = useState<ErrorStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const storage = new ErrorStorage(supabase);

  // Fetch error groups
  const fetchErrorGroups = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const groups = await storage.getErrorGroups({
        status: statusFilter === 'all' ? undefined : statusFilter as 'open' | 'resolved' | 'ignored',
        severity: severityFilter === 'all' ? undefined : severityFilter as ErrorSeverity,
        service: serviceFilter === 'all' ? undefined : serviceFilter,
        limit: 100,
      });

      // Client-side search
      let filtered = groups;
      if (searchQuery) {
        const queryLower = searchQuery.toLowerCase();
        filtered = filtered.filter(g =>
          g.message.toLowerCase().includes(queryLower) ||
          g.fingerprint.toLowerCase().includes(queryLower)
        );
      }

      setErrorGroups(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch error groups');
      console.error('Error fetching error groups:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter, categoryFilter, serviceFilter, searchQuery]);

  // Fetch error stats
  const fetchErrorStats = useCallback(async () => {
    try {
      const stats = await storage.getErrorStats(24);
      setErrorStats(stats);
    } catch (err) {
      console.error('Error fetching error stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchErrorGroups();
    fetchErrorStats();
  }, [fetchErrorGroups, fetchErrorStats]);

  // Get unique services and categories
  const uniqueServices = Array.from(new Set(errorGroups.map(g => g.service_name))).sort();
  const uniqueCategories = Array.from(new Set(errorGroups.map(g => g.category))).sort();

  // Calculate summary stats
  const summary = {
    totalErrors: errorGroups.reduce((sum, g) => sum + g.occurrence_count, 0),
    openErrors: errorGroups.filter(g => g.status === 'open').length,
    criticalErrors: errorGroups.filter(g => g.severity === ErrorSeverity.CRITICAL).length,
    affectedUsers: errorGroups.reduce((sum, g) => sum + g.affected_users, 0),
  };

  if (selectedFingerprint) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => setSelectedFingerprint(null)}>
          ← Back to Dashboard
        </Button>
        <ErrorDetails fingerprint={selectedFingerprint} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Error Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and track errors across the ticketing system
          </p>
        </div>
        <Button onClick={fetchErrorGroups} disabled={loading} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalErrors}</div>
            <div className="text-xs text-muted-foreground">All time</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Open Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{summary.openErrors}</div>
            <div className="text-xs text-muted-foreground">Requires attention</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary.criticalErrors}</div>
            <div className="text-xs text-muted-foreground">Immediate action</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Affected Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.affectedUsers}</div>
            <div className="text-xs text-muted-foreground">Unique users</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search errors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="ignored">Ignored</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value={ErrorSeverity.CRITICAL}>Critical</SelectItem>
                <SelectItem value={ErrorSeverity.HIGH}>High</SelectItem>
                <SelectItem value={ErrorSeverity.MEDIUM}>Medium</SelectItem>
                <SelectItem value={ErrorSeverity.LOW}>Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {uniqueCategories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {uniqueServices.map(service => (
                  <SelectItem key={service} value={service}>{service}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-300">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs defaultValue="groups" className="space-y-4">
        <TabsList>
          <TabsTrigger value="groups">Error Groups</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="groups" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Error Groups</CardTitle>
              <CardDescription>
                {errorGroups.length} error group{errorGroups.length !== 1 ? 's' : ''} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="w-8 h-8 mx-auto mb-2 animate-pulse" />
                  Loading errors...
                </div>
              ) : errorGroups.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No errors found
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {errorGroups.map(group => (
                    <ErrorGroupCard
                      key={group.fingerprint}
                      group={group}
                      onSelect={setSelectedFingerprint}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Error Statistics (Last 24 Hours)</CardTitle>
            </CardHeader>
            <CardContent>
              {errorStats.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No statistics available
                </div>
              ) : (
                <div className="space-y-4">
                  {errorStats.map((stat, idx) => (
                    <div key={idx} className="p-4 border rounded">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-semibold">{new Date(stat.hour).toLocaleString()}</div>
                          <div className="text-sm text-muted-foreground">
                            {stat.service_name} • {stat.category} • {stat.severity}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">{stat.error_count}</div>
                          <div className="text-xs text-muted-foreground">errors</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <Users className="w-4 h-4 inline mr-1" />
                          {stat.affected_users} users
                        </div>
                        <div>
                          <Activity className="w-4 h-4 inline mr-1" />
                          {stat.unique_errors} unique
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
