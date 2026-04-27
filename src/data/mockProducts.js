export const MOCK_PRODUCTS = [
  // ORIBE
  { id: "oribe_gold_lust_oil",       brand: "ORIBE",         name: "Gold Lust Nourishing Oil",         shortName: "Gold Lust\nNourishing Oil",         price: 56,  stationTag: "BACK BAR",   abbr: "ORI", color: "#1a1612" },
  { id: "oribe_dry_texturizing",     brand: "ORIBE",         name: "Dry Texturizing Spray",             shortName: "Dry Texturizing\nSpray",             price: 49,  stationTag: "ON STATION", abbr: "ORI", color: "#1a1612" },
  { id: "oribe_royal_blowout",       brand: "ORIBE",         name: "Royal Blowout Heat Styling Spray",  shortName: "Royal Blowout\nHeat Styling Spray",  price: 69,  stationTag: "ON STATION", abbr: "ORI", color: "#1a1612" },
  // R+Co
  { id: "rplusco_dallas_thickening", brand: "R+Co",          name: "Dallas Thickening Conditioner",     shortName: "Dallas Thickening\nConditioner",     price: 36,  stationTag: "BACK BAR",   abbr: "R+C", color: "#1e1020" },
  { id: "rplusco_death_valley",      brand: "R+Co",          name: "Death Valley Dry Shampoo",          shortName: "Death Valley\nDry Shampoo",          price: 36,  stationTag: "ON STATION", abbr: "R+C", color: "#1e1020" },
  { id: "rplusco_rockaway_salt",     brand: "R+Co",          name: "Rockaway Salt Spray",               shortName: "Rockaway Salt\nSpray",               price: 32,  stationTag: "ON STATION", abbr: "R+C", color: "#1e1020" },
  { id: "rplusco_television",        brand: "R+Co",          name: "Television Perfect Hair Shampoo",   shortName: "Television Perfect\nHair Shampoo",   price: 32,  stationTag: "BACK BAR",   abbr: "R+C", color: "#1e1020" },
  // Davines
  { id: "davines_oi_all_in_one",     brand: "davines",       name: "OI All In One Milk",                shortName: "Ol All In\nOne Milk",                price: 44,  stationTag: "ON STATION", abbr: "DAV", color: "#1e1a0e" },
  { id: "davines_oi_hair_butter",    brand: "davines",       name: "OI Hair Butter",                    shortName: "Ol Hair\nButter",                    price: 50,  stationTag: "ON STATION", abbr: "DAV", color: "#1e1a0e" },
  { id: "davines_naturaltech",       brand: "davines",       name: "Naturaltech Replumping Serum",      shortName: "Naturaltech\nReplumping Serum",      price: 68,  stationTag: "BACK BAR",   abbr: "DAV", color: "#1e1a0e" },
  // Kevin Murphy
  { id: "km_killer_curls",           brand: "KEVIN.MURPHY",  name: "Killer.Curls Wash",                 shortName: "Killer.Curls\nWash",                 price: 38,  stationTag: "BACK BAR",   abbr: "KM",  color: "#141e14" },
  { id: "km_hydrate_me_rinse",       brand: "KEVIN.MURPHY",  name: "Hydrate-Me.Rinse",                  shortName: "Hydrate-Me\nRinse",                  price: 38,  stationTag: "BACK BAR",   abbr: "KM",  color: "#141e14" },
  { id: "km_undo_volume",            brand: "KEVIN.MURPHY",  name: "Undo Volume Spray",                 shortName: "Undo Volume\nSpray",                 price: 37,  stationTag: "ON STATION", abbr: "KM",  color: "#141e14" },
  { id: "km_session_spray",          brand: "KEVIN.MURPHY",  name: "Session.Spray Flex",                shortName: "Session.Spray\nFlex",                price: 34,  stationTag: "ON STATION", abbr: "KM",  color: "#141e14" },
  { id: "km_plumping_wash",          brand: "KEVIN.MURPHY",  name: "Plumping Wash",                     shortName: "Plumping\nWash",                     price: 38,  stationTag: "BACK BAR",   abbr: "KM",  color: "#141e14" },
  // Virtue
  { id: "virtue_healing_shampoo",    brand: "VIRTUE",        name: "Healing Shampoo",                   shortName: "Healing\nShampoo",                   price: 42,  stationTag: "BACK BAR",   abbr: "VRT", color: "#18181c" },
  { id: "virtue_healing_cond",       brand: "VIRTUE",        name: "Healing Conditioner",               shortName: "Healing\nConditioner",               price: 42,  stationTag: "BACK BAR",   abbr: "VRT", color: "#18181c" },
  { id: "virtue_6in1_styler",        brand: "VIRTUE",        name: "6-in-1 Styler",                     shortName: "6-in-1\nStyler",                     price: 40,  stationTag: "ON STATION", abbr: "VRT", color: "#18181c" },
  { id: "virtue_full_shampoo",       brand: "VIRTUE",        name: "Full Shampoo For Thick Hair",       shortName: "Full Shampoo\nFor Thick Hair",       price: 42,  stationTag: "BACK BAR",   abbr: "VRT", color: "#18181c" },
  { id: "virtue_creme_rinse",        brand: "VIRTUE",        name: "Crème Rinse",                       shortName: "Crème\nRinse",                       price: 42,  stationTag: "BACK BAR",   abbr: "VRT", color: "#18181c" },
  // Olaplex
  { id: "olaplex_no4",               brand: "OLAPLEX",       name: "No.4 Bond Maintenance Shampoo",     shortName: "No.4 Bond Maintenance\nShampoo",     price: 30,  stationTag: "BACK BAR",   abbr: "OLX", color: "#1a1a24" },
  { id: "olaplex_no5",               brand: "OLAPLEX",       name: "No.5 Bond Maintenance Conditioner", shortName: "No.5 Bond Maintenance\nConditioner", price: 30,  stationTag: "BACK BAR",   abbr: "OLX", color: "#1a1a24" },
  { id: "olaplex_no7",               brand: "OLAPLEX",       name: "No.7 Bonding Oil",                  shortName: "No.7\nBonding Oil",                  price: 30,  stationTag: "ON STATION", abbr: "OLX", color: "#1a1a24" },
  { id: "olaplex_no6",               brand: "OLAPLEX",       name: "No.6 Bond Smoother",                shortName: "No.6\nBond Smoother",                price: 30,  stationTag: "ON STATION", abbr: "OLX", color: "#1a1a24" },
  { id: "olaplex_no9",               brand: "OLAPLEX",       name: "No.9 Bond Protector Nourishing Hair Serum", shortName: "No.9 Bond Protector\nNourishing Hair Serum", price: 30, stationTag: "BACK BAR", abbr: "OLX", color: "#1a1a24" },
];
