// Environments: the weather of the field itself, rolled for each wave from the chapter's pool. They tilt the
// elements and the martial marks (each has a martial rule too: blinding sun, snow that holds a pin...) and change the field a little. The player's
// own rain spells (Storm Cloud, Lava Rain, Lightning Rain) still come on top.

export const ENVS = {
  clear: { name: "Trời quang", icon: "☀", vi: "Không có gì đặc biệt.", mul: {} },
  sun: {
    name: "Nắng gắt", icon: "🔆", vi: "Lửa +20%, Ánh sáng +10% · Nước, Băng −15% · vũng nước khô nhanh gấp đôi, quái mau hết Ướt. Võ thuật: Chảy máu, Mù +20% · nắng chói: quái bị Mù trượt 50%.",
    mul: { fire: 1.2, light: 1.1, water: 0.85, ice: 0.85, bleed: 1.2, blind: 1.2 }, dry: 2, blindMiss: 0.5,
  },
  rain: {
    name: "Mưa phùn", icon: "🌦", vi: "Nước, Sét +15% · Lửa −15% · quái thỉnh thoảng bị Ướt, mưa để lại vũng nước nhỏ. Võ thuật: Phá giáp, Què +15% (giáp gỉ, đất trơn) · Nọc −15% (mưa rửa trôi).",
    mul: { water: 1.15, volt: 1.15, fire: 0.85, sunder: 1.15, cripple: 1.15, venom: 0.85 }, soak: true, puddles: 2.2,
  },
  snow: {
    name: "Tuyết rơi", icon: "❄", vi: "Băng +20% · Lửa −10% · quái chậm 15% · vũng nước đóng thành băng trơn (chậm 40%). Võ thuật: Ghim, Choáng +20% · Ghim giữ chân lâu gấp rưỡi (chân lún tuyết).",
    mul: { ice: 1.2, fire: 0.9, pin: 1.2, daze: 1.2 }, slow: 0.15, freezeWater: true, pinMul: 1.5,
  },
  fog: {
    name: "Sương mù", icon: "🌫", vi: "Ánh sáng, Bóng tối +25% · phép chỉ thấy quái khi chúng đến gần (tầm nhìn 220). Võ thuật: Đánh dấu, Mù +25% · đánh lén trong sương: đòn Đánh dấu chí mạng ×2.",
    mul: { light: 1.25, dark: 1.25, expose: 1.25, blind: 1.25 }, sight: 220, exposeCrit: 2,
  },
  sandstorm: {
    name: "Bão cát", icon: "🏜", vi: "Đất, Gió +20% · Ánh sáng −15% · quái chậm 10%, đánh tường chậm 10%. Võ thuật: Mù, Phá giáp +20% · cát mài giáp: quái bị Mù trượt 50%.",
    mul: { earth: 1.2, wind: 1.2, light: 0.85, blind: 1.2, sunder: 1.2 }, slow: 0.1, atk: 0.9, blindMiss: 0.5,
  },
  miasma: {
    name: "Chướng khí", icon: "☁", vi: "Độc +25% · độc cộng dồn tới 7 lớp · Ánh sáng −10% · quái hồi 1% máu/giây. Võ thuật: Nọc +25%, cộng dồn tới 11 lớp · Chảy máu −10%.",
    mul: { poison: 1.25, light: 0.9, venom: 1.25, bleed: 0.9 }, poisonCap: 7, regen: 0.01, venomCap: 11,
  },
  night: {
    name: "Đêm trăng máu", icon: "🌑", vi: "Bóng tối, Huyền bí +20% · Ánh sáng −20% · quái nhanh hơn 15%. Võ thuật: Chảy máu, Đánh dấu +20% · trăng máu: quái bị Truy nã rơi vàng ×3.",
    mul: { dark: 1.2, arcane: 1.2, light: 0.8, bleed: 1.2, expose: 1.2 }, haste: 0.15, bounty: 3,
  },
  aurora: {
    name: "Cực quang", icon: "🌌", vi: "Huyền bí +25% · mọi phản ứng và combo +15% sát thương · dấu và aura kéo dài thêm 20%. Võ thuật: Choáng, Tước vũ khí +20%.",
    mul: { arcane: 1.25, daze: 1.2, disarm: 1.2 }, react: 1.15, aura: 1.2,
  },
};

// which environments each chapter rolls from (wave 1 of chapter 1 is always clear)
export const ENV_POOL = {
  1: ["clear", "clear", "sun", "rain", "fog"],
  2: ["rain", "fog", "miasma", "miasma", "clear"],
  3: ["sun", "sun", "sandstorm", "night"],
  4: ["snow", "snow", "fog", "aurora"],
  5: ["night", "aurora", "fog", "miasma", "sandstorm"],
  endless: Object.keys(ENVS),
};
