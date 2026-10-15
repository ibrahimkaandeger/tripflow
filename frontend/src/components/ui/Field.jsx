import { useId } from "react";

// Label + control + optional hint. The control is rendered by the
// caller through a render prop so it receives the generated id.
function Field({ label, required = false, hint, className = "", children }) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      <label className="field-label" htmlFor={id}>
        {label}
        {required && <span className="field-required"> *</span>}
      </label>
      {children(id)}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

export default Field;
