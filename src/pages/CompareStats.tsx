import { useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  LabelList,
  Tooltip,
} from 'recharts';
import { Container, Box, Flex, Text, Spinner, Button } from '../components/ui';
import Header from '../components/ui/Header';
import { getPlayers, getAllRounds, getAllGames } from '../services';
import type { Player, DbRound, DbGame } from '../services';
import { computePlayerStats } from '../helpers/math/playerStats';
import type { PlayerStats } from '../helpers/math/playerStats';

const CHART_GREEN = '#68D391';
const CHART_RED = '#FC8181';
const CHART_BLUE = '#63B3ED';
const CHART_YELLOW = '#F6E05E';
const CHART_ORANGE = '#F6AD55';
const CHART_PURPLE = '#B794F4';

const CHART_MARGIN = { top: 20, right: 8, bottom: 0, left: -10 };
const AXIS_TICK_COLOR = '#718096';

const RANK_COLORS = [
  '#FFD700', // 1st – gold
  '#A8A9AD', // 2nd – silver
  '#CD7F32', // 3rd – bronze
  '#63B3ED', // 4th
  '#68D391', // 5th
  '#F6AD55', // 6th
  '#B794F4', // 7th
  '#FC8181', // 8th
  '#4FD1C5', // 9th
  '#F687B3', // 10th
];
const RANK_ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
const RANK_GRAY = '#718096';

type SortKey =
  | 'name'
  | 'rating'
  | 'games'
  | 'winRate'
  | 'roundWinRate'
  | 'reliability'
  | 'nilRate'
  | 'avgWinMargin';

interface PlayerRow {
  id: string;
  rating: number;
  stats: PlayerStats;
  games: number;
  winRate: number | null;
  roundWinRate: number | null;
  reliabilityRate: number | null;
  nilRate: number | null;
  avgWinMargin: number | null;
}

const TABLE_COLS: { key: SortKey; label: string; title: string }[] = [
  { key: 'rating', label: 'Rating', title: 'ELO Rating' },
  { key: 'games', label: 'Games', title: 'Games (W-L)' },
  { key: 'winRate', label: 'Win%', title: 'Game win rate' },
  { key: 'roundWinRate', label: 'Rnd%', title: 'Round win rate' },
  { key: 'reliability', label: 'Rel%', title: 'Bid reliability' },
  { key: 'nilRate', label: 'Nil%', title: 'Nil success rate' },
  { key: 'avgWinMargin', label: '+Pts', title: 'Average win margin' },
];

function buildRow(player: Player, rounds: DbRound[]): PlayerRow {
  const stats = computePlayerStats(player.id, rounds);
  const games = stats.gameWins.wins + stats.gameWins.losses;
  const winRate = games > 0 ? Math.round((stats.gameWins.wins / games) * 100) : null;
  const roundWinRate =
    stats.roundWins.total > 0
      ? Math.round((stats.roundWins.wins / stats.roundWins.total) * 100)
      : null;
  const reliabilityRate =
    stats.reliability.total > 0
      ? Math.round((stats.reliability.made / stats.reliability.total) * 100)
      : null;
  const nilTotal = stats.nils.successful + stats.nils.unsuccessful;
  const nilRate = nilTotal > 0 ? Math.round((stats.nils.successful / nilTotal) * 100) : null;
  return {
    id: player.id,
    rating: player.rating,
    stats,
    games,
    winRate,
    roundWinRate,
    reliabilityRate,
    nilRate,
    avgWinMargin: stats.avgWinMargin,
  };
}

function sortRows(rows: PlayerRow[], key: SortKey, dir: 'asc' | 'desc'): PlayerRow[] {
  return [...rows].sort((a, b) => {
    let av: number | string | null;
    let bv: number | string | null;
    switch (key) {
      case 'name':
        av = a.id;
        bv = b.id;
        break;
      case 'rating':
        av = a.rating;
        bv = b.rating;
        break;
      case 'games':
        av = a.games;
        bv = b.games;
        break;
      case 'winRate':
        av = a.winRate;
        bv = b.winRate;
        break;
      case 'roundWinRate':
        av = a.roundWinRate;
        bv = b.roundWinRate;
        break;
      case 'reliability':
        av = a.reliabilityRate;
        bv = b.reliabilityRate;
        break;
      case 'nilRate':
        av = a.nilRate;
        bv = b.nilRate;
        break;
      case 'avgWinMargin':
        av = a.avgWinMargin;
        bv = b.avgWinMargin;
        break;
    }
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    if (typeof av === 'string' && typeof bv === 'string')
      return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    return dir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });
}

