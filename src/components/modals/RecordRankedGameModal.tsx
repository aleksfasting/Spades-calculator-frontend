import { useState, useEffect } from 'react';
import { AppModal, Flex, Box, Text, Button, Spinner } from '../ui';
import { calculateTeamScoreFromRoundHistory } from '../../helpers/math/spadesMath';
import { calculateEloDeltas } from '../../helpers/math/eloMath';
import type { EloResult, PlayerRating } from '../../helpers/math/eloMath';
import { getPlayersByIds, recordRankedGame } from '../../services';
import { getNames, getNilSetting } from '../../helpers/utils/storage';
import { TEAM1, TEAM2 } from '../../helpers/utils/constants';
import type { Round } from '../../types';

interface RecordRankedGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  roundHistory: Round[];
}

type ModalStatus = 'loading' | 'idle' | 'submitting' | 'success' | 'error';

interface PreviewDeltas {
  team1Results: [EloResult, EloResult];
  team2Results: [EloResult, EloResult];
}

function formatDelta(delta: number): string {
  const rounded = Math.round(delta);
  return rounded >= 0 ? `+${rounded}` : `${rounded}`;
}

function RecordRankedGameModal({
  isOpen,
  onClose,
  roundHistory,
}: RecordRankedGameModalProps) {
  const [status, setStatus] = useState<ModalStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [ratingsMap, setRatingsMap] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState<PreviewDeltas | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const names = getNames();
    const nilSetting = getNilSetting();

    if (!names) return;

    const playerIds = [
      names.t1p1Name,
      names.t1p2Name,
      names.t2p1Name,
      names.t2p2Name,
    ];

    const buildPreview = (map: Record<string, number>) => {
      const t1Score = calculateTeamScoreFromRoundHistory(
        roundHistory,
        TEAM1,
        nilSetting,
      ).teamScore;
      const t2Score = calculateTeamScoreFromRoundHistory(
        roundHistory,
        TEAM2,
        nilSetting,
      ).teamScore;
      const team1Players: [PlayerRating, PlayerRating] = [
        { id: names.t1p1Name, rating: map[names.t1p1Name] },
        { id: names.t1p2Name, rating: map[names.t1p2Name] },
      ];
      const team2Players: [PlayerRating, PlayerRating] = [
        { id: names.t2p1Name, rating: map[names.t2p1Name] },
        { id: names.t2p2Name, rating: map[names.t2p2Name] },
      ];
      return calculateEloDeltas(team1Players, team2Players, t1Score, t2Score);
    };

    getPlayersByIds(playerIds)
      .then((players) => {
        const map: Record<string, number> = {};
        playerIds.forEach((id) => {
          const found = players.find((p) => p.id === id);
          map[id] = found ? found.rating : 1200;
        });
        setRatingsMap(map);
        setPreview(buildPreview(map));
        setStatus('idle');
      })
      .catch(() => {
        const fallback: Record<string, number> = {};
        playerIds.forEach((id) => {
          fallback[id] = 1200;
        });
        setRatingsMap(fallback);
        setPreview(buildPreview(fallback));
        setStatus('idle');
      });
  }, [isOpen, roundHistory]);

  const handleConfirm = async () => {
    const names = getNames();
    const nilSetting = getNilSetting();
    if (!names) return;

    setStatus('submitting');

    try {
      const t1Score = calculateTeamScoreFromRoundHistory(
        roundHistory,
        TEAM1,
        nilSetting,
      ).teamScore;
      const t2Score = calculateTeamScoreFromRoundHistory(
        roundHistory,
        TEAM2,
        nilSetting,
      ).teamScore;

      const team1Players: [PlayerRating, PlayerRating] = [
        { id: names.t1p1Name, rating: ratingsMap[names.t1p1Name] ?? 1200 },
        { id: names.t1p2Name, rating: ratingsMap[names.t1p2Name] ?? 1200 },
      ];
      const team2Players: [PlayerRating, PlayerRating] = [
        { id: names.t2p1Name, rating: ratingsMap[names.t2p1Name] ?? 1200 },
        { id: names.t2p2Name, rating: ratingsMap[names.t2p2Name] ?? 1200 },
      ];

      const { team1Results, team2Results } = calculateEloDeltas(
        team1Players,
        team2Players,
        t1Score,
        t2Score,
      );

      await recordRankedGame({
        team1PlayerIds: [names.t1p1Name, names.t1p2Name],
        team2PlayerIds: [names.t2p1Name, names.t2p2Name],
        team1NewRatings: [team1Results[0].ratingAfter, team1Results[1].ratingAfter],
        team2NewRatings: [team2Results[0].ratingAfter, team2Results[1].ratingAfter],
        roundHistory,
      });

      setStatus('success');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred');
      setStatus('error');
    }
  };

  const handleClose = () => {
    setStatus('loading');
    setErrorMessage('');
    setPreview(null);
    onClose();
  };

  const names = getNames();
  const nilSetting = getNilSetting();

  const t1Score = names
    ? calculateTeamScoreFromRoundHistory(roundHistory, TEAM1, nilSetting).teamScore
    : 0;
  const t2Score = names
    ? calculateTeamScoreFromRoundHistory(roundHistory, TEAM2, nilSetting).teamScore
    : 0;

  const winnerLabel =
    t1Score > t2Score
      ? `${names?.team1Name ?? 'Team 1'} wins!`
      : t2Score > t1Score
        ? `${names?.team2Name ?? 'Team 2'} wins!`
        : "It's a draw!";

  return (
    <AppModal
      isOpen={isOpen}
      onClose={() => handleClose()}
      title={
        status === 'success'
          ? 'Game Recorded!'
          : status === 'error'
            ? 'Error'
            : 'Record as Ranked'
      }
    >
      {(status === 'loading' || status === 'submitting') && (
        <Flex justify="center" align="center" py={8}>
          <Spinner size="lg" />
        </Flex>
      )}

      {status === 'idle' && names && (
        <Box p={4}>
          <Text fontWeight="bold" fontSize="lg" mb={3} textAlign="center">
            {winnerLabel}
          </Text>

          <Flex justify="space-between" mb={4}>
            <Box flex={1}>
              <Text fontWeight="semibold" mb={1}>
                {names.team1Name}
              </Text>
              <Text fontSize="2xl" fontWeight="bold">
                {t1Score}
              </Text>
            </Box>
            <Box flex={1} textAlign="right">
              <Text fontWeight="semibold" mb={1}>
                {names.team2Name}
              </Text>
              <Text fontSize="2xl" fontWeight="bold">
                {t2Score}
              </Text>
            </Box>
          </Flex>

          {preview && (
            <Box
              borderTop="1px solid"
              borderColor="whiteAlpha.200"
              pt={3}
              mb={4}
            >
              <Text fontSize="sm" color="gray.400" mb={2}>
                Rating changes
              </Text>
              <Flex justify="space-between">
                <Box flex={1}>
                  {preview.team1Results.map((r, i) => (
                    <Text key={r.playerId} fontSize="sm" mb={1}>
                      {i === 0 ? names.t1p1Name : names.t1p2Name}:{' '}
                      {Math.round(r.ratingBefore)} →{' '}
                      {Math.round(r.ratingAfter)}{' '}
                      <Text
                        as="span"
                        color={r.ratingDelta >= 0 ? 'green.400' : 'red.400'}
                      >
                        ({formatDelta(r.ratingDelta)})
                      </Text>
                    </Text>
                  ))}
                </Box>
                <Box flex={1} textAlign="right">
                  {preview.team2Results.map((r, i) => (
                    <Text key={r.playerId} fontSize="sm" mb={1}>
                      {i === 0 ? names.t2p1Name : names.t2p2Name}:{' '}
                      {Math.round(r.ratingBefore)} →{' '}
                      {Math.round(r.ratingAfter)}{' '}
                      <Text
                        as="span"
                        color={r.ratingDelta >= 0 ? 'green.400' : 'red.400'}
                      >
                        ({formatDelta(r.ratingDelta)})
                      </Text>
                    </Text>
                  ))}
                </Box>
              </Flex>
            </Box>
          )}

          <Flex gap={3} justify="flex-end">
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleConfirm}>Confirm</Button>
          </Flex>
        </Box>
      )}

      {status === 'success' && (
        <Box p={4} textAlign="center">
          <Text mb={4}>
            Game successfully recorded. Ratings have been updated.
          </Text>
          <Button onClick={handleClose}>Close</Button>
        </Box>
      )}

      {status === 'error' && (
        <Box p={4}>
          <Text color="red.400" mb={4}>
            {errorMessage}
          </Text>
          <Flex gap={3} justify="flex-end">
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={() => setStatus('idle')}>Try Again</Button>
          </Flex>
        </Box>
      )}
    </AppModal>
  );
}

export default RecordRankedGameModal;
