import { Bullet, DeckMark, SlideFrame } from '../../components/SlideKit';

export default function Slide08Funding() {
  return (
    <SlideFrame>
      <div className="px-[6vw] pt-[6.5vh]">
        <h1 className="font-display text-[4.7vw] font-extrabold tracking-[-0.045em] text-primary">
          How Involv can be sustained
        </h1>
        <div className="mt-[4.5vh] grid grid-cols-[54%_46%] gap-[4vw]">
          <div className="grid grid-cols-2 gap-x-[2.5vw] gap-y-[3.2vh]">
            <Bullet>
              A pilot could be supported through a school innovation,
              service-learning, or community-partnership budget
            </Bullet>
            <Bullet>
              Longer term, schools could support the platform through an annual
              licence or shared subscription
            </Bullet>
            <Bullet>
              Grants, sponsors, and community partners could help fund access
              and expansion
            </Bullet>
            <Bullet>
              Funding would cover hosting, maintenance, support, safeguarding,
              and future improvements
            </Bullet>
            <div className="col-span-2">
              <Bullet>
                Start with a focused pilot, learn what works, then scale
                responsibly
              </Bullet>
            </div>
          </div>
          <div className="flex flex-col justify-center rounded-[1.8vw] bg-[#eaf0fb] px-[3vw] py-[3.5vh]">
            <div className="rounded-[1.2vw] bg-white px-[2.2vw] py-[2.2vh] text-center font-display text-[1.9vw] font-bold text-primary shadow-sm">
              School or partner funding
            </div>
            <div className="py-[1.8vh] text-center text-[2.4vw] font-bold text-accent">
              ↓
            </div>
            <div className="rounded-[1.2vw] bg-primary px-[2.2vw] py-[2.2vh] text-center font-display text-[1.9vw] font-bold text-white shadow-sm">
              Platform operations
            </div>
            <div className="py-[1.8vh] text-center text-[2.4vw] font-bold text-accent">
              ↓
            </div>
            <div className="rounded-[1.2vw] bg-[#d7e5fb] px-[2.2vw] py-[2.2vh] text-center font-display text-[1.9vw] font-bold leading-[1.2] text-primary shadow-sm">
              Reliable student service-learning access
            </div>
          </div>
        </div>
      </div>
      <DeckMark page="08" />
    </SlideFrame>
  );
}