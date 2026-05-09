import { useState, useContext, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { useFormik } from 'formik';
import { useNavigate } from 'react-router-dom';
import * as Yup from 'yup';
import { useLocalStorage } from '../../helpers/utils/hooks';
import { GlobalContext } from '../../helpers/context/GlobalContext';
import WarningModal from '../modals/WarningModal';
import NewPlayersWarningModal from '../modals/NewPlayersWarningModal';
import PlayerPickerModal from '../modals/PlayerPickerModal';
import {
  hasPlayerNamesEntered,
  hasRoundProgress,
} from '../../helpers/math/spadesMath';
import { getPlayersByIds } from '../../services';

import PlayerSlotField from './PlayerSlotField';
import { Button, SimpleGrid, Center, Text } from '../ui';
import {
  initialNames,
  normalizeNames,
  TeamDisplayName,
} from '../../helpers/utils/constants';
import type { Names, SavedPlayer } from '../../types';
import {
  migrateSeedPlayerPoolFromNames,
  normalizePlayerName,
  getSavedPlayers,
  upsertPoolFromNormalizedNames,
  toDisplayNameFromNormalized,
} from '../../helpers/utils/playerPool';

type SlotKey = 't1p1Name' | 't1p2Name' | 't2p1Name' | 't2p2Name';

type PlayerNamesFormValues = Pick<Names, SlotKey>;

const SLOT_KEYS: SlotKey[] = ['t1p1Name', 't1p2Name', 't2p1Name', 't2p2Name'];

const teamHeadingStyle: CSSProperties = {
  fontSize: 'var(--app-font-2xl)',
  fontWeight: 'bold',
  textAlign: 'center',
  width: '100%',
};

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function slotDisplayLabel(normalized: string, pool: SavedPlayer[]): string {
  if (!normalized) return '';
  const hit = pool.find(
    (p) => normalizePlayerName(p.displayName) === normalized,
  );
  return hit?.displayName ?? toDisplayNameFromNormalized(normalized);
}

function NameForm() {
  const navigate = useNavigate();
  const { roundHistory, currentRound } = useContext(GlobalContext);
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
  const [isNewPlayersModalOpen, setIsNewPlayersModalOpen] = useState(false);
  const [newPlayerNames, setNewPlayerNames] = useState<string[]>([]);
  const [pendingNavValues, setPendingNavValues] = useState<Names | null>(null);
  const [names, setNames] = useLocalStorage<Names>('names', initialNames);
  const [savedPlayers, setSavedPlayers] = useLocalStorage<SavedPlayer[]>(
    'savedPlayers',
    [],
  );
  const [pickerSlot, setPickerSlot] = useState<SlotKey | null>(null);
  const [shortcutHint, setShortcutHint] = useState<string | null>(null);

  useEffect(() => {
    migrateSeedPlayerPoolFromNames();
    setSavedPlayers(getSavedPlayers());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasGameData =
    hasPlayerNamesEntered(names) ||
    hasRoundProgress(roundHistory, currentRound);

  const handleNewGame = () => {
    setIsWarningModalOpen(true);
  };

  const validationSchema = Yup.object({
    t1p1Name: Yup.string().required('Required'),
    t2p1Name: Yup.string().required('Required'),
    t1p2Name: Yup.string().required('Required'),
    t2p2Name: Yup.string().required('Required'),
  });

  const submitNormalizedGame = useCallback(
    async (lowerCaseValues: Names) => {
      const playerIds = [
        lowerCaseValues.t1p1Name,
        lowerCaseValues.t2p1Name,
        lowerCaseValues.t1p2Name,
        lowerCaseValues.t2p2Name,
      ];
      try {
        const existingPlayers = await getPlayersByIds(playerIds);
        const existingIds = new Set(existingPlayers.map((p) => p.id));
        const newNamesFound = playerIds.filter((id) => !existingIds.has(id));
        if (newNamesFound.length > 0) {
          setPendingNavValues(lowerCaseValues);
          setNewPlayerNames(newNamesFound);
          setIsNewPlayersModalOpen(true);
          return;
        }
      } catch {
        // Supabase unavailable — proceed without warning
      }
      setNames(lowerCaseValues);
      navigate('/spades-calculator', { state: lowerCaseValues });
    },
    [navigate, setNames],
  );

  const formik = useFormik<PlayerNamesFormValues>({
    initialValues: {
      t1p1Name: names.t1p1Name,
      t2p1Name: names.t2p1Name,
      t1p2Name: names.t1p2Name,
      t2p2Name: names.t2p2Name,
    },
    validationSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      const mergedPool = upsertPoolFromNormalizedNames(
        savedPlayers,
        SLOT_KEYS.map((k) => normalizePlayerName(values[k])),
      );
      setSavedPlayers(mergedPool);

      const lowerCaseValues = normalizeNames({
        team1Name: TeamDisplayName.Team1,
        team2Name: TeamDisplayName.Team2,
        t1p1Name: normalizePlayerName(values.t1p1Name),
        t2p1Name: normalizePlayerName(values.t2p1Name),
        t1p2Name: normalizePlayerName(values.t1p2Name),
        t2p2Name: normalizePlayerName(values.t2p2Name),
      });
      await submitNormalizedGame(lowerCaseValues);
    },
  });

  const excludedForPicker =
    pickerSlot === null
      ? []
      : SLOT_KEYS.filter((k) => k !== pickerSlot)
          .map((k) => normalizePlayerName(formik.values[k]))
          .filter(Boolean);

  const handlePickPlayer = (player: SavedPlayer) => {
    if (!pickerSlot) return;
    formik.setFieldValue(pickerSlot, normalizePlayerName(player.displayName));
    formik.setFieldTouched(pickerSlot, true);
    setPickerSlot(null);
    setShortcutHint(null);
  };

  const handleCreateAndPick = (displayName: string) => {
    if (!pickerSlot) return;
    const trimmed = displayName.trim();
    const norm = normalizePlayerName(trimmed);
    const dupSlot = SLOT_KEYS.filter((k) => k !== pickerSlot).some(
      (k) => normalizePlayerName(formik.values[k]) === norm,
    );
    if (dupSlot) return;
    const exists = savedPlayers.some(
      (p) => normalizePlayerName(p.displayName) === norm,
    );
    if (!exists) {
      setSavedPlayers([
        ...savedPlayers,
        { id: crypto.randomUUID(), displayName: trimmed },
      ]);
    }
    formik.setFieldValue(pickerSlot, norm);
    formik.setFieldTouched(pickerSlot, true);
    setPickerSlot(null);
    setShortcutHint(null);
  };

  const handleShuffleTeams = () => {
    const norms = SLOT_KEYS.map((k) =>
      normalizePlayerName(formik.values[k]),
    );
    if (norms.some((n) => !n) || new Set(norms).size !== 4) {
      setShortcutHint(
        'Pick four different players in all seats, then shuffle.',
      );
      return;
    }
    const shuffled = shuffle(norms);
    formik.setValues({
      t1p1Name: shuffled[0],
      t1p2Name: shuffled[1],
      t2p1Name: shuffled[2],
      t2p2Name: shuffled[3],
    });
    formik.setTouched({
      t1p1Name: true,
      t1p2Name: true,
      t2p1Name: true,
      t2p2Name: true,
    });
    setShortcutHint(null);
  };

  const handleNewPlayersGoBack = () => {
    setIsNewPlayersModalOpen(false);
    setPendingNavValues(null);
  };

  const handleNewPlayersContinue = () => {
    if (!pendingNavValues) return;
    setNames(pendingNavValues);
    setIsNewPlayersModalOpen(false);
    navigate('/spades-calculator', { state: pendingNavValues });
  };

  return (
    <>
      <NewPlayersWarningModal
        isOpen={isNewPlayersModalOpen}
        onClose={handleNewPlayersGoBack}
        onContinue={handleNewPlayersContinue}
        newPlayerNames={newPlayerNames}
      />
      <WarningModal
        isOpen={isWarningModalOpen}
        setIsModalOpen={setIsWarningModalOpen}
        resetNames={setNames}
      />
      <PlayerPickerModal
        isOpen={pickerSlot !== null}
        onClose={() => setPickerSlot(null)}
        players={savedPlayers}
        excludedNormalized={excludedForPicker}
        onPick={handlePickPlayer}
        onCreateAndPick={handleCreateAndPick}
      />
      <form onSubmit={formik.handleSubmit}>
        <Center mt={8} mb={2}>
          <div className="team1" style={teamHeadingStyle}>
            {TeamDisplayName.Team1}
          </div>
        </Center>
        <SimpleGrid columns={2} gap={2}>
          <PlayerSlotField
            teamClassName="team1"
            label="You"
            placeholder="Select player"
            displayLabel={slotDisplayLabel(
              formik.values.t1p1Name,
              savedPlayers,
            )}
            errors={formik.errors.t1p1Name}
            touched={formik.touched.t1p1Name}
            onOpenPicker={() => setPickerSlot('t1p1Name')}
          />
          <PlayerSlotField
            teamClassName="team1"
            label="Partner"
            placeholder="Select player"
            displayLabel={slotDisplayLabel(
              formik.values.t1p2Name,
              savedPlayers,
            )}
            errors={formik.errors.t1p2Name}
            touched={formik.touched.t1p2Name}
            onOpenPicker={() => setPickerSlot('t1p2Name')}
          />
        </SimpleGrid>

        <Center mt={6} mb={2}>
          <div className="team2" style={teamHeadingStyle}>
            {TeamDisplayName.Team2}
          </div>
        </Center>
        <SimpleGrid columns={2} gap={2}>
          <PlayerSlotField
            teamClassName="team2"
            label="Left Opponent"
            placeholder="Select player"
            displayLabel={slotDisplayLabel(
              formik.values.t2p1Name,
              savedPlayers,
            )}
            errors={formik.errors.t2p1Name}
            touched={formik.touched.t2p1Name}
            onOpenPicker={() => setPickerSlot('t2p1Name')}
          />
          <PlayerSlotField
            teamClassName="team2"
            label="Right Opponent"
            placeholder="Select player"
            displayLabel={slotDisplayLabel(
              formik.values.t2p2Name,
              savedPlayers,
            )}
            errors={formik.errors.t2p2Name}
            touched={formik.touched.t2p2Name}
            onOpenPicker={() => setPickerSlot('t2p2Name')}
          />
        </SimpleGrid>

        <Center my={6}>
          <Button
            variant="outline"
            size="lg"
            type="button"
            fontSize="lg"
            minW="200px"
            onClick={handleShuffleTeams}
          >
            Shuffle teams
          </Button>
        </Center>

        {shortcutHint && (
          <Text fontSize="sm" color="red.400" textAlign="center" mb={4} px={2}>
            {shortcutHint}
          </Text>
        )}

        {hasGameData ? (
          <SimpleGrid columns={2} gap={6} mb={8}>
            <Button
              variant="outline"
              size="lg"
              height="40px"
              width="auto"
              minW="120px"
              px={4}
              justifySelf="center"
              onClick={handleNewGame}
              data-cy="newGameButton"
              type="button"
              fontSize="lg"
            >
              New Game
            </Button>
            <Button
              variant="outline"
              size="lg"
              height="40px"
              width="auto"
              minW="120px"
              px={4}
              justifySelf="center"
              data-cy="continueButton"
              type="submit"
              fontSize="lg"
            >
              Continue
            </Button>
          </SimpleGrid>
        ) : (
          <Center>
            <Button
              variant="outline"
              size="lg"
              height="40px"
              width="200px"
              type="submit"
              mb={8}
              data-cy="startButton"
              fontSize="lg"
            >
              Start Game
            </Button>
          </Center>
        )}
      </form>
    </>
  );
}

export default NameForm;
