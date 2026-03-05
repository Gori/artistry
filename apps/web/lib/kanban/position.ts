/**
 * Calculate a fractional insert position for a sorted list.
 *
 * - Empty list or overIndex out of range → place at end (last + 1, or 1)
 * - overIndex === 0 → place before first (first / 2)
 * - Otherwise → midpoint between [overIndex - 1] and [overIndex]
 */
export function calculateInsertPosition(
  sortedPositions: number[],
  overIndex: number
): number {
  if (sortedPositions.length === 0) return 1;

  if (overIndex < 0 || overIndex >= sortedPositions.length) {
    return sortedPositions[sortedPositions.length - 1]! + 1;
  }

  if (overIndex === 0) {
    return sortedPositions[0]! / 2;
  }

  return (sortedPositions[overIndex - 1]! + sortedPositions[overIndex]!) / 2;
}
