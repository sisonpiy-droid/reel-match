export default function Loading({ title, subtitle }) {
  return (
    <div className="loading-screen">
      <div className="spinner" aria-hidden="true" />
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}
