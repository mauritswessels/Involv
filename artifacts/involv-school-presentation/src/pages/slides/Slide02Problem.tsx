import { Bullet, DeckMark, SlideFrame } from '../../components/SlideKit';

export default function Slide02Problem() {
  return (
    <SlideFrame>
      <div className="px-[6vw] pt-[7vh]">
        <h1 className="max-w-[82vw] font-display text-[4.2vw] font-extrabold leading-[1.04] tracking-[-0.04em] text-primary">
          Service learning should be easier to find — and easier to run
        </h1>
        <div className="mt-[6vh] grid grid-cols-[56%_44%] gap-[4vw]">
          <div className="grid grid-cols-2 gap-x-[2.8vw] gap-y-[4.3vh]">
            <Bullet>
              Opportunities can be spread across emails, forms, chats, and
              noticeboards
            </Bullet>
            <Bullet>
              Students may not know which opportunities fit their interests,
              schedule, or experience
            </Bullet>
            <Bullet>
              Teachers and student organisers need a clearer way to manage
              applications and participation
            </Bullet>
            <Bullet>
              The result is avoidable friction before the meaningful work even
              begins
            </Bullet>
          </div>
          <div className="relative h-[54vh] rounded-[2vw] bg-[#eaf0fb] p-[3vw]">
            <div className="absolute left-1/2 top-1/2 flex h-[17vh] w-[17vh] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-center font-display text-[1.75vw] font-bold leading-[1.15] text-white shadow-[0_2vh_4vh_rgba(11,43,99,0.2)]">
              One student journey
            </div>
            <div className="absolute left-[3vw] top-[4vh] rounded-[1vw] border border-[#c8d6ed] bg-white px-[2vw] py-[1.8vh] font-display text-[1.6vw] font-bold text-primary">
              Emails
            </div>
            <div className="absolute right-[3vw] top-[4vh] rounded-[1vw] border border-[#c8d6ed] bg-white px-[2vw] py-[1.8vh] font-display text-[1.6vw] font-bold text-primary">
              Forms
            </div>
            <div className="absolute bottom-[4vh] left-[3vw] rounded-[1vw] border border-[#c8d6ed] bg-white px-[2vw] py-[1.8vh] font-display text-[1.6vw] font-bold text-primary">
              Chats
            </div>
            <div className="absolute bottom-[4vh] right-[3vw] rounded-[1vw] border border-[#c8d6ed] bg-white px-[1.6vw] py-[1.8vh] font-display text-[1.6vw] font-bold text-primary">
              Noticeboards
            </div>
            <div className="absolute left-[9.5vw] top-[12vh] h-[0.28vh] w-[10vw] rotate-[26deg] bg-[#7998d1]" />
            <div className="absolute right-[9.5vw] top-[12vh] h-[0.28vh] w-[10vw] -rotate-[26deg] bg-[#7998d1]" />
            <div className="absolute bottom-[12vh] left-[9.5vw] h-[0.28vh] w-[10vw] -rotate-[26deg] bg-[#7998d1]" />
            <div className="absolute bottom-[12vh] right-[9.5vw] h-[0.28vh] w-[10vw] rotate-[26deg] bg-[#7998d1]" />
          </div>
        </div>
      </div>
      <DeckMark page="02" />
    </SlideFrame>
  );
}