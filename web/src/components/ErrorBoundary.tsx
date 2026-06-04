import { Component, type ReactNode } from 'react';
import { reportError } from '../lib/errors';

interface Props {
  fallback?: (err: unknown, reset: () => void) => ReactNode;
  children: ReactNode;
}

interface State {
  error: unknown | null;
}

/**
 * Top-level error boundary. Catches render-time errors anywhere in the tree
 * below it, ships them to the reporter, and shows a fallback so the UI
 * doesn't go white.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string }): void {
    reportError(error, { type: 'react', componentStack: info.componentStack });
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
      return (
        <div className="min-h-screen p-6 flex items-center justify-center">
          <div className="card aurora max-w-md w-full text-center space-y-4 p-6">
            <div className="text-3xl">😵</div>
            <div className="text-lg font-bold tracking-tight">Что-то пошло не так</div>
            <div className="text-xs text-muted break-words">
              {this.state.error instanceof Error ? this.state.error.message : String(this.state.error)}
            </div>
            <button onClick={this.reset} className="btn-primary">Перезагрузить</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
