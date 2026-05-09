import type { Names, SavedPlayer } from '../../types';
import { getLocalStorage, setLocalStorage } from './helperFunctions';

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
