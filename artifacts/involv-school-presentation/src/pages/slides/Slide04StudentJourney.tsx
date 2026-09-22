import {
  asset,
  Bullet,
  DeckMark,
  SlideFrame,
} from '../../components/SlideKit';

export default function Slide04StudentJourney() {
  return (
    <SlideFrame>
      <div className="grid h-full grid-cols-[42%_58%]">
        <div className="px-[5.8vw] pt-[7vh]">
          <h1 className="font-display text-[4.4vw] font-extrabold leading-[1.04] tracking-[-0.04em] text-primary">
            From interest to participation
          </h1>
          <div className="mt-[6vh] space-y-[3.2vh]">
            <Bullet>
              Start with a category such as Community, Health, Sustainability,
              Arts, Technology, or Education
            </Bullet>
            <Bullet>
              Search and filter by location, duration, and skill level
            </Bullet>
            <Bullet>
              Open a clear opportunity page with the details that matter
            </Bullet>
            <Bullet>Apply, then follow progress from one place</Bullet>
          </div>
        </div>
        <div className="relative flex items-center justify-center bg-[#eaf0fb] px-[4vw]">
          <div className="relative w-[48vw] overflow-hidden rounded-[1.6vw] border-[0.16vw] border-[#c7d4e8] bg-white shadow-[0_2.5vh_6vh_rgba(11,43,99,0.18)]">
            <div className="flex h-[4vh] items-center gap-[0.6vw] border-b border-[#dbe3ef] bg-[#f7f9fc] px-[1.4vw]">
              <span className="h-[0.8vw] w-[0.8vw] rounded-full bg-[#ef9a9a]" />
              <span className="h-[0.8vw] w-[0.8vw] rounded-full bg-[#f4d27a]" />
              <span className="h-[0.8vw] w-[0.8vw] rounded-full bg-[#8bc7a5]" />
            </div>
            <img
              src={asset('product/involv-browse.jpg')}
              crossOrigin="anonymous"
              className="h-[62vh] w-full object-cover object-top"
              alt="Involv browse page"
            />
          </div>
          <div className="absolute right-[5vw] top-[19vh] rounded-full bg-accent px-[1.4vw] py-[1.2vh] text-[1.5vw] font-bold text-white shadow-lg">
            Filter by interest
          </div>
        </div>
      </div>
      <DeckMark page="04" />
    </SlideFrame>
  );
}