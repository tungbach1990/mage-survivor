// Environments: the weather of the field itself, rolled for each wave from the chapter's pool. They tilt the
// elements (for the player's spells and against the monsters alike) and change the field a little. The player's
// own rain spells (Storm Cloud, Lava Rain, Lightning Rain) still come on top.

export const ENVS = {
  clear: { name: "Trời quang", icon: "☀", vi: "Không có gì đặc biệt.", mul: {} },
  sun: {
    name: "Nắng gắt", icon: "🔆", vi: "Lửa +20%, Ánh sáng +10% · Nước, Băng −15% · vũng nước khô nhanh gấp đôi, quái mau hết Ướt.",
    mul: { fire: 1.2, light: 1.1, water: 0.85, ice: 0.85 }, dry: 2,
  },
  rain: {
    name: "Mưa phùn", icon: "🌦", vi: "Nước, Sét +15% · Lửa −15% · quái thỉnh thoảng bị Ướt, mưa để lại vũng nước nhỏ.",
    mul: { water: 1.15, volt: 1.15, fire: 0.85 }, soak: true, puddles: 2.2,
  },
  snow: {
    name: "Tuyết rơi", icon: "❄", vi: "Băng +20% · Lửa −10% · quái chậm 15% · vũng nước đóng thành băng trơn (chậm 40%).",
    mul: { ice: 1.2, fire: 0.9 }, slow: 0.15, freezeWater: true,
  },
  fog: {
    name: "Sương mù", icon: "🌫", vi: "Ánh sáng, Bóng tối +25% · phép chỉ thấy quái khi chúng đến gần (tầm nhìn 220).",
    mul: { light: 1.25, dark: 1.25 }, sight: 220,
  },
  sandstorm: {
    name: "Bão cát", icon: "🏜", vi: "Đất, Gió +20% · Ánh sáng −15% · quái chậm 10%, đánh tường chậm 10%.",
    mul: { earth: 1.2, wind: 1.2, light: 0.85 }, slow: 0.1, atk: 0.9,
  },
  miasma: {
    name: "Chướng khí", icon: "☁", vi: "Độc +25% · độc cộng dồn tới 7 lớp · Ánh sáng −10% · quái hồi 1% máu/giây.",
    mul: { poison: 1.25, light: 0.9 }, poisonCap: 7, regen: 0.01,
  },
  night: {
    name: "Đêm trăng máu", icon: "🌑", vi: "Bóng tối, Huyền bí +20% · Ánh sáng −20% · quái nhanh hơn 15%.",
    mul: { dark: 1.2, arcane: 1.2, light: 0.8 }, haste: 0.15,
  },
  aurora: {
    name: "Cực quang", icon: "🌌", vi: "Huyền bí +25% · mọi phản ứng +15% sát thương · aura kéo dài thêm 20%.",
    mul: { arcane: 1.25 }, react: 1.15, aura: 1.2,
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
