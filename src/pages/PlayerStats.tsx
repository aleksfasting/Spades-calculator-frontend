import { useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import { Container, Box, Flex, Text, Spinner, Button, SeasonSwitcher } from '../components/ui';
import Header from '../components/ui/Header';
import { getPlayerRounds, getPlayersByIds, getSeasons, getAllGames } from '../services';
import type { DbRound, DbGame, Player } from '../services';
import { computePlayerStats } from '../helpers/math/playerStats';
import type { PlayerStats } from '../helpers/math/playerStats';
import { useSelectedSeason } from '../helpers/utils/hooks';
import {
  filterGamesForSeason,
  filterRoundsForSeason,
  seasonQuery,
  type ArchivedSeason,
} from '../helpers/utils/seasons';

const CHART_GREEN = '#68D391';
const CHART_RED = '#FC8181';

function StatCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box p={4} borderRadius="lg" border="1px solid" borderColor="whiteAlpha.200" bg="whiteAlpha.50">
      <Text
        fontSize="xs"
        color="gray.400"
        mb={3}
        fontWeight="semibold"
        textTransform="uppercase"
        letterSpacing="wide"
      >
        {title}
      </Text>
      {children}
    </Box>
  );
}

function NoDataMsg({ message }: { message: string }) {
  return (
    <Flex height="130px" align="center" justify="center">
      <Text color="gray.600" fontSize="sm" textAlign="center">
        {message}
      </Text>
    </Flex>
  );
}

function DonutChart({
  success,
  failure,
  centerLabel,
  subtitleLabel,
  noDataMessage = 'No data recorded',
}: {
  success: number;
  failure: number;
  centerLabel: string;
  subtitleLabel: string;
  noDataMessage?: string;
}) {
  if (success + failure === 0) return <NoDataMsg message={noDataMessage} />;

  const data = [
    { name: 'Success', value: success },
    { name: 'Failure', value: failure },
  ];

  return (
    <Box>
      <Box position="relative" h="130px">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="50%"
              outerRadius="70%"
              dataKey="value"
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              <Cell fill={CHART_GREEN} />
              <Cell fill={CHART_RED} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <Flex
          position="absolute"
          top="0"
          left="0"
          right="0"
          bottom="0"
          align="center"
          justify="center"
          pointerEvents="none"
        >
          <Text fontSize="xl" fontWeight="bold">
            {centerLabel}
          </Text>
        </Flex>
      </Box>
      <Text textAlign="center" fontSize="xs" color="gray.400" mt={1}>
        {subtitleLabel}
      </Text>
    </Box>
  );
}

