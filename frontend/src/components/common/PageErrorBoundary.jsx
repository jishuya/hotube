import { Component } from 'react';

export default class PageErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('페이지 표시 실패:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-text-primary">
        <section className="w-full max-w-xs rounded-2xl bg-surface p-6 text-center shadow-xl" role="alert">
          <h1 className="text-lg font-semibold">화면을 불러오지 못했어요</h1>
          <p className="mt-3 text-sm leading-6 text-text-secondary">완료된 업로드는 다시 올리지 않아도 돼요. 화면을 다시 불러오거나 캘린더에서 확인해 주세요.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 min-h-11 w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-white hover:bg-primary/90">다시 불러오기</button>
          <a href="/calendar" className="mt-3 flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-background">캘린더로 이동</a>
        </section>
      </main>
    );
  }
}
