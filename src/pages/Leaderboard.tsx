import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Box, Flex, Text, Spinner, Button, SeasonSwitcher } from '../components/ui';
import Header from '../components/ui/Header';
import { SaveResetLeaderboardModal } from '../components/modals';
import { getPlayers, getSeasons, getAllGames } from '../services';
import type { Player, DbGame } from '../services';
import type { ArchivedSeason } from '../helpers/utils/seasons';
import {
  CURRENT_SEASON,
  DEFAULT_RATING,
  leaderboardForSeason,
  seasonQuery,
} from '../helpers/utils/seasons';
import { useSelectedSeason } from '../helpers/utils/hooks';

function fetchLeaderboardData() {
  return Promise.all([getPlayers(), getSeasons(), getAllGames()]);
}

function Leaderboard() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [seasons, setSeasons] = useState<ArchivedSeason[]>([]);
  const [games, setGames] = useState<DbGame[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [isSaveResetOpen, setIsSaveResetOpen] = useState(false);

  const { season, setSeason } = useSelectedSeason(seasons.map((s) => s.name));

  const applyLeaderboard = (
    playerData: Player[],
    seasonData: ArchivedSeason[],
    gameData: DbGame[],
  ) => {
    setPlayers(playerData);
    setSeasons(seasonData);
    setGames(gameData);
    setStatus('success');
  };

  const load = () => {
    setStatus('loading');
    fetchLeaderboardData()
      .then(([playerData, seasonData, gameData]) =>
        applyLeaderboard(playerData, seasonData, gameData),
      )
      .catch(() => setStatus('error'));
  };

  useEffect(() => {
    fetchLeaderboardData()
      .then(([playerData, seasonData, gameData]) =>
        applyLeaderboard(playerData, seasonData, gameData),
      )
      .catch(() => setStatus('error'));
  }, []);

  const displayed = useMemo(
    () => leaderboardForSeason(season, seasons, players, games),
    [season, seasons, players, games],
  );

  const isCurrent = season === CURRENT_SEASON;

  return (
    <Container maxW="container.sm" py={4}>
      <Header />

      <Box mt={6}>
        <Flex align="baseline" justify="space-between" mb={2} gap={3} flexWrap="wrap">
          <Text fontSize="var(--app-font-xl)" fontWeight="bold">
            Leaderboard
          </Text>
          <Flex gap={2}>
            {isCurrent && status === 'success' && players.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setIsSaveResetOpen(true)}>
                Save & Reset
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/stats${seasonQuery(season)}`)}
            >
              Compare Stats
            </Button>
          </Flex>
        </Flex>

      

        <Box mb={4}>
          <SeasonSwitcher seasons={seasons} selected={season} onSelect={setSeason} />
        </Box>

        {status === 'loading' && (
          <Flex justify="center" py={12}>
            <Spinner size="lg" />
          </Flex>
        )}

        {status === 'error' && (
          <Flex direction="column" align="center" py={12} gap={4}>
            <Text color="red.400">Failed to load rankings.</Text>
            <Button variant="outline" onClick={load}>
              Retry
            </Button>
          </Flex>
        )}

        {status === 'success' && displayed.length === 0 && (
          <Text color="gray.400" textAlign="center" py={12}>
            {isCurrent && seasons.length > 0
              ? 'No ranked games this season yet.'
              : 'No ranked games recorded yet.'}
          </Text>
        )}

        {status === 'success' && displayed.length > 0 && (
          <Box>
            <Flex
              px={3}
              py={2}
              borderBottom="1px solid"
              borderColor="whiteAlpha.200"
            >
              <Text fontSize="sm" color="gray.400" w="40px">
                #
              </Text>
              <Text fontSize="sm" color="gray.400" flex={1}>
                Player
              </Text>
              <Text fontSize="sm" color="gray.400">
                Rating
              </Text>
            </Flex>

            {displayed.map((player, index) => {
              return (
                <Flex
                  key={player.id}
                  px={3}
                  py={3}
                  align="center"
                  borderBottom="1px solid"
                  borderColor="whiteAlpha.100"
                  _hover={{ bg: 'whiteAlpha.50' }}
                  cursor="pointer"
                  onClick={() =>
                    navigate(
                      `/stats/${encodeURIComponent(player.id)}${seasonQuery(season)}`,
                    )
                  }
                >
                  <Text w="40px" color="gray.400" fontWeight="semibold">
                    {index + 1}
                  </Text>
                  <Flex flex={1} align="center" gap={2}>
                    <Text fontWeight="normal">{player.id}</Text>
                  </Flex>
                  <Text
                    fontWeight="semibold"
                    color={player.rating === DEFAULT_RATING ? 'gray.400' : 'inherit'}
                  >
                    {Math.round(player.rating)}
                  </Text>
                </Flex>
              );
            })}
          </Box>
        )}
      </Box>

      <SaveResetLeaderboardModal
        isOpen={isSaveResetOpen}
        onClose={() => setIsSaveResetOpen(false)}
        currentPlayers={players}
        existingSeasons={seasons}
        onSuccess={(saved) => {
          setIsSaveResetOpen(false);
          setSeasons((prev) => [
            saved,
            ...prev.filter((s) => s.name !== saved.name),
          ]);
          setPlayers((prev) =>
            prev.map((p) => ({ ...p, rating: DEFAULT_RATING })),
          );
          setSeason(saved.name);
          load();
        }}
      />
    </Container>
  );
}

export default Leaderboard;
