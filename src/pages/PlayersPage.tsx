import '../App.css';
import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Header } from '../components/ui';
import { UpdateNotification } from '../components';
import {
  Box,
  Button,
  Center,
  Flex,
  IconButton,
  Input,
  Stack,
  Text,
} from '../components/ui';
import {
  useLocalStorage,
  refreshSavedPlayersFromSupabase,
} from '../helpers/utils/hooks';
import type { SavedPlayer } from '../types';
import { normalizePlayerName } from '../helpers/utils/playerPool';

function PlayersPage() {
  const [players, setPlayers] = useLocalStorage<SavedPlayer[]>('savedPlayers', []);
  const [draftName, setDraftName] = useState('');

  useEffect(() => {
    let cancelled = false;
    refreshSavedPlayersFromSupabase().then((merged) => {
      if (!cancelled) setPlayers(merged);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = useMemo(
    () =>
      [...players].sort((a, b) =>
        a.displayName.localeCompare(b.displayName, undefined, {
          sensitivity: 'base',
        }),
      ),
    [players],
  );

  const handleAdd = () => {
    const trimmed = draftName.trim();
    if (!trimmed) return;
    const norm = normalizePlayerName(trimmed);
    const dup = players.some((p) => normalizePlayerName(p.displayName) === norm);
    if (dup) return;
    setPlayers([
      ...players,
      { id: crypto.randomUUID(), displayName: trimmed },
    ]);
    setDraftName('');
  };

  const handleRename = (id: string, displayName: string): boolean => {
    const trimmed = displayName.trim();
    if (!trimmed) return false;
    const norm = normalizePlayerName(trimmed);
    const others = players.filter((p) => p.id !== id);
    if (others.some((p) => normalizePlayerName(p.displayName) === norm))
      return false;
    setPlayers(
      players.map((p) =>
        p.id === id ? { ...p, displayName: trimmed } : p,
      ),
    );
    return true;
  };

  const handleDelete = (id: string) => {
    setPlayers(players.filter((p) => p.id !== id));
  };

  return (
    <div className="App">
      <UpdateNotification />
      <Header />
      <Center mt={6} mb={4}>
        <Text fontSize="var(--app-font-2xl)" fontWeight="bold">
          Players
        </Text>
      </Center>

      <Stack gap={3} px={2} maxW="480px" mx="auto">
        <Flex gap={2}>
          <Input
            flex={1}
            placeholder="New player name"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            fontSize="lg"
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
          />
          <Button variant="outline" onClick={handleAdd} px={4}>
            Add
          </Button>
        </Flex>

        <Text fontSize="sm" color="fg.muted">
          Rename inline; duplicate names are not allowed.
        </Text>

        <Stack gap={2}>
          {sorted.map((p) => (
            <PlayerRow
              key={`${p.id}-${p.displayName}`}
              player={p}
              onRename={(name) => handleRename(p.id, name)}
              onDelete={() => handleDelete(p.id)}
            />
          ))}
          {sorted.length === 0 && (
            <Text fontSize="md" color="fg.muted" textAlign="center" py={8}>
              No saved players yet. Add names here or from game setup.
            </Text>
          )}
        </Stack>
      </Stack>
    </div>
  );
}

function PlayerRow({
  player,
  onRename,
  onDelete,
}: {
  player: SavedPlayer;
  onRename: (name: string) => boolean;
  onDelete: () => void;
}) {
  const [value, setValue] = useState(player.displayName);

  return (
    <Flex align="center" gap={2}>
      <Box flex={1}>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          fontSize="lg"
          onBlur={() => {
            if (value.trim() !== player.displayName) {
              const ok = onRename(value);
              if (!ok) setValue(player.displayName);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      </Box>
      <IconButton
        aria-label={`Delete ${player.displayName}`}
        variant="ghost"
        size="sm"
        onClick={onDelete}
      >
        <Trash2 size={18} />
      </IconButton>
    </Flex>
  );
}

export default PlayersPage;
