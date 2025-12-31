/**
 * Circuit Breaker Dashboard Component
 * 
 * Displays real-time status of all circuit breakers in the system.
 * Shows current state, failure counts, and recent state changes.
 * Allows manual control of circuit breakers for maintenance/recovery.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  RefreshCw, 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  ShieldOff,
  Activity,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
  Mail,
  CreditCard,
  Database,
  Power,
  PowerOff,
  History,
} from 'lucide-react';
import { 
  getAllCircuitBreakerStats, 
  getStateChangeHistory,
  stripeCircuit,
  emailCircuit,
  supabaseCircuit,
  type CircuitState,
  type CircuitStateChangeEvent,
  onCircuitStateChange,
} from '@/lib/circuit-breaker';
import { getEmailQueueStats, type EmailQueueStats } from '@/lib/email-queue';

// ============================================
// TYPES
// ============================================

interface CircuitStats {
  name: string;
  state: CircuitState;
  failures: number;
  lastFailureTime: number;
  timeUntilRetry: number;
  halfOpenSuccesses: number;
  halfOpenFailures: number;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getCircuitIcon(name: string) {
  switch (name) {
    case 'stripe':
      return <CreditCard className="w-5 h-5" />;
    case 'email':
      return <Mail className="w-5 h-5" />;
    case 'supabase':
      return <Database className="w-5 h-5" />;
    default:
      return <Zap className="w-5 h-5" />;
  }
}

function getStateColor(state: CircuitState): string {
  switch (state) {
    case 'CLOSED':
      return 'text-green-500';
    case 'OPEN':
      return 'text-red-500';
    case 'HALF_OPEN':
      return 'text-yellow-500';
    default:
      return 'text-gray-500';
  }
}

function getStateBadgeVariant(state: CircuitState): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (state) {
    case 'CLOSED':
      return 'default';
    case 'OPEN':
      return 'destructive';
    case 'HALF_OPEN':
      return 'secondary';
    default:
      return 'outline';
  }
}

function getStateIcon(state: CircuitState) {
  switch (state) {
    case 'CLOSED':
      return <ShieldCheck className="w-5 h-5 text-green-500" />;
    case 'OPEN':
      return <ShieldOff className="w-5 h-5 text-red-500" />;
    case 'HALF_OPEN':
      return <ShieldAlert className="w-5 h-5 text-yellow-500" />;
    default:
      return <Shield className="w-5 h-5 text-gray-500" />;
  }
}

function formatTimeAgo(timestamp: number): string {
  if (!timestamp) return 'Never';
  
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return 'Ready';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function getCircuitDescription(name: string): string {
  switch (name) {
    case 'stripe':
      return 'Payment processing (Stripe API)';
    case 'email':
      return 'Email delivery (Resend API)';
    case 'supabase':
      return 'Database operations (Supabase)';
    default:
      return 'External service';
  }
}

// ============================================
// CIRCUIT CARD COMPONENT
// ============================================

interface CircuitCardProps {
  circuit: CircuitStats;
  onForceOpen: () => void;
  onForceClose: () => void;
}

function CircuitCard({ circuit, onForceOpen, onForceClose }: CircuitCardProps) {
  const healthPercentage = circuit.state === 'CLOSED' 
    ? 100 
    : circuit.state === 'HALF_OPEN' 
      ? 50 
      : 0;
  
  return (
    <Card className={`border-l-4 ${
      circuit.state === 'CLOSED' ? 'border-l-green-500' :
      circuit.state === 'OPEN' ? 'border-l-red-500' :
      'border-l-yellow-500'
    }`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getCircuitIcon(circuit.name)}
            <CardTitle className="capitalize">{circuit.name}</CardTitle>
          </div>
          <Badge variant={getStateBadgeVariant(circuit.state)}>
            {circuit.state}
          </Badge>
        </div>
        <CardDescription>{getCircuitDescription(circuit.name)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Health Bar */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Health</span>
            <span className={getStateColor(circuit.state)}>
              {healthPercentage}%
            </span>
          </div>
          <Progress value={healthPercentage} className="h-2" />
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Failures</p>
            <p className="font-semibold text-lg">{circuit.failures}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Last Failure</p>
            <p className="font-semibold">{formatTimeAgo(circuit.lastFailureTime)}</p>
          </div>
          {circuit.state === 'OPEN' && (
            <>
              <div>
                <p className="text-muted-foreground">Retry In</p>
                <p className="font-semibold text-yellow-600">
                  {formatDuration(circuit.timeUntilRetry)}
                </p>
              </div>
            </>
          )}
          {circuit.state === 'HALF_OPEN' && (
            <>
              <div>
                <p className="text-muted-foreground">Test Successes</p>
                <p className="font-semibold text-green-600">{circuit.halfOpenSuccesses}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Test Failures</p>
                <p className="font-semibold text-red-600">{circuit.halfOpenFailures}</p>
              </div>
            </>
          )}
        </div>
        
        <Separator />
        
        {/* Action Buttons */}
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                disabled={circuit.state === 'OPEN'}
              >
                <PowerOff className="w-4 h-4 mr-1" />
                Force Open
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Force Open Circuit?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will immediately open the {circuit.name} circuit breaker, 
                  blocking all requests to this service. Use this for maintenance 
                  or when you know the service is down.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onForceOpen}>
                  Force Open
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                disabled={circuit.state === 'CLOSED'}
              >
                <Power className="w-4 h-4 mr-1" />
                Force Close
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Force Close Circuit?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will immediately close the {circuit.name} circuit breaker, 
                  allowing requests to pass through. Only do this if you're sure 
                  the service has recovered.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onForceClose}>
                  Force Close
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// EMAIL QUEUE CARD COMPONENT
// ============================================

