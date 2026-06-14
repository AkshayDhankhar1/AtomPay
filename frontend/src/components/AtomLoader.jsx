/**
 * AtomLoader — the signature AtomPay loading animation.
 *
 * A pulsing nucleus with two concentric circular orbits; one electron rides
 * each orbit at a constant radius and constant speed (no wobble), the inner
 * shell faster and counter-rotating. Styles live in global.css.
 *
 * Reused for page loads, section loads, buttons, and the AI "thinking" state.
 *
 * @param {number} size   diameter in px (default 64)
 * @param {string} label  optional caption shown under the atom
 */
export default function AtomLoader({ size = 64, label }) {
  return (
    <div className="atom-loader" style={{ "--atom-size": `${size}px` }}>
      <div className="atom" role="status" aria-label="loading">
        <div className="atom-nucleus" />
        <div className="ring ring-outer">
          <span className="e-wrap"><span className="electron" /></span>
        </div>
        <div className="ring ring-inner">
          <span className="e-wrap"><span className="electron" /></span>
        </div>
      </div>
      {label && <span className="atom-loader-label">{label}</span>}
    </div>
  );
}
