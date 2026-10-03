import type { Platform } from '../../shared/parseTrackUrl';
import { PLATFORM_NAME } from '../embed';

export function PlatformBadge({ platform }: { platform: Platform }) {
  return <span className={`badge badge-${platform}`}>{PLATFORM_NAME[platform]}</span>;
}
