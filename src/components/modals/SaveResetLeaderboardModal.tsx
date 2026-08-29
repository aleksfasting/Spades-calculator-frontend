import { useState } from 'react';
import { AppModal, Box, Flex, Text, Button, Input, Field, Spinner } from '../ui';
import { archiveAndResetLeaderboard } from '../../services';
import type { Player } from '../../services';
import {
  DEFAULT_RATING,
  isValidSeasonName,
  suggestNextSeasonName,
  type ArchivedSeason,
} from '../../helpers/utils/seasons';

interface SaveResetLeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (season: ArchivedSeason) => void;
  currentPlayers: Player[];
  existingSeasons: ArchivedSeason[];
}

function SaveResetLeaderboardModal({
  isOpen,
  onClose,
  onSuccess,
  currentPlayers,
  existingSeasons,
}: SaveResetLeaderboardModalProps) {
  const [name, setName] = useState(() => suggestNextSeasonName(existingSeasons));
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [wasOpen, setWasOpen] = useState(isOpen);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setName(suggestNextSeasonName(existingSeasons));
      setStatus('idle');
      setErrorMessage('');
    }
  }

  const trimmed = name.trim();
  const nameError =
    trimmed && !isValidSeasonName(trimmed)
      ? 'Use letters, numbers, spaces, or hyphens'
      : existingSeasons.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())
        ? `Season "${trimmed}" already exists`
        : '';

  const handleConfirm = async () => {
    if (!trimmed || nameError) return;
    setStatus('submitting');
    try {
      const season = await archiveAndResetLeaderboard(trimmed);
      onSuccess(season);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred');
      setStatus('error');
    }
  };

  const topThree = currentPlayers.slice(0, 3);

  return (
    <AppModal
      isOpen={isOpen}
      onClose={() => onClose()}
      title="Save & Reset Leaderboard"
    >
      <Box p={4}>
        {status === 'submitting' ? (
          <Flex justify="center" py={8}>
            <Spinner size="lg" />
          </Flex>
        ) : (
          <>
            <Text mb={4} color="gray.300">
              Save the current standings, then
              reset everyone to {DEFAULT_RATING}. New ranked games start the next
              season.
            </Text>

            {topThree.length > 0 && (
              <Box
                mb={4}
                p={3}
                borderRadius="md"
                border="1px solid"
                borderColor="whiteAlpha.200"
              >
                <Text fontSize="xs" color="gray.400" mb={2} textTransform="uppercase">
                  Current top {topThree.length}
                </Text>
                {topThree.map((player, index) => (
                  <Flex key={player.id} justify="space-between" mb={1}>
                    <Text fontSize="sm">
                      {index + 1}. {player.id}
                    </Text>
                    <Text fontSize="sm" fontWeight="semibold">
                      {Math.round(player.rating)}
                    </Text>
                  </Flex>
                ))}
              </Box>
            )}

            <Field
              label="Season name"
              invalid={Boolean(nameError)}
              errorText={nameError}
              mb={4}
            >
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="V26"
                autoFocus
              />
            </Field>

            {status === 'error' && (
              <Text color="red.400" mb={4}>
                {errorMessage}
              </Text>
            )}

            <Flex gap={3} justify="flex-end">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!trimmed || Boolean(nameError)}
              >
                Save & Reset
              </Button>
            </Flex>
          </>
        )}
      </Box>
    </AppModal>
  );
}

export default SaveResetLeaderboardModal;
