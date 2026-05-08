import { AppModal } from '../ui';
import { Separator, Button, Text, Flex } from '../ui';

interface NewPlayersWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
  newPlayerNames: string[];
}

function NewPlayersWarningModal({
  isOpen,
  onClose,
  onContinue,
  newPlayerNames,
}: NewPlayersWarningModalProps) {
  return (
    <AppModal
      isOpen={isOpen}
      onClose={(open) => {
        if (!open) onClose();
      }}
      title="New Leaderboard Players"
    >
      <div style={{ padding: 'var(--app-spacing-2)' }}>
        <Separator mb={4} />
        {newPlayerNames.map((name) => (
          <Text key={name} style={{ marginBottom: 'var(--app-spacing-3)' }}>
            Warning: Player &quot;{name}&quot; is a new player to the Leaderboard
          </Text>
        ))}
        <Flex direction="row" justifyContent="space-between" mt={4}>
          <Button variant="outline" onClick={onClose}>
            Go Back
          </Button>
          <Button variant="outline" onClick={onContinue}>
            Continue
          </Button>
        </Flex>
      </div>
    </AppModal>
  );
}

export default NewPlayersWarningModal;
