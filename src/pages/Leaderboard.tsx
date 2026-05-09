import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Box, Flex, Text, Spinner, Button } from '../components/ui';
import Header from '../components/ui/Header';
import { getPlayers } from '../services';
import type { Player } from '../services';

function Leaderboard() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  const handleRetry = () => {
    setStatus('loading');
    getPlayers()
      .then((data) => {
        setPlayers(data);
        setStatus('success');
      })
      .catch(() => setStatus('error'));
  };

  useEffect(() => {
    getPlayers()
      .then((data) => {
        setPlayers(data);
        setStatus('success');
      })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <Container maxW="container.sm" py={4}>
      <Header />

      <Box mt={6}>
        <Flex align="baseline" justify="space-between" mb={4}>
          <Text fontSize="var(--app-font-xl)" fontWeight="bold">
            Leaderboard
          </Text>
          <Button variant="outline" size="sm" onClick={() => navigate('/stats')}>
            Compare Stats
          </Button>
        </Flex>

        {status === 'loading' && (
          <Flex justify="center" py={12}>
            <Spinner size="lg" />
          </Flex>
        )}

        {status === 'error' && (
          <Flex direction="column" align="center" py={12} gap={4}>
            <Text color="red.400">Failed to load rankings.</Text>
            <Button variant="outline" onClick={handleRetry}>
              Retry
            </Button>
          </Flex>
        )}

        {status === 'success' && players.length === 0 && (
          <Text color="gray.400" textAlign="center" py={12}>
            No ranked games recorded yet.
          </Text>
        )}

        {status === 'success' && players.length > 0 && (
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

            {players.map((player, index) => {
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
                  onClick={() => navigate(`/stats/${encodeURIComponent(player.id)}`)}
                >
                  <Text w="40px" color="gray.400" fontWeight="semibold">
                    {index + 1}
                  </Text>
                  <Flex flex={1} align="center" gap={2}>
                    <Text fontWeight='normal'>
                      {player.id}
                    </Text>
                  </Flex>
                  <Text
                    fontWeight="semibold"
                    color={player.rating === 1200 ? 'gray.400' : 'inherit'}
                  >
                    {Math.round(player.rating)}
                  </Text>
                </Flex>
              );
            })}
          </Box>
        )}
      </Box>
    </Container>
  );
}

export default Leaderboard;
