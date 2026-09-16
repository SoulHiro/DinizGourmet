export const formatEventDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
};

export const formatEventTime = (time: string) => time.slice(0, 5);

export const removeWhatsappPunctuation = (whatsapp: string) => {
  return whatsapp.replace(/\D/g, "");
};
