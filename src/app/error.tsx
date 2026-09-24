'use client';
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="empty">
      <h2>页面遇到了一点问题</h2>
      <p>请重新加载后再试。</p>
      <button className="button primary" onClick={reset}>
        重新加载
      </button>
    </div>
  );
}
