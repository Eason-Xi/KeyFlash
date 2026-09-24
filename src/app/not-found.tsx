import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="empty">
      <span className="eyebrow">404</span>
      <h1>这里还没有内容</h1>
      <p>这个页面可能已经移动，回到社区继续探索吧。</p>
      <Link className="button primary" href="/">
        返回首页
      </Link>
    </div>
  );
}
