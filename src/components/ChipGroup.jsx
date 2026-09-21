// Reusable multi/single-select chip row. `anyValue` (if given) is a value
// that, when picked, deselects everything else, and gets deselected the
// instant something else is picked -- the "Any" exclusivity behavior the
// language and era fields both need.
export default function ChipGroup({ options, value, onChange, multi, anyValue }) {
  const selected = multi ? value : [value];

  function toggle(optValue) {
    if (!multi) return onChange(optValue);

    if (anyValue && optValue === anyValue) {
      onChange(selected.includes(anyValue) ? [] : [anyValue]);
      return;
    }
    const withoutAny = selected.filter((v) => v !== anyValue);
    const next = withoutAny.includes(optValue) ? withoutAny.filter((v) => v !== optValue) : [...withoutAny, optValue];
    onChange(next);
  }

  return (
    <div className="chip-group">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`chip${selected.includes(opt.value) ? " chip-selected" : ""}`}
          onClick={() => toggle(opt.value)}
          aria-pressed={selected.includes(opt.value)}
        >
          {opt.label}
          {opt.caveat ? <span className="chip-caveat">{opt.caveat}</span> : null}
        </button>
      ))}
    </div>
  );
}
