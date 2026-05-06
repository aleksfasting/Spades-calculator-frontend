import { supabase } from './supabaseClient';
import type { EloResult, GameOutcome } from '../helpers/math/eloMath';

export interface Player {
  id: string;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecordRankedGameArgs {
  team1PlayerIds: [string, string];
  team2PlayerIds: [string, string];
  team1Outcome: GameOutcome;
  team2Outcome: GameOutcome;
  team1EloResults: [EloResult, EloResult];
  team2EloResults: [EloResult, EloResult];
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
  const {
    team1Outcome,
    team2Outcome,
    team1EloResults,
    team2EloResults,
  } = args;

  const { data: game, error: gameError } = await supabase
    .from('games')
    .insert({})
    .select('id')
    .single();

  if (gameError) throw new Error(gameError.message);
  const gameId = (game as { id: string }).id;

  const allResults = [...team1EloResults, ...team2EloResults];
  const { error: playerError } = await supabase.from('players').upsert(
    allResults.map((r) => ({
      id: r.playerId,
      rating: r.ratingAfter,
      updatedAt: new Date().toISOString(),
    })),
    { onConflict: 'id' },
  );

  if (playerError) throw new Error(playerError.message);

  const participants = [
    ...team1EloResults.map((r) =>
      buildParticipantRow(r, gameId, 'team1', team1Outcome),
    ),
    ...team2EloResults.map((r) =>
      buildParticipantRow(r, gameId, 'team2', team2Outcome),
    ),
  ];

  const { error: participantError } = await supabase
    .from('game_participants')
    .insert(participants);

  if (participantError) throw new Error(participantError.message);
}

function buildParticipantRow(
  result: EloResult,
  gameId: string,
  team: 'team1' | 'team2',
  outcome: GameOutcome,
) {
  return {
    gameId,
    playerId: result.playerId,
    team,
    outcome,
    ratingBefore: result.ratingBefore,
    ratingAfter: result.ratingAfter,
    ratingDelta: result.ratingDelta,
    expectedScore: result.expectedScore,
    kFactor: result.kFactor,
  };
}
