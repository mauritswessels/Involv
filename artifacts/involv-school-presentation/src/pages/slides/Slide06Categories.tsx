import { DeckMark, SlideFrame } from '../../components/SlideKit';

export default function Slide06Categories() {
  return (
    <SlideFrame>
      <div className="px-[6vw] pt-[6.5vh]">
        <h1 className="font-display text-[4.5vw] font-extrabold tracking-[-0.045em] text-primary">
          Built around what matters to students
        </h1>
        <div className="mt-[4.5vh] grid grid-cols-3 gap-[1.5vw]">
          <div className="rounded-[1.25vw] border border-[#a8cce8] bg-[#e8f5fd] px-[1.7vw] py-[2.5vh]">
            <span className="block h-[1vh] w-[4vw] rounded-full bg-[#1d83c2]" />
            <p className="mt-[2.2vh] font-display text-[1.9vw] font-bold text-[#145f91]">
              Community &amp; Social Impact
            </p>
          </div>
          <div className="rounded-[1.25vw] border border-[#efb4b4] bg-[#fff0f0] px-[1.7vw] py-[2.5vh]">
            <span className="block h-[1vh] w-[4vw] rounded-full bg-[#d85353]" />
            <p className="mt-[2.2vh] font-display text-[1.9vw] font-bold text-[#a63e3e]">
              Health &amp; Wellbeing
            </p>
          </div>
          <div className="rounded-[1.25vw] border border-[#a9d9bd] bg-[#ecf9f1] px-[1.7vw] py-[2.5vh]">
            <span className="block h-[1vh] w-[4vw] rounded-full bg-[#2c9560]" />
            <p className="mt-[2.2vh] font-display text-[1.9vw] font-bold text-[#25784f]">
              Sustainability &amp; Environment
            </p>
          </div>
          <div className="rounded-[1.25vw] border border-[#b7c7ea] bg-[#edf2ff] px-[1.7vw] py-[2.5vh]">
            <span className="block h-[1vh] w-[4vw] rounded-full bg-[#5371bd]" />
            <p className="mt-[2.2vh] font-display text-[1.9vw] font-bold text-[#3d5794]">
              Global &amp; Humanitarian
            </p>
          </div>
          <div className="rounded-[1.25vw] border border-[#e5c0e8] bg-[#fbf0fc] px-[1.7vw] py-[2.5vh]">
            <span className="block h-[1vh] w-[4vw] rounded-full bg-[#a558ad]" />
            <p className="mt-[2.2vh] font-display text-[1.9vw] font-bold text-[#804588]">
              Arts, Culture &amp; Media
            </p>
          </div>
          <div className="rounded-[1.25vw] border border-[#d1bee8] bg-[#f5effc] px-[1.7vw] py-[2.5vh]">
            <span className="block h-[1vh] w-[4vw] rounded-full bg-[#7753aa]" />
            <p className="mt-[2.2vh] font-display text-[1.9vw] font-bold text-[#60438a]">
              School-Based Service
            </p>
          </div>
          <div className="rounded-[1.25vw] border border-[#e2c59e] bg-[#fff6e9] px-[1.7vw] py-[2.5vh]">
            <span className="block h-[1vh] w-[4vw] rounded-full bg-[#b97d2f]" />
            <p className="mt-[2.2vh] font-display text-[1.9vw] font-bold text-[#8f6125]">
              Business, Leadership &amp; Management
            </p>
          </div>
          <div className="rounded-[1.25vw] border border-[#9fcfd4] bg-[#eaf8f8] px-[1.7vw] py-[2.5vh]">
            <span className="block h-[1vh] w-[4vw] rounded-full bg-[#2c8a93]" />
            <p className="mt-[2.2vh] font-display text-[1.9vw] font-bold text-[#246e75]">
              Technology &amp; Innovation
            </p>
          </div>
          <div className="rounded-[1.25vw] border border-[#ebd899] bg-[#fff9df] px-[1.7vw] py-[2.5vh]">
            <span className="block h-[1vh] w-[4vw] rounded-full bg-[#b89521]" />
            <p className="mt-[2.2vh] font-display text-[1.9vw] font-bold text-[#8e741b]">
              Education &amp; Mentorship
            </p>
          </div>
        </div>
      </div>
      <DeckMark page="06" />
    </SlideFrame>
  );
}