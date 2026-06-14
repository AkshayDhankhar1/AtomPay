/**
 * AtomLoader — the signature AtomPay loading animation.
 *
 * Three static, tilted elliptical orbits form the classic atom symbol;
 * an electron glides smoothly along each orbit's path (CSS offset-path),
 * with a softly pulsing nucleus at the center. Styles live in global.css.
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
        <div className="atom-orbit-group g1">
          <div className="orbit-ring" />
          <span className="electron" />
        </div>
        <div className="atom-orbit-group g2">
          <div className="orbit-ring" />
          <span className="electron" />
        </div>
        <div className="atom-orbit-group g3">
          <div className="orbit-ring" />
          <span className="electron" />
        </div>
      </div>
      {label && <span className="atom-loader-label">{label}</span>}
    </div>
  );
}
