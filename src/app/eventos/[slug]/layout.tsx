import "./evento.css";

import { eventoSans, eventoScript, eventoSerif } from "./evento-fonts";

const EventoLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div
      className={`evento-page ${eventoSerif.variable} ${eventoSans.variable} ${eventoScript.variable} evento-sans min-h-svh`}
    >
      {children}
    </div>
  );
};

export default EventoLayout;
