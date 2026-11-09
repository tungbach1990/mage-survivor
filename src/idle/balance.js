// The idle game's dials, in one place (the admin page can change them).
export const BAL = {
  monster: { hp: 1, atk: 1.8, xp: 0.55 },   // monsters' health, blows and experience
  basic: 0.5,                          // the basic attack's damage
  aspd: 0.6,                           // how fast the hero strikes (a multiplier on blows a second)
  cd: 1.5,                             // the skills' cooldowns
  skill: 0.5,                          // the skills' damage
  // each class's damage late in the game (reached at level 70; a straight line from 1 at level 1)
  late: { mage: 0.62, swordman: 1, archer: 0.66, thief: 1, acolyte: 0.9, merchant: 1 },
  drop: 0.03,                          // gear from a common monster (a boss: always)
  offline: 0.7, offlineMax: 8 * 3600,  // offline: this share of the recent rate, up to 8 hours
};