function SortIcon({ direction }: { direction: 'asc' | 'desc' | null }) {
  if (!direction)
    return (
      <Text as="span" color="gray.600" ml={1} fontSize="xs">
        ⇅
      </Text>
    );
  return (
    <Text as="span" color="blue.300" ml={1} fontSize="xs">
      {direction === 'asc' ? '↑' : '↓'}
    </Text>
  );
}

function ChartCard({
  title,
  legend,
  children,
}: {
  title: string;
  legend?: { color: string; label: string }[];
  children: ReactNode;
}) {
  return (
    <Box
      p={4}
      borderRadius="lg"
      border="1px solid"
      borderColor="whiteAlpha.200"
      bg="whiteAlpha.50"
    >
      <Flex align="center" justify="space-between" mb={3}>
        <Text
          fontSize="xs"
          color="gray.400"
          fontWeight="semibold"
          textTransform="uppercase"
          letterSpacing="wide"
        >
          {title}
        </Text>
        {legend && (
          <Flex gap={3} flexWrap="wrap" justify="flex-end">
            {legend.map((l) => (
              <Flex key={l.label} align="center" gap={1}>
                <Box
                  w={2}
                  h={2}
                  borderRadius="sm"
                  style={{ background: l.color, flexShrink: 0 }}
                />
                <Text fontSize="xs" color="gray.500">
                  {l.label}
                </Text>
              </Flex>
            ))}
          </Flex>
        )}
      </Flex>
      {children}
    </Box>
  );
}

function NoData({ message = 'No data recorded' }: { message?: string }) {
  return (
    <Flex height="160px" align="center" justify="center">
      <Text color="gray.600" fontSize="sm">
        {message}
      </Text>
    </Flex>
  );
}

function RotatedTick({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
}) {
  if (!payload) return null;
  const name = payload.value;
  const display = name.length > 10 ? name.slice(0, 9) + '…' : name;
  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      <text
        dy={8}
        textAnchor="end"
        fill={AXIS_TICK_COLOR}
        fontSize={11}
        transform="rotate(-35)"
      >
        {display}
      </text>
    </g>
  );
}

function DarkTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; fill?: string; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: '#171923',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 6,
        padding: '8px 12px',
        fontSize: 11,
        pointerEvents: 'none',
      }}
    >
      <div style={{ color: '#e2e8f0', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((entry, i) => (
        <div
          key={i}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: entry.fill ?? entry.color,
              flexShrink: 0,
            }}
          />
          <span style={{ color: '#a0aec0' }}>
            {entry.name}: {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function pct(n: number | null): string {
  return n !== null ? `${n}%` : '—';
}

const TOP_N = 10;

function buildRankingTimeline(
  games: DbGame[],
  players: Player[],
): Array<Record<string, number>> {
  if (games.length === 0) return [];

  const currentRatingMap = new Map(players.map((p) => [p.id, p.rating]));

  const lastKnown = new Map<string, number>();
  players.forEach((p) => lastKnown.set(p.id, 1200));
  games.forEach((g) => {
    [g.t1p1, g.t1p2, g.t2p1, g.t2p2].forEach((id) => {
      if (id && !lastKnown.has(id)) lastKnown.set(id, 1200);
    });
  });

  // Returns the rating for playerId AFTER game at gameIdx by looking at the
  // before_rating of their next game appearance, or current rating if last game.
  function afterRating(gameIdx: number, playerId: string | null): number | null {
    if (!playerId) return null;
    for (let j = gameIdx + 1; j < games.length; j++) {
      const g = games[j];
      if (g.t1p1 === playerId && g.t1p1_before_rating != null) return g.t1p1_before_rating;
      if (g.t1p2 === playerId && g.t1p2_before_rating != null) return g.t1p2_before_rating;
      if (g.t2p1 === playerId && g.t2p1_before_rating != null) return g.t2p1_before_rating;
      if (g.t2p2 === playerId && g.t2p2_before_rating != null) return g.t2p2_before_rating;
    }
    return currentRatingMap.get(playerId) ?? 1200;
  }

  const snapshots: Array<Record<string, number>> = [];

  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    const time = new Date(game.createdAt).getTime();

    // Update lastKnown with after-ratings for the 4 players in this game
    for (const id of [game.t1p1, game.t1p2, game.t2p1, game.t2p2]) {
      const ar = afterRating(i, id);
      if (id && ar != null) lastKnown.set(id, ar);
    }

    const sorted = [...lastKnown.entries()].sort((a, b) => b[1] - a[1]);
    const point: Record<string, number> = { time };
    sorted.slice(0, TOP_N).forEach(([id], idx) => {
      point[id] = idx + 1;
    });
    snapshots.push(point);
  }

  // Extend ribbons to now by copying the last snapshot's rankings
  if (snapshots.length > 0) {
    const last = snapshots[snapshots.length - 1];
    const nowPoint: Record<string, number> = { ...last, time: Date.now() };
    snapshots.push(nowPoint);
  }

  return snapshots;
}

interface RankTooltipProps {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number | undefined }>;
  label?: number;
  colorForPlayer: (id: string) => string;
}

function RankTooltip({ active, payload, label, colorForPlayer }: RankTooltipProps) {
  if (!active || !payload || label == null) return null;

  const entries = payload
    .filter((p) => p.value !== undefined)
    .sort((a, b) => (a.value ?? 99) - (b.value ?? 99));

  const dateStr = new Date(label).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Box
      bg="gray.800"
      border="1px solid"
      borderColor="whiteAlpha.200"
      borderRadius="md"
      p={3}
      fontSize="xs"
      minW="160px"
    >
      <Text color="gray.400" mb={2}>
        {dateStr}
      </Text>
      {entries.map((entry) => (
        <Flex key={entry.dataKey} align="center" gap={2} mb={1}>
          <Box
            w={2}
            h={2}
            borderRadius="full"
            flexShrink={0}
            style={{ background: colorForPlayer(entry.dataKey) }}
          />
          <Text color="gray.300" flex={1}>
            {entry.dataKey}
          </Text>
          <Text color="white" fontWeight="bold">
            {RANK_ORDINALS[(entry.value ?? 1) - 1] ?? `${entry.value}th`}
          </Text>
        </Flex>
      ))}
    </Box>
  );
}

