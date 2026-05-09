import { calculateRoundScore, calculateTeamScoreFromRoundHistory } from './spadesMath';
import type { Round, BidValue, ActualValue } from '../../types';

export interface DbRound {
  id: string;
  game_id: string;
  round_nr: number;
  t1p1: string | null;
  t1p2: string | null;
  t2p1: string | null;
  t2p2: string | null;
  t1p1_bid: number | null;
  t1p2_bid: number | null;
  t2p1_bid: number | null;
  t2p2_bid: number | null;
  t1p1_actual: number | null;
  t1p2_actual: number | null;
  t2p1_actual: number | null;
  t2p2_actual: number | null;
}

export interface PlayerStats {
  reliability: { made: number; total: number };
  gameWins: { wins: number; losses: number };
  roundWins: { wins: number; total: number };
  avgWinMargin: number | null;
  nils: { successful: number; unsuccessful: number };
  blindNils: { successful: number; unsuccessful: number };
  avgBid: number | null;
  highestBid: number | null;
  bidOutcomes: { exact: number; over: number; under: number };
}

function getPlayerData(
  playerId: string,
  round: DbRound,
): { bid: number | null; actual: number | null; isTeam1: boolean } | null {
  if (round.t1p1 === playerId)
    return { bid: round.t1p1_bid, actual: round.t1p1_actual, isTeam1: true };
  if (round.t1p2 === playerId)
    return { bid: round.t1p2_bid, actual: round.t1p2_actual, isTeam1: true };
  if (round.t2p1 === playerId)
    return { bid: round.t2p1_bid, actual: round.t2p1_actual, isTeam1: false };
  if (round.t2p2 === playerId)
    return { bid: round.t2p2_bid, actual: round.t2p2_actual, isTeam1: false };
  return null;
}

function convertDbBidToInputValue(bid: number | null): BidValue | '' {
  if (bid === null) return '';
  if (bid === -1) return 'Blind Nil';
  if (bid === 0) return 'Nil';
  return String(bid) as BidValue;
}

function convertDbActualToInputValue(actual: number | null): ActualValue | '' {
  if (actual === null) return '';
  return String(actual) as ActualValue;
}

function convertDbRowToRound(row: DbRound): Round {
  return {
    team1BidsAndActuals: {
      p1Bid: convertDbBidToInputValue(row.t1p1_bid),
      p2Bid: convertDbBidToInputValue(row.t1p2_bid),
      p1Actual: convertDbActualToInputValue(row.t1p1_actual),
      p2Actual: convertDbActualToInputValue(row.t1p2_actual),
    },
    team2BidsAndActuals: {
      p1Bid: convertDbBidToInputValue(row.t2p1_bid),
      p2Bid: convertDbBidToInputValue(row.t2p2_bid),
      p1Actual: convertDbActualToInputValue(row.t2p1_actual),
      p2Actual: convertDbActualToInputValue(row.t2p2_actual),
    },
  };
}

export function computePlayerStats(playerId: string, rounds: DbRound[]): PlayerStats {
  let reliabilityMade = 0;
  let reliabilityTotal = 0;
  let roundWins = 0;
  let totalRounds = 0;
  let nilSuccessful = 0;
  let nilUnsuccessful = 0;
  let blindNilSuccessful = 0;
  let blindNilUnsuccessful = 0;
  let bidSum = 0;
  let bidCount = 0;
  let maxBid = 0;
  let exactBidCount = 0;
  let overBidCount = 0;
  let underBidCount = 0;

  for (const round of rounds) {
    const playerData = getPlayerData(playerId, round);
    if (!playerData) continue;

    const { bid, actual, isTeam1 } = playerData;

    if (bid !== null && bid > 0) {
      reliabilityTotal++;
      bidCount++;
      bidSum += bid;
      if (bid > maxBid) maxBid = bid;
      if (actual !== null && actual >= bid) reliabilityMade++;
      if (actual !== null) {
        if (actual === bid) exactBidCount++;
        else if (actual > bid) overBidCount++;
        else underBidCount++;
      }
    }

    if (bid === 0) {
      if (actual === 0) nilSuccessful++;
      else nilUnsuccessful++;
    }

    if (bid === -1) {
      if (actual === 0) blindNilSuccessful++;
      else blindNilUnsuccessful++;
    }

    const appRound = convertDbRowToRound(round);
    const team1Score = calculateRoundScore(
      appRound.team1BidsAndActuals.p1Bid,
      appRound.team1BidsAndActuals.p2Bid,
      appRound.team1BidsAndActuals.p1Actual,
      appRound.team1BidsAndActuals.p2Actual,
    );
    const team2Score = calculateRoundScore(
      appRound.team2BidsAndActuals.p1Bid,
      appRound.team2BidsAndActuals.p2Bid,
      appRound.team2BidsAndActuals.p1Actual,
      appRound.team2BidsAndActuals.p2Actual,
    );

    totalRounds++;
    const playerTeamScore = isTeam1 ? team1Score.score : team2Score.score;
    const opponentTeamScore = isTeam1 ? team2Score.score : team1Score.score;
    if (playerTeamScore > opponentTeamScore) roundWins++;
  }

  // Group rounds by game_id for game-level stats
  const gameGroups: Record<string, DbRound[]> = {};
  for (const round of rounds) {
    if (!round.game_id) continue;
    if (!gameGroups[round.game_id]) gameGroups[round.game_id] = [];
    gameGroups[round.game_id].push(round);
  }

  let gameWins = 0;
  let gameLosses = 0;
  let totalWinMargin = 0;
  let winMarginCount = 0;

  for (const gameRounds of Object.values(gameGroups)) {
    const sortedRounds = [...gameRounds].sort((a, b) => a.round_nr - b.round_nr);
    const playerData = getPlayerData(playerId, sortedRounds[0]);
    if (!playerData) continue;

    const { isTeam1 } = playerData;
    const appRounds = sortedRounds.map(convertDbRowToRound);

    // Reconstruct final scores using default nil setting (HELPS_TEAM_BID)
    const team1Final = calculateTeamScoreFromRoundHistory(
      appRounds,
      'team1BidsAndActuals',
      null,
    );
    const team2Final = calculateTeamScoreFromRoundHistory(
      appRounds,
      'team2BidsAndActuals',
      null,
    );

    const playerFinal = isTeam1 ? team1Final.teamScore : team2Final.teamScore;
    const opponentFinal = isTeam1 ? team2Final.teamScore : team1Final.teamScore;

    if (playerFinal > opponentFinal) {
      gameWins++;
      totalWinMargin += playerFinal - opponentFinal;
      winMarginCount++;
    } else if (playerFinal < opponentFinal) {
      gameLosses++;
    }
  }

  return {
    reliability: { made: reliabilityMade, total: reliabilityTotal },
    gameWins: { wins: gameWins, losses: gameLosses },
    roundWins: { wins: roundWins, total: totalRounds },
    avgWinMargin: winMarginCount > 0 ? Math.round(totalWinMargin / winMarginCount) : null,
    nils: { successful: nilSuccessful, unsuccessful: nilUnsuccessful },
    blindNils: { successful: blindNilSuccessful, unsuccessful: blindNilUnsuccessful },
    avgBid: bidCount > 0 ? Math.round((bidSum / bidCount) * 10) / 10 : null,
    highestBid: maxBid > 0 ? maxBid : null,
    bidOutcomes: { exact: exactBidCount, over: overBidCount, under: underBidCount },
  };
}
