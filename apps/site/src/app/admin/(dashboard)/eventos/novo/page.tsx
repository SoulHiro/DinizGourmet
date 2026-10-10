import { EventForm } from "../_components/event-form";

const NovoEventoPage = () => {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Novo evento</h1>
      <EventForm />
    </div>
  );
};

export default NovoEventoPage;
