import type { GameDefinition, GameId } from './types.js';

export const GAME_CATALOG: GameDefinition[] = [
  {
    id: 'chess',
    name: 'Chess',
    shortName: 'Chess',
    category: 'strategy',
    tagline: 'Grandmaster 8×8 Tactical Duel',
    description: 'Full classical chess with castling, en passant, pawn promotion, checkmate, and draw detection.',
    rules: [
      'White moves first. Capture pieces and checkmate the opponent King.',
      'Castling, en passant, and pawn promotion to Q/R/B/N are fully supported.',
      'Stalemate, threefold repetition, insufficient material, or 50-move rule ends in a draw.'
    ],
    avgMinutes: '8–15 min',
    defaultTurnSeconds: 60,
    gradient: 'from-cyan-500/20 via-blue-600/20 to-indigo-700/30',
    accentColor: '#00F0FF',
    badgeText: 'CLASSIC',
    supportsDrawOffer: true
  },
  {
    id: 'ludo',
    name: 'Ludo',
    shortName: 'Ludo',
    category: 'board',
    tagline: 'Royal Cross-Track Race',
    description: 'Head-to-head 2-player opposite-corner Ludo with server RNG dice, safe stars, and captures.',
    rules: [
      'Roll a 6 to deploy a token from your yard onto the starting square.',
      'Rolling a 6, capturing an opponent token, or reaching home grants a bonus roll.',
      'Three consecutive 6s forfeits your turn. First player to get all 4 tokens home wins.'
    ],
    avgMinutes: '5–10 min',
    defaultTurnSeconds: 30,
    gradient: 'from-amber-500/20 via-orange-600/20 to-rose-600/30',
    accentColor: '#F59E0B',
    badgeText: 'POPULAR',
    supportsDrawOffer: false
  },
  {
    id: 'carrom',
    name: 'Carrom',
    shortName: 'Carrom',
    category: 'arcade',
    tagline: 'Precision Striker & Queen Physics',
    description: 'Real-time 2D physics Carrom with striker positioning, power aiming, and Red Queen cover rules.',
    rules: [
      'Player 1 pockets White coins; Player 2 pockets Black coins.',
      'Pocket the Red Queen (+3 pts) and cover it by pocketing your own coin on the same or next shot.',
      'Pocketing the striker is a foul that returns one of your pocketed coins to the center.'
    ],
    avgMinutes: '4–8 min',
    defaultTurnSeconds: 40,
    gradient: 'from-emerald-500/20 via-teal-600/20 to-cyan-600/30',
    accentColor: '#10B981',
    badgeText: 'PHYSICS',
    supportsDrawOffer: false
  },
  {
    id: 'pool_8ball',
    name: '8 Ball Pool',
    shortName: '8 Ball Pool',
    category: 'arcade',
    tagline: 'Pro Cue Physics Arena',
    description: 'Server-simulated 8-Ball Pool with break shot, solids vs stripes, fouls, and ball-in-hand placement.',
    rules: [
      'First legally pocketed non-8 ball after the break assigns Solids (1–7) or Stripes (9–15).',
      'Fouling (scratch, hitting wrong ball first, or no rail) gives opponent Ball-in-Hand.',
      'Clear all 7 group balls, then legally sink the 8-Ball to win. Early 8-Ball sink loses.'
    ],
    avgMinutes: '5–9 min',
    defaultTurnSeconds: 45,
    gradient: 'from-sky-500/20 via-emerald-500/20 to-teal-700/30',
    accentColor: '#38BDF8',
    badgeText: 'ARENA',
    supportsDrawOffer: false
  },
  {
    id: 'sudoku',
    name: 'Sudoku Duel',
    shortName: 'Sudoku',
    category: 'puzzle',
    tagline: 'Competitive 9×9 Logic Clash',
    description: 'Turn-based 9×9 unique-solution Sudoku duel where accuracy builds streaks and mistakes cost strikes.',
    rules: [
      'Players take turns placing digits 1–9 into empty cells.',
      'Correct placement earns +10 pts plus streak bonus; wrong guess costs -5 pts and 1 strike.',
      '3 strikes results in instant defeat. Highest score when the grid completes wins.'
    ],
    avgMinutes: '4–8 min',
    defaultTurnSeconds: 45,
    gradient: 'from-violet-500/20 via-purple-600/20 to-fuchsia-600/30',
    accentColor: '#A855F7',
    badgeText: 'BRAIN',
    supportsDrawOffer: false
  },
  {
    id: 'checkers',
    name: 'Checkers',
    shortName: 'Checkers',
    category: 'strategy',
    tagline: 'Tactical Diagonal Multi-Jump',
    description: 'American Checkers with mandatory captures, chained multi-jumps, and King promotions.',
    rules: [
      'Move diagonally forward onto dark squares. Captures are mandatory when available.',
      'Chain multiple jumps in one turn whenever another capture exists from the landing square.',
      'Reaching the back rank crowns a King, allowing diagonal movement and captures in all directions.'
    ],
    avgMinutes: '5–10 min',
    defaultTurnSeconds: 35,
    gradient: 'from-rose-500/20 via-red-600/20 to-orange-600/30',
    accentColor: '#F43F5E',
    badgeText: 'CLASSIC',
    supportsDrawOffer: true
  },
  {
    id: 'battleship',
    name: 'Battleship',
    shortName: 'Battleship',
    category: 'strategy',
    tagline: 'Stealth 10×10 Naval Strike',
    description: 'Secret fleet deployment followed by tactical torpedo salvos with zero server-state leaks.',
    rules: [
      'Deploy all 5 naval vessels on your 10×10 grid without overlapping, then lock your fleet.',
      'Take turns firing at enemy coordinates. Direct hits award a bonus shot.',
      'Sink all 5 enemy ships first to claim naval supremacy.'
    ],
    avgMinutes: '4–7 min',
    defaultTurnSeconds: 30,
    gradient: 'from-blue-600/20 via-cyan-600/20 to-sky-700/30',
    accentColor: '#0EA5E9',
    badgeText: 'TACTICAL',
    supportsDrawOffer: false,
    simultaneousTurns: true
  },
  {
    id: 'connect_four',
    name: 'Connect Four',
    shortName: 'Connect 4',
    category: 'board',
    tagline: '7×6 Gravity Disc Battle',
    description: 'Drop neon discs into the 7×6 rack and align four horizontally, vertically, or diagonally.',
    rules: [
      'Take turns dropping one disc into any non-full column.',
      'Discs fall to the lowest available row in the chosen column.',
      'First player to connect 4 discs in any straight line wins.'
    ],
    avgMinutes: '2–4 min',
    defaultTurnSeconds: 25,
    gradient: 'from-pink-500/20 via-rose-500/20 to-amber-500/30',
    accentColor: '#EC4899',
    badgeText: 'FAST',
    supportsDrawOffer: false
  },
  {
    id: 'four_in_a_row',
    name: 'Four in a Row',
    shortName: '4 in a Row',
    category: 'board',
    tagline: '8×7 Pop-Out Gravity Edition',
    description: 'Enhanced 8×7 Four in a Row where you can drop from the top OR pop your own disc from the bottom!',
    rules: [
      'On your turn, either drop a disc from the top OR pop out one of your own bottom-row discs.',
      'Popping a disc drops every disc in that column down by one space.',
      'Create a line of 4 to win! If a pop makes both players connect 4, the opponent wins.'
    ],
    avgMinutes: '3–6 min',
    defaultTurnSeconds: 30,
    gradient: 'from-indigo-500/20 via-cyan-500/20 to-emerald-500/30',
    accentColor: '#6366F1',
    badgeText: 'POP-OUT',
    supportsDrawOffer: false
  },
  {
    id: 'dots_and_boxes',
    name: 'Dots and Boxes',
    shortName: 'Dots & Boxes',
    category: 'puzzle',
    tagline: 'Territory Capture Grid',
    description: 'Draw neon segments between 5×5 dots, close boxes to score points, and chain bonus turns.',
    rules: [
      'Take turns connecting two adjacent horizontal or vertical dots.',
      'Completing the 4th side of a box claims it (+1 pt) and grants an extra turn.',
      'Whoever captures the majority of the 16 boxes wins.'
    ],
    avgMinutes: '3–5 min',
    defaultTurnSeconds: 25,
    gradient: 'from-teal-500/20 via-cyan-500/20 to-blue-600/30',
    accentColor: '#14B8A6',
    badgeText: 'STRATEGIC',
    supportsDrawOffer: false
  },
  {
    id: 'tic_tac_toe',
    name: 'Tic-Tac-Toe',
    shortName: 'Tic-Tac-Toe',
    category: 'quick',
    tagline: 'Best-of-3 Blitz Duel',
    description: 'Fast-paced Best-of-3 rounds of classic X vs O with alternating first movers.',
    rules: [
      'Align 3 marks horizontally, vertically, or diagonally to win a round.',
      'Starting symbol alternates across up to 3 rounds (sudden-death tiebreak up to 5 rounds).',
      'First player to reach 2 round wins takes the match.'
    ],
    avgMinutes: '1–2 min',
    defaultTurnSeconds: 20,
    gradient: 'from-cyan-400/20 via-violet-500/20 to-fuchsia-500/30',
    accentColor: '#22D3EE',
    badgeText: 'BLITZ',
    supportsDrawOffer: false
  },
  {
    id: 'rps',
    name: 'Rock Paper Scissors',
    shortName: 'RPS Duel',
    category: 'quick',
    tagline: 'Secret-Commit Best of 5',
    description: 'Simultaneous blind commit prevents peeking—first player to 3 round wins triumphs.',
    rules: [
      'Both players secretly lock Rock, Paper, or Scissors simultaneously.',
      'Server reveals both picks only after both players commit.',
      'First to 3 round victories wins the match.'
    ],
    avgMinutes: '1–2 min',
    defaultTurnSeconds: 20,
    gradient: 'from-fuchsia-500/20 via-pink-600/20 to-rose-600/30',
    accentColor: '#E879F9',
    badgeText: 'BLITZ',
    supportsDrawOffer: false,
    simultaneousTurns: true
  },
  {
    id: 'reversi',
    name: 'Reversi (Othello)',
    shortName: 'Reversi',
    category: 'strategy',
    tagline: '8×8 Territory Flip Duel',
    description: 'Outflank opponent discs along lines to flip entire rows into your neon color.',
    rules: [
      'Place a disc so at least one line of opponent discs sits between yours.',
      'All bracketed opponent discs flip to your color. Turns auto-skip if no legal move exists.',
      'Player with the most discs when no moves remain wins.'
    ],
    avgMinutes: '4–7 min',
    defaultTurnSeconds: 30,
    gradient: 'from-emerald-500/20 via-lime-500/20 to-teal-600/30',
    accentColor: '#22C55E',
    badgeText: 'BONUS',
    supportsDrawOffer: true
  },
  {
    id: 'memory_clash',
    name: 'Memory Clash',
    shortName: 'Memory Clash',
    category: 'puzzle',
    tagline: '6×4 Cyber Pair Duel',
    description: 'Server-hidden 24-card grid duel where matching pairs awards points and bonus turns.',
    rules: [
      'Flip two hidden cards on your turn. Unflipped symbols remain hidden on the server.',
      'Matching pairs score +1 point and keep your turn active.',
      'Collect more pairs than your opponent out of 12 total pairs to win.'
    ],
    avgMinutes: '2–4 min',
    defaultTurnSeconds: 25,
    gradient: 'from-purple-500/20 via-indigo-500/20 to-cyan-500/30',
    accentColor: '#8B5CF6',
    badgeText: 'BONUS',
    supportsDrawOffer: false
  }
];

export const GAME_MAP: Record<GameId, GameDefinition> = GAME_CATALOG.reduce(
  (acc, g) => {
    acc[g.id] = g;
    return acc;
  },
  {} as Record<GameId, GameDefinition>
);

export const VALID_GAME_IDS = new Set<GameId>(GAME_CATALOG.map((g) => g.id));

