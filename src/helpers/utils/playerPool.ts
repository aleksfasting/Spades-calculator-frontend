import type { Names, SavedPlayer } from '../../types';
import { getLocalStorage, setLocalStorage } from './helperFunctions';
import { isInternalPlayerId } from './seasons';

const SAVED_PLAYERS_KEY = 'savedPlayers';

export function normalizePlayerName(name: string): string {
  return name.trim().toLowerCase();
}

export function toDisplayNameFromNormalized(normalized: string): string {
  if (!normalized) return '';
  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function getSavedPlayers(): SavedPlayer[] {
  const raw = getLocalStorage<SavedPlayer[]>(SAVED_PLAYERS_KEY);
  return Array.isArray(raw) ? raw : [];
}

export function setSavedPlayers(players: SavedPlayer[]): void {
  setLocalStorage(SAVED_PLAYERS_KEY, players);
}

/** One-time seed from legacy `names` when the pool is empty. */
export function migrateSeedPlayerPoolFromNames(): void {
  if (getSavedPlayers().length > 0) return;
  const names = getLocalStorage<Names>('names');
  if (!names) return;
  const vals = [
    names.t1p1Name,
    names.t1p2Name,
    names.t2p1Name,
    names.t2p2Name,
  ];
  const seen = new Set<string>();
  const players: SavedPlayer[] = [];
  for (const v of vals) {
    const n = normalizePlayerName(v);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    players.push({
      id: crypto.randomUUID(),
      displayName: toDisplayNameFromNormalized(n),
    });
  }
  if (players.length) setSavedPlayers(players);
}

/** Stable id for roster rows synced from Supabase (`players.id` = normalized name). */
function rosterIdFromDbPlayerId(norm: string): string {
  return `db:${norm}`;
}

/** Adds Supabase `players` into local roster; keeps existing entries (same normalized name wins locally). */
export function mergeRemotePlayersIntoPool(
  local: SavedPlayer[],
  remote: { id: string }[],
): SavedPlayer[] {
  const seen = new Set(
    local.map((p) => normalizePlayerName(p.displayName)),
  );
  const next = [...local];
  for (const r of remote) {
    if (isInternalPlayerId(r.id)) continue;
    const norm = normalizePlayerName(r.id);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    next.push({
      id: rosterIdFromDbPlayerId(norm),
      displayName: toDisplayNameFromNormalized(norm),
    });
  }
  return next;
}

export function upsertPoolFromNormalizedNames(
  players: SavedPlayer[],
  normalizedNames: string[],
): SavedPlayer[] {
  const existing = new Set(
    players.map((p) => normalizePlayerName(p.displayName)),
  );
  let next = [...players];
  for (const n of normalizedNames) {
    if (!n || existing.has(n)) continue;
    existing.add(n);
    next = [
      ...next,
      {
        id: crypto.randomUUID(),
        displayName: toDisplayNameFromNormalized(n),
      },
    ];
  }
  return next;
}
