// Sound is opt-in and only invoked from explicit user gestures. No autoplay or music.
export function interfaceSound(
  enabled: boolean,
  type: "capture" | "flow" | "complete",
) {
  if (!enabled || typeof window === "undefined" || !window.AudioContext) return;
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value =
    type === "capture" ? 660 : type === "flow" ? 440 : 880;
  gain.gain.setValueAtTime(0.025, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.13);
  oscillator.onended = () => {
    void context.close();
  };
}
