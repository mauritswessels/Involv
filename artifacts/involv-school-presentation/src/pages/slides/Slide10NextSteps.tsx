import { DeckMark, SlideFrame } from '../../components/SlideKit';

export default function Slide10NextSteps() {
  return (
    <SlideFrame>
      <div className="grid h-full grid-cols-[58%_42%]">
        <div className="px-[6vw] pt-[5.8vh]">
          <h1 className="font-display text-[4.1vw] font-extrabold tracking-[-0.045em] text-primary">
            What we need to move forward
          </h1>
          <div className="mt-[3vh] grid grid-cols-2 gap-[1vw]">
            <div className="rounded-[1.2vw] bg-[#eaf0fb] px-[1.7vw] py-[1.8vh]">
              <span className="font-display text-[2.2vw] font-extrabold text-accent">
                01
              </span>
              <p className="mt-[0.7vh] text-[1.55vw] leading-[1.22]">
                Choose a first pilot group, programme, or service-learning theme
              </p>
            </div>
            <div className="rounded-[1.2vw] bg-[#eaf0fb] px-[1.7vw] py-[1.8vh]">
              <span className="font-display text-[2.2vw] font-extrabold text-accent">
                02
              </span>
              <p className="mt-[0.7vh] text-[1.55vw] leading-[1.22]">
                Confirm a school sponsor and a sustainable funding route
              </p>
            </div>
            <div className="rounded-[1.2vw] bg-[#eaf0fb] px-[1.7vw] py-[1.8vh]">
              <span className="font-display text-[2.2vw] font-extrabold text-accent">
                03
              </span>
              <p className="mt-[0.7vh] text-[1.55vw] leading-[1.22]">
                Add a focused set of real opportunities
              </p>
            </div>
            <div className="rounded-[1.2vw] bg-[#eaf0fb] px-[1.7vw] py-[1.8vh]">
              <span className="font-display text-[2.2vw] font-extrabold text-accent">
                04
              </span>
              <p className="mt-[0.7vh] text-[1.55vw] leading-[1.22]">
                Invite teachers, organisers, and students to try the full
                journey
              </p>
            </div>
            <div className="col-span-2 rounded-[1.2vw] bg-primary px-[1.7vw] py-[1.5vh] text-white">
              <span className="font-display text-[2.2vw] font-extrabold text-[#86a6e4]">
                05
              </span>
              <p className="mt-[0.5vh] text-[1.6vw] leading-[1.2]">
                Review feedback before expanding the platform
              </p>
            </div>
          </div>
        </div>
        <div className="relative flex flex-col justify-center bg-primary px-[4.8vw] text-white">
          <div className="mb-[7vh] flex items-center gap-[0.9vw]">
            <span className="flex h-[5.4vh] w-[5.4vh] items-center justify-center rounded-[0.55vw] bg-white text-[1.9vw] font-extrabold text-primary">
              i
            </span>
            <span className="font-display text-[2.5vw] font-extrabold text-white">
              Involv
            </span>
          </div>
          <p className="font-display text-[2vw] font-semibold uppercase tracking-[0.16em] text-[#8faee8]">
            Decision
          </p>
          <p className="mt-[2.5vh] font-display text-[3.1vw] font-bold leading-[1.16]">
            What would a useful, funded first pilot look like for our school?
          </p>
        </div>
      </div>
      <DeckMark page="10" />
    </SlideFrame>
  );
}