// Phase 4 of docs/design/EXECUTION.md: one icon family.
//
//   node scripts/codemods/one-icon-family.mjs [--dry]
//
// Replaces every import from the twelve react-icons sets with its Lucide
// equivalent, using Lucide's `…Icon` export names so nothing collides with a
// component of the same name. Icons that were solid on purpose (a rated star,
// a liked heart, a saved bookmark) keep that meaning with `fill="currentColor"`.
// Brand marks Lucide does not carry map to a neutral glyph; the label beside
// them already names the service.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const dry = process.argv.includes("--dry");

/** react-icons name → [Lucide name, filled?] */
const MAP = {
  FaChevronLeft: ["ChevronLeft"], FaChevronRight: ["ChevronRight"], FaChevronDown: ["ChevronDown"],
  AiOutlineLoading3Quarters: ["LoaderCircle"], FaCircleNotch: ["LoaderCircle"],
  FaTv: ["Tv"], FaFilm: ["Film"], RiEyeCloseLine: ["EyeOff"], PiEyeBold: ["Eye"],
  MdOutlineWatchLater: ["Clock"], FiMessageSquare: ["MessageSquare"], FiHeart: ["Heart"], CiHeart: ["Heart"],
  FcLike: ["Heart", true], FiDownload: ["Download"], FiBookmark: ["Bookmark"], HiOutlineBookmark: ["Bookmark"],
  FaBookmark: ["Bookmark", true], FiBell: ["Bell"], IoNotificationsOutline: ["Bell"], FaUsers: ["Users"],
  FiUsers: ["Users"], FiUser: ["User"], FaSearch: ["Search"], FiSearch: ["Search"], FaMagnifyingGlass: ["Search"],
  MdPauseCircleOutline: ["CirclePause"], MdLiveTv: ["MonitorPlay"], MdContentCopy: ["Copy"], IoIosCopy: ["Copy"],
  LuSend: ["Send"], IoCloseCircleOutline: ["CircleX"], HiOutlineStar: ["Star"], FaStar: ["Star", true],
  HiOutlineGlobeAlt: ["Globe"], FaGlobe: ["Globe"], HiHome: ["House"], FiPlusSquare: ["SquarePlus"],
  FiPlay: ["Play"], FiList: ["List"], FiCompass: ["Compass"], FaXmark: ["X"], FaTimes: ["X"],
  FaRightFromBracket: ["LogOut"], FaMagic: ["WandSparkles"], FaLayerGroup: ["Layers"], FaFilter: ["Funnel"],
  FaEdit: ["SquarePen"], FaCheck: ["Check"], FaCalendar: ["Calendar"], FaBars: ["Menu"],
  FaInstagram: ["Instagram"], FaXTwitter: ["Twitter"], FaTwitter: ["Twitter"], FaWhatsapp: ["MessageCircle"],
  FaImdb: ["Clapperboard"],
};

const IMPORT = /import\s*\{([^}]+)\}\s*from\s*["']react-icons\/[a-z0-9]+["'];?\n?/g;
const LUCIDE = /import\s*\{([^}]+)\}\s*from\s*["']lucide-react["'];?/;

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) walk(f, acc);
    else if (/\.tsx?$/.test(e)) acc.push(f);
  }
  return acc;
}

const missing = new Set();
let files = 0;
for (const f of walk("src")) {
  let src = readFileSync(f, "utf8");
  if (!/from\s*["']react-icons\//.test(src)) continue;
  const renames = new Map(); // local name in file → lucide export
  src = src.replace(IMPORT, (_m, names) => {
    for (const part of names.split(",").map((s) => s.trim()).filter(Boolean)) {
      const [orig, local = orig] = part.split(/\s+as\s+/).map((s) => s.trim());
      const target = MAP[orig];
      if (!target) { missing.add(orig); continue; }
      renames.set(local, target);
    }
    return "";
  });
  const needed = new Set();
  for (const [local, [name, filled]] of renames) {
    const exportName = `${name}Icon`;
    needed.add(exportName);
    // JSX with a filled meaning keeps it.
    if (filled) src = src.replace(new RegExp(`<${local}(?![\\w])`, "g"), `<${exportName} fill="currentColor"`);
    src = src.replace(new RegExp(`(?<![\\w.])${local}(?![\\w])`, "g"), exportName);
  }
  const lucide = LUCIDE.exec(src);
  if (lucide) {
    const have = new Set(lucide[1].split(",").map((s) => s.trim()).filter(Boolean));
    for (const n of needed) have.add(n);
    src = src.replace(LUCIDE, `import { ${[...have].join(", ")} } from "lucide-react";`);
  } else if (needed.size) {
    // After the last import statement.
    const lines = src.split("\n");
    let last = -1;
    lines.forEach((l, i) => { if (/^import\s.*from\s+["'].+["'];?\s*$/.test(l)) last = i; });
    lines.splice(last + 1, 0, `import { ${[...needed].join(", ")} } from "lucide-react";`);
    src = lines.join("\n");
  }
  files++;
  if (!dry) writeFileSync(f, src);
}
console.log(`${dry ? "would change" : "changed"} ${files} files`);
if (missing.size) console.log("no mapping for:", [...missing].join(", "));
