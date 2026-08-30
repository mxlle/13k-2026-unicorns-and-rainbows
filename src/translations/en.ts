import { TranslationKey } from "./translationKey";

// For texts that should be shorter in the competition build, use per-entry
// ternaries on the HAS_SHORT_TEXTS flag (env-utils.ts) — the unused variant is
// tree-shaken: [TranslationKey.START]: HAS_SHORT_TEXTS ? "Go" : "Start game",
export const enTranslations: Record<TranslationKey, string> = {
  [TranslationKey.CONTINUE]: "Continue",
  // The end-of-run text shares the info panel's "Name|Description" shape. The score is
  // appended to the description by the component, so the line ends ready for a number.
  [TranslationKey.WON]: "Time is up!|Your final score:",
  [TranslationKey.END_TURN]: "End turn",
  [TranslationKey.LEVELS]: "Levels",
  [TranslationKey.RETRY]: "Retry",
  [TranslationKey.PLAY]: "Play",
  // PLACEHOLDER wording — "Name|Description", split at the pipe by the info panel.
  // Plain, short words: many players will not be native speakers.
  //
  // The unicorn is introduced twice over, and this is the half a player reads first: what it is
  // for, and the two taps that move it. Walking is the only thing the opening position can do —
  // every board opens with a 3x3 of bare meadow and clouds past it — so the line-up rule below
  // would be a rule about a thing that is not on the board yet. "clears ☁️" is the same fact the
  // score is made of, said where the walking is: see INFO_GOAL for the arithmetic.
  //
  // The currency but not the number, which is the house rule the sites and the tub already
  // follow: every lit tile is wearing its own −1💧 at the moment this is read, so the figure
  // would be the most redundant thing in the file *and* a hand-copy of MOVE_COST to keep in
  // step. What the tag cannot say is what a 💧 is for — it renders at 0.4em, quiet on purpose —
  // so naming the currency is what ties the sentence to the purse in the turn bar, and answers
  // the question a stuck player actually has: not what a step costs, but why the walking stopped.
  [TranslationKey.INFO_UNICORN]: "Unicorn|Your explorer. Tap a lit tile — walking costs 💧 and clears ☁️.",
  // ...and this is the half that arrives with the first fountain the player finds. The 🦄⛲🌈
  // pattern carries the line-up rule without language, and repeats, so it costs almost nothing.
  // The ✨ the panel puts after the name is the only place a level is stated, so this is where it
  // has to be explained: what earns one, and that it is worth having. "worth more" rather than a
  // number because a grown rainbow pays more of whichever currency it is on — see INFO_RAINBOW.
  // The 3 repeats GROWTH_PER_LEVEL by hand, the way the tub's line repeats BASE_INCOME: change
  // them together.
  // Its length is load-bearing: it is the longest description in the file, and $info-height is
  // the room reserved for exactly it. Re-measure that if this line grows.
  [TranslationKey.INFO_UNICORN_SHINE]: "It shines. Line it up like this: 🦄⛲🌈. Each ✨ (3 turns shining) makes its 🌈 worth more.",
  // Both halves of the earning rule in one line, because a rainbow is where the choice is made:
  // the same tile pays a different currency depending on what is standing next to it. The
  // beams say it in colour — blue for the purse, red for the jar — and this says it in words.
  [TranslationKey.INFO_RAINBOW]: "Rainbow|It scores while it shines. Beside a 🍭 it makes 🍬, otherwise 💧.",
  [TranslationKey.INFO_FOUNTAIN]: "Fountain|Light comes out the other side as a rainbow: 🦄⛲🌈",
  // The two halves of what the tub is, kept apart because the tutorial board only has the
  // first: the flat income it pays wherever it stands, and — once there are trees on the board
  // to make sweets — the fields it can put a new unicorn on. The info panel joins them.
  // The number repeats BASE_INCOME by hand — change them together. The price is not a number
  // here on purpose: it is the size of the herd, so it moves every time one is bought.
  [TranslationKey.INFO_BATHTUB]: "Bathtub|It makes 2 💧 a turn.",
  [TranslationKey.INFO_BATHTUB_SELL]: "A new unicorn beside it costs one 🍬 per unicorn you have.",
  [TranslationKey.INFO_HINT]: "|Tap anything to find out what it does.",
  // No turn count in the text — the turn bar shows it, and it stays right when TURN_LIMIT moves.
  // The shape of the sentence is the shape of the score: two things add up, and the cloud you
  // have cleared multiplies them. It is also the line held over the breakdown when the score is
  // opened, so the words and the arithmetic under them say the same thing.
  [TranslationKey.INFO_GOAL]: "|Build up before the turns run out. Every 🌈 and 🦄 scores 1 point per % of ☁️ you cleared.",
  [TranslationKey.INFO_FOG]: "Cloud|You cannot see here yet. Walk a unicorn closer.",
  [TranslationKey.INFO_EMPTY]: "Meadow|Free space. A rainbow can appear here.",
  // "per 🌈" rather than a number: what one rainbow feeds it is that rainbow's own size, so
  // the sum is on the board — one red line per sweet — rather than in the sentence. It says
  // "instead of 💧" because that is the whole of the trade: the tree does not add sweets to a
  // rainbow's water, it drinks the water and makes sweets out of it.
  [TranslationKey.INFO_TREE]: "Lollipop tree|It turns the 💧 of every 🌈 next to it into 🍬. No rainbow can appear here.",
  // The whole price rather than the surcharge — "one more than a step" is arithmetic the
  // player has to do at exactly the moment they are counting drops. The number repeats
  // PORTAL_COST by hand, the same way the tub's line repeats BASE_INCOME: change them together.
  [TranslationKey.INFO_DONUT]: "Donut|A portal. Tap another 🍩 to jump there for 2 💧.",
  // Says both halves of the trade: the free step, and the rainbow spot it takes up.
  [TranslationKey.INFO_FLOWER]: "Flower|Stepping on it is free. But no rainbow can appear here.",
  // Says what it is for without saying what is in it: the three outcomes, and the one action.
  [TranslationKey.INFO_CHEST]: "Present|Step on it to open. Inside is 💧, 🍬 or a new 🦄.",
  // The three build sites. No price in the text: the button carries it, and it is the button
  // that would go out of date if the numbers moved.
  [TranslationKey.INFO_TUB_SITE]: "Empty tub|A unicorn beside it can fill it up.",
  [TranslationKey.INFO_FOUNTAIN_SITE]: "Rubble|A unicorn beside it can rebuild the fountain.",
  [TranslationKey.INFO_TREE_SITE]: "Seedling|A unicorn beside it can grow it into a 🍭 tree.",
  // The opponent. Written flat rather than behind a HAS_OPPONENT ternary, and that is a size
  // decision rather than a tidy-up: the AST transformer only compacts a numeric-keyed map into
  // an array when *every* value is a literal (see vite.config.ts), so four ternaries in here
  // were costing the whole map its compaction — more than the four sentences they saved. The
  // opponent ships in every build now, so there was nothing left to weigh against it.
  // What it says is the whole of what the player has to know: it plays the same game, its
  // rainbows are its own, and the fountains are what the two of you are actually racing for.
  [TranslationKey.INFO_RIVAL]: "Dark unicorn|Your rival. It plays the same game — beat it to the fountains.",
  [TranslationKey.INFO_DARK_RAINBOW]: "Dark rainbow|It scores for your rival. Its tile is taken; yours cannot land here.",
  // Both endings end the same way — a score to read — so both lines end ready for a number,
  // exactly as WON does. The rival's own total is a row in the breakdown underneath.
  [TranslationKey.WON_RACE]: "You win!|Your final score:",
  [TranslationKey.LOST_RACE]: "Your rival wins!|Your final score:",
};
