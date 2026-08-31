import heroTech from "@/assets/hero-tech.jpg";
import pCharger from "@/assets/p-charger.jpg";
import pCpu from "@/assets/p-cpu.jpg";
import pGpu from "@/assets/p-gpu.jpg";
import pHeadphones from "@/assets/p-headphones.jpg";
import pKeyboard from "@/assets/p-keyboard.jpg";
import pLaptopGaming from "@/assets/p-laptop-gaming.jpg";
import pLaptopUltra from "@/assets/p-laptop-ultra.jpg";
import pMonitor from "@/assets/p-monitor.jpg";
import pMouse from "@/assets/p-mouse.jpg";
import pPhoneAndroid from "@/assets/p-phone-android.jpg";
import pRouter from "@/assets/p-router.jpg";
import pSmarthome from "@/assets/p-smarthome.jpg";
import pSsd from "@/assets/p-ssd.jpg";
import pTablet from "@/assets/p-tablet.jpg";

export { heroTech };

export type CategoryId = "laptops" | "mobile" | "audio" | "displays" | "components" | "connected";

export type Category = {
  id: CategoryId;
  name: string;
  blurb: string;
};

export type Spec = {
  label: string;
  value: string;
};

export type Product = {
  slug: string;
  name: string;
  brand: string;
  category: CategoryId;
  /** Stored in pence to keep money arithmetic in integers. */
  price: number;
  /** Previous price in pence, present only when the item is reduced. */
  wasPrice?: number;
  image: string;
  tagline: string;
  description: string;
  highlights: string[];
  specs: Spec[];
  rating: number;
  reviewCount: number;
  stock: number;
  badge?: string;
};

export const categories: Category[] = [
  {
    id: "laptops",
    name: "Laptops",
    blurb: "Thin-and-light machines through to desktop-replacement gaming rigs.",
  },
  {
    id: "mobile",
    name: "Phones & Tablets",
    blurb: "Flagship handsets and tablets with the screens to match.",
  },
  {
    id: "audio",
    name: "Audio",
    blurb: "Noise cancelling headphones tuned for long listening sessions.",
  },
  {
    id: "displays",
    name: "Displays & Desk",
    blurb: "Monitors, keyboards and pointing devices for a workspace that lasts.",
  },
  {
    id: "components",
    name: "Components",
    blurb: "Graphics, processors and storage for building or upgrading.",
  },
  {
    id: "connected",
    name: "Network & Home",
    blurb: "Mesh networking, smart home kit and the power to run it.",
  },
];

