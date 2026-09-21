import Logo from "./Logo.jsx";

export default function Loading({ title, subtitle }) {
  return (
    <div className="loading-screen">
      <Logo withWordmark={false} size={34} />
      <div className="spinner" aria-hidden="true" />
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}
