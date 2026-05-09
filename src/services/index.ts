import { supabase } from './supabaseClient';
import { convertBidToDbValue } from '../helpers/math/spadesMath';
import type { Round } from '../types';

export interface Player {
  id: string;
  rating: number;
}

export interface RecordRankedGameArgs {
  team1PlayerIds: [string, string];
  team2PlayerIds: [string, string];
  team1NewRatings: [number, number];
  team2NewRatings: [number, number];
  roundHistory: Round[];
}

export async function getPlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('rating', { ascending: false });

  if (error) throw new Error(error.message);
  return (data as Player[]) ?? [];
}

export async function getPlayersByIds(ids: string[]): Promise<Player[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('players')
    .select('*')
    .in('id', ids);

  if (error) throw new Error(error.message);
  return (data as Player[]) ?? [];
}

export async function recordRankedGame(args: RecordRankedGameArgs): Promise<void> {
  const { team1PlayerIds, team2PlayerIds, team1NewRatings, team2NewRatings, roundHistory } = args;

  const { data: game, error: gameError } = await supabase
    .from('games')
    .insert({})
    .select('id')
    .single();

  if (gameError) throw new Error(gameError.message);
  const gameId = (game as { id: string }).id;

  const { error: playerError } = await supabase.from('players').upsert(
    [
      { id: team1PlayerIds[0], rating: team1NewRatings[0] },
      { id: team1PlayerIds[1], rating: team1NewRatings[1] },
      { id: team2PlayerIds[0], rating: team2NewRatings[0] },
      { id: team2PlayerIds[1], rating: team2NewRatings[1] },
    ],
    { onConflict: 'id' },
  );

  if (playerError) throw new Error(playerError.message);

  const rounds = roundHistory.map((round, idx) => ({
    game_id: gameId,
    round_nr: idx + 1,
    t1p1: team1PlayerIds[0],
    t1p2: team1PlayerIds[1],
    t2p1: team2PlayerIds[0],
    t2p2: team2PlayerIds[1],
    t1p1_bid: convertBidToDbValue(round.team1BidsAndActuals.p1Bid),
    t1p2_bid: convertBidToDbValue(round.team1BidsAndActuals.p2Bid),
    t2p1_bid: convertBidToDbValue(round.team2BidsAndActuals.p1Bid),
    t2p2_bid: convertBidToDbValue(round.team2BidsAndActuals.p2Bid),
    t1p1_actual: Number(round.team1BidsAndActuals.p1Actual),
    t1p2_actual: Number(round.team1BidsAndActuals.p2Actual),
    t2p1_actual: Number(round.team2BidsAndActuals.p1Actual),
    t2p2_actual: Number(round.team2BidsAndActuals.p2Actual),
  }));

  const { error: roundsError } = await supabase.from('rounds').insert(rounds);

  if (roundsError) throw new Error(roundsError.message);
}
