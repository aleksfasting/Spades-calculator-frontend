export type GameOutcome = 'WIN' | 'LOSS' | 'draw';

export interface PlayerRating {
  id: string;
  rating: number;
}

export interface EloResult {
  playerId: string;
  ratingBefore: number;
  ratingAfter: number;
  ratingDelta: number;
  expectedScore: number;
  kFactor: number;
}

const K = 32;

function teamAvg(p1: number, p2: number): number {
  return (p1 + p2) / 2;
}

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function computeNewRating(old: number, actual: number, expected: number): number {
  return old + K * (actual - expected);
}

export function teamWinProbability(
  team1Ratings: [number, number],
  team2Ratings: [number, number],
): number {
  const t1Avg = teamAvg(team1Ratings[0], team1Ratings[1]);
  const t2Avg = teamAvg(team2Ratings[0], team2Ratings[1]);
  return expectedScore(t1Avg, t2Avg);
}

export function calculateEloDeltas(
  team1: [PlayerRating, PlayerRating],
  team2: [PlayerRating, PlayerRating],
  team1Score: number,
  team2Score: number,
): { team1Results: [EloResult, EloResult]; team2Results: [EloResult, EloResult] } {
  const t1Avg = teamAvg(team1[0].rating, team1[1].rating);
  const t2Avg = teamAvg(team2[0].rating, team2[1].rating);

  const exp1 = expectedScore(t1Avg, t2Avg);
  const exp2 = 1 - exp1;

  const actual1 =
    team1Score > team2Score ? 1 : team1Score < team2Score ? 0 : 0.5;
  const actual2 = 1 - actual1;

  const makeResult = (
    player: PlayerRating,
    actual: number,
    exp: number,
  ): EloResult => {
    const ratingAfter = computeNewRating(player.rating, actual, exp);
    return {
      playerId: player.id,
      ratingBefore: player.rating,
      ratingAfter,
      ratingDelta: ratingAfter - player.rating,
      expectedScore: exp,
      kFactor: K,
    };
  };

  return {
    team1Results: [
      makeResult(team1[0], actual1, exp1),
      makeResult(team1[1], actual1, exp1),
    ],
    team2Results: [
      makeResult(team2[0], actual2, exp2),
      makeResult(team2[1], actual2, exp2),
    ],
  };
}
