import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logSafeError } from '../../utils/safeConsole';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logSafeError('[Involv] Unhandled interface error', error, {
      componentStack: info.componentStack,
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-blue-900 text-lg font-bold text-white">
            i
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            Involv could not load this page
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Refresh the page to try again. If you had just submitted something,
            check its status before trying a second time. If the problem
            continues, contact the school team.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800"
          >
            Refresh page
          </button>
        </section>
      </main>
    );
  }
}