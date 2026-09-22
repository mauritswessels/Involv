import type { ReactNode } from 'react';

export const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

export function SlideFrame({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`w-screen h-screen overflow-hidden relative bg-bg text-text font-body ${className}`}
    >
      <div className="absolute inset-x-0 top-0 h-[1.1vh] bg-primary" />
      {children}
    </div>
  );
}

export function DeckMark({ page }: { page: string }) {
  return (
    <div className="absolute left-[5.5vw] right-[5.5vw] bottom-[4.2vh] flex items-center justify-between">
      <div className="flex items-center gap-[0.7vw] text-primary">
        <span className="flex h-[3.2vh] w-[3.2vh] items-center justify-center rounded-[0.38vw] bg-primary text-[1.25vw] font-extrabold text-white">
          i
        </span>
        <span className="font-display text-[1.55vw] font-extrabold">Involv</span>
      </div>
      <span className="font-display text-[1.5vw] font-bold tracking-[0.18em] text-muted">
        {page}
      </span>
    </div>
  );
}

export function Bullet({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-[1.1vw]">
      <span className="mt-[1.05vh] h-[1.1vh] w-[1.1vh] shrink-0 rounded-full bg-accent" />
      <p className="text-[2vw] leading-[1.3] text-text">{children}</p>
    </div>
  );
}

export function CheckLine({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-[1.2vw] border-b border-[var(--slide-line)] py-[1.7vh]">
      <div className="flex h-[3.6vh] w-[3.6vh] shrink-0 items-center justify-center rounded-full bg-primary text-[1.55vw] font-bold text-white">
        ✓
      </div>
      <p className="text-[2vw] leading-[1.2] text-text">{children}</p>
    </div>
  );
}