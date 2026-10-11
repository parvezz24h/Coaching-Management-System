// Re-mounts on every navigation. Each top-level block of the page (and of its
// loading skeleton) fades and rises in as it is inserted, with a short stagger.
export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
