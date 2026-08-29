export const CURRENT_SEASON = 'current';
export const DEFAULT_RATING = 1200;

/** Sentinel rows in `players` that store archived season metadata and rankings. */
export const SEASON_META_PREFIX = '::season::';
export const SEASON_RANK_PREFIX = '::rank::';

export interface SeasonRanking {
  id: string;
  rating: number;
}

export interface ArchivedSeason {
  name: string;
  archivedAt: string;
  rankings: SeasonRanking[];
}

export interface SeasonWindow {
  from?: string;
  to?: string;
}

export function isInternalPlayerId(id: string): boolean {
  return id.startsWith('::');
}

export function parseSeasons(
  rows: { id: string; rating: number }[],
): ArchivedSeason[] {
  const seasons: ArchivedSeason[] = [];

  for (const row of rows) {
    if (!row.id.startsWith(SEASON_META_PREFIX)) continue;
    const rest = row.id.slice(SEASON_META_PREFIX.length);
    const sep = rest.indexOf('::');
    if (sep <= 0) continue;
    const name = rest.slice(0, sep);
    const archivedAt = rest.slice(sep + 2);
    if (!name || !archivedAt) continue;

    const rankPrefix = `${SEASON_RANK_PREFIX}${name}::`;
    const rankings = rows
      .filter((r) => r.id.startsWith(rankPrefix))
      .map((r) => ({ id: r.id.slice(rankPrefix.length), rating: r.rating }))
      .filter((r) => r.id)
      .sort((a, b) => b.rating - a.rating);

    seasons.push({ name, archivedAt, rankings });
  }

  return seasons.sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
}

export function seasonWindow(
  seasonName: string,
  seasons: ArchivedSeason[],
): SeasonWindow {
  const chronological = [...seasons].sort((a, b) =>
    a.archivedAt.localeCompare(b.archivedAt),
  );

  if (seasonName === CURRENT_SEASON) {
    const last = chronological[chronological.length - 1];
    return last ? { from: last.archivedAt } : {};
  }

  const idx = chronological.findIndex((s) => s.name === seasonName);
  if (idx < 0) return {};
  return {
    from: idx > 0 ? chronological[idx - 1].archivedAt : undefined,
    to: chronological[idx].archivedAt,
  };
}

export function inSeasonWindow(
  iso: string | null | undefined,
  window: SeasonWindow,
): boolean {
  if (!iso) return !window.from && !window.to;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return false;
  if (window.from) {
    const from = Date.parse(window.from);
    if (!Number.isNaN(from) && time < from) return false;
  }
  if (window.to) {
    const to = Date.parse(window.to);
    if (!Number.isNaN(to) && time >= to) return false;
  }
  return true;
}

export function suggestNextSeasonName(seasons: ArchivedSeason[]): string {
  const nums = seasons
    .map((s) => /^V(\d+)$/i.exec(s.name)?.[1])
    .filter((n): n is string => Boolean(n))
    .map(Number);
  if (nums.length === 0) return 'V26';
  return `V${Math.max(...nums) + 1}`;
}

export function seasonQuery(season: string): string {
  if (!season || season === CURRENT_SEASON) return '';
  return `?season=${encodeURIComponent(season)}`;
}

export function formatSeasonDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function isValidSeasonName(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,30}$/.test(name.trim());
}

type GamePlayers = {
  createdAt: string;
  t1p1: string | null;
  t1p2: string | null;
  t2p1: string | null;
  t2p2: string | null;
};

function playerIdsInGames(games: GamePlayers[]): Set<string> {
  const ids = new Set<string>();
  for (const game of games) {
    for (const id of [game.t1p1, game.t1p2, game.t2p1, game.t2p2]) {
      if (id && !isInternalPlayerId(id)) ids.add(id);
    }
  }
  return ids;
}

export function leaderboardForSeason(
  season: string,
  seasons: ArchivedSeason[],
  livePlayers: SeasonRanking[],
  games: GamePlayers[],
): SeasonRanking[] {
  if (season !== CURRENT_SEASON) {
    return seasons.find((s) => s.name === season)?.rankings ?? [];
  }

  const window = seasonWindow(CURRENT_SEASON, seasons);
  if (!window.from) return livePlayers;

  const ids = playerIdsInGames(
    games.filter((g) => inSeasonWindow(g.createdAt, window)),
  );
  return livePlayers.filter((p) => ids.has(p.id));
}

export function filterGamesForSeason<T extends GamePlayers>(
  games: T[],
  season: string,
  seasons: ArchivedSeason[],
): T[] {
  const window = seasonWindow(season, seasons);
  return games.filter((g) => inSeasonWindow(g.createdAt, window));
}

export function filterRoundsForSeason<T extends { game_id: string }>(
  rounds: T[],
  seasonGames: { id: string }[],
): T[] {
  const ids = new Set(seasonGames.map((g) => g.id));
  return rounds.filter((r) => ids.has(r.game_id));
}
