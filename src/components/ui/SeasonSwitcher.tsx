import { Flex } from './flex';
import { Button } from './button';
import { CURRENT_SEASON, type ArchivedSeason } from '../../helpers/utils/seasons';

interface SeasonSwitcherProps {
  seasons: ArchivedSeason[];
  selected: string;
  onSelect: (name: string) => void;
}

function SeasonSwitcher({ seasons, selected, onSelect }: SeasonSwitcherProps) {
  if (seasons.length === 0) return null;

  return (
    <Flex gap={2} flexWrap="wrap">
      <Button
        size="sm"
        variant={selected === CURRENT_SEASON ? 'solid' : 'outline'}
        onClick={() => onSelect(CURRENT_SEASON)}
      >
        Current
      </Button>
      {seasons.map((season) => (
        <Button
          key={season.name}
          size="sm"
          variant={selected === season.name ? 'solid' : 'outline'}
          onClick={() => onSelect(season.name)}
        >
          {season.name}
        </Button>
      ))}
    </Flex>
  );
}

export default SeasonSwitcher;
