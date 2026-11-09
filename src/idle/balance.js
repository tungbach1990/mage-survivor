// The idle game's dials, in one place (the admin page can change them).
export const BAL = {
  monster: { hp: 1, atk: 2.2, xp: 0.3 },   // monsters' health, blows and experience
  basic: 1,                            // the basic attack's damage
  skill: 1,                            // the skills' damage
  // each class's damage late in the game (reached at level 70; a straight line from 1 at level 1)
  late: { mage: 0.62, swordman: 1, archer: 0.66, thief: 1, acolyte: 0.9, merchant: 1 },
  drop: 0.03,                          // gear from a common monster (a boss: always)
  offline: 0.7, offlineMax: 8 * 3600,  // offline: this share of the recent rate, up to 8 hours
};
