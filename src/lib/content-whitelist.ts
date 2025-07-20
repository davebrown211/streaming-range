// YouTube Golf Creator Whitelist
// Only content from these creators should be promoted to main sections

export const WHITELISTED_GOLF_CREATORS = [
  // Top YouTube Golf Content Creators
  "good good",
  "bob does sports",
  "grant horvat",
  "bryan bros",
  "foreplay",
  "dude perfect",
  "gm golf",
  "micah morris golf",
  "garrett clark",
  "tig",
  "fat perez",
  "the jet",
  "cold cuts",
  "bubbie",
  "steve",
  "matt",
  "micah",
  "brad dalke",
  "lanto griffin",
  "erik anders lang",
  "the golfers journal",
  "no laying up",
  "fore the people",

  // Golf Instruction/Educational Creators
  "rick shiels",
  "peter finch",
  "mark crossfield",
  "me and my golf",
  "athletic motion golf",
  "dan whittaker golf",
  "golf monthly",
  "golf.com",
  "dan hendriksen",
  "chris ryan golf",
  "scratch golf academy",
  "golf sidekick",
  "james robinson golf",
  "golf distillery",
  "danny maude",
  "alex elliott golf",
  "golf swing simplified",
  "top speed golf",
  "golf tips magazine",
  "rotary swing",
  "eric cogorno",
  "eric cogorno golf",
  "cogorno golf",
  "matt fryer golf",
  "matt fryer",
  "alex etches golf",
  "alex etches",
  "golf channel",
  "the scratch golf show",
  "scratch golf show",

  // Golf Equipment/Review Creators
  "golf wrx",
  "test golf",
  "golf equipment guru",
  "golf gurus",
  "clay ballard",
  "txg",
  "golf monthly gear",
  "2nd swing golf",
  "fairway jockey",
  "golf monthly reviews",

  // Golf Entertainment/Variety
  "fore fore",
  "golf boys",
  "golf life",
  "scramble podcast",
  "barstool golf",
  "golf unfiltered",
  "bad golf",
  "golf beast",
  "golf it",
  "golf gods",
  "golf time",
  "ron chopper golf",
  "ron chopper",

  // Rising Golf Creators
  "luke kwon golf",
  "luke kwon",
  "the lads",
  "phil mickelson",
  "hyflyers",
  "micah morris",
  "tommy fleetwood",
  "sean walsh",
  "jake hutt golf",
  "jake hutt",
  "mytpi",
  "titleist",
  "taylormade",
  "taylor made",
  "garrett hilbert",
  "tyler toney",
  "brad dalke golf",
  "stephen castaneda golf",
  "ben polland golf",
  "garrett johnston golf",
  "amateur golf",
  "golf with aimee",
  "golf with aim",
  "golf with friends",
  "golf adventures",
  "coffee and golf",
  "golf diary",
  "golf tales",
  "big wedge golf",
  "big wedge",
  "padraig harrington",
  "mrshortgame golf",
  "mrshortgame",
  "mr short game",
  "jna golf",
  "jna",
  "bryan bros tv",
  "josh mayer",
  "golf girl games",
  "girl golf games",
  "golf life",
];

