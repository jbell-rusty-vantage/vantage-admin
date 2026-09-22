import { copy } from "./sales-intelligence-copy";
import { Button } from "./atoms/button";

export function PageControls({
  label,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
}: {
  label: string;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <nav className="si-loadmore" aria-label={copy.actions.pages}>
      <Button type="button" variant="secondary" disabled={!canPrevious} onClick={onPrevious}>{copy.actions.previous}</Button>
      <span className="si-text--sm si-text--subtle">{label}</span>
      <Button type="button" variant="secondary" disabled={!canNext} onClick={onNext}>{copy.actions.next}</Button>
    </nav>
  );
}
