import type { CSSProperties } from 'react';

type IconName = 'arrow' | 'down' | 'menu' | 'close' | 'album' | 'story' | 'song';
const paths: Record<IconName, string> = {
  arrow: 'M3 12h17m-6-6 6 6-6 6',
  down: 'm5 9 7 7 7-7',
  menu: 'M3 6h18M3 12h12M3 18h18',
  close: 'm5 5 14 14M19 5 5 19',
  album: 'M12 5C8 3 5 3 2 4v15c3-1 6-1 10 1 4-2 7-2 10-1V4c-3-1-6-1-10 1v15',
  story: 'M5 3h11l3 3v15H5V3Zm3 6h8M8 13h8M8 17h5',
  song: 'M10 17V5l10-2v12M10 8l10-2M10 17c0 2-6 4-6 1s6-3 6-1Zm10-2c0 2-6 4-6 1s6-3 6-1Z',
};
/** Ayni's compact line vocabulary: open pages, stories and song links. */
export function AyniIcon({ name, className, style }: {name: IconName; className?: string; style?: CSSProperties}) {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}