export const products: Product[] = [
  {
    slug: "nordvane-aero-14",
    name: "Nordvane Aero 14",
    brand: "Nordvane",
    category: "laptops",
    price: 13639500,
    wasPrice: 15214500,
    image: pLaptopUltra,
    tagline: "A 1.2 kg aluminium ultrabook that lasts a full working day.",
    description:
      "The Aero 14 is built for people who carry their machine everywhere. The unibody aluminium shell is milled to 15.9 mm, the fans stay silent under everyday load, and the 72 Wh cell reaches early evening on a single charge. A 14-inch display at 2880 x 1800 keeps text crisp without draining the battery.",
    highlights: [
      "1.24 kg chassis milled from a single aluminium billet",
      "Up to 14 hours of mixed use from the 72 Wh battery",
      "Two Thunderbolt 4 ports, both able to charge the machine",
      "Backlit keyboard with 1.4 mm of key travel",
    ],
    specs: [
      { label: "Display", value: "14in 2880 x 1800 IPS, 120 Hz" },
      { label: "Processor", value: "12-core mobile CPU, 4.9 GHz boost" },
      { label: "Memory", value: "16 GB LPDDR5X (soldered)" },
      { label: "Storage", value: "512 GB PCIe 4.0 NVMe" },
      { label: "Battery", value: "72 Wh, 65 W USB-C charging" },
      { label: "Weight", value: "1.24 kg" },
    ],
    rating: 4.6,
    reviewCount: 218,
    stock: 12,
    badge: "Save ₹15,750",
  },
  {
    slug: "nordvane-raider-16",
    name: "Nordvane Raider 16",
    brand: "Nordvane",
    category: "laptops",
    price: 19414500,
    image: pLaptopGaming,
    tagline: "A 16-inch gaming laptop with the cooling to hold its clocks.",
    description:
      "The Raider 16 pairs a desktop-class mobile GPU with a vapour chamber that spans both the processor and the graphics die. Sustained load is where it separates itself: after twenty minutes of rendering it is still within a few percent of its opening frame rate, and the per-key backlight stays legible in a dark room.",
    highlights: [
      "Vapour chamber cooling across CPU and GPU",
      "240 Hz 16-inch panel with a 3 ms response",
      "Per-key RGB backlighting with n-key rollover",
      "Upgradeable memory and dual M.2 slots",
    ],
    specs: [
      { label: "Display", value: "16in 2560 x 1600 IPS, 240 Hz" },
      { label: "Processor", value: "16-core mobile CPU, 5.4 GHz boost" },
      { label: "Graphics", value: "16 GB discrete mobile GPU, 150 W" },
      { label: "Memory", value: "32 GB DDR5-5600 (2 slots, upgradeable)" },
      { label: "Storage", value: "1 TB PCIe 4.0 NVMe, second slot free" },
      { label: "Weight", value: "2.4 kg" },
    ],
    rating: 4.7,
    reviewCount: 164,
    stock: 6,
    badge: "Best for gaming",
  },
  {
    slug: "kestrel-nova-9",
    name: "Kestrel Nova 9",
    brand: "Kestrel",
    category: "mobile",
    price: 7864500,
    wasPrice: 8389500,
    image: pPhoneAndroid,
    tagline: "A flagship handset in emerald, with a camera that earns its keep.",
    description:
      "The Nova 9 puts its budget where it shows: a 6.7-inch LTPO panel that drops to 1 Hz when idle, a main sensor large enough to keep noise down after dark, and a 5000 mAh battery that comfortably clears a day. The emerald finish is a frosted glass that resists fingerprints better than the gloss it replaces.",
    highlights: [
      "6.7in LTPO display, 1-120 Hz adaptive refresh",
      "50 MP main sensor with optical stabilisation",
      "5000 mAh battery, 68 W wired charging",
      "Seven years of security updates",
    ],
    specs: [
      { label: "Display", value: "6.7in 2412 x 1080 LTPO AMOLED" },
      { label: "Rear cameras", value: "50 MP main, 12 MP ultrawide, 10 MP 3x tele" },
      { label: "Front camera", value: "32 MP" },
      { label: "Battery", value: "5000 mAh, 68 W wired / 15 W wireless" },
      { label: "Storage", value: "256 GB UFS 4.0" },
      { label: "Water resistance", value: "IP68" },
    ],
    rating: 4.5,
    reviewCount: 392,
    stock: 24,
  },
  {
    slug: "kestrel-slate-11",
    name: "Kestrel Slate 11",
    brand: "Kestrel",
    category: "mobile",
    price: 4504500,
    image: pTablet,
    tagline: "An 11-inch tablet that is genuinely usable as a second screen.",
    description:
      "The Slate 11 is aimed squarely at reading, sketching and light desk work. The laminated display removes the air gap that makes cheaper tablets feel hollow under a stylus, and the aluminium back spreads heat well enough that it never gets uncomfortable to hold during video calls.",
    highlights: [
      "Laminated 11in display, 500 nits sustained",
      "Stylus support with 4096 pressure levels",
      "Quad speakers tuned for landscape viewing",
      "Charges over USB-C at 30 W",
    ],
    specs: [
      { label: "Display", value: "11in 2560 x 1600 IPS, 120 Hz" },
      { label: "Processor", value: "8-core, 3.2 GHz" },
      { label: "Memory", value: "8 GB LPDDR5" },
      { label: "Storage", value: "128 GB, microSD expandable" },
      { label: "Battery", value: "8000 mAh" },
      { label: "Weight", value: "480 g" },
    ],
    rating: 4.3,
    reviewCount: 147,
    stock: 18,
  },
  {
    slug: "aurex-quietude-900",
    name: "Aurex Quietude 900",
    brand: "Aurex",
    category: "audio",
    price: 3454500,
    wasPrice: 3979500,
    image: pHeadphones,
    tagline: "Over-ear noise cancelling built for eight-hour days.",
    description:
      "The Quietude 900 targets the low rumble that makes offices and aircraft tiring rather than simply loud. Clamping force is deliberately light and the memory foam pads are wrapped in a protein leather that stays cool, so the pair is still comfortable at the end of a long stretch. Thirty hours of playback with cancellation on.",
    highlights: [
      "Hybrid noise cancellation with eight microphones",
      "30 hours of playback with ANC enabled",
      "Multipoint pairing across two devices",
      "Folds flat, 3.5 mm cable included for wired use",
    ],
    specs: [
      { label: "Drivers", value: "40 mm dynamic" },
      { label: "Battery", value: "30 h ANC on, 45 h ANC off" },
      { label: "Charging", value: "USB-C, 5 min for 3 h playback" },
      { label: "Bluetooth", value: "5.3, LDAC and aptX Adaptive" },
      { label: "Weight", value: "253 g" },
    ],
    rating: 4.8,
    reviewCount: 511,
    stock: 31,
    badge: "Save ₹5,250",
  },
  {
    slug: "meridian-vista-27",
    name: "Meridian Vista 27",
    brand: "Meridian",
    category: "displays",
    price: 5764500,
    image: pMonitor,
    tagline: "A colour-accurate 4K panel that also handles 144 Hz.",
    description:
      "Most 4K monitors ask you to choose between colour work and frame rate. The Vista 27 covers 98% of DCI-P3 and ships with a per-unit calibration report, then still runs at 144 Hz over DisplayPort 2.1. The stand adjusts through height, tilt, swivel and pivot, and the built-in hub saves a cable or three.",
    highlights: [
      "98% DCI-P3 with a factory calibration report",
      "144 Hz over DisplayPort 2.1, 120 Hz over HDMI 2.1",
      "90 W USB-C power delivery to a connected laptop",
      "Full height, tilt, swivel and pivot adjustment",
    ],
    specs: [
      { label: "Panel", value: "27in 3840 x 2160 IPS Black" },
      { label: "Refresh rate", value: "144 Hz, 1 ms GtG" },
      { label: "Colour", value: "98% DCI-P3, 10-bit" },
      { label: "Ports", value: "DP 2.1, 2x HDMI 2.1, USB-C 90 W, 3x USB-A" },
      { label: "Stand", value: "Height, tilt, swivel, pivot" },
    ],
    rating: 4.6,
    reviewCount: 203,
    stock: 9,
  },
  {
    slug: "meridian-tactile-75",
    name: "Meridian Tactile 75",
    brand: "Meridian",
    category: "displays",
    price: 1459500,
    image: pKeyboard,
    tagline: "A 75% mechanical board with gasket mounting and hot-swap sockets.",
    description:
      "The Tactile 75 is the board to buy if you want to stop buying boards. The gasket mount and layered foam take the hollowness out of each press, the sockets are hot-swappable so you can change switches without a soldering iron, and the aluminium case gives it enough mass to stay where you put it.",
    highlights: [
      "Gasket-mounted plate with three layers of damping",
      "Hot-swap sockets for 3- and 5-pin switches",
      "Tri-mode: USB-C, Bluetooth and 2.4 GHz",
      "PBT double-shot keycaps that resist shine",
    ],
    specs: [
      { label: "Layout", value: "75%, UK ISO" },
      { label: "Switches", value: "Tactile, 55 g actuation, hot-swappable" },
      { label: "Case", value: "CNC aluminium, gasket mount" },
      { label: "Connection", value: "USB-C, Bluetooth 5.1, 2.4 GHz dongle" },
      { label: "Battery", value: "4000 mAh" },
    ],
    rating: 4.7,
    reviewCount: 288,
    stock: 27,
  },
  {
    slug: "meridian-glide-pro",
    name: "Meridian Glide Pro",
    brand: "Meridian",
    category: "displays",
    price: 829500,
    image: pMouse,
    tagline: "A lightweight wireless mouse with a sensor that never guesses.",
    description:
      "At 63 g the Glide Pro is light enough for fast play without the honeycomb shell that makes lighter mice feel fragile. The 26K sensor tracks cleanly on every surface we tried including bare desk, and the battery goes about three weeks between charges at everyday settings.",
    highlights: [
      "63 g with a solid, non-perforated shell",
      "26,000 DPI sensor with no smoothing or acceleration",
      "Optical switches rated to 100 million clicks",
      "Around 90 hours of use per charge",
    ],
    specs: [
      { label: "Weight", value: "63 g" },
      { label: "Sensor", value: "26,000 DPI optical" },
      { label: "Polling rate", value: "1000 Hz wireless, 8000 Hz wired" },
      { label: "Switches", value: "Optical, 100M clicks" },
      { label: "Battery", value: "Up to 90 h" },
    ],
    rating: 4.4,
    reviewCount: 176,
    stock: 45,
  },
  {
    slug: "corvus-rx-9070",
    name: "Corvus RX-9070 XT",
    brand: "Corvus",
    category: "components",
    price: 7234500,
    wasPrice: 7864500,
    image: pGpu,
    tagline: "16 GB of graphics memory aimed squarely at 1440p ultra.",
    description:
      "The RX-9070 XT is the card for people running a high-refresh 1440p panel who do not want to think about settings. The triple-fan cooler idles passively below 50C, and the 16 GB frame buffer leaves headroom for texture packs and local model work alike. Two 8-pin connectors, no proprietary adapter.",
    highlights: [
      "16 GB GDDR6 on a 256-bit bus",
      "Triple-fan cooler with a passive idle mode",
      "Standard 2x 8-pin power, no adapter required",
      "2.5 slots wide, 304 mm long",
    ],
    specs: [
      { label: "Memory", value: "16 GB GDDR6, 256-bit" },
      { label: "Boost clock", value: "2.97 GHz" },
      { label: "Power draw", value: "304 W typical" },
      { label: "Power connectors", value: "2x 8-pin PCIe" },
      { label: "Outputs", value: "3x DisplayPort 2.1, 1x HDMI 2.1" },
      { label: "Dimensions", value: "304 x 130 x 50 mm" },
    ],
    rating: 4.5,
    reviewCount: 231,
    stock: 7,
    badge: "Save ₹6,300",
  },
  {
    slug: "corvus-apex-9",
    name: "Corvus Apex 9 7950",
    brand: "Corvus",
    category: "components",
    price: 5554500,
    image: pCpu,
    tagline: "Sixteen cores for people who compile, render or both.",
    description:
      "The Apex 9 is a workstation processor at an enthusiast price. Sixteen cores and thirty-two threads make short work of parallel builds and video exports, while the single-core boost is high enough that it does not feel slow in ordinary desktop use. It runs on the existing socket, so a BIOS update is usually the only prerequisite.",
    highlights: [
      "16 cores and 32 threads",
      "5.7 GHz maximum boost clock",
      "80 MB of combined cache",
      "Drops into the existing socket with a BIOS update",
    ],
    specs: [
      { label: "Cores / threads", value: "16 / 32" },
      { label: "Base / boost", value: "4.2 GHz / 5.7 GHz" },
      { label: "Cache", value: "80 MB combined" },
      { label: "TDP", value: "170 W" },
      { label: "Memory support", value: "DDR5-5600 dual channel" },
      { label: "Cooler", value: "Not included" },
    ],
    rating: 4.7,
    reviewCount: 189,
    stock: 14,
  },
  {
    slug: "helix-torrent-2tb",
    name: "Helix Torrent 2 TB NVMe",
    brand: "Helix",
    category: "components",
    price: 1774500,
    image: pSsd,
    tagline: "PCIe 4.0 storage that holds its speed when the cache runs out.",
    description:
      "Plenty of drives post a big sequential number and then collapse once the SLC cache is exhausted. The Torrent uses a DRAM cache and holds roughly 1.6 GB/s of sustained write well past the 200 GB mark, which is the difference between a fast drive and one that only benchmarks well. Five-year warranty.",
    highlights: [
      "7400 MB/s sequential read, 6900 MB/s write",
      "DRAM cache keeps sustained writes high",
      "1200 TBW endurance, five-year warranty",
      "Graphene heatspreader, fits laptops and consoles",
    ],
    specs: [
      { label: "Capacity", value: "2 TB" },
      { label: "Interface", value: "PCIe 4.0 x4, NVMe 2.0" },
      { label: "Sequential read", value: "7400 MB/s" },
      { label: "Sequential write", value: "6900 MB/s" },
      { label: "Endurance", value: "1200 TBW" },
      { label: "Form factor", value: "M.2 2280, single sided" },
    ],
    rating: 4.6,
    reviewCount: 264,
    stock: 38,
  },
  {
    slug: "beacon-mesh-ax6600",
    name: "Beacon Mesh AX6600",
    brand: "Beacon",
    category: "connected",
    price: 2614500,
    image: pRouter,
    tagline: "Tri-band mesh with a dedicated backhaul that keeps its speed.",
    description:
      "A two-pack that covers roughly 400 square metres. The third band is reserved for traffic between the units rather than shared with your devices, which is why the far node does not halve your throughput the way cheaper mesh kits do. Setup runs from the app and takes about ten minutes.",
    highlights: [
      "Tri-band with a dedicated 5 GHz backhaul",
      "Covers around 400 m² as a two-pack",
      "2.5 Gb WAN port for full-fibre connections",
      "Guest network and per-device scheduling",
    ],
    specs: [
      { label: "Standard", value: "Wi-Fi 6 (802.11ax), AX6600" },
      { label: "Bands", value: "Tri-band, dedicated backhaul" },
      { label: "Coverage", value: "~400 m² (2 units)" },
      { label: "Ports", value: "1x 2.5 Gb WAN, 3x 1 Gb LAN per unit" },
      { label: "In the box", value: "2 units, 2 PSUs, 1 Ethernet cable" },
    ],
    rating: 4.4,
    reviewCount: 158,
    stock: 16,
  },
  {
    slug: "beacon-hub-mini",
    name: "Beacon Hub Mini",
    brand: "Beacon",
    category: "connected",
    price: 1249500,
    image: pSmarthome,
    tagline: "A smart speaker and sensor pair that runs locally.",
    description:
      "The Hub Mini handles routines on the device rather than in someone else's data centre, so lights and heating still respond when the internet drops. The fabric-wrapped speaker is a genuine step above the usual voice-assistant tinniness, and the included contact sensor pairs in a single press.",
    highlights: [
      "Automations run locally, no cloud round trip",
      "Works with Matter and Thread out of the box",
      "Fabric-wrapped 45 mm driver with a passive radiator",
      "Contact and temperature sensor included",
    ],
    specs: [
      { label: "Protocols", value: "Matter, Thread, Zigbee 3.0, Wi-Fi" },
      { label: "Speaker", value: "45 mm driver, passive radiator" },
      { label: "Microphones", value: "4, with a hardware mute switch" },
      { label: "Included sensor", value: "Contact and temperature" },
      { label: "Power", value: "USB-C, 15 W" },
    ],
    rating: 4.2,
    reviewCount: 96,
    stock: 22,
  },
  {
    slug: "volta-gan-100w",
    name: "Volta GaN 100 W Charger",
    brand: "Volta",
    category: "connected",
    price: 619500,
    image: pCharger,
    tagline: "One brick, four ports, enough power for a laptop and a phone at once.",
    description:
      "Gallium nitride internals let this charger deliver 100 W from something roughly the size of a deck of cards. The first USB-C port takes the full 100 W on its own; plug in a second device and it splits sensibly rather than dropping everything to a trickle. Folding pins and a UK plug.",
    highlights: [
      "100 W from a single USB-C port",
      "Four ports: 2x USB-C, 2x USB-A",
      "GaN internals, folding UK pins",
      "Two-year warranty",
    ],
    specs: [
      { label: "Total output", value: "100 W" },
      { label: "Ports", value: "2x USB-C (100 W / 30 W), 2x USB-A (18 W)" },
      { label: "Protocols", value: "USB PD 3.1, PPS, QC 4+" },
      { label: "Size", value: "68 x 62 x 32 mm" },
      { label: "Plug", value: "UK, folding pins" },
    ],
    rating: 4.5,
    reviewCount: 342,
    stock: 60,
  },
];

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
});

/** Formats a price held in paise, e.g. 7864500 -> "₹78,645.00". */
export function formatPrice(paise: number): string {
  return inr.format(paise / 100);
}

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getCategory(id: CategoryId): Category | undefined {
  return categories.find((c) => c.id === id);
}

export function productsInCategory(id: CategoryId): Product[] {
  return products.filter((p) => p.category === id);
}

/** Products sharing a category, excluding the one being viewed. */
export function relatedProducts(product: Product, limit = 4): Product[] {
  const sameCategory = products.filter(
    (p) => p.category === product.category && p.slug !== product.slug,
  );
  if (sameCategory.length >= limit) return sameCategory.slice(0, limit);

  const filler = products.filter((p) => p.category !== product.category && p.slug !== product.slug);
  return [...sameCategory, ...filler].slice(0, limit);
}

export function discountPercent(product: Product): number | null {
  if (product.wasPrice === undefined || product.wasPrice <= product.price) return null;
  return Math.round(((product.wasPrice - product.price) / product.wasPrice) * 100);
}
