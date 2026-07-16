"use client";

import { Component, type ReactNode } from "react";

interface WorldErrorBoundaryProps {
  children: ReactNode;
  onError?: () => void;
  renderFallback: (retry: () => void) => ReactNode;
  resetKey: number;
}

interface WorldErrorBoundaryState {
  failed: boolean;
}

export class WorldErrorBoundary extends Component<
  WorldErrorBoundaryProps,
  WorldErrorBoundaryState
> {
  state: WorldErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): WorldErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch() {
    // The fallback is intentionally local; no student data is sent to a logger.
    this.props.onError?.();
  }

  componentDidUpdate(previousProps: WorldErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  private retry = () => {
    this.setState({ failed: false });
  };

  render() {
    if (this.state.failed) return this.props.renderFallback(this.retry);
    return this.props.children;
  }
}
