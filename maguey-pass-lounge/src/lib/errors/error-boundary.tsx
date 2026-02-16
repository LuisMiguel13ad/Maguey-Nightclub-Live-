/**
 * React Error Boundary
 * 
 * Catches render errors and reports them to ErrorTracker.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { errorTracker } from './error-tracker';
import { ErrorSeverity } from './error-types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, errorInfo: ErrorInfo) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'page' | 'component';
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Report error to ErrorTracker
    errorTracker.captureError(error, {
      severity: ErrorSeverity.HIGH,
      context: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
      },
      tags: {
        errorBoundary: 'true',
      },
    });

    this.setState({
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback(this.state.error, this.state.errorInfo!);
        }
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-red-500" />
                <CardTitle>Something went wrong</CardTitle>
              </div>
              <CardDescription>
                {this.props.level === 'component'
                  ? 'This component encountered an error'
                  : 'An unexpected error occurred'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {import.meta.env.DEV && (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="font-semibold mb-2">Error Details (Development Only):</div>
                  <div className="text-sm font-mono text-red-600 mb-2">
                    {this.state.error.message}
                  </div>
                  {this.state.error.stack && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground mb-2">
                        Stack Trace
                      </summary>
                      <pre className="whitespace-pre-wrap text-xs bg-background p-2 rounded overflow-auto max-h-64">
                        {this.state.error.stack}
                      </pre>
                    </details>
                  )}
                  {this.state.errorInfo?.componentStack && (
                    <details className="text-xs mt-2">
                      <summary className="cursor-pointer text-muted-foreground mb-2">
                        Component Stack
                      </summary>
                      <pre className="whitespace-pre-wrap text-xs bg-background p-2 rounded overflow-auto max-h-64">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={this.handleReset} variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button onClick={this.handleReload} variant="outline">
                  Reload Page
                </Button>
                <Button onClick={this.handleGoHome} variant="default">
                  <Home className="w-4 h-4 mr-2" />
                  Go Home
                </Button>
              </div>

              {!import.meta.env.DEV && (
                <div className="text-sm text-muted-foreground">
                  The error has been reported. If this problem persists, please contact support.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC for wrapping components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode | ((error: Error, errorInfo: ErrorInfo) => ReactNode)
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback} level="component">
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
}

/**
 * Hook for manually reporting errors
 */
export function useErrorHandler() {
  return {
    reportError: (error: Error, context?: Record<string, unknown>) => {
      errorTracker.captureError(error, {
        context: context as any,
      });
    },
  };
}
