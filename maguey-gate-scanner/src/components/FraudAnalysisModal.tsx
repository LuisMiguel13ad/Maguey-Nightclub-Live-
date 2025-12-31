/**
 * Fraud Analysis Modal Component
 * 
 * Displays detailed fraud analysis for a scan
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Shield, CheckCircle2, X, MapPin, Globe, Smartphone } from 'lucide-react';
import { getFraudDetectionLogs, confirmFraud, whitelistFraudDetection } from '@/lib/fraud-detection-service';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { isSupabaseConfigured } from '@/integrations/supabase/client';

interface FraudAnalysisModalProps {
  ticketId: string;
  scanLogId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FraudIndicator {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  score: number;
  metadata?: Record<string, any>;
}

interface FraudLog {
  id: string;
  risk_score: number;
  fraud_indicators: FraudIndicator[];
  ip_address: string;
  device_fingerprint: string;
  geolocation: any;
  created_at: string;
  is_confirmed_fraud: boolean;
  is_whitelisted: boolean;
  investigation_notes?: string;
}

export const FraudAnalysisModal = ({
  ticketId,
  scanLogId,
  open,
  onOpenChange,
}: FraudAnalysisModalProps) => {
  const [fraudLog, setFraudLog] = useState<FraudLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (open && ticketId) {
      loadFraudData();
    }
  }, [open, ticketId, scanLogId]);

  const loadFraudData = async () => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const logs = await getFraudDetectionLogs(ticketId, 1);
      
      if (logs.length > 0) {
        // If scanLogId provided, find matching log, otherwise use most recent
        const log = scanLogId
          ? logs.find((l: any) => l.scan_log_id === scanLogId) || logs[0]
          : logs[0];
        setFraudLog(log as FraudLog);
      } else {
        setFraudLog(null);
      }
    } catch (error: any) {
      console.error('[fraud-analysis] Error loading fraud data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load fraud analysis data',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmFraud = async () => {
    if (!fraudLog || !user?.id) return;

    setIsProcessing(true);
    try {
      await confirmFraud(fraudLog.id, user.id, 'Confirmed via fraud analysis modal');
      toast({
        title: 'Success',
        description: 'Fraud confirmed and logged',
      });
      await loadFraudData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to confirm fraud',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWhitelist = async () => {
    if (!fraudLog || !user?.id) return;

    setIsProcessing(true);
    try {
      await whitelistFraudDetection(fraudLog.id, user.id);
      toast({
        title: 'Success',
        description: 'Fraud detection whitelisted (marked as false positive)',
      });
      await loadFraudData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to whitelist',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return 'bg-red-600 text-white';
      case 'high':
        return 'bg-orange-600 text-white';
      case 'medium':
        return 'bg-yellow-600 text-white';
      default:
        return 'bg-blue-600 text-white';
    }
  };

  if (!isSupabaseConfigured()) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-500" />
            Fraud Analysis
          </DialogTitle>
          <DialogDescription>
            Detailed fraud detection analysis for ticket {ticketId?.substring(0, 8) || 'Unknown'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading fraud analysis...
          </div>
        ) : !fraudLog ? (
          <div className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <p className="text-muted-foreground">No fraud indicators detected</p>
            <p className="text-sm text-muted-foreground mt-1">This scan appears normal</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Risk Score Summary */}
            <div className="p-4 rounded-lg border bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">Risk Score</span>
                <Badge
                  className={`text-lg px-3 py-1 ${
                    fraudLog.risk_score >= 90
                      ? 'bg-red-600 text-white'
                      : fraudLog.risk_score >= 80
                      ? 'bg-orange-600 text-white'
                      : 'bg-yellow-600 text-white'
                  }`}
                >
                  {fraudLog.risk_score}/100
                </Badge>
              </div>
              <div className="w-full bg-muted h-2 rounded-full overflow-hidden mt-2">
                <div
                  className={`h-full transition-all ${
                    fraudLog.risk_score >= 90
                      ? 'bg-red-600'
                      : fraudLog.risk_score >= 80
                      ? 'bg-orange-600'
                      : 'bg-yellow-600'
                  }`}
                  style={{ width: `${fraudLog.risk_score}%` }}
                />
              </div>
            </div>

            {/* Status Badges */}
            {(fraudLog.is_confirmed_fraud || fraudLog.is_whitelisted) && (
              <div className="flex gap-2">
                {fraudLog.is_confirmed_fraud && (
                  <Badge variant="destructive" className="text-sm">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Confirmed Fraud
                  </Badge>
                )}
                {fraudLog.is_whitelisted && (
                  <Badge variant="outline" className="text-sm bg-green-500/10 text-green-600 border-green-500/30">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Whitelisted (False Positive)
                  </Badge>
                )}
              </div>
            )}

            {/* Fraud Indicators */}
            {fraudLog.fraud_indicators && fraudLog.fraud_indicators.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Fraud Indicators ({fraudLog.fraud_indicators.length})
                </h3>
                <div className="space-y-3">
                  {fraudLog.fraud_indicators.map((indicator, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={getSeverityColor(indicator.severity)}>
                              {indicator.severity.toUpperCase()}
                            </Badge>
                            <span className="font-medium text-sm">{indicator.type}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {indicator.description}
                          </p>
                        </div>
                        <Badge variant="outline" className="ml-2">
                          +{indicator.score}
                        </Badge>
                      </div>
                      {indicator.metadata && Object.keys(indicator.metadata).length > 0 && (
                        <div className="mt-2 pt-2 border-t text-xs">
                          <details className="cursor-pointer">
                            <summary className="text-muted-foreground hover:text-foreground">
                              View Details
                            </summary>
                            <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                              {JSON.stringify(indicator.metadata, null, 2)}
                            </pre>
                          </details>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Device & Network Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">IP Address</span>
                </div>
                <p className="text-sm font-mono">{fraudLog.ip_address || 'Unknown'}</p>
              </div>
              <div className="p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Device Fingerprint</span>
                </div>
                <p className="text-sm font-mono text-xs truncate">
                  {fraudLog.device_fingerprint || 'Unknown'}
                </p>
              </div>
            </div>

            {/* Geolocation */}
            {fraudLog.geolocation && (
              <div className="p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Geolocation</span>
                </div>
                <div className="text-sm space-y-1">
                  {fraudLog.geolocation.latitude && fraudLog.geolocation.longitude && (
                    <p>
                      Coordinates: {fraudLog.geolocation.latitude.toFixed(4)},{' '}
                      {fraudLog.geolocation.longitude.toFixed(4)}
                    </p>
                  )}
                  {fraudLog.geolocation.city && (
                    <p>City: {fraudLog.geolocation.city}</p>
                  )}
                  {fraudLog.geolocation.country && (
                    <p>Country: {fraudLog.geolocation.country}</p>
                  )}
                </div>
              </div>
            )}

            {/* Timestamp */}
            <div className="text-sm text-muted-foreground">
              Detected: {new Date(fraudLog.created_at).toLocaleString()}
            </div>

            {/* Actions */}
            {!fraudLog.is_confirmed_fraud && !fraudLog.is_whitelisted && (
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="destructive"
                  onClick={handleConfirmFraud}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Confirm Fraud
                </Button>
                <Button
                  variant="outline"
                  onClick={handleWhitelist}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Whitelist (False Positive)
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

