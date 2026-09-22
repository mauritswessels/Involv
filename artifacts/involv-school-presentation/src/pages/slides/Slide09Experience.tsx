import { asset, DeckMark, SlideFrame } from '../../components/SlideKit';

export default function Slide09Experience() {
  return (
    <SlideFrame>
      <div className="px-[5.5vw] pt-[6vh]">
        <h1 className="font-display text-[4.4vw] font-extrabold tracking-[-0.045em] text-primary">
          The experience is designed to feel simple
        </h1>
        <div className="mt-[3.5vh] grid grid-cols-[39%_61%] gap-[3.2vw]">
          <div className="space-y-[1.1vh]">
            <div className="border-b border-[#dbe3ef] py-[1.5vh] text-[1.9vw] leading-[1.25]">
              One clear action at each stage
            </div>
            <div className="border-b border-[#dbe3ef] py-[1.5vh] text-[1.9vw] leading-[1.25]">
              Focused screens instead of overloaded dashboards
            </div>
            <div className="border-b border-[#dbe3ef] py-[1.5vh] text-[1.9vw] leading-[1.25]">
              Plain language that works for students and organisers
            </div>
            <div className="border-b border-[#dbe3ef] py-[1.5vh] text-[1.9vw] leading-[1.25]">
              Categories that help people start with their interests
            </div>
            <div className="py-[1.5vh] text-[1.9vw] leading-[1.25]">
              A calm visual system built around navy, white, and purposeful
              colour
            </div>
          </div>
          <div className="grid grid-cols-3 gap-[1.2vw]">
            <div className="overflow-hidden rounded-[1.2vw] border border-[#cad6e8] bg-white shadow-[0_1.5vh_3vh_rgba(11,43,99,0.12)]">
              <img
                src={asset('product/involv-home.jpg')}
                crossOrigin="anonymous"
                className="h-[45vh] w-full object-cover object-top"
                alt="Involv landing page"
              />
              <p className="px-[1.2vw] py-[1.8vh] font-display text-[1.5vw] font-bold text-primary">
                Landing page
              </p>
            </div>
            <div className="mt-[5vh] overflow-hidden rounded-[1.2vw] border border-[#cad6e8] bg-white shadow-[0_1.5vh_3vh_rgba(11,43,99,0.12)]">
              <img
                src={asset('product/involv-browse.jpg')}
                crossOrigin="anonymous"
                className="h-[45vh] w-full object-cover object-top"
                alt="Involv browse page"
              />
              <p className="px-[1.2vw] py-[1.8vh] font-display text-[1.5vw] font-bold text-primary">
                Browse page
              </p>
            </div>
            <div className="overflow-hidden rounded-[1.2vw] border border-[#cad6e8] bg-white shadow-[0_1.5vh_3vh_rgba(11,43,99,0.12)]">
              <img
                src={asset('product/involv-login.jpg')}
                crossOrigin="anonymous"
                className="h-[45vh] w-full object-cover object-top"
                alt="Involv sign-in page"
              />
              <p className="px-[1.2vw] py-[1.8vh] font-display text-[1.5vw] font-bold text-primary">
                Sign-in page
              </p>
            </div>
          </div>
        </div>
      </div>
      <DeckMark page="09" />
    </SlideFrame>
  );
}