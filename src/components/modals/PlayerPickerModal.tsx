import { useMemo, useState } from 'react';
import AppModal from '../ui/AppModal';
import { Box, Button, Flex, Input, Stack } from '../ui';
import type { SavedPlayer } from '../../types';
import { normalizePlayerName } from '../../helpers/utils/playerPool';

/** ~5 ghost rows at default tap size + `gap={1}` between rows */
const PLAYER_LIST_MAX_HEIGHT = '16rem';

interface PlayerPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: SavedPlayer[];
  /** Normalized names already taken by other slots (not the slot being edited). */
  excludedNormalized: string[];
  onPick: (player: SavedPlayer) => void;
  onCreateAndPick: (displayName: string) => void;
}

function PlayerPickerModal({
  isOpen,
  onClose,
  players,
  excludedNormalized,
  onPick,
  onCreateAndPick,
}: PlayerPickerModalProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const excluded = useMemo(
    () => new Set(excludedNormalized.map((n) => normalizePlayerName(n))),
    [excludedNormalized],
  );

  const sortedPlayers = useMemo(
    () =>
      [...players].sort((a, b) =>
        a.displayName.localeCompare(b.displayName, undefined, {
          sensitivity: 'base',
        }),
      ),
    [players],
  );

  const handleClose = (open: boolean) => {
    if (!open) {
      setAdding(false);
      setNewName('');
      onClose();
    }
  };

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const norm = normalizePlayerName(trimmed);
    if (excluded.has(norm)) return;
    const dupPool = players.some((p) => normalizePlayerName(p.displayName) === norm);
    if (dupPool) return;
    onCreateAndPick(trimmed);
    setNewName('');
    setAdding(false);
    handleClose(false);
  };

  return (
    <AppModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Choose player"
      bodyStyle={{
        p: 4,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minH: 0,
      }}
    >
      <Stack gap={3} flex="1" minH={0} overflow="hidden">
        {adding && (
          <Stack gap={2}>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              fontSize="md"
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
              }}
            />
            <Stack direction="row" gap={2}>
              <Button flex={1} variant="outline" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button flex={1} onClick={handleCreate}>
                Add
              </Button>
            </Stack>
          </Stack>
        )}

        <Box
          role="listbox"
          aria-label="Players"
          flex="1"
          minH={0}
          maxH={PLAYER_LIST_MAX_HEIGHT}
          overflowY="auto"
          overscrollBehavior="contain"
          css={{
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
          }}
        >
          <Stack gap={1}>
            {sortedPlayers.map((p) => {
              const norm = normalizePlayerName(p.displayName);
              const taken = excluded.has(norm);
              return (
                <Button
                  key={p.id}
                  variant="ghost"
                  justifyContent="flex-start"
                  disabled={taken}
                  opacity={taken ? 0.4 : 1}
                  onClick={() => {
                    if (taken) return;
                    onPick(p);
                    handleClose(false);
                  }}
                >
                  {p.displayName}
                </Button>
              );
            })}
          </Stack>
        </Box>
        <Flex justify="flex-end" align="center">
          {!adding && (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              + Add
            </Button>
          )}
        </Flex>
      </Stack>
    </AppModal>
  );
}

export default PlayerPickerModal;
