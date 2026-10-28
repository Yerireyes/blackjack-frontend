import { useUiStore, type Venue } from '@/store/uiStore';
import { Segmented } from './Segmented';

const VENUES = [
  { value: 'practice', label: 'Práctica' },
  { value: 'casual', label: 'Casual' },
] as const satisfies readonly { value: Venue; label: string }[];

/** Práctica (en el navegador, sin cuenta) o Casual (contra el servidor, con cuenta). */
export function VenueSwitch() {
  const venue = useUiStore((s) => s.venue);
  const setVenue = useUiStore((s) => s.setVenue);
  return <Segmented label="Dónde jugar" value={venue} options={VENUES} onChange={setVenue} />;
}
