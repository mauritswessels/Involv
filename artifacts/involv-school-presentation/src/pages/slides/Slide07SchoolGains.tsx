import { CheckLine, DeckMark, SlideFrame } from '../../components/SlideKit';

export default function Slide07SchoolGains() {
  return (
    <SlideFrame>
      <div className="grid h-full grid-cols-[38%_62%]">
        <div className="relative flex flex-col justify-center bg-primary px-[5.7vw] text-white">
          <div className="absolute right-0 top-[13vh] h-[74vh] w-[0.35vw] bg-[#7194da]" />
          <p className="font-display text-[7.8vw] font-extrabold leading-none text-[#6f93d8]">
            05
          </p>
          <h1 className="mt-[2vh] font-display text-[4.7vw] font-extrabold leading-[1.05] tracking-[-0.04em]">
            What the school gains
          </h1>
        </div>
        <div className="flex flex-col justify-center px-[7vw]">
          <CheckLine>
            A clearer front door for service-learning opportunities
          </CheckLine>
          <CheckLine>
            A consistent process for applications and follow-up
          </CheckLine>
          <CheckLine>
            Better visibility for teachers, organisers, and students
          </CheckLine>
          <CheckLine>
            Less manual coordination across disconnected tools
          </CheckLine>
          <CheckLine>
            A stronger structure for participation and reflection
          </CheckLine>
        </div>
      </div>
      <DeckMark page="07" />
    </SlideFrame>
  );
}