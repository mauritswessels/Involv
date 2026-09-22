import { asset, SlideFrame } from '../../components/SlideKit';

export default function Slide01Cover() {
  return (
    <SlideFrame>
      <div className="grid h-full grid-cols-[42%_58%]">
        <div className="relative flex flex-col justify-center bg-primary px-[5.5vw] pb-[5vh] text-white">
          <div className="absolute right-0 top-[10vh] h-[80vh] w-[0.35vw] bg-[#6f93dd]" />
          <div className="mb-[7vh] flex items-center gap-[0.9vw]">
            <span className="flex h-[5.4vh] w-[5.4vh] items-center justify-center rounded-[0.55vw] bg-white text-[1.9vw] font-extrabold text-primary">
              i
            </span>
            <span className="font-display text-[2.5vw] font-extrabold text-white">
              Involv
            </span>
          </div>
          <h1 className="font-display text-[5.6vw] font-extrabold leading-[0.98] tracking-[-0.045em]">
            Involv
          </h1>
          <p className="mt-[3vh] max-w-[29vw] font-display text-[2.5vw] font-semibold leading-[1.2] text-[#dbe7ff]">
            A clearer way to organise service learning.
          </p>
          <p className="mt-[4vh] max-w-[30vw] text-[1.7vw] leading-[1.45] text-[#bfcff0]">
            A student-first platform for discovering, applying for, and managing
            meaningful school service-learning opportunities.
          </p>
        </div>
        <div className="relative flex items-center justify-center bg-[#edf2fa] px-[4vw]">
          <div className="absolute left-[5vw] top-[12vh] h-[18vh] w-[18vh] rounded-full bg-[#d9e5fb]" />
          <div className="absolute bottom-[10vh] right-[3vw] h-[26vh] w-[26vh] rounded-full border-[1.2vw] border-[#d8e3f6]" />
          <div className="relative w-[50vw] overflow-hidden rounded-[1.6vw] border-[0.16vw] border-[#ccd8eb] bg-white shadow-[0_2.5vh_6vh_rgba(11,43,99,0.18)]">
            <div className="flex h-[4vh] items-center gap-[0.6vw] border-b border-[#dbe3ef] bg-[#f7f9fc] px-[1.4vw]">
              <span className="h-[0.8vw] w-[0.8vw] rounded-full bg-[#ef9a9a]" />
              <span className="h-[0.8vw] w-[0.8vw] rounded-full bg-[#f4d27a]" />
              <span className="h-[0.8vw] w-[0.8vw] rounded-full bg-[#8bc7a5]" />
            </div>
            <img
              src={asset('product/involv-home.jpg')}
              crossOrigin="anonymous"
              className="h-[56vh] w-full object-cover object-top"
              alt="Involv landing page"
            />
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}