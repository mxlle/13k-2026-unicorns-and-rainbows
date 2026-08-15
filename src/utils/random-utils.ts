// Everything the game rolls goes through one seeded generator, so a board is fully
// determined by its seed: the same number always builds the same map. That is what makes
// replaying a map free — regenerate it instead of snapshotting it — and what lets a
// predefined level be nothing but a number, with no level data to carry in the bundle.
// (The audio player keeps its own Math.random for noise; that is not part of the game.)

const MODULUS = 2147483647; // 2^31 - 1, the modulus of the Park-Miller "minimal standard"
const MULTIPLIER = 16807;

let state = 1;

/**
 * The seeds we actually want to use are small — a level list is [0, 1, 2, ...] — and a bare
 * multiplicative generator started at 1 and at 2 opens with two proportionally tiny values,
 * so neighbouring seeds would begin with near-identical draws and build near-identical maps.
 * Hashing the seed on the way in scatters them, so consecutive level numbers stay unrelated.
 */
export function setSeed(seed: number) {
  // never 0: it is the generator's fixed point and every draw after it would be 0 too
  state = ((Math.imul(seed, 2654435761) >>> 0) % (MODULUS - 1)) + 1;
}

/** A float in [0, 1) — the seeded stand-in for the Math.random it replaces. */
export function random(): number {
  // exact in doubles: state is below 2^31, so the product stays well under 2^53
  state = (state * MULTIPLIER) % MODULUS;

  return state / MODULUS;
}

/**
 * Shuffles array in place.
 * @param {Array} a items An array containing the items.
 */
export function shuffleArray<T>(a: T[]) {
  let j, x, i;
  for (i = a.length - 1; i > 0; i--) {
    j = Math.floor(random() * (i + 1));
    x = a[i];
    a[i] = a[j];
    a[j] = x;
  }
  return a;
}

export function getRandomInt(max: number) {
  return Math.floor(random() * max);
}

export function getRandomIntFromInterval(min: number, max: number) {
  return Math.floor(random() * (max - min + 1) + min);
}
