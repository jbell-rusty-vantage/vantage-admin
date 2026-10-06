import { DAILY_BOARD_CSS, DAILY_BOARD_STYLE_HREF } from "@/components/daily/daily-board-css";

/** Mounts the board styles once (React 19 hoists and dedupes a `<style href precedence>`). */
export function DailyBoardStyle() {
  return (
    <style href={DAILY_BOARD_STYLE_HREF} precedence="default">
      {DAILY_BOARD_CSS}
    </style>
  );
}
