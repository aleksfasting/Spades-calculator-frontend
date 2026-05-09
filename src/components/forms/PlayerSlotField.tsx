import { ChevronDown } from 'lucide-react';
import { Button, Field } from '../ui';

interface PlayerSlotFieldProps {
  teamClassName: string;
  label: string;
  displayLabel: string;
  placeholder?: string;
  errors?: string;
  touched?: boolean;
  onOpenPicker: () => void;
}

function PlayerSlotField({
  teamClassName,
  label,
  displayLabel,
  placeholder = 'Select player',
  errors,
  touched,
  onOpenPicker,
}: PlayerSlotFieldProps) {
  const empty = !displayLabel.trim();

  return (
    <div className={teamClassName} style={{ color: 'inherit' }}>
      <Field
        label={label}
        invalid={!!(errors && touched)}
        errorText={errors}
        pb={4}
        color={teamClassName === 'team1' ? 'team1' : 'team2'}
      >
        <Button
          type="button"
          variant="outline"
          width="100%"
          justifyContent="space-between"
          fontWeight="normal"
          fontSize="lg"
          minH="40px"
          px={3}
          onClick={onOpenPicker}
        >
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              textAlign: 'left',
              opacity: empty ? 0.55 : 1,
            }}
          >
            {empty ? placeholder : displayLabel}
          </span>
          <ChevronDown size={18} style={{ flexShrink: 0, marginLeft: 8 }} />
        </Button>
      </Field>
    </div>
  );
}

export default PlayerSlotField;
