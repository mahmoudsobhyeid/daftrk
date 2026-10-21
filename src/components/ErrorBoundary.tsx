import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen bg-secondary-50 dark:bg-secondary-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-danger-50 dark:bg-danger-900/20 text-danger-500">
                <AlertTriangle size={40} />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-black text-secondary-800 dark:text-secondary-100">Something went wrong</h1>
              <p className="mt-2 text-secondary-500 dark:text-secondary-400">
                An unexpected error occurred. Please try refreshing the page.
              </p>
              {this.state.error && (
                <pre className="mt-4 text-left text-xs text-danger-600 dark:text-danger-400 bg-danger-50 dark:bg-danger-900/20 rounded-xl p-3 overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              )}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
            >
              <RefreshCw size={15} /> Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
