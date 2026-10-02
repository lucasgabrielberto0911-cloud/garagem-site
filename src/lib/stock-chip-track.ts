export type ChipBox = {
  left: number;
  right: number;
};

/**
 * Chips that cross the track edge are hidden whole, so a label is never
 * painted as “50 a” or “Volkswa”. Fully on-screen chips stay put.
 */
export function chipTrackInsets(
  view: { left: number; right: number },
  chips: ChipBox[],
  tolerance = 1,
) {
  let insetLeft = 0;
  let insetRight = 0;
  const hidden = chips.map(() => false);

  chips.forEach((chip, index) => {
    const cutsRight =
      chip.left < view.right - tolerance && chip.right > view.right + tolerance;
    const cutsLeft =
      chip.right > view.left + tolerance && chip.left < view.left - tolerance;
    if (cutsRight) {
      hidden[index] = true;
      insetRight = Math.max(insetRight, view.right - chip.left);
    }
    if (cutsLeft) {
      hidden[index] = true;
      insetLeft = Math.max(insetLeft, chip.right - view.left);
    }
  });

  return { insetLeft, insetRight, hidden };
}
