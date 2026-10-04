/**
 * The interim page a Rep account sees at `/sales-intelligence`: Sales Intelligence is being rebuilt and is not
 * available for Rep accounts yet. It makes no read: the interim Numbers and Accounts reads are Owner-only, and a Rep
 * never gets an unscoped Numbers browser. The route imports the stylesheet.
 */
import { copy } from "./sales-intelligence-copy";

const r = copy.repUnavailable;

export function RepUnavailable() {
  return (
    <div className="si-root si-route si-repunavailable" data-viewer="rep">
      <section className="si-empty" role="status" aria-labelledby="si-rep-unavailable-title">
        <h1 id="si-rep-unavailable-title" className="si-empty__title">{r.title}</h1>
        <p className="si-empty__text">{r.body}</p>
        <p className="si-empty__text">{r.contact}</p>
      </section>
    </div>
  );
}