function WinsBarChart({
  wins,
  losses,
  labels,
}: {
  wins: number;
  losses: number;
  labels: [string, string];
}) {
  if (wins === 0 && losses === 0) return <NoDataMsg message="No data recorded" />;

  const data = [
    { name: labels[0], value: wins },
    { name: labels[1], value: losses },
  ];

  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} margin={{ top: 16, right: 10, bottom: 5, left: -20 }}>
        <XAxis
          dataKey="name"
          tick={{ fill: '#718096', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: '#718096', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0] as [number, number, number, number]}>
          <Cell fill={CHART_GREEN} />
          <Cell fill={CHART_RED} />
          <LabelList
            dataKey="value"
            position="top"
            style={{ fill: '#CBD5E0', fontSize: 12 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function PlayerStatsPage() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();

  const [rounds, setRounds] = useState<DbRound[]>([]);
  const [player, setPlayer] = useState<Player | null>(null);
  const [seasons, setSeasons] = useState<ArchivedSeason[]>([]);
  const [games, setGames] = useState<DbGame[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  const { season, setSeason } = useSelectedSeason(seasons.map((s) => s.name));
  const decodedId = playerId ? decodeURIComponent(playerId) : '';

  useEffect(() => {
    if (!decodedId) return;

    Promise.all([
      getPlayerRounds(decodedId),
      getPlayersByIds([decodedId]),
      getSeasons(),
      getAllGames(),
    ])
      .then(([roundData, playerData, seasonData, gameData]) => {
        setRounds(roundData);
        setPlayer(playerData[0] ?? null);
        setSeasons(seasonData);
        setGames(gameData);
        setStatus('success');
      })
      .catch(() => setStatus('error'));
  }, [decodedId]);

  const seasonGames = useMemo(
    () => filterGamesForSeason(games, season, seasons),
    [games, season, seasons],
  );

  const seasonRounds = useMemo(
    () => filterRoundsForSeason(rounds, seasonGames),
    [rounds, seasonGames],
  );

  const archived = seasons.find((s) => s.name === season);
  const displayRating =
    archived?.rankings.find((r) => r.id === decodedId)?.rating ?? player?.rating;

  const stats: PlayerStats | null = useMemo(() => {
    if (!decodedId) return null;
    return computePlayerStats(decodedId, seasonRounds);
  }, [decodedId, seasonRounds]);

  const reliabilityPct =
    stats && stats.reliability.total > 0
      ? Math.round((stats.reliability.made / stats.reliability.total) * 100)
      : null;

  const nilTotal = stats ? stats.nils.successful + stats.nils.unsuccessful : 0;
  const nilPct =
    nilTotal > 0 && stats
      ? Math.round((stats.nils.successful / nilTotal) * 100)
      : null;

  const blindNilTotal = stats
    ? stats.blindNils.successful + stats.blindNils.unsuccessful
    : 0;
  const blindNilPct =
    blindNilTotal > 0 && stats
      ? Math.round((stats.blindNils.successful / blindNilTotal) * 100)
      : null;

  const leaderboardPath = `/leaderboard${seasonQuery(season)}`;

  return (
    <Container maxW="container.sm" py={4}>
      <Header />

      <Box mt={6}>
        <Button variant="outline" size="sm" onClick={() => navigate(leaderboardPath)} mb={4}>
          ← Leaderboard
        </Button>

        {!decodedId && (
          <Flex direction="column" align="center" py={12} gap={4}>
            <Text color="red.400">Player not found.</Text>
            <Button variant="outline" onClick={() => navigate(leaderboardPath)}>
              Back to Leaderboard
            </Button>
          </Flex>
        )}

        {decodedId && status === 'loading' && (
          <Flex justify="center" py={12}>
            <Spinner size="lg" />
          </Flex>
        )}

        {decodedId && status === 'error' && (
          <Flex direction="column" align="center" py={12} gap={4}>
            <Text color="red.400">Failed to load player stats.</Text>
            <Button variant="outline" onClick={() => navigate(leaderboardPath)}>
              Back to Leaderboard
            </Button>
          </Flex>
        )}

        {decodedId && status === 'success' && (
          <>
            <Flex align="baseline" gap={3} mb={3} flexWrap="wrap">
              <Text fontSize="var(--app-font-xl)" fontWeight="bold">
                {decodedId}
              </Text>
              {displayRating != null && (
                <Text color="gray.400" fontSize="sm">
                  Rating: {Math.round(displayRating)}
                </Text>
              )}
            </Flex>

            <Box mb={6}>
              <SeasonSwitcher seasons={seasons} selected={season} onSelect={setSeason} />
            </Box>

            {seasonRounds.length === 0 ? (
              <Text color="gray.400" textAlign="center" py={12}>
                No ranked rounds recorded yet.
              </Text>
            ) : (
              <Box
                display="grid"
                gridTemplateColumns={{ base: '1fr', sm: '1fr 1fr' }}
                gap={4}
              >
                <StatCard title="Reliability">
                  <DonutChart
                    success={stats?.reliability.made ?? 0}
                    failure={(stats?.reliability.total ?? 0) - (stats?.reliability.made ?? 0)}
                    centerLabel={reliabilityPct !== null ? `${reliabilityPct}%` : '—'}
                    subtitleLabel={
                      stats && stats.reliability.total > 0
                        ? `${stats.reliability.made} / ${stats.reliability.total} bids made`
                        : ''
                    }
                    noDataMessage="No non-nil bids recorded"
                  />
                </StatCard>

                <StatCard title="Game Wins">
                  <WinsBarChart
                    wins={stats?.gameWins.wins ?? 0}
                    losses={stats?.gameWins.losses ?? 0}
                    labels={['Wins', 'Losses']}
                  />
                </StatCard>

                <StatCard title="Round Wins">
                  <WinsBarChart
                    wins={stats?.roundWins.wins ?? 0}
                    losses={(stats?.roundWins.total ?? 0) - (stats?.roundWins.wins ?? 0)}
                    labels={['Wins', 'Losses']}
                  />
                </StatCard>

                <StatCard title="Avg Game Win Margin">
                  <Flex
                    height="140px"
                    align="center"
                    justify="center"
                    direction="column"
                    gap={1}
                  >
                    {stats?.avgWinMargin != null ? (
                      <>
                        <Text fontSize="4xl" fontWeight="bold" color="green.300">
                          +{stats.avgWinMargin}
                        </Text>
                        <Text fontSize="xs" color="gray.400">
                          points per win
                        </Text>
                      </>
                    ) : (
                      <Text color="gray.600" fontSize="sm">
                        No wins recorded
                      </Text>
                    )}
                  </Flex>
                </StatCard>

                <StatCard title="Nil Bids">
                  <DonutChart
                    success={stats?.nils.successful ?? 0}
                    failure={stats?.nils.unsuccessful ?? 0}
                    centerLabel={nilPct !== null ? `${nilPct}%` : '—'}
                    subtitleLabel={
                      nilTotal > 0 && stats
                        ? `${stats.nils.successful} made / ${stats.nils.unsuccessful} missed`
                        : ''
                    }
                    noDataMessage="No nil bids recorded"
                  />
                </StatCard>

                <StatCard title="Blind Nils">
                  <DonutChart
                    success={stats?.blindNils.successful ?? 0}
                    failure={stats?.blindNils.unsuccessful ?? 0}
                    centerLabel={blindNilPct !== null ? `${blindNilPct}%` : '—'}
                    subtitleLabel={
                      blindNilTotal > 0 && stats
                        ? `${stats.blindNils.successful} made / ${stats.blindNils.unsuccessful} missed`
                        : ''
                    }
                    noDataMessage="No blind nils recorded"
                  />
                </StatCard>
              </Box>
            )}
          </>
        )}
      </Box>
    </Container>
  );
}

export default PlayerStatsPage;