// Channel IDs for exact matching (validated + found via YouTube API)
export const WHITELISTED_CHANNEL_IDS = [
  // ✅ VALIDATED CHANNELS IN DATABASE (13 channels, 127 total videos, 39 recent videos)
  "UCfi-mPMOmche6WI-jkvnGXw", // Good Good (main) - 25 videos, 6 recent
  "UCbY_v56iMzSGvXK79X6f4dw", // Good Good Extra - 10 videos, 1 recent
  "UCqr4sONkmFEOPc3rfoVLEvg", // Bob Does Sports - 2 videos, 2 recent
  "UCgUueMmSpcl-aCTt5CuCKQw", // Grant Horvat Golf - 26 videos, 5 recent
  "UCJcc1x6emfrQquiV8Oe_pug", // Luke Kwon Golf - 1 video, 1 recent
  "UCsazhBmAVDUL_WYcARQEFQA", // The Lads - 3 videos, 3 recent
  "UC3jFoA7_6BTV90hsRSVHoaw", // Phil Mickelson and the HyFlyers - 10 videos, 2 recent
  "UCfdYeBYjouhibG64ep_m4Vw", // Micah Morris - 13 videos, 1 recent
  "UCjchle1bmH0acutqK15_XSA", // Brad Dalke - 10 videos, 4 recent
  "UCdCxaD8rWfAj12rloIYS6jQ", // Bryan Bros Golf - 10 videos, 3 recent
  "UCB0NRdlQ6fBYQX8W8bQyoDA", // MyTPI - 0 videos, 0 recent
  "UCyy8ULLDGSm16_EkXdIt4Gw", // Titleist - 4 videos, 4 recent
  "UClJO9jvaU5mvNuP-XTbhHGw", // TaylorMade Golf - 13 videos, 7 recent
  
  // 🆕 FOUND VIA YOUTUBE API (popular golf creators, may need data collection)
  "UCFHZHhZaH7Rc_FOMIzUziJA", // Rick Shiels Golf - 3.0M subs
  "UCFoez1Xjc90CsHvCzqKnLcw", // Peter Finch Golf - 747K subs
  "UCCxF55adGXOscJ3L8qdKnrQ", // Bryson DeChambeau - 2.1M subs
  "UCZelGnfKLXic4gDP63dIRxw", // Mark Crossfield - 486K subs
  "UCaeGjmOiTxekbGUDPKhoU-A", // Golf Sidekick - 360K subs
  "UCtNpbO2MtsVY4qW23WfnxGg", // James Robinson Golf - 281K subs
  "UCUOqlmPAo8h4pVQ4cuRECUg", // Big Wedge Golf - 675K subs
  "UClljAz6ZKy0XeViKsohdjqA", // GM Golf (gm__golf) - 1.4M subs
  "UCSwdmDQhAi_-ICkAvNBLEBw", // Danny Maude - 1.5M subs
  "UCJolpQHWLAW6cCUYGgean8w", // Padraig Harrington - 192K subs
  "UCuXIBwKQeH9cnLOv7w66cJg", // MrShortGame Golf - 499K subs
  "UCXvDkP2X3aE9yrPavNMJv0A", // JnA Golf - 140K subs
  "UCamOYT0c_pSrSCu9c8CyEcg", // Bryan Bros TV - 87K subs
  "UCrgGz4gZxWu77Nw5RXcxlRg", // Josh Mayer - 220K subs
  "UCCry5X3Phfmz0UzqRNm0BPA", // Golf Girl Games - 238K subs
  "UCwMgdK0S57nEdN_RGaajwOQ", // GOLF LIFE - 349K subs
];

// Function to check if a channel is whitelisted
export function isWhitelistedCreator(
  channelTitle: string,
  channelId?: string
): boolean {
  // Check by channel ID first (most reliable)
  if (channelId && WHITELISTED_CHANNEL_IDS.includes(channelId)) {
    return true;
  }

  // Check by channel name (case insensitive, partial match)
  const channelTitleLower = channelTitle.toLowerCase();
  return WHITELISTED_GOLF_CREATORS.some((creator) =>
    channelTitleLower.includes(creator.toLowerCase())
  );
}

// Professional tournament patterns to exclude
export const EXCLUDED_TOURNAMENT_PATTERNS = [
  /round \d+/i,
  /r\d+/i,
  /mpo \|/i,
  /fpo \|/i,
  /klpga/i,
  /kpga/i,
  /lpga tour/i,
  /pga tour/i,
  /dp world tour/i,
  /european tour/i,
  /asian tour/i,
  /kornferry/i,
  /fedex cup/i,
  /\d{4} open/i,
  /championship \d{4}/i,
  /tournament highlights/i,
  /final round/i,
  /course maintenance/i,
  /golf course setup/i,
  /superintendentlife/i,
];

// Function to check if content should be excluded (tournaments, maintenance, etc.)
export function isExcludedContent(title: string, description: string): boolean {
  const content = `${title} ${description}`.toLowerCase();

  return EXCLUDED_TOURNAMENT_PATTERNS.some((pattern) => pattern.test(content));
}