function CompareStats() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [allRounds, setAllRounds] = useState<DbRound[]>([]);
  const [allGames, setAllGames] = useState<DbGame[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [sortKey, setSortKey] = useState<SortKey>('rating');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    Promise.all([getPlayers(), getAllRounds(), getAllGames()])
      .then(([playerData, roundData, gameData]) => {
        setPlayers(playerData);
        setAllRounds(roundData);
        setAllGames(gameData);
        setStatus('success');
      })
      .catch(() => setStatus('error'));
  }, []);

  const chartRows = useMemo(() => {
    if (status !== 'success') return [];
    return players
      .map((p) => {
        const playerRounds = allRounds.filter(
          (r) =>
            r.t1p1 === p.id || r.t1p2 === p.id || r.t2p1 === p.id || r.t2p2 === p.id,
        );
        return buildRow(p, playerRounds);
      })
      .sort((a, b) => b.rating - a.rating);
  }, [players, allRounds, status]);

  const rows = useMemo(
    () => sortRows(chartRows, sortKey, sortDir),
    [chartRows, sortKey, sortDir],
  );

  // players is already sorted by rating desc from getPlayers()
  const currentRankMap = useMemo(
    () => new Map(players.map((p, idx) => [p.id, idx])),
    [players],
  );

  const colorForPlayer = (id: string): string => {
    const rank = currentRankMap.get(id);
    return rank !== undefined && rank < RANK_COLORS.length ? RANK_COLORS[rank] : RANK_GRAY;
  };

  const ribbonData = useMemo(
    () => (status === 'success' ? buildRankingTimeline(allGames, players) : []),
    [allGames, players, status],
  );

  const topPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    ribbonData.forEach((point) => {
      Object.keys(point).forEach((key) => {
        if (key !== 'time') ids.add(key);
      });
    });
    return [...ids].sort((a, b) => {
      const ra = currentRankMap.get(a) ?? Infinity;
      const rb = currentRankMap.get(b) ?? Infinity;
      return ra !== rb ? ra - rb : a.localeCompare(b);
    });
  }, [ribbonData, currentRankMap]);

  const dayTicks = useMemo(() => {
    if (ribbonData.length < 2) return [];
    const start = ribbonData[0].time;
    const end = ribbonData[ribbonData.length - 1].time;
    const ticks: number[] = [];
    const d = new Date(start);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 1);
    while (d.getTime() <= end) {
      ticks.push(d.getTime());
      d.setDate(d.getDate() + 1);
    }
    return ticks;
  }, [ribbonData]);

  const cd = useMemo(
    () => ({
      gameWins: chartRows
        .map((x) => ({
          name: x.id,
          Wins: x.stats.gameWins.wins,
          Losses: x.stats.gameWins.losses,
        }))
        .sort((a, b) => b.Wins - a.Wins || a.Losses - b.Losses),
      roundWins: chartRows
        .map((x) => ({
          name: x.id,
          'Round Wins': x.stats.roundWins.wins,
          'Round Losses': x.stats.roundWins.total - x.stats.roundWins.wins,
        }))
        .sort((a, b) => b['Round Wins'] - a['Round Wins']),
      nils: chartRows
        .filter((x) => x.stats.nils.successful + x.stats.nils.unsuccessful > 0)
        .map((x) => ({
          name: x.id,
          Made: x.stats.nils.successful,
          Missed: x.stats.nils.unsuccessful,
        }))
        .sort((a, b) => b.Made - a.Made),
      blindNils: chartRows
        .filter((x) => x.stats.blindNils.successful + x.stats.blindNils.unsuccessful > 0)
        .map((x) => ({
          name: x.id,
          Made: x.stats.blindNils.successful,
          Missed: x.stats.blindNils.unsuccessful,
        }))
        .sort((a, b) => b.Made - a.Made),
      avgBid: chartRows
        .filter((x) => x.stats.avgBid !== null)
        .map((x) => ({ name: x.id, 'Avg Bid': x.stats.avgBid! }))
        .sort((a, b) => b['Avg Bid'] - a['Avg Bid']),
      highestBid: chartRows
        .filter((x) => x.stats.highestBid !== null)
        .map((x) => ({ name: x.id, 'Highest Bid': x.stats.highestBid! }))
        .sort((a, b) => b['Highest Bid'] - a['Highest Bid']),
      winMargin: chartRows
        .filter((x) => x.stats.avgWinMargin !== null)
        .map((x) => ({ name: x.id, 'Avg Margin': x.stats.avgWinMargin! }))
        .sort((a, b) => b['Avg Margin'] - a['Avg Margin']),
      bidOutcomes: chartRows
        .filter((x) => x.stats.reliability.total > 0)
        .map((x) => ({
          name: x.id,
          Exact: x.stats.bidOutcomes.exact,
          Bags: x.stats.bidOutcomes.over,
          Failed: x.stats.bidOutcomes.under,
        }))
        .sort(
          (a, b) =>
            b.Exact + b.Bags + b.Failed - (a.Exact + a.Bags + a.Failed),
        ),
    }),
    [chartRows],
  );

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const xAxis = (
    <XAxis
      dataKey="name"
      tick={(props: unknown) => <RotatedTick {...(props as { x: number; y: number; payload: { value: string } })} />}
      height={55}
      axisLine={false}
      tickLine={false}
      interval={0}
    />
  );

  const yAxis = (
    <YAxis
      tick={{ fill: '#718096', fontSize: 10 }}
      axisLine={false}
      tickLine={false}
      width={28}
    />
  );

  const tooltip = <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />;

  const labelStyle = { fill: '#CBD5E0', fontSize: 10 };

  return (
    <Container maxW="container.sm" py={4}>
      <Header />

      <Box mt={6}>
        <Button variant="outline" size="sm" onClick={() => navigate('/leaderboard')} mb={4}>
          ← Leaderboard
        </Button>

        <Text fontSize="var(--app-font-xl)" fontWeight="bold" mb={6}>
          Player Comparison
        </Text>

        {status === 'loading' && (
          <Flex justify="center" py={12}>
            <Spinner size="lg" />
          </Flex>
        )}

        {status === 'error' && (
          <Flex direction="column" align="center" py={12} gap={4}>
            <Text color="red.400">Failed to load stats.</Text>
            <Button variant="outline" onClick={() => navigate('/leaderboard')}>
              Back to Leaderboard
            </Button>
          </Flex>
        )}

        {status === 'success' && chartRows.length === 0 && (
          <Text color="gray.400" textAlign="center" py={12}>
            No ranked games recorded yet.
          </Text>
        )}

        {status === 'success' && chartRows.length > 0 && (
          <Flex direction="column" gap={4}>
            {/* ── Ranking Progression ── */}
            <ChartCard
              title="Ranking Progression"
              legend={topPlayerIds.map((id) => ({ color: colorForPlayer(id), label: id }))}
            >
              {ribbonData.length < 2 ? (
                <NoData message="Not enough games to show progression" />
              ) : (
                <ResponsiveContainer width="100%" height={500}>
                  <LineChart
                    data={ribbonData}
                    margin={{ top: 16, right: 16, bottom: 48, left: 8 }}
                  >
                    <XAxis
                      dataKey="time"
                      type="number"
                      scale="time"
                      domain={['dataMin', 'dataMax']}
                      ticks={dayTicks}
                      tickFormatter={(ts: number) =>
                        new Date(ts).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })
                      }
                      tick={{ fill: AXIS_TICK_COLOR, fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      angle={-30}
                      textAnchor="end"
                      height={52}
                    />
                    <YAxis
                      reversed={true}
                      domain={[0.5, 10.5]}
                      ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
                      tickFormatter={(r: number) => RANK_ORDINALS[r - 1] ?? `${r}th`}
                      tick={{ fill: AXIS_TICK_COLOR, fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                    />
                    <Tooltip
                      content={(props) => (
                        <RankTooltip
                          active={props.active}
                          payload={
                            props.payload as Array<{
                              dataKey: string;
                              value: number | undefined;
                            }>
                          }
                          label={props.label as number}
                          colorForPlayer={colorForPlayer}
                        />
                      )}
                      cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }}
                    />
                    {topPlayerIds.map((id) => (
                      <Line
                        key={id}
                        dataKey={id}
                        type="monotone"
                        stroke={colorForPlayer(id)}
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* ── Game Wins / Losses ── */}
            <ChartCard
              title="Game Wins & Losses"
              legend={[
                { color: CHART_GREEN, label: 'Wins' },
                { color: CHART_RED, label: 'Losses' },
              ]}
            >
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={cd.gameWins} margin={CHART_MARGIN} maxBarSize={48}>
                  {xAxis}
                  {yAxis}
                  {tooltip}
                  <Bar dataKey="Wins" stackId="a" fill={CHART_GREEN} />
                  <Bar dataKey="Losses" stackId="a" fill={CHART_RED} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* ── Round Wins / Losses ── */}
            <ChartCard
              title="Round Wins & Losses"
              legend={[
                { color: CHART_GREEN, label: 'Wins' },
                { color: CHART_RED, label: 'Losses' },
              ]}
            >
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={cd.roundWins} margin={CHART_MARGIN} maxBarSize={48}>
                  {xAxis}
                  {yAxis}
                  {tooltip}
                  <Bar dataKey="Round Wins" stackId="a" fill={CHART_GREEN} />
                  <Bar
                    dataKey="Round Losses"
                    stackId="a"
                    fill={CHART_RED}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* ── Bid Outcomes ── */}
            <ChartCard
              title="Bid Outcomes"
              legend={[
                { color: CHART_BLUE, label: 'Exact' },
                { color: CHART_YELLOW, label: 'Bags' },
                { color: CHART_RED, label: 'Failed' },
              ]}
            >
              {cd.bidOutcomes.length === 0 ? (
                <NoData />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={cd.bidOutcomes} margin={CHART_MARGIN} maxBarSize={48}>
                    {xAxis}
                    {yAxis}
                    {tooltip}
                    <Bar dataKey="Exact" stackId="a" fill={CHART_BLUE} />
                    <Bar dataKey="Bags" stackId="a" fill={CHART_YELLOW} />
                    <Bar dataKey="Failed" stackId="a" fill={CHART_RED} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* ── Nil Bids ── */}
            <ChartCard
              title="Nil Bids"
              legend={[
                { color: CHART_GREEN, label: 'Made' },
                { color: CHART_RED, label: 'Missed' },
              ]}
            >
              {cd.nils.length === 0 ? (
                <NoData message="No nil bids recorded" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={cd.nils} margin={CHART_MARGIN} maxBarSize={48}>
                    {xAxis}
                    {yAxis}
                    {tooltip}
                    <Bar dataKey="Made" stackId="a" fill={CHART_GREEN} />
                    <Bar dataKey="Missed" stackId="a" fill={CHART_RED} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* ── Blind Nil Bids ── */}
            <ChartCard
              title="Blind Nil Bids"
              legend={[
                { color: CHART_GREEN, label: 'Made' },
                { color: CHART_RED, label: 'Missed' },
              ]}
            >
              {cd.blindNils.length === 0 ? (
                <NoData message="No blind nil bids recorded" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={cd.blindNils} margin={CHART_MARGIN} maxBarSize={48}>
                    {xAxis}
                    {yAxis}
                    {tooltip}
                    <Bar dataKey="Made" stackId="a" fill={CHART_GREEN} />
                    <Bar dataKey="Missed" stackId="a" fill={CHART_RED} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* ── Average Bid ── */}
            <ChartCard title="Average Bid (non-nil)">
              {cd.avgBid.length === 0 ? (
                <NoData />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={cd.avgBid} margin={CHART_MARGIN} maxBarSize={48}>
                    {xAxis}
                    {yAxis}
                    {tooltip}
                    <Bar dataKey="Avg Bid" fill={CHART_ORANGE} radius={[4, 4, 0, 0]}>
                      <LabelList
                        dataKey="Avg Bid"
                        position="top"
                        style={labelStyle}
                        formatter={(v: number) =>
                          Number.isInteger(v) ? String(v) : v.toFixed(1)
                        }
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* ── Highest Single Bid ── */}
            <ChartCard title="Highest Single Bid">
              {cd.highestBid.length === 0 ? (
                <NoData />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={cd.highestBid} margin={CHART_MARGIN} maxBarSize={48}>
                    {xAxis}
                    {yAxis}
                    {tooltip}
                    <Bar dataKey="Highest Bid" fill={CHART_PURPLE} radius={[4, 4, 0, 0]}>
                      <LabelList
                        dataKey="Highest Bid"
                        position="top"
                        style={labelStyle}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* ── Average Win Margin ── */}
            <ChartCard title="Average Game Win Margin">
              {cd.winMargin.length === 0 ? (
                <NoData message="No wins recorded yet" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={cd.winMargin} margin={CHART_MARGIN} maxBarSize={48}>
                    {xAxis}
                    {yAxis}
                    {tooltip}
                    <Bar dataKey="Avg Margin" fill={CHART_GREEN} radius={[4, 4, 0, 0]}>
                      <LabelList
                        dataKey="Avg Margin"
                        position="top"
                        style={labelStyle}
                        formatter={(v: number) => `+${v}`}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* ── Full Stats Table ── */}
            <Box mt={2}>
              <Text
                fontSize="xs"
                color="gray.500"
                fontWeight="semibold"
                textTransform="uppercase"
                letterSpacing="wide"
                mb={3}
              >
                Full Stats Table
              </Text>
              <Box overflowX="auto">
                <Box as="table" width="100%" style={{ borderCollapse: 'collapse' }}>
                  <Box as="thead">
                    <Box as="tr">
                      <Box
                        as="th"
                        textAlign="left"
                        px={3}
                        py={2}
                        position="sticky"
                        left={0}
                        bg="gray.900"
                        zIndex={1}
                        borderBottom="1px solid"
                        borderColor="whiteAlpha.200"
                        style={{ minWidth: '100px' }}
                      >
                        <Flex
                          align="center"
                          gap={1}
                          cursor="pointer"
                          onClick={() => handleSort('name')}
                          _hover={{ color: 'white' }}
                          color="gray.400"
                        >
                          <Text
                            fontSize="xs"
                            fontWeight="semibold"
                            textTransform="uppercase"
                            letterSpacing="wide"
                          >
                            Player
                          </Text>
                          <SortIcon direction={sortKey === 'name' ? sortDir : null} />
                        </Flex>
                      </Box>
                      {TABLE_COLS.map((col) => (
                        <Box
                          key={col.key}
                          as="th"
                          textAlign="right"
                          px={3}
                          py={2}
                          borderBottom="1px solid"
                          borderColor="whiteAlpha.200"
                          title={col.title}
                        >
                          <Flex
                            align="center"
                            justify="flex-end"
                            gap={1}
                            cursor="pointer"
                            onClick={() => handleSort(col.key)}
                            _hover={{ color: 'white' }}
                            color="gray.400"
                          >
                            <Text
                              fontSize="xs"
                              fontWeight="semibold"
                              textTransform="uppercase"
                              letterSpacing="wide"
                            >
                              {col.label}
                            </Text>
                            <SortIcon direction={sortKey === col.key ? sortDir : null} />
                          </Flex>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                  <Box as="tbody">
                    {rows.map((row) => (
                      <Box
                        as="tr"
                        key={row.id}
                        cursor="pointer"
                        onClick={() => navigate(`/stats/${encodeURIComponent(row.id)}`)}
                        _hover={{ bg: 'whiteAlpha.50' }}
                      >
                        <Box
                          as="td"
                          px={3}
                          py={3}
                          position="sticky"
                          left={0}
                          bg="gray.900"
                          borderBottom="1px solid"
                          borderColor="whiteAlpha.100"
                        >
                          <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
                            {row.id}
                          </Text>
                        </Box>
                        <Box
                          as="td"
                          px={3}
                          py={3}
                          textAlign="right"
                          borderBottom="1px solid"
                          borderColor="whiteAlpha.100"
                        >
                          <Text
                            fontSize="sm"
                            color={row.rating === 1200 ? 'gray.400' : 'inherit'}
                          >
                            {Math.round(row.rating)}
                          </Text>
                        </Box>
                        <Box
                          as="td"
                          px={3}
                          py={3}
                          textAlign="right"
                          borderBottom="1px solid"
                          borderColor="whiteAlpha.100"
                        >
                          <Text
                            fontSize="sm"
                            color={row.games === 0 ? 'gray.600' : 'inherit'}
                          >
                            {row.games > 0
                              ? `${row.stats.gameWins.wins}-${row.stats.gameWins.losses}`
                              : '—'}
                          </Text>
                        </Box>
                        <Box
                          as="td"
                          px={3}
                          py={3}
                          textAlign="right"
                          borderBottom="1px solid"
                          borderColor="whiteAlpha.100"
                        >
                          <Text
                            fontSize="sm"
                            color={
                              row.winRate === null
                                ? 'gray.600'
                                : row.winRate >= 50
                                  ? 'green.300'
                                  : 'red.300'
                            }
                          >
                            {pct(row.winRate)}
                          </Text>
                        </Box>
                        <Box
                          as="td"
                          px={3}
                          py={3}
                          textAlign="right"
                          borderBottom="1px solid"
                          borderColor="whiteAlpha.100"
                        >
                          <Text
                            fontSize="sm"
                            color={
                              row.roundWinRate === null
                                ? 'gray.600'
                                : row.roundWinRate >= 50
                                  ? 'green.300'
                                  : 'red.300'
                            }
                          >
                            {pct(row.roundWinRate)}
                          </Text>
                        </Box>
                        <Box
                          as="td"
                          px={3}
                          py={3}
                          textAlign="right"
                          borderBottom="1px solid"
                          borderColor="whiteAlpha.100"
                        >
                          <Text
                            fontSize="sm"
                            color={
                              row.reliabilityRate === null
                                ? 'gray.600'
                                : row.reliabilityRate >= 70
                                  ? 'green.300'
                                  : row.reliabilityRate >= 50
                                    ? 'yellow.300'
                                    : 'red.300'
                            }
                          >
                            {pct(row.reliabilityRate)}
                          </Text>
                        </Box>
                        <Box
                          as="td"
                          px={3}
                          py={3}
                          textAlign="right"
                          borderBottom="1px solid"
                          borderColor="whiteAlpha.100"
                        >
                          <Text
                            fontSize="sm"
                            color={row.nilRate === null ? 'gray.600' : 'inherit'}
                          >
                            {pct(row.nilRate)}
                          </Text>
                        </Box>
                        <Box
                          as="td"
                          px={3}
                          py={3}
                          textAlign="right"
                          borderBottom="1px solid"
                          borderColor="whiteAlpha.100"
                        >
                          <Text
                            fontSize="sm"
                            color={row.avgWinMargin === null ? 'gray.600' : 'green.300'}
                          >
                            {row.avgWinMargin !== null ? `+${row.avgWinMargin}` : '—'}
                          </Text>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            </Box>
          </Flex>
        )}
      </Box>
    </Container>
  );
}

export default CompareStats;
