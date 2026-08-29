import { supabase } from './supabaseClient';
import { convertBidToDbValue } from '../helpers/math/spadesMath';
import type { Round } from '../types';
import type { DbRound } from '../helpers/math/playerStats';
import {
  DEFAULT_RATING,
  SEASON_META_PREFIX,
  SEASON_RANK_PREFIX,
  isInternalPlayerId,
  isValidSeasonName,
  parseSeasons,
  type ArchivedSeason,
} from '../helpers/utils/seasons';

export type { DbRound, ArchivedSeason };

export interface Player {
  id: string;
  rating: number;
}

export interface RecordRankedGameArgs {
  team1PlayerIds: [string, string];
  team2PlayerIds: [string, string];
  team1BeforeRatings: [number, number];
  team2BeforeRatings: [number, number];
  team1NewRatings: [number, number];
  team2NewRatings: [number, number];
  roundHistory: Round[];
}

async function fetchPlayerRows(): Promise<Player[]> {
  const { data, error } = await supabase.from('players').select('*');
  if (error) throw new Error(error.message);
  return (data as Player[]) ?? [];
}

export async function getPlayers(): Promise<Player[]> {
  const rows = await fetchPlayerRows();
  return rows
    .filter((p) => !isInternalPlayerId(p.id))
    .sort((a, b) => b.rating - a.rating);
}

export async function getPlayersByIds(ids: string[]): Promise<Player[]> {
  const realIds = ids.filter((id) => id && !isInternalPlayerId(id));
  if (realIds.length === 0) return [];

  const { data, error } = await supabase
    .from('players')
    .select('*')
    .in('id', realIds);

  if (error) throw new Error(error.message);
  return ((data as Player[]) ?? []).filter((p) => !isInternalPlayerId(p.id));
}

export async function getSeasons(): Promise<ArchivedSeason[]> {
  const rows = await fetchPlayerRows();
  return parseSeasons(rows);
}

export async function archiveAndResetLeaderboard(
  name: string,
): Promise<ArchivedSeason> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Season name is required');
  if (!isValidSeasonName(trimmed)) {
    throw new Error('Use letters, numbers, spaces, or hyphens');
  }

  const rows = await fetchPlayerRows();
  const seasons = parseSeasons(rows);
  if (seasons.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error(`Season "${trimmed}" already exists`);
  }

  const live = rows.filter((p) => !isInternalPlayerId(p.id));
  const archivedAt = new Date().toISOString();
  const rankings = [...live].sort((a, b) => b.rating - a.rating);

  const snapshotRows: Player[] = [
    { id: `${SEASON_META_PREFIX}${trimmed}::${archivedAt}`, rating: 0 },
    ...rankings.map((p) => ({
      id: `${SEASON_RANK_PREFIX}${trimmed}::${p.id}`,
      rating: p.rating,
    })),
  ];

  const { error: snapError } = await supabase
    .from('players')
    .upsert(snapshotRows, { onConflict: 'id' });
  if (snapError) throw new Error(snapError.message);

  const { error: resetError } = await supabase.from('players').upsert(
    live.map((p) => ({ id: p.id, rating: DEFAULT_RATING })),
    { onConflict: 'id' },
  );
  if (resetError) throw new Error(resetError.message);

  return { name: trimmed, archivedAt, rankings };
}

export async function recordRankedGame(args: RecordRankedGameArgs): Promise<void> {
  const {
    team1PlayerIds,
    team2PlayerIds,
    team1BeforeRatings,
    team2BeforeRatings,
    team1NewRatings,
    team2NewRatings,
    roundHistory,
  } = args;

  const { data: game, error: gameError } = await supabase
    .from('games')
    .insert({
      t1p1: team1PlayerIds[0],
      t1p2: team1PlayerIds[1],
      t2p1: team2PlayerIds[0],
      t2p2: team2PlayerIds[1],
      t1p1_before_rating: team1BeforeRatings[0],
      t1p2_before_rating: team1BeforeRatings[1],
      t2p1_before_rating: team2BeforeRatings[0],
      t2p2_before_rating: team2BeforeRatings[1],
    })
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

type RoundWithGame = Omit<DbRound, 't1p1' | 't1p2' | 't2p1' | 't2p2'> & {
  games: { t1p1: string | null; t1p2: string | null; t2p1: string | null; t2p2: string | null } | null;
};

function flattenRound({ games: g, ...round }: RoundWithGame): DbRound {
  return {
    ...round,
    t1p1: g?.t1p1 ?? null,
    t1p2: g?.t1p2 ?? null,
    t2p1: g?.t2p1 ?? null,
    t2p2: g?.t2p2 ?? null,
  };
}

export async function getAllRounds(): Promise<DbRound[]> {
  const { data, error } = await supabase
    .from('rounds')
    .select('*, games(t1p1, t1p2, t2p1, t2p2)')
    .order('game_id')
    .order('round_nr');

  if (error) throw new Error(error.message);
  return ((data as RoundWithGame[]) ?? []).map(flattenRound);
}

export async function getPlayerRounds(playerId: string): Promise<DbRound[]> {
  const { data: gameRows, error: gameError } = await supabase
    .from('games')
    .select('id')
    .or(`t1p1.eq.${playerId},t1p2.eq.${playerId},t2p1.eq.${playerId},t2p2.eq.${playerId}`);

  if (gameError) throw new Error(gameError.message);
  const gameIds = (gameRows ?? []).map((g: { id: string }) => g.id);
  if (gameIds.length === 0) return [];

  const { data, error } = await supabase
    .from('rounds')
    .select('*, games(t1p1, t1p2, t2p1, t2p2)')
    .in('game_id', gameIds)
    .order('game_id')
    .order('round_nr');

  if (error) throw new Error(error.message);
  return ((data as RoundWithGame[]) ?? []).map(flattenRound);
}

export interface DbGame {
  id: string;
  createdAt: string;
  t1p1: string | null;
  t1p2: string | null;
  t2p1: string | null;
  t2p2: string | null;
  t1p1_before_rating: number | null;
  t1p2_before_rating: number | null;
  t2p1_before_rating: number | null;
  t2p2_before_rating: number | null;
}

export async function getAllGames(): Promise<DbGame[]> {
  const { data, error } = await supabase
    .from('games')
    .select(
      'id, createdAt, t1p1, t1p2, t2p1, t2p2, t1p1_before_rating, t1p2_before_rating, t2p1_before_rating, t2p2_before_rating',
    )
    .order('createdAt', { ascending: true });
  if (error) throw new Error(error.message);
  return (data as DbGame[]) ?? [];
}
