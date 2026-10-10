"use client";

import { useEffect, useState } from "react";

// Avisos no celular do garçom: som, vibração, notificação do sistema (com o
// app em segundo plano) e tela sempre acesa enquanto o app está aberto.

const CHAVE_SOM = "avisos:som";

export const somLigado = () => {
  try {
    return localStorage.getItem(CHAVE_SOM) !== "0";
  } catch {
    return true;
  }
};

let contexto: AudioContext | null = null;

// O navegador só deixa tocar som depois de um toque na tela: o primeiro
// toque em qualquer lugar "destrava" o áudio para os alertas seguintes.
const destravarAudio = () => {
  if (typeof window === "undefined" || contexto) return;
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return;
  contexto = new Ctx();
  // Um som vazio confirma o desbloqueio no iOS.
  const buffer = contexto.createBuffer(1, 1, 22_050);
  const fonte = contexto.createBufferSource();
  fonte.buffer = buffer;
  fonte.connect(contexto.destination);
  fonte.start(0);
};

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", destravarAudio, { once: true });
}

// Dois toques curtos, agudo e alto o bastante para o salão. Pedido de conta
// toca três (é o mais urgente).
export const tocarAlerta = (urgente = false) => {
  if (!somLigado() || !contexto) return;
  if (contexto.state === "suspended") contexto.resume().catch(() => {});
  const notas = urgente ? [988, 1319, 988] : [880, 1175];
  const inicio = contexto.currentTime + 0.02;
  notas.forEach((freq, i) => {
    if (!contexto) return;
    const osc = contexto.createOscillator();
    const volume = contexto.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    const t = inicio + i * 0.22;
    volume.gain.setValueAtTime(0.0001, t);
    volume.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    volume.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(volume).connect(contexto.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  });
};

// Notificação do sistema: aparece mesmo com o app atrás de outro ou com a
// tela bloqueada (enquanto o navegador mantém o app vivo). Exige HTTPS.
export const notificarSistema = async (titulo: string, corpo: string) => {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const opcoes = {
    body: corpo,
    tag: titulo,
    renotify: true,
    icon: "/icons/192",
    vibrate: [250, 120, 250],
  } as NotificationOptions;
  try {
    const registro = await navigator.serviceWorker?.getRegistration();
    if (registro) await registro.showNotification(titulo, opcoes);
    else new Notification(titulo, opcoes);
  } catch {}
};

export const pedirPermissaoNotificacao = async () => {
  if (typeof window === "undefined" || !("Notification" in window))
    return "indisponivel" as const;
  if (!window.isSecureContext) return "sem-https" as const;
  if (Notification.permission === "default")
    return await Notification.requestPermission();
  return Notification.permission;
};

// Liga/desliga o som (lembrado no celular). Ligar também pede permissão
// de notificação e já toca um exemplo.
export const useSomAlertas = () => {
  const [ligado, setLigado] = useState(true);
  useEffect(() => setLigado(somLigado()), []);
  const alternar = async () => {
    const novo = !ligado;
    try {
      localStorage.setItem(CHAVE_SOM, novo ? "1" : "0");
    } catch {}
    setLigado(novo);
    if (novo) {
      destravarAudio();
      tocarAlerta();
      await pedirPermissaoNotificacao();
    }
  };
  return { ligado, alternar };
};

// Tela acesa enquanto o app está aberto: com a tela apagada o garçom não vê
// nem ouve os chamados. O sistema solta a trava quando o app sai da frente;
// ao voltar, pede de novo.
export const useManterTelaLigada = () => {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let trava: WakeLockSentinel | null = null;
    const pedir = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        trava = await navigator.wakeLock.request("screen");
      } catch {}
    };
    pedir();
    const aoVoltar = () => {
      if (document.visibilityState === "visible") pedir();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      trava?.release().catch(() => {});
    };
  }, []);
};
