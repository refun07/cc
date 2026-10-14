import { Component } from "react";

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Application render failed", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="grid min-h-dvh place-items-center bg-slate-50 px-4">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg">
          <h1 className="text-xl font-bold text-slate-900">This page could not load</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Please retry. Your booking details have not been submitted.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Reload page
          </button>
        </section>
      </main>
    );
  }
}
