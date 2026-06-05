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
      // ErrorBoundary mounts above the language context, so detect once from
      // navigator.language. Falls back to RU since the app default is Russian.
      const isEn = typeof navigator !== 'undefined' && navigator.language?.startsWith('en');
      const title = isEn ? 'Something went wrong' : 'Что-то пошло не так';
      const reload = isEn ? 'Reload' : 'Перезагрузить';
      return (
        <div className="min-h-screen p-6 flex items-center justify-center">
          <div className="card aurora max-w-md w-full text-center space-y-4 p-6">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-warning"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/></svg>
            <div className="text-lg font-bold tracking-tight">{title}</div>
            <div className="text-xs text-muted break-words">
              {this.state.error instanceof Error ? this.state.error.message : String(this.state.error)}
            </div>
            <button onClick={this.reset} className="btn-primary">{reload}</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
