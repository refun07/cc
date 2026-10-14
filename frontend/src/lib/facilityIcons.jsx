import {
  Accessibility, AirVent, Bath, Camera, Car, ChefHat, CircleCheck, Cctv, Flower2,
  Lightbulb, Moon, MoveVertical, Music, ParkingCircle, PartyPopper, Projector,
  ShieldCheck, Snowflake, Sofa, Sparkles, Trees, Utensils, Volume2, Wifi, Zap,
} from "lucide-react";

/**
 * Registry of facility icons. `key` is what we persist on the facility row.
 * Add an entry here and it becomes pickable everywhere — owner form, listing
 * card and centre detail page all read from this one map.
 */
export const FACILITY_ICONS = {
  ac: { icon: Snowflake, label: "Air conditioning" },
  airvent: { icon: AirVent, label: "Ventilation" },
  lighting: { icon: Lightbulb, label: "Lighting" },
  stage: { icon: PartyPopper, label: "Stage" },
  sound: { icon: Volume2, label: "Sound system" },
  music: { icon: Music, label: "Music" },
  bridal: { icon: Sparkles, label: "Bridal room" },
  kitchen: { icon: ChefHat, label: "Kitchen" },
  catering: { icon: Utensils, label: "Catering" },
  security: { icon: ShieldCheck, label: "Security" },
  cctv: { icon: Cctv, label: "CCTV" },
  parking: { icon: ParkingCircle, label: "Parking" },
  car: { icon: Car, label: "Valet / car" },
  wifi: { icon: Wifi, label: "Wi-Fi" },
  generator: { icon: Zap, label: "Generator / power" },
  washroom: { icon: Bath, label: "Washroom" },
  prayer: { icon: Moon, label: "Prayer room" },
  lift: { icon: MoveVertical, label: "Lift / elevator" },
  accessible: { icon: Accessibility, label: "Wheelchair access" },
  projector: { icon: Projector, label: "Projector" },
  photography: { icon: Camera, label: "Photography" },
  garden: { icon: Trees, label: "Garden / lawn" },
  decor: { icon: Flower2, label: "Decoration" },
  furniture: { icon: Sofa, label: "Furniture" },
  check: { icon: CircleCheck, label: "General" },
};

/** Keyword → icon key, used to auto-match a facility that has no icon set. */
const KEYWORDS = [
  [/air.?cond|\bac\b|cooling/i, "ac"],
  [/vent/i, "airvent"],
  [/light/i, "lighting"],
  [/stage/i, "stage"],
  [/sound|audio|speaker|mic/i, "sound"],
  [/music|dj|band/i, "music"],
  [/bridal|bride|groom/i, "bridal"],
  [/kitchen/i, "kitchen"],
  [/cater|food|dining|buffet/i, "catering"],
  [/cctv|camera surveil/i, "cctv"],
  [/security|guard|safety|fire/i, "security"],
  [/valet/i, "car"],
  [/park/i, "parking"],
  [/wi.?fi|internet|broadband/i, "wifi"],
  [/generator|power|backup|electric/i, "generator"],
  [/washroom|toilet|restroom|bath/i, "washroom"],
  [/prayer|namaz|mosque/i, "prayer"],
  [/lift|elevator/i, "lift"],
  [/wheelchair|accessib|disabled|ramp/i, "accessible"],
  [/projector|screen|av\b/i, "projector"],
  [/photo|video/i, "photography"],
  [/garden|lawn|outdoor|terrace|rooftop/i, "garden"],
  [/decor|floral|flower/i, "decor"],
  [/furnitur|chair|table|seat/i, "furniture"],
];

/** Resolve the icon key for a facility: explicit `icon` wins, else guess from the name. */
export function resolveIconKey(name = "", icon = null) {
  if (icon && FACILITY_ICONS[icon]) return icon;
  const match = KEYWORDS.find(([re]) => re.test(name));
  return match ? match[1] : "check";
}

/** Get the lucide component for a facility. */
export function facilityIcon(name, icon) {
  return FACILITY_ICONS[resolveIconKey(name, icon)].icon;
}
