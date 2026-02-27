import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
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
    console.error('[ErrorBoundary] Render-Fehler abgefangen:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
            <div className="text-6xl mb-4">😵</div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Etwas ist schiefgelaufen</h1>
            <p className="text-slate-500 text-sm mb-6">
              Ein unerwarteter Fehler ist aufgetreten. Bitte lade die Seite neu oder gehe zurück zum Dashboard.
            </p>
            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">
                  Technische Details
                </summary>
                <pre className="mt-2 text-xs text-red-600 bg-red-50 rounded p-3 overflow-auto max-h-40 whitespace-pre-wrap">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleReset}
              className="w-full py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
            >
              ↩ Zurück zum Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