function EmailQueueCard({ stats }: { stats: EmailQueueStats }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Email Queue
        </CardTitle>
        <CardDescription>
          Emails queued for retry when circuit recovers
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Queued</p>
            <p className="font-semibold text-2xl text-yellow-600">{stats.queuedCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Total Sent</p>
            <p className="font-semibold text-2xl text-green-600">{stats.totalSent}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Total Failed</p>
            <p className="font-semibold text-red-600">{stats.totalFailed}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Processing</p>
            <p className="font-semibold">
              {stats.isProcessing ? (
                <span className="text-blue-600">Yes</span>
              ) : (
                <span className="text-gray-500">No</span>
              )}
            </p>
          </div>
        </div>
        
        {stats.oldestEmail && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Oldest queued email: {formatTimeAgo(stats.oldestEmail.getTime())}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// STATE CHANGE HISTORY COMPONENT
// ============================================

function StateChangeHistory({ events }: { events: CircuitStateChangeEvent[] }) {
  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            State Change History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            No state changes recorded yet
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5" />
          State Change History
        </CardTitle>
        <CardDescription>Recent circuit breaker state transitions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {events.slice().reverse().map((event, index) => (
            <div 
              key={`${event.circuitName}-${event.timestamp.getTime()}-${index}`}
              className="flex items-start gap-3 p-2 rounded-lg bg-muted/50"
            >
              <div className="mt-1">
                {getStateIcon(event.newState)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium capitalize">{event.circuitName}</span>
                  <Badge variant="outline" className="text-xs">
                    {event.previousState} → {event.newState}
                  </Badge>
                </div>
                {event.reason && (
                  <p className="text-sm text-muted-foreground mt-1 truncate">
                    {event.reason}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {event.timestamp.toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// SUMMARY CARD COMPONENT
// ============================================

function SummaryCard({ circuits }: { circuits: CircuitStats[] }) {
  const closedCount = circuits.filter(c => c.state === 'CLOSED').length;
  const openCount = circuits.filter(c => c.state === 'OPEN').length;
  const halfOpenCount = circuits.filter(c => c.state === 'HALF_OPEN').length;
  
  const overallStatus = openCount > 0 ? 'degraded' : halfOpenCount > 0 ? 'recovering' : 'healthy';
  
  return (
    <Card className={`${
      overallStatus === 'healthy' ? 'bg-green-50 dark:bg-green-950' :
      overallStatus === 'degraded' ? 'bg-red-50 dark:bg-red-950' :
      'bg-yellow-50 dark:bg-yellow-950'
    }`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {overallStatus === 'healthy' ? (
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            ) : overallStatus === 'degraded' ? (
              <XCircle className="w-8 h-8 text-red-500" />
            ) : (
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
            )}
            <div>
              <h3 className="text-lg font-semibold capitalize">
                System {overallStatus === 'healthy' ? 'Healthy' : 
                        overallStatus === 'degraded' ? 'Degraded' : 'Recovering'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {closedCount} healthy, {halfOpenCount} recovering, {openCount} unavailable
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant="default" className="bg-green-500">
              {closedCount} OK
            </Badge>
            {halfOpenCount > 0 && (
              <Badge variant="secondary" className="bg-yellow-500 text-white">
                {halfOpenCount} Testing
              </Badge>
            )}
            {openCount > 0 && (
              <Badge variant="destructive">
                {openCount} Down
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================

export function CircuitBreakerDashboard() {
  const [circuits, setCircuits] = useState<CircuitStats[]>([]);
  const [stateHistory, setStateHistory] = useState<CircuitStateChangeEvent[]>([]);
  const [emailQueueStats, setEmailQueueStats] = useState<EmailQueueStats>({
    queuedCount: 0,
    totalQueued: 0,
    totalSent: 0,
    totalFailed: 0,
    isProcessing: false,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const refreshData = useCallback(() => {
    setIsRefreshing(true);
    try {
      setCircuits(getAllCircuitBreakerStats());
      setStateHistory(getStateChangeHistory(20));
      setEmailQueueStats(getEmailQueueStats());
      setLastUpdated(new Date());
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Initial load and auto-refresh
  useEffect(() => {
    refreshData();
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(refreshData, 5000);
    
    // Subscribe to state changes for immediate updates
    const unsubscribe = onCircuitStateChange(() => {
      refreshData();
    });
    
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [refreshData]);

  const handleForceOpen = (circuitName: string) => {
    switch (circuitName) {
      case 'stripe':
        stripeCircuit.forceOpen();
        break;
      case 'email':
        emailCircuit.forceOpen();
        break;
      case 'supabase':
        supabaseCircuit.forceOpen();
        break;
    }
    refreshData();
  };

  const handleForceClose = (circuitName: string) => {
    switch (circuitName) {
      case 'stripe':
        stripeCircuit.forceClose();
        break;
      case 'email':
        emailCircuit.forceClose();
        break;
      case 'supabase':
        supabaseCircuit.forceClose();
        break;
    }
    refreshData();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Circuit Breakers
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={refreshData}
          disabled={isRefreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary */}
      <SummaryCard circuits={circuits} />

      {/* Circuit Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {circuits.map((circuit) => (
          <CircuitCard
            key={circuit.name}
            circuit={circuit}
            onForceOpen={() => handleForceOpen(circuit.name)}
            onForceClose={() => handleForceClose(circuit.name)}
          />
        ))}
      </div>

      {/* Secondary Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Email Queue Stats */}
        <EmailQueueCard stats={emailQueueStats} />
        
        {/* State Change History */}
        <StateChangeHistory events={stateHistory} />
      </div>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Circuit Breaker States</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-green-500" />
              <span><strong>CLOSED</strong> - Normal operation, requests pass through</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldOff className="w-4 h-4 text-red-500" />
              <span><strong>OPEN</strong> - Service down, requests fail fast</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-yellow-500" />
              <span><strong>HALF_OPEN</strong> - Testing if service has recovered</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default CircuitBreakerDashboard;
