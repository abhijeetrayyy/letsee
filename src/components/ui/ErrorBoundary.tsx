"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
  message?: string;
  onRetry?: () => void;
  className?: string;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className={`flex flex-col items-center justify-center py-8 px-4 text-center rounded-2xl border border-red-500/20 bg-red-500/5 ${this.props.className}`}>
          <AlertTriangle className="w-8 h-8 text-red-400 mb-3" />
          <h3 className="text-sm font-semibold text-red-300 mb-1">
            {this.props.message || "Something went wrong"}
          </h3>
          <p className="text-xs text-red-400/70 mb-4 max-w-xs">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          {this.props.onRetry && (
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-medium hover:bg-red-500/20 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try again
            </button>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
