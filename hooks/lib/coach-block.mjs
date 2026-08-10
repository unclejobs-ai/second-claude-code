/**
 * Returns a block reason when a coach interview is still open.
 * Compliance-check blocking arrives with the check runner in phase 2.
 *
 * Lives here rather than in session-end.mjs because that file calls main()
 * at the top level — importing it from a test would run the whole hook.
 */
export function coachBlockReason(coachState) {
  if (!coachState) return null;
  if (coachState.status === "pending_approval") return null;
  const settled = Array.isArray(coachState.forks) ? coachState.forks.length : 0;
  return (
    `coach 인터뷰가 끝나지 않았습니다. 확정된 갈림길 ${settled}개. ` +
    `\`/scc:coach --resume\`으로 마치거나 명시적으로 중단하십시오.`
  );
}
