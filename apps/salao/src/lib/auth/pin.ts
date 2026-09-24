import bcrypt from "bcryptjs";

// PIN de 4 dígitos tem só 10 mil combinações: o hash protege o banco vazado,
// mas quem segura brute force de verdade é o bloqueio por tentativas no login.
export const PIN_REGEX = /^\d{4}$/;

export const hashPin = (pin: string) => bcrypt.hash(pin, 10);

export const conferirPin = (pin: string, hash: string) =>
  bcrypt.compare(pin, hash);
