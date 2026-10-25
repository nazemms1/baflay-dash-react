import type { HeroSlide } from "@/services";

/** الترتيب كما يراه الزائر: حسب `sort_order`، والتعادل بالمعرّف. */
export const sortSlides = (slides: HeroSlide[]): HeroSlide[] =>
  [...slides].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
