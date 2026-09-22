import { copy } from "./sales-intelligence-copy";
import "./styles/sales-intelligence.css";

function Bone({ className }: { className?: string }) {
  return <span className={className ? `si-skeleton ${className}` : "si-skeleton"} />;
}

function PagerBones() {
  return (
    <div className="si-loadmore" aria-hidden>
      <Bone className="si-skeleton--btn" />
      <Bone className="si-skeleton--range" />
      <Bone className="si-skeleton--btn" />
    </div>
  );
}

/** Shape of the Outreach Intelligence list while a page is still loading. */
export function OutreachListSkeleton() {
  return (
    <div className="si-skel" role="status" aria-busy="true">
      <span className="si-sr">{copy.loading.outreach}</span>
      <div className="si-bandcards" aria-hidden>
        {Array.from({ length: 4 }, (_, index) => <Bone key={index} className="si-skeleton--card" />)}
      </div>
      <PagerBones />
      <div className="si-skel-rows" aria-hidden>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="si-skel-row">
            <span><Bone className="si-skeleton--line" /><Bone className="si-skeleton--short" /></span>
            <span><Bone className="si-skeleton--line" /><Bone className="si-skeleton--short" /></span>
            <span><Bone className="si-skeleton--line" /></span>
            <span><Bone className="si-skeleton--short" /></span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Shape of the Numbers list while a page is still loading. */
export function NumbersListSkeleton() {
  return (
    <div className="si-skel" role="status" aria-busy="true">
      <span className="si-sr">{copy.loading.numbers}</span>
      <div className="si-nhead" aria-hidden>
        <span>{copy.columns.number}</span>
        <span>{copy.columns.lead}</span>
        <span>{copy.columns.latestActivity}</span>
        <span />
      </div>
      <div className="si-skel-rows" aria-hidden>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="si-skel-row si-skel-row--numbers">
            <span><Bone className="si-skeleton--line" /><Bone className="si-skeleton--short" /></span>
            <span><Bone className="si-skeleton--short" /></span>
            <span><Bone className="si-skeleton--line" /></span>
          </div>
        ))}
      </div>
      <PagerBones />
    </div>
  );
}

/** Route-level placeholder, shown before the workspace itself is ready. */
export function SalesIntelligenceRouteSkeleton() {
  return (
    <div className="si-root si-workspace">
      <header className="si-workspace__header">
        <h1 className="si-workspace__title">{copy.page.title}</h1>
      </header>
      <OutreachListSkeleton />
    </div>
  );
}
