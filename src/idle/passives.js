// Passives: five a class, up to level 10, bought with crystals (from breaking gear down). Each lifts one
// number a little a level. The first is the class's own and starts at level 1.
const P = (id, name, stat, per, text) => ({ id, name, stat, per, text, max: 10 });
export const PASSIVE_TREE = {
  mage: [P("arcanist", "Pháp lực", "matk", 0.03, "MATK"), P("channel", "Niệm chú nhanh", "cd", 0.02, "hồi chiêu"), P("manaward", "Lá chắn ma lực", "def", 0.04, "DEF"), P("mind", "Tâm trí", "sp", 0.05, "SP tối đa"), P("scholar", "Học giả", "xp", 0.02, "kinh nghiệm")],
  swordman: [P("bulwark", "Thành lũy", "hp", 0.04, "máu tối đa"), P("edge", "Lưỡi bén", "atk", 0.03, "ATK"), P("ironwill", "Ý chí sắt", "def", 0.05, "DEF"), P("rush", "Xông pha", "aspd", 0.01, "tốc đánh"), P("veteran", "Lão luyện", "xp", 0.02, "kinh nghiệm")],
  archer: [P("hawkeye", "Mắt ưng", "atk", 0.03, "ATK"), P("quickdraw", "Rút tên nhanh", "aspd", 0.012, "tốc đánh"), P("precision", "Chuẩn xác", "crit", 0.006, "chí mạng"), P("nimble", "Nhanh nhẹn", "hp", 0.03, "máu tối đa"), P("tracker", "Truy dấu", "gold", 0.03, "vàng")],
  thief: [P("phantom", "Bóng ma", "crit", 0.008, "chí mạng"), P("toxin", "Độc dược", "atk", 0.03, "ATK"), P("swift", "Nhanh tay", "aspd", 0.012, "tốc đánh"), P("fingers", "Bàn tay nhanh", "gold", 0.05, "vàng"), P("evade", "Lẩn tránh", "def", 0.03, "DEF")],
  acolyte: [P("exorcist", "Trừ tà", "matk", 0.03, "MATK"), P("grace", "Ân phúc", "hp", 0.04, "máu tối đa"), P("sanctuary", "Thánh địa", "def", 0.05, "DEF"), P("devotion", "Thành kính", "sp", 0.05, "SP tối đa"), P("prayer", "Cầu nguyện", "cd", 0.02, "hồi chiêu")],
  merchant: [P("greed", "Lòng tham", "gold", 0.06, "vàng"), P("heavycart", "Xe nặng", "atk", 0.03, "ATK"), P("haggle", "Mặc cả", "hp", 0.03, "máu tối đa"), P("investor", "Đầu tư", "xp", 0.02, "kinh nghiệm"), P("guard", "Bảo vệ hàng", "def", 0.04, "DEF")],
};
export const SIG = Object.fromEntries(Object.entries(PASSIVE_TREE).map(([c, l]) => [c, l[0].id]));
export const passiveCost = (level) => Math.round(40 * Math.pow(1.5, level));
