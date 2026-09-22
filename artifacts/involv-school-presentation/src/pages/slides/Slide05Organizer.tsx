import { Bullet, DeckMark, SlideFrame } from '../../components/SlideKit';

export default function Slide05Organizer() {
  return (
    <SlideFrame>
      <div className="px-[6vw] pt-[7vh]">
        <h1 className="font-display text-[4.8vw] font-extrabold tracking-[-0.045em] text-primary">
          Less admin. More visibility.
        </h1>
        <div className="mt-[5vh] grid grid-cols-[48%_52%] gap-[5vw]">
          <div className="space-y-[3.3vh]">
            <Bullet>
              Post opportunities with clear descriptions, requirements, and
              practical details
            </Bullet>
            <Bullet>Review applications in one organised workflow</Bullet>
            <Bullet>
              Update application status and keep applicants informed
            </Bullet>
            <Bullet>Track attendance, hours, and progress</Bullet>
            <Bullet>Keep communication connected to the opportunity</Bullet>
          </div>
          <div className="grid grid-cols-2 gap-[1.6vw]">
            <div className="rounded-[1.4vw] bg-primary px-[2vw] py-[3vh] text-white">
              <p className="font-display text-[3.8vw] font-extrabold text-[#86a6e4]">
                01
              </p>
              <h2 className="mt-[2vh] font-display text-[2.3vw] font-bold">
                Post
              </h2>
            </div>
            <div className="rounded-[1.4vw] border-[0.18vw] border-[#cad7eb] bg-white px-[2vw] py-[3vh]">
              <p className="font-display text-[3.8vw] font-extrabold text-[#aabbd8]">
                02
              </p>
              <h2 className="mt-[2vh] font-display text-[2.3vw] font-bold text-primary">
                Review
              </h2>
            </div>
            <div className="rounded-[1.4vw] border-[0.18vw] border-[#cad7eb] bg-white px-[2vw] py-[3vh]">
              <p className="font-display text-[3.8vw] font-extrabold text-[#aabbd8]">
                03
              </p>
              <h2 className="mt-[2vh] font-display text-[2.3vw] font-bold text-primary">
                Coordinate
              </h2>
            </div>
            <div className="rounded-[1.4vw] bg-[#dce8fa] px-[2vw] py-[3vh]">
              <p className="font-display text-[3.8vw] font-extrabold text-[#7393cd]">
                04
              </p>
              <h2 className="mt-[2vh] font-display text-[2.3vw] font-bold text-primary">
                Track
              </h2>
            </div>
          </div>
        </div>
      </div>
      <DeckMark page="05" />
    </SlideFrame>
  );
}