import { SHOWCASE_STYLE } from '../../../utils/showcaseStyle';
import CarouselShowcase from './CarouselShowcase';
import PillarsShowcase from './PillarsShowcase';

export const SHOWCASE_STYLE_RENDERERS = {
  [SHOWCASE_STYLE.CAROUSEL]: CarouselShowcase,
  [SHOWCASE_STYLE.PILLARS]: PillarsShowcase,
};
