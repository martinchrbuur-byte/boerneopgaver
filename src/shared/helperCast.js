/**
 * Helper Cast — the magical cast of characters that appear at key moments.
 *
 * Each character has:
 *   id          – unique key used in CSS class names
 *   iconKey     – key from iconRegistry.js (the emoji that represents them)
 *   name        – display name shown in the speech bubble header
 *   trigger     – which event summons them
 *   entrance    – animation variant: 'fallFromTop' | 'zoomFromRight' | 'spiralUp'
 *                 | 'crawlUp' | 'floatFromLeft' | 'dropFromStar'
 *   soundCue    – soundManager key to play on entrance
 *   phrases     – array of random Danish speech-bubble messages (one is chosen at random)
 */

export const HELPER_CAST = Object.freeze([
  {
    id: 'starWizard',
    iconKey: 'wizard',
    name: 'Stjernetroldmanden',
    trigger: 'streak',
    entrance: 'fallFromTop',
    soundCue: 'chime',
    phrases: [
      '✨ Stribetrold aktiveret! Du er uovervindelig!',
      '⭐ Dag efter dag — du er ren magi!',
      '🌟 Hvilken stribe! Troldmanden er imponeret!',
      '✨ Triple-stribe! Wizardhat til dig!',
    ],
  },
  {
    id: 'rocketPilot',
    iconKey: 'astronaut',
    name: 'Raketpiloten',
    trigger: 'fastCompletion',
    entrance: 'zoomFromRight',
    soundCue: 'whoosh',
    phrases: [
      '🚀 WARP-FART! Du er hurtigere end en raket!',
      '🚀 Houston, vi har en HELT!',
      '💨 Blink og det var gjort! Raketpiloten er jaloux!',
      '🚀 5… 4… 3… opgave udført! KABOOM!',
    ],
  },
  {
    id: 'partyFairy',
    iconKey: 'fairy',
    name: 'Festfeen',
    trigger: 'allChoresDone',
    entrance: 'spiralCenter',
    soundCue: 'firework',
    phrases: [
      '🎉 ALLE OPGAVER FÆRDIGE! Du er en HELT!',
      '🧚 Festfeen er stolt — alle stjerner er samlet!',
      '🎊 100 % fuldført! Feen danser af glæde!',
      '✨ Ingenting kan stoppe dig nu! FEJRING!',
    ],
  },
  {
    id: 'coinDragon',
    iconKey: 'dragon',
    name: 'Møntdragen',
    trigger: 'periodPaid',
    entrance: 'crawlUp',
    soundCue: 'coin',
    phrases: [
      '🐉 MØNTREGN! Dragen vågner og det BRAGER!',
      '💰 Perioden klaret — dragen er tilfreds!',
      '🐉 Guld i kassen! Møntdragen nikker anerkendende.',
      '🪙 Lommepenge udbetalt! Dragen vogter din skat!',
    ],
  },
  {
    id: 'sleepyGhost',
    iconKey: 'ghost',
    name: 'Den Søvnige Spøgelse',
    trigger: 'overdueReminder',
    entrance: 'floatFromLeft',
    soundCue: 'pop',
    phrases: [
      '👻 Pssst… opgaverne venter stadig…',
      '😴 Zzzzz... åh, opgaverne! Du kan stadig nå det!',
      '👻 Spøgelset minder dig venligt om dine opgaver!',
      '💤 Det er ikke for sent — kom så, helt!',
    ],
  },
  {
    id: 'trophyKnight',
    iconKey: 'knight',
    name: 'Trofæridderne',
    trigger: 'newRecord',
    entrance: 'dropFromStar',
    soundCue: 'levelup',
    phrases: [
      '🏆 NY REKORD! Ridderen bukker sig dybt!',
      '🥇 Aldrig gjort det bedre! Ridderscenen er din!',
      '⚔️ Rekordslående præstation — ridderen saluterer!',
      '🏆 Trofæsamlingen vokser! Uovertruffet!',
    ],
  },
]);

/**
 * Look up a helper character by its trigger name.
 * @param {string} trigger
 * @returns {object|undefined}
 */
export function getHelperByTrigger(trigger) {
  return HELPER_CAST.find(h => h.trigger === trigger);
}

/**
 * Pick a random phrase from the helper's phrases array.
 * @param {object} helper – a HELPER_CAST entry
 * @returns {string}
 */
export function pickPhrase(helper) {
  const phrases = helper.phrases ?? [];
  if (phrases.length === 0) return '';
  return phrases[Math.floor(Math.random() * phrases.length)];
}
