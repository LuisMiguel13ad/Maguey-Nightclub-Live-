/**
 * Circuit Breaker Dashboard Component
 *
 * Displays real-time status of all circuit breakers in the system.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  CreditCard,
  Database,
  History,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import {
  getAllCircuitBreakerStats,
  getStateChangeHistory,
  stripeCircuit,
  supabaseCircuit,
  type CircuitState,
  type CircuitStateChangeEvent,
  onCircuitStateChange,
} from '@/lib/circuit-breaker';

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
    case 'supabase':
      return <Database className="w-5 h-5" />;
    default:
      return <Shield className="w-5 h-5" />;
  }
}

function getStateColor(state: CircuitState): string {
  switch (state) {
    case 'CLOSED':
      return 'text-green-400';
    case 'OPEN':
      return 'text-red-400';
    case 'HALF_OPEN':
      return 'text-yellow-400';
    default:
      return 'text-slate-400';
  }
}

function getStateIcon(state: CircuitState) {
  switch (state) {
    case 'CLOSED':
      return <ShieldCheck className="w-5 h-5 text-green-400" />;
    case 'OPEN':
      return <ShieldOff className="w-5 h-5 text-red-400" />;
    case 'HALF_OPEN':
      return <ShieldAlert className="w-5 h-5 text-yellow-400" />;
    default:
      return <Shield className="w-5 h-5 text-slate-400" />;
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
    <Card className={`border-l-4 bg-white/5 border-white/10 ${
      circuit.state === 'CLOSED' ? 'border-l-green-500' :
      circuit.state === 'OPEN' ? 'border-l-red-500' :
      'border-l-yellow-500'
    }`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getCircuitIcon(circuit.name)}
            <CardTitle className="capitalize text-white">{circuit.name}</CardTitle>
          </div>
          <Badge className={
            circuit.state === 'CLOSED' ? 'bg-green-500/20 text-green-400' :
            circuit.state === 'OPEN' ? 'bg-red-500/20 text-red-400' :
            'bg-yellow-500/20 text-yellow-400'
          }>
            {circuit.state}
          </Badge>
        </div>
        <CardDescription className="text-slate-400">{getCircuitDescription(circuit.name)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Health Bar */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-400">Health</span>
            <span className={getStateColor(circuit.state)}>
              {healthPercentage}%
            </span>
          </div>
          <Progress value={healthPercentage} className="h-2" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-400">Failures</p>
            <p className="font-semibold text-lg text-white">{circuit.failures}</p>
          </div>
          <div>
            <p className="text-slate-400">Last Failure</p>
            <p className="font-semibold text-white">{formatTimeAgo(circuit.lastFailureTime)}</p>
          </div>
          {circuit.state === 'OPEN' && (
            <div>
              <p className="text-slate-400">Retry In</p>
              <p className="font-semibold text-yellow-400">
                {formatDuration(circuit.timeUntilRetry)}
              </p>
            </div>
          )}
          {circuit.state === 'HALF_OPEN' && (
            <>
              <div>
                <p className="text-slate-400">Test Successes</p>
                <p className="font-semibold text-green-400">{circuit.halfOpenSuccesses}</p>
              </div>
              <div>
                <p className="text-slate-400">Test Failures</p>
                <p className="font-semibold text-red-400">{circuit.halfOpenFailures}</p>
              </div>
            </>
          )}
        </div>

        <Separator className="bg-white/10" />

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 border-white/10 bg-white/5 text-white hover:bg-white/10"
            onClick={onForceOpen}
            disabled={circuit.state === 'OPEN'}
          >
            Force Open
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 border-white/10 bg-white/5 text-white hover:bg-white/10"
            onClick={onForceClose}
            disabled={circuit.state === 'CLOSED'}
          >
            Force Close
          </Button>
        </div>
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
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <History className="w-5 h-5" />
            State Change History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-400 text-center py-4">
            No state changes recorded yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <History className="w-5 h-5" />
          State Change History
        </CardTitle>
        <CardDescription className="text-slate-400">Recent circuit breaker state transitions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {events.slice().reverse().map((event, index) => (
            <div
              key={`${event.circuitName}-${event.timestamp.getTime()}-${index}`}
              className="flex items-start gap-3 p-2 rounded-lg bg-white/5"
            >
              <div className="mt-1">
                {getStateIcon(event.newState)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium capitalize text-white">{event.circuitName}</span>
                  <Badge variant="outline" className="text-xs border-white/10 text-slate-300">
                    {event.previousState} → {event.newState}
                  </Badge>
                </div>
                {event.reason && (
                  <p className="text-sm text-slate-400 mt-1 truncate">
                    {event.reason}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-1">
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
    <Card className={`bg-white/5 border-white/10 ${
      overallStatus === 'healthy' ? 'border-l-4 border-l-green-500' :
      overallStatus === 'degraded' ? 'border-l-4 border-l-red-500' :
      'border-l-4 border-l-yellow-500'
    }`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {overallStatus === 'healthy' ? (
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            ) : overallStatus === 'degraded' ? (
              <XCircle className="w-8 h-8 text-red-400" />
            ) : (
              <AlertTriangle className="w-8 h-8 text-yellow-400" />
            )}
            <div>
              <h3 className="text-lg font-semibold capitalize text-white">
                System {overallStatus === 'healthy' ? 'Healthy' :
                        overallStatus === 'degraded' ? 'Degraded' : 'Recovering'}
              </h3>
              <p className="text-sm text-slate-400">
                {closedCount} healthy, {halfOpenCount} recovering, {openCount} unavailable
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge className="bg-green-500/20 text-green-400">
              {closedCount} OK
            </Badge>
            {halfOpenCount > 0 && (
              <Badge className="bg-yellow-500/20 text-yellow-400">
                {halfOpenCount} Testing
              </Badge>
            )}
            {openCount > 0 && (
              <Badge className="bg-red-500/20 text-red-400">
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const refreshData = useCallback(() => {
    setIsRefreshing(true);
    try {
      setCircuits(getAllCircuitBreakerStats());
      setStateHistory(getStateChangeHistory(20));
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
      case 'supabase':
        supabaseCircuit.forceClose();
        break;
    }
    refreshData();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-white">
            <Shield className="w-8 h-8" />
            Circuit Breakers
          </h1>
          <p className="text-slate-400">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={refreshData}
          disabled={isRefreshing}
          className="border-white/10 bg-white/5 text-white hover:bg-white/10"
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

      {/* State Change History */}
      <StateChangeHistory events={stateHistory} />

      {/* Legend */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-sm text-white">Circuit Breaker States</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-green-400" />
              <span><strong>CLOSED</strong> - Normal operation</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <ShieldOff className="w-4 h-4 text-red-400" />
              <span><strong>OPEN</strong> - Service down</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <ShieldAlert className="w-4 h-4 text-yellow-400" />
              <span><strong>HALF_OPEN</strong> - Testing recovery</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default CircuitBreakerDashboard;
