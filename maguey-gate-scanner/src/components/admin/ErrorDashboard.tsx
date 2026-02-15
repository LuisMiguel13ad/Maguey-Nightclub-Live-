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
import {
  RefreshCw,
  Search,
  Filter,
  AlertTriangle,
  Users,
  Activity,
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
    [ErrorCategory.VALIDATION]: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    [ErrorCategory.PAYMENT]: 'bg-red-500/20 text-red-400 border-red-500/50',
    [ErrorCategory.INVENTORY]: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
    [ErrorCategory.DATABASE]: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
    [ErrorCategory.NETWORK]: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    [ErrorCategory.AUTHENTICATION]: 'bg-pink-500/20 text-pink-400 border-pink-500/50',
    [ErrorCategory.AUTHORIZATION]: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50',
    [ErrorCategory.EXTERNAL_SERVICE]: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
    [ErrorCategory.UNKNOWN]: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
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
      className="cursor-pointer hover:shadow-md transition-all bg-white/5 border-white/10"
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
              <Badge variant={group.status === 'open' ? 'destructive' : 'outline'} className={group.status === 'open' ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'border-white/10 text-slate-300'}>
                {group.status}
              </Badge>
            </div>
            <div className="font-medium mb-2 text-white">{group.message}</div>
            <div className="text-sm text-slate-400 space-y-1">
              <div>Service: {group.service_name}</div>
              <div>First seen: {formatTimestamp(group.first_seen)}</div>
              <div>Last seen: {formatTimestamp(group.last_seen)}</div>
            </div>
          </div>
          <div className="text-right ml-4">
            <div className="text-2xl font-bold text-white">{group.occurrence_count}</div>
            <div className="text-xs text-slate-400">occurrences</div>
            <div className="text-sm font-semibold mt-2 text-white">{group.affected_users}</div>
            <div className="text-xs text-slate-400">users</div>
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
        <Button variant="outline" onClick={() => setSelectedFingerprint(null)} className="border-white/10 bg-white/5 text-white hover:bg-white/10">
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
          <h1 className="text-3xl font-bold text-white">Error Dashboard</h1>
          <p className="text-slate-400">
            Monitor and track errors across the ticketing system
          </p>
        </div>
        <Button onClick={fetchErrorGroups} disabled={loading} variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Total Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{summary.totalErrors}</div>
            <div className="text-xs text-slate-500">All time</div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Open Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-400">{summary.openErrors}</div>
            <div className="text-xs text-slate-500">Requires attention</div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Critical</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">{summary.criticalErrors}</div>
            <div className="text-xs text-slate-500">Immediate action</div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Affected Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{summary.affectedUsers}</div>
            <div className="text-xs text-slate-500">Unique users</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search errors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-400"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
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
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
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
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
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
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
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
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs defaultValue="groups" className="space-y-4">
        <TabsList className="bg-white/5 border-white/10">
          <TabsTrigger value="groups" className="data-[state=active]:bg-white/10">Error Groups</TabsTrigger>
          <TabsTrigger value="stats" className="data-[state=active]:bg-white/10">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="groups" className="space-y-4">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Error Groups</CardTitle>
              <CardDescription className="text-slate-400">
                {errorGroups.length} error group{errorGroups.length !== 1 ? 's' : ''} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-slate-400">
                  <Activity className="w-8 h-8 mx-auto mb-2 animate-pulse" />
                  Loading errors...
                </div>
              ) : errorGroups.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
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
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Error Statistics (Last 24 Hours)</CardTitle>
            </CardHeader>
            <CardContent>
              {errorStats.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  No statistics available
                </div>
              ) : (
                <div className="space-y-4">
                  {errorStats.map((stat, idx) => (
                    <div key={idx} className="p-4 border border-white/10 rounded bg-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-semibold text-white">{new Date(stat.hour).toLocaleString()}</div>
                          <div className="text-sm text-slate-400">
                            {stat.service_name} • {stat.category} • {stat.severity}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-white">{stat.error_count}</div>
                          <div className="text-xs text-slate-400">errors</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-400">
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
