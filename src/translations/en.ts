import { TranslationKey } from "./translationKey";

// One map for every build. There used to be a plan for a second, shorter map behind a
// competition-build flag; the texts were shortened instead (2026-09-10, ~100 packed bytes) and
// the same wording ships everywhere, so there is nothing to pick between and no flag.
// The rule that plan came with still holds: never write a per-entry ternary in here. The AST
// transformer only compacts a numeric-keyed map into an array when every value is a literal
// (see vite.config.ts), so a single `FLAG ? "a" : "b"` costs all of these entries their
// compaction, which is more than any string it saves. A variant is a second whole literal map.
export const enTranslations: Record<TranslationKey, string> = {
  [TranslationKey.CONTINUE]: "Continue",
  // The end-of-run text shares the info panel's "Name|Description" shape. The score is
  // appended to the description by the component, so the line ends ready for a number.
  [TranslationKey.WON]: "Time is up!|Score:",
  [TranslationKey.END_TURN]: "End turn",
  [TranslationKey.LEVELS]: "Levels",
  [TranslationKey.RETRY]: "Retry",
  [TranslationKey.PLAY]: "Play",
  // "Name|Description", split at the pipe by the info panel. Plain, short words: many players
  // will not be native speakers.
  //
  // The unicorn is introduced twice over, and this is the half a player reads first: the two
  // taps that move it. Walking is the only thing the opening position can do — every board
  // opens with a 3x3 of bare meadow and clouds past it — so the line-up rule below would be a
  // rule about a thing that is not on the board yet. "clears ☁️" is the same fact the score is
  // made of, said where the walking is: see INFO_GOAL for the arithmetic.
  //
  // The currency but not the number, which is the house rule the sites and the tub already
  // follow: every lit tile is wearing its own −1💧 at the moment this is read, so the figure
  // would be redundant *and* a hand-copy of MOVE_COST to keep in step. Naming the currency is
  // what ties the sentence to the purse in the turn bar, and answers the question a stuck
  // player actually has: not what a step costs, but why the walking stopped.
  [TranslationKey.INFO_UNICORN]: "Unicorn|Tap a lit tile to walk. Costs 💧, clears ☁️.",
  // ...and this is the half that arrives with the first fountain the player finds. The 🦄⛲🌈
  // pattern carries the line-up rule without language, and repeats, so it costs almost nothing.
  // The ladder under it (RANK, see renderGrowth) shows how many turns a rank takes and how far
  // this unicorn has come, so the sentence only has to say what earns one and that it is worth
  // having. "worth more" rather than a number because a grown rainbow pays more of whichever
  // currency it is on — see INFO_RAINBOW.
  // Its length is load-bearing: it is the longest description in the file, and $info-height is
  // the room reserved for exactly it plus the ladder. Re-measure that if this line grows.
  [TranslationKey.INFO_UNICORN_SHINE]: "Line up 🦄⛲🌈 to shine. Shining raises its rank. Each rank makes its 🌈 worth more.",
  // Both halves of the earning rule in one line, because a rainbow is where the choice is made:
  // the same tile pays a different currency depending on what is standing next to it. The
  // beams say it in colour — blue for the purse, red for the jar — and this says it in words.
  [TranslationKey.INFO_RAINBOW]: "Rainbow|Scores while it shines. Makes 🍬 beside a 🍭, else 💧.",
  [TranslationKey.INFO_FOUNTAIN]: "Fountain|Needed to create a rainbow: 🦄⛲🌈",
  // The two halves of what the tub is, kept apart because the tutorial board only has the
  // first: the flat income it pays wherever it stands, and — once there are trees on the board
  // to make sweets — the fields it can put a new unicorn on. The info panel joins them.
  // The number repeats BASE_INCOME by hand — change them together. The price is not a number
  // here on purpose: it is the size of the herd, so it moves every time one is bought.
  [TranslationKey.INFO_BATHTUB]: "Bathtub|Makes 2 💧 a turn.",
  [TranslationKey.INFO_BATHTUB_SELL]: "A new unicorn costs one 🍬 per unicorn you have.",
  [TranslationKey.INFO_HINT]: "|Tap anything to learn about it.",
  // No turn count in the text — the turn bar shows it, and it stays right when TURN_LIMIT moves.
  // The shape of the sentence is the shape of the score: two things add up, and the cloud you
  // have cleared multiplies them. It is the line held over the breakdown when the score is
  // opened, so the words and the arithmetic under them say the same thing.
  [TranslationKey.INFO_GOAL]: "|Every 🌈 and 🦄 scores 1 point per % of ☁️ cleared.",
  [TranslationKey.INFO_FOG]: "Cloud|Unknown. Walk closer.",
  [TranslationKey.INFO_EMPTY]: "Meadow|Free space.",
  // "each 🌈" rather than a number: what one rainbow feeds it is that rainbow's own size, so
  // the sum is on the board — one red line per sweet — rather than in the sentence. "Turns 💧
  // into 🍬" rather than "makes 🍬" because that is the whole of the trade: the tree does not
  // add sweets to a rainbow's water, it drinks the water and makes sweets out of it.
  [TranslationKey.INFO_TREE]: "Lollipop tree|Turns the 💧 of each 🌈 beside it into 🍬.",
  // The whole price rather than the surcharge — "one more than a step" is arithmetic the
  // player has to do at exactly the moment they are counting drops. The number repeats
  // PORTAL_COST by hand, the same way the tub's line repeats BASE_INCOME: change them together.
  [TranslationKey.INFO_DONUT]: "Donut|Portal. Tap another 🍩 to jump for 2 💧.",
  // Named for the thing and not the mechanic, which is the rule the rest of the panel follows —
  // the donut is a "Donut" and its description is what says "portal". "Bouncy" is the one word
  // that makes the sentence after it obvious rather than arbitrary.
  // "Steps off it" rather than "your next step" because it is a property of the tile and not a
  // charge that gets used up — a unicorn that ends its turn on a custard still walks off it for
  // nothing next turn, and two custards side by side are a free path.
  //
  // It does not say that a rainbow cannot land here, though a rainbow still needs bare ground
  // and this is not it. The board generator keeps custards off the ring around every fountain
  // and off the ring around every rubble pile (see crowdsFountain), and a rainbow only ever
  // lands on that ring — so the two cannot meet on any board as dealt, and a rule that never
  // fires is a line of the panel spent on nothing.
  [TranslationKey.INFO_CUSTARD]: "Custard|Bouncy. Steps off it are free.",
  // What is inside is *shown* rather than described: the colour it is wrapped in on the board,
  // and the glyph this panel puts in place of the 🎁 (see LOOT_EMOJIS, which is also why a
  // player who cannot tell two tints apart still gets the answer by tapping). That leaves the
  // line the one thing neither of those can say — that stepping on it is the whole of opening it.
  [TranslationKey.INFO_CHEST]: "Present|Step on it to open.",
  // The three build sites. No price in the text: the tile carries it, and it is the tile that
  // would go out of date if the numbers moved.
  [TranslationKey.INFO_TUB_SITE]: "Shower|A unicorn beside it can build a tub.",
  [TranslationKey.INFO_FOUNTAIN_SITE]: "Hole|A unicorn beside it can raise a fountain.",
  [TranslationKey.INFO_TREE_SITE]: "Seedling|A unicorn beside it can grow it into a 🍭 tree.",
  // The opponent. Written flat rather than behind a HAS_OPPONENT ternary — see the note at the
  // top of the file about what a single ternary costs the whole map. What it says is the whole
  // of what the player has to know: it is a rival, and the fountains are what the two of you
  // are actually racing for.
  [TranslationKey.INFO_RIVAL]: "Dark unicorn|Your rival. Beat it to the fountains.",
  [TranslationKey.INFO_DARK_RAINBOW]: "Dark rainbow|Scores for your rival.",
  // Shown when nothing on the board can be paid for any more — see canAct. Deliberately not
  // "you have no 💧": the purse is often not empty when this appears, it is just short of
  // everything on offer, and a player told they have no drops goes looking for a drop rather
  // than reading the sentence after it. "Income" is the word the "(+n)" beside each counter has
  // been saying wordlessly all run, which is what this connects the button to.
  [TranslationKey.INFO_STUCK]: "No more actions available|End the turn to collect income.",
  // The closing turn has no income behind it, so the button is the end of the run rather than
  // the way on to the next turn — and saying "collect income" there would promise money that is
  // not coming.
  [TranslationKey.INFO_STUCK_LAST]: "No more actions available|End the turn to finish.",
  // Both endings end the same way — a score to read — so both lines end ready for a number,
  // exactly as WON does. The rival's own total is a row in the breakdown underneath.
  [TranslationKey.WON_RACE]: "You win!|Score:",
  [TranslationKey.LOST_RACE]: "Rival wins!|Score:",
  [TranslationKey.RANK]: "Rank",
};
