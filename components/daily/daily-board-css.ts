/**
 * Styles for the Operations Board, Lanes, live feed and milestone toast (doc 16). They sit over the `--crm-*`
 * tokens and read like `app/crm.css`; the lead may promote them there.
 *
 * Why a string and not a `.css` import: the node test runner cannot load a `.css` file, and `today-page.tsx` (which
 * the render tests import) reaches this code through `daily-shell.tsx`. React 19 hoists a `<style href precedence>`
 * into the document head and dedupes it by `href`, on the server and the client alike.
 */
export const DAILY_BOARD_STYLE_HREF = "vantage-daily-board";

export const DAILY_BOARD_CSS = `
.dboard-tiles { display: grid; gap: var(--crm-gap); grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
.dboard-tile { display: flex; min-width: 0; flex-direction: column; gap: 8px; padding: 12px 14px; border: 1px solid var(--crm-border); border-radius: var(--crm-r-card); background: var(--crm-card); box-shadow: var(--crm-shadow-card); }
.dboard-tile[data-flash="true"] { border-color: #b9d1fb; background: var(--crm-blue-tint); }
.dboard-tile__head { display: flex; align-items: center; gap: 8px; min-width: 0; }
.dboard-tile__title { margin: 0; font-size: 13px; font-weight: 700; color: var(--crm-ink); }
.dboard-tile__count { margin-left: auto; font-size: 22px; font-weight: 800; line-height: 1; color: var(--crm-ink); font-variant-numeric: tabular-nums; }
.dboard-tile__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-height: 22px; font-size: 12px; color: var(--crm-muted); }
.dboard-spark { display: flex; align-items: flex-end; gap: 2px; height: 28px; }
.dboard-spark__bar { flex: 1; min-height: 2px; border-radius: 2px; background: var(--crm-blue-100); }
.dboard-spark__bar[data-now="true"] { background: var(--crm-blue); }
.dboard-tile__fact { margin: 0; min-height: 18px; overflow: hidden; font-size: 12.5px; color: var(--crm-text); text-overflow: ellipsis; white-space: nowrap; }
.dboard-tile__foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: auto; }

.dboard-grid { display: grid; gap: var(--crm-gap); align-items: start; }
@media (min-width: 1280px) { .dboard-grid { grid-template-columns: minmax(0, 1fr) minmax(340px, 400px); } }

.dboard-feed { display: flex; min-height: 0; flex-direction: column; overflow: hidden; border: 1px solid var(--crm-border); border-radius: var(--crm-r-card); background: var(--crm-card); box-shadow: var(--crm-shadow-card); }
@media (min-width: 1280px) { .dboard-feed { position: sticky; top: 16px; max-height: calc(100dvh - 7rem); } }
.dboard-feed__head { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; border-bottom: 1px solid var(--crm-divider); }
.dboard-feed__title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 14px; font-weight: 800; color: var(--crm-ink); }
.dboard-feed__chips { display: flex; flex-wrap: wrap; gap: 6px; }
.dboard-feed__tools { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; color: var(--crm-muted); }
.dboard-feed__scroll { position: relative; min-height: 0; flex: 1; overflow-y: auto; padding: 10px 12px 14px; }
.dboard-feed__list { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
.dboard-feed__empty { margin: 0; padding: 18px 4px; font-size: 13px; color: var(--crm-muted); }
.dboard-feed__more { display: block; width: 100%; padding: 8px; border: 0; background: none; color: var(--crm-blue-strong); font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; }
.dboard-new { position: sticky; top: 0; z-index: 2; display: flex; justify-content: center; height: 0; overflow: visible; }
.dboard-new__pill { margin-top: 2px; padding: 4px 14px; border: 1px solid var(--crm-blue); border-radius: var(--crm-r-pill); background: var(--crm-blue); color: #fff; font: inherit; font-size: 12.5px; font-weight: 700; box-shadow: var(--crm-shadow-pop); cursor: pointer; }

.dboard-card { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border: 1px solid var(--crm-border); border-radius: var(--crm-r-card); background: var(--crm-card); }
.dboard-card[data-tone="gold"] { border-color: #f0d68a; background: var(--crm-gold-50); }
.dboard-card[data-arrived="true"] { box-shadow: 0 0 0 2px rgba(47, 111, 230, 0.25); }
.dboard-card__open { display: grid; width: 100%; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.dboard-card__open:focus-visible, .dboard-row:focus-visible, .dboard-fold__toggle:focus-visible { outline: none; box-shadow: var(--crm-focus); border-radius: var(--crm-r-control); }
.dboard-card__text { min-width: 0; }
.dboard-card__title { display: block; margin: 0; overflow: hidden; font-size: 14px; font-weight: 700; color: var(--crm-ink); text-overflow: ellipsis; white-space: nowrap; }
.dboard-card__meta { display: block; margin: 2px 0 0; overflow: hidden; font-size: 12.5px; color: var(--crm-muted); text-overflow: ellipsis; white-space: nowrap; }
.dboard-card__line { margin: 2px 0 0; font-size: 12.5px; color: var(--crm-text); }
.dboard-card__time { align-self: start; font-size: 12px; color: var(--crm-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.dboard-card__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.dboard-card .crm-track { margin-top: 6px; }

.dboard-row { display: grid; width: 100%; min-height: 44px; grid-template-columns: auto auto minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 4px 10px; border: 0; border-radius: var(--crm-r-control); background: none; color: var(--crm-text); font: inherit; font-size: 13px; text-align: left; cursor: pointer; }
.dboard-row:hover { background: var(--crm-blue-50); }
.dboard-row[data-tier="C"] { color: var(--crm-muted); }
.dboard-row[data-arrived="true"] { background: var(--crm-blue-tint); }
.dboard-row__dot { width: 9px; height: 9px; border-radius: 50%; }
.dboard-row__star { color: #9a6b00; font-size: 14px; line-height: 1; }
.dboard-row__time { color: var(--crm-muted); font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.dboard-row__text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dboard-row__text strong { color: var(--crm-ink); font-weight: 700; }
.dboard-row__suffix { color: var(--crm-blue-ink); font-weight: 700; }
.dboard-row__chev { color: var(--crm-faint); font-size: 16px; }
.dboard-fold { display: flex; flex-direction: column; }
.dboard-fold__toggle { display: grid; width: 100%; min-height: 44px; grid-template-columns: auto auto minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 4px 10px; border: 0; border-radius: var(--crm-r-control); background: var(--crm-divider); color: var(--crm-text); font: inherit; font-size: 13px; text-align: left; cursor: pointer; }
.dboard-fold__children { margin: 2px 0 0 14px; padding: 0; list-style: none; border-left: 2px solid var(--crm-divider); }

.dboard-lanes { display: grid; gap: var(--crm-gap); grid-template-columns: minmax(0, 1fr); align-items: start; }
@media (min-width: 1280px) { .dboard-lanes[data-solo="false"] { grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); } }
.dboard-lane__head { display: flex; flex-direction: column; gap: 4px; width: 100%; padding: 12px 14px 8px; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.dboard-lane__top { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.dboard-lane__scroll { max-height: 28rem; overflow-y: auto; padding: 0 8px 8px; }
[data-solo="true"] .dboard-lane__scroll { max-height: min(56rem, calc(100dvh - 14rem)); }
.dboard-lane__more { display: flex; flex-direction: column; gap: 8px; padding: 0 12px 12px; }
.dboard-detail { margin: 2px 8px 8px 22px; padding: 8px 12px; border: 1px solid var(--crm-divider); border-radius: var(--crm-r-control); background: var(--crm-table-head); }

.dboard-scrim { position: fixed; inset: 0; z-index: 50; border: 0; background: transparent; cursor: default; }
.dboard-toast { position: fixed; right: 16px; bottom: 16px; z-index: 60; width: min(380px, calc(100vw - 32px)); }
.dboard-toast__card { position: relative; padding: 12px 14px; border: 1px solid #f0d68a; border-radius: var(--crm-r-card); background: var(--crm-gold-50); box-shadow: var(--crm-shadow-pop); }
.dboard-toast__close { position: absolute; top: 6px; right: 6px; display: inline-flex; width: 26px; height: 26px; align-items: center; justify-content: center; border: 0; border-radius: 50%; background: none; color: var(--crm-muted); cursor: pointer; }
.dboard-burst { position: relative; display: inline-flex; }

@media (prefers-reduced-motion: no-preference) {
  .dboard-toast__card { animation: dboard-toast-in 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
  .dboard-burst::after { content: ""; position: absolute; inset: 0; border-radius: 50%; box-shadow: 0 0 0 0 rgba(244, 180, 0, 0.55); animation: dboard-burst 900ms ease-out 1 both; pointer-events: none; }
  .dboard-tile[data-flash="true"] { animation: dboard-flash 1800ms ease-out 1 both; }
  @keyframes dboard-toast-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes dboard-burst { 0% { box-shadow: 0 0 0 0 rgba(244, 180, 0, 0.55); } 100% { box-shadow: 0 0 0 16px rgba(244, 180, 0, 0); } }
  @keyframes dboard-flash { 0% { background: var(--crm-blue-100); } 100% { background: var(--crm-blue-tint); } }
}
`;
