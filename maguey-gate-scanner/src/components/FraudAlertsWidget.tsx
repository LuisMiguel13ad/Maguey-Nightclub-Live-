/**
 * Fraud Alerts Widget Component
 * 
 * Displays high-risk fraud alerts on the dashboard
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Shield, X, CheckCircle2 } from 'lucide-react';
import { getHighRiskAlerts } from '@/lib/fraud-detection-service';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { isSupabaseConfigured } from '@/integrations/supabase/client';

interface FraudAlert {
  id: string;
  risk_score: number;
  fraud_indicators: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    score: number;
  }>;
  created_at: string;
  ticket_id: string;
  scan_log_id: string;
  tickets?: {
    ticket_id: string;
    event_name: string;
  };
  scan_logs?: {
    scanned_at: string;
    scan_result: string;
  };
}

export const FraudAlertsWidget = () => {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    loadAlerts();
    // Refresh alerts every 30 seconds
    const interval = setInterval(loadAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadAlerts = async () => {
    try {
      const data = await getHighRiskAlerts(80, 10);
      setAlerts(data as FraudAlert[]);
    } catch (error: any) {
      console.error('[fraud-alerts] Error loading alerts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskColor = (score: number): string => {
    if (score >= 90) return 'text-red-600 bg-red-500/10 border-red-500/20';
    if (score >= 80) return 'text-orange-600 bg-orange-500/10 border-orange-500/20';
    return 'text-yellow-600 bg-yellow-500/10 border-yellow-500/20';
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
    <Card className="border-red-500/20 bg-gradient-to-br from-red-950/50 via-slate-950 to-slate-950">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-500" />
            <CardTitle className="text-lg font-semibold">Fraud Alerts</CardTitle>
          </div>
          <Badge variant="destructive" className="text-xs">
            {alerts.length} Active
          </Badge>
        </div>
        <CardDescription>
          High-risk scans requiring investigation
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading alerts...
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <p className="text-muted-foreground">No high-risk alerts</p>
            <p className="text-sm text-muted-foreground mt-1">All scans appear normal</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border ${getRiskColor(alert.risk_score)} cursor-pointer hover:opacity-80 transition-opacity`}
                onClick={() => navigate(`/fraud-investigation?alert=${alert.id}`)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-semibold text-sm">
                      Risk Score: {alert.risk_score}
                    </span>
                  </div>
                  <Badge className={`text-xs ${getSeverityColor(alert.fraud_indicators[0]?.severity || 'low')}`}>
                    {alert.fraud_indicators[0]?.severity.toUpperCase() || 'LOW'}
                  </Badge>
                </div>
                <div className="text-xs space-y-1">
                  <p className="font-medium">
                    Ticket: {alert.tickets?.ticket_id || alert.ticket_id?.substring(0, 8) || 'Unknown'}
                  </p>
                  <p className="text-muted-foreground">
                    {alert.fraud_indicators.length} indicator{alert.fraud_indicators.length !== 1 ? 's' : ''} detected
                  </p>
                  <p className="text-muted-foreground">
                    {new Date(alert.created_at).toLocaleString()}
                  </p>
                </div>
                {alert.fraud_indicators.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-current/20">
                    <p className="text-xs font-medium mb-1">Top Indicator:</p>
                    <p className="text-xs opacity-90">
                      {alert.fraud_indicators[0].description}
                    </p>
                  </div>
                )}
              </div>
            ))}
            {alerts.length > 5 && (
              <Button
                variant="outline"
                className="w-full mt-2"
                onClick={() => navigate('/fraud-investigation')}
              >
                View All {alerts.length} Alerts
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

