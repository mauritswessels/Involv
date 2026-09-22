import { DeckMark, SlideFrame } from '../../components/SlideKit';

export default function Slide03Journey() {
  return (
    <SlideFrame>
      <div className="px-[6vw] pt-[7vh]">
        <h1 className="font-display text-[4.6vw] font-extrabold tracking-[-0.045em] text-primary">
          One place for the whole journey
        </h1>
        <div className="mt-[5vh] grid grid-cols-4 gap-[1.8vw]">
          <div className="relative rounded-[1.6vw] bg-primary px-[2vw] py-[3.5vh] text-white">
            <div className="mb-[3vh] font-display text-[4.4vw] font-extrabold text-[#88a9ea]">
              01
            </div>
            <h2 className="font-display text-[2.3vw] font-bold">Discover</h2>
            <p className="mt-[2vh] text-[1.85vw] leading-[1.35] text-[#dbe7ff]">
              Discover opportunities that match what you care about
            </p>
            <div className="absolute -right-[1.45vw] top-1/2 z-10 flex h-[5vh] w-[5vh] -translate-y-1/2 items-center justify-center rounded-full bg-white text-[2vw] font-bold text-primary shadow">
              →
            </div>
          </div>
          <div className="relative rounded-[1.6vw] border-[0.18vw] border-[#cdd9ec] bg-white px-[2vw] py-[3.5vh]">
            <div className="mb-[3vh] font-display text-[4.4vw] font-extrabold text-[#b8c8e4]">
              02
            </div>
            <h2 className="font-display text-[2.3vw] font-bold text-primary">
              Apply
            </h2>
            <p className="mt-[2vh] text-[1.85vw] leading-[1.35] text-text">
              Apply with the information organisers need
            </p>
            <div className="absolute -right-[1.45vw] top-1/2 z-10 flex h-[5vh] w-[5vh] -translate-y-1/2 items-center justify-center rounded-full bg-primary text-[2vw] font-bold text-white shadow">
              →
            </div>
          </div>
          <div className="relative rounded-[1.6vw] border-[0.18vw] border-[#cdd9ec] bg-white px-[2vw] py-[3.5vh]">
            <div className="mb-[3vh] font-display text-[4.4vw] font-extrabold text-[#b8c8e4]">
              03
            </div>
            <h2 className="font-display text-[2.3vw] font-bold text-primary">
              Participate
            </h2>
            <p className="mt-[2vh] text-[1.85vw] leading-[1.35] text-text">
              Track applications, saved opportunities, and participation
            </p>
            <div className="absolute -right-[1.45vw] top-1/2 z-10 flex h-[5vh] w-[5vh] -translate-y-1/2 items-center justify-center rounded-full bg-primary text-[2vw] font-bold text-white shadow">
              →
            </div>
          </div>
          <div className="rounded-[1.6vw] bg-[#dce7fa] px-[2vw] py-[3.5vh]">
            <div className="mb-[3vh] font-display text-[4.4vw] font-extrabold text-[#7696cf]">
              04
            </div>
            <h2 className="font-display text-[2.3vw] font-bold text-primary">
              Reflect
            </h2>
            <p className="mt-[2vh] text-[1.85vw] leading-[1.35] text-text">
              Give organisers a shared space to post, review, coordinate, and
              communicate
            </p>
          </div>
        </div>
      </div>
      <DeckMark page="03" />
    </SlideFrame>
  );
}