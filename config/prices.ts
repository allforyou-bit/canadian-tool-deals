// Price book: the single source of truth for the quote calculator, the price sheet,
// the door hanger and /admin/prices. Every default is either inside a published market
// range (status "snippet": seen in a 2025–2026 search-result summary, page not opened) or
// an explicit owner choice (status "owner-choice": no market data was found).
// Re-check 5–10 live competitor prices in your own area before printing anything.

export type CityKey = 'gta' | 'ottawa' | 'calgary' | 'vancouver' | 'montreal'

export type SourceStatus = 'snippet' | 'owner-choice' | 'not-found'

export interface Source {
  label: string
  url?: string
  status: SourceStatus
  note: string
}

export type Bedrooms = 1 | 2 | 3 | 4 | 5

export interface CleaningTier {
  bedrooms: Bedrooms
  /** bathrooms included in the flat price */
  includedBaths: number
  standard: number
  deep: number
  moveOut: number
}

export interface AddOn {
  id: string
  en: string
  ko: string
  price: number
}

export interface CleaningBook {
  tiers: CleaningTier[]
  extraBathroom: number
  addOns: AddOn[]
  /** % added for jobs within 24 h, weekends or statutory holidays */
  rushPremiumPct: number
  sources: Source[]
}

export interface GutterBook {
  byStoreys: Record<1 | 2 | 3, number>
  downspoutFlush: number
  sources: Source[]
}

export type DrivewaySize = 'single' | 'double' | 'large'

export interface SnowBook {
  /** 'season' = one seasonal price split into instalments; 'monthly' = per-month price */
  mode: 'season' | 'monthly'
  /** season price (mode 'season') or monthly price (mode 'monthly') per driveway size */
  driveway: Record<DrivewaySize, number>
  walkwayAndSteps: number
  salting: number
  /** per-visit rate for storms before the contract season starts (November) */
  perVisit: number
  /** number of monthly instalments / billed months (Dec 1 – Mar 1) */
  instalments: number
  sources: Source[]
}

export interface PriceBook {
  city: CityKey
  currency: 'CAD'
  cleaning: CleaningBook
  gutters: GutterBook | null
  snow: SnowBook | null
  /** high end of every estimate = low end × (1 + rangeUpliftPct/100): condition is confirmed on site */
  rangeUpliftPct: number
  cityNotes: Source[]
}

// ---------------------------------------------------------------------------
// Shared sources
// ---------------------------------------------------------------------------

const CLEANING_SOURCES_GTA: Source[] = [
  {
    label: 'Toronto flat-rate guide (condo/small apt $165–250; deep or larger $250–400+)',
    url: 'https://www.itsglocleaning.com/post/how-much-does-a-home-cleaning-service-cost-in-toronto',
    status: 'snippet',
    note: 'Search-result summary, 2025 article. Standard and deep defaults sit inside or just below this band.',
  },
  {
    label: 'Toronto apartment cleaning $100–250',
    url: 'https://nowitsclean.ca/blog/apartment-cleaning-cost/',
    status: 'snippet',
    note: 'Search-result summary.',
  },
  {
    label: 'Toronto 3-bedroom home about $150–300',
    url: 'https://www.cqdnewgen.ai/blog/how-much-does-a-house-cleaner-cost-in-toronto-in-2026-real-c',
    status: 'snippet',
    note: 'Search-result summary, 2026.',
  },
  {
    label: 'Move-out "From $185 Fixed"',
    url: 'https://anyclean.ca/move-out-cleaning-toronto/',
    status: 'snippet',
    note: 'Page title seen in search results.',
  },
  {
    label: 'Move-out $325 (1BR) – $559 (5BR) + HST at one Toronto service',
    url: 'https://mastermaid.ca/prices/',
    status: 'snippet',
    note: 'Attribution to this page unconfirmed. Move-out defaults are set about 15–20% below it for a new entrant.',
  },
  {
    label: 'Rush / weekend / holiday premium 10–20%',
    url: 'https://tidyuphandycrew.ca/2026/02/23/what-affects-move-out-cleaning-cost-in-toronto/',
    status: 'snippet',
    note: 'Default premium 15% is the middle of this band.',
  },
  {
    label: 'Extra-bathroom charge and add-on prices (oven, fridge, cabinets)',
    status: 'owner-choice',
    note: 'No market figure was found. These are owner-set prices; change them freely.',
  },
]

const GUTTER_SOURCES_GTA: Source[] = [
  {
    label: 'Toronto standard gutter cleaning $150–350',
    url: 'https://professionalroofers.com/blogs/gutter-cleaning-cost-in-toronto-2025/',
    status: 'snippet',
    note: '2026 price per page title.',
  },
  {
    label: 'GTA bungalow $150–225, 2-storey $200–275 (another guide $250–400)',
    url: 'https://ntpropertycare.com/eavestrough-gutter-cleaning-cost-in-toronto/',
    status: 'snippet',
    note: 'Summary combined several GTA guides; page attribution not exact.',
  },
  {
    label: '3-storey $275–375; downspout unclogging $70+ (Calgary guide, used as GTA fallback)',
    url: 'https://guttercleaningcalgary.ca/cost-gutter-cleaning-calgary/',
    status: 'snippet',
    note: 'No GTA 3-storey figure was found.',
  },
]

const SNOW_SOURCES_GTA: Source[] = [
  {
    label: 'Toronto: "most homeowners pay $500–1,500 per season"',
    url: 'https://silverlightwindowsandeaves.ca/how-much-does-snow-removal-cost-in-toronto/',
    status: 'snippet',
    note: 'Other GTA guides give $200–600, $400–950 and $570–1,730. Defaults sit at the low end of the "most" band.',
  },
  {
    label: 'GTA per visit $50–150; walkways, steps and salting "almost universally" add-ons',
    url: 'https://www.monsterplow.ca/post/how-much-snow-removal-cost-toronto-2026-pricing-guide',
    status: 'snippet',
    note: 'Per-visit default $60. Add-on prices were not found, so walkway and salting prices are owner choices.',
  },
]

// ---------------------------------------------------------------------------
// City price books
// ---------------------------------------------------------------------------

const GTA_CLEANING: CleaningBook = {
  tiers: [
    { bedrooms: 1, includedBaths: 1, standard: 150, deep: 230, moveOut: 260 },
    { bedrooms: 2, includedBaths: 1, standard: 180, deep: 270, moveOut: 300 },
    { bedrooms: 3, includedBaths: 2, standard: 220, deep: 320, moveOut: 360 },
    { bedrooms: 4, includedBaths: 2, standard: 260, deep: 370, moveOut: 420 },
    { bedrooms: 5, includedBaths: 3, standard: 300, deep: 420, moveOut: 470 },
  ],
  extraBathroom: 30,
  addOns: [
    { id: 'oven', en: 'Inside oven', ko: '오븐 내부', price: 40 },
    { id: 'fridge', en: 'Inside fridge', ko: '냉장고 내부', price: 35 },
    { id: 'cabinets', en: 'Inside empty cabinets', ko: '빈 수납장 내부', price: 40 },
  ],
  rushPremiumPct: 15,
  sources: CLEANING_SOURCES_GTA,
}

const NOT_FOUND_CLEANING = (city: string): Source => ({
  label: `${city} cleaning prices`,
  status: 'not-found',
  note: `No ${city} cleaning price was found in research. GTA defaults are used; check local competitors before quoting.`,
})

export const PRICE_BOOKS: Record<CityKey, PriceBook> = {
  gta: {
    city: 'gta',
    currency: 'CAD',
    cleaning: GTA_CLEANING,
    gutters: {
      byStoreys: { 1: 175, 2: 225, 3: 300 },
      downspoutFlush: 70,
      sources: GUTTER_SOURCES_GTA,
    },
    snow: {
      mode: 'season',
      driveway: { single: 500, double: 650, large: 800 },
      walkwayAndSteps: 100,
      salting: 100,
      perVisit: 60,
      instalments: 4,
      sources: SNOW_SOURCES_GTA,
    },
    rangeUpliftPct: 15,
    cityNotes: [
      {
        label: 'Toronto: pressure washing appears to need a Building Renovator licence (exam)',
        url: 'https://www.toronto.ca/services-payments/permits-licences-bylaws/building-renovators/',
        status: 'snippet',
        note: 'Pressure washing is not offered.',
      },
    ],
  },
  ottawa: {
    city: 'ottawa',
    currency: 'CAD',
    cleaning: { ...GTA_CLEANING, sources: [NOT_FOUND_CLEANING('Ottawa'), ...CLEANING_SOURCES_GTA] },
    gutters: {
      byStoreys: { 1: 175, 2: 225, 3: 300 },
      downspoutFlush: 70,
      sources: [
        { label: 'Ottawa gutter prices', status: 'not-found', note: 'GTA defaults used. Check locally.' },
        ...GUTTER_SOURCES_GTA,
      ],
    },
    snow: {
      mode: 'season',
      driveway: { single: 450, double: 575, large: 700 },
      walkwayAndSteps: 100,
      salting: 100,
      perVisit: 60,
      instalments: 4,
      sources: [
        {
          label: 'Ottawa: "most homeowners pay $400–700 per season"; $40–100 per visit',
          url: 'https://blizzardpro.ca/guides/ottawa-snow-removal-costs',
          status: 'snippet',
          note: 'Another Ottawa guide gives $400–900 per season.',
        },
        {
          label: 'Ottawa snow plow contractor licence ($2M insurance) for vehicle plows',
          url: 'https://www.ottawa.ca/en/business/permits-and-licences/business-licences/snow-plow-contractor-and-vehicle-licences',
          status: 'snippet',
          note: 'Whether manual snowblower/shovel work is exempt is UNRESOLVED. Confirm with the City before selling snow.',
        },
      ],
    },
    rangeUpliftPct: 15,
    cityNotes: [],
  },
  calgary: {
    city: 'calgary',
    currency: 'CAD',
    cleaning: { ...GTA_CLEANING, sources: [NOT_FOUND_CLEANING('Calgary'), ...CLEANING_SOURCES_GTA] },
    gutters: {
      byStoreys: { 1: 175, 2: 240, 3: 300 },
      downspoutFlush: 70,
      sources: [
        {
          label: 'Calgary bungalow $150–225, 2-storey $225–275, 3-storey $275–375; downspout $70+',
          url: 'https://guttercleaningcalgary.ca/cost-gutter-cleaning-calgary/',
          status: 'snippet',
          note: 'A low-price competitor advertises "Starting At $75" (cleaninginaction.ca).',
        },
      ],
    },
    snow: {
      mode: 'monthly',
      driveway: { single: 150, double: 190, large: 240 },
      walkwayAndSteps: 25,
      salting: 25,
      perVisit: 60,
      instalments: 4,
      sources: [
        {
          label: 'Calgary seasonal contract: single driveway $150–200/month, double $190–260/month',
          url: 'https://threenorthclean.com/blog/snow-removal-cost-calgary/',
          status: 'snippet',
          note: 'Other guides: $130–300/month; "unlimited from $129 a month" (bluefrogservices.ca). Large-driveway and add-on prices are owner choices.',
        },
        {
          label: 'Calgary sidewalk rule (24 h) and fines $250/$500/$750',
          url: 'https://www.calgary.ca/bylaws/snow-ice.html',
          status: 'snippet',
          note: 'Never push snow onto the road or sidewalk.',
        },
      ],
    },
    rangeUpliftPct: 15,
    cityNotes: [],
  },
  vancouver: {
    city: 'vancouver',
    currency: 'CAD',
    cleaning: { ...GTA_CLEANING, sources: [NOT_FOUND_CLEANING('Metro Vancouver'), ...CLEANING_SOURCES_GTA] },
    gutters: {
      byStoreys: { 1: 150, 2: 200, 3: 275 },
      downspoutFlush: 70,
      sources: [
        {
          label: 'Gutter Cleaning Cost Vancouver (2026): $100–300',
          url: 'https://shinecitypressurewashing.ca/blogs/gutter-cleaning-cost-vancouver/',
          status: 'snippet',
          note: 'Page title. Some figures in the same results may be for Vancouver, WA.',
        },
      ],
    },
    // Snow is not offered: Metro Vancouver has "at least a centimetre of snow on the ground for about nine days a year"
    // (currentresults.com, search summary).
    snow: null,
    rangeUpliftPct: 15,
    cityNotes: [
      {
        label: 'City of Vancouver business licence ($77 application + $277–376/yr) or $300 inter-municipal licence',
        url: 'https://www.vancubers.com/start-a-business-in-canada/vancouver-business-licence-2026-fees-address/',
        status: 'snippet',
        note: 'Third-party 2026 summary. Check with the city before the first job.',
      },
      {
        label: 'BC short-term-rental rules cut entire-home listings 22%',
        url: 'https://www.nationalobserver.com/2025/04/24/news/year-after-bcs-short-term-rental-crackdown-has-it-made-housing-cheaper',
        status: 'snippet',
        note: 'Short-term-rental turnover cleaning is not targeted in BC.',
      },
    ],
  },
  montreal: {
    city: 'montreal',
    currency: 'CAD',
    cleaning: { ...GTA_CLEANING, sources: [NOT_FOUND_CLEANING('Montreal'), ...CLEANING_SOURCES_GTA] },
    gutters: null,
    snow: null,
    rangeUpliftPct: 15,
    cityNotes: [
      {
        label: 'Montreal is not supported by this site yet',
        status: 'not-found',
        note: 'French is likely required for consumer services (unverified), no Montreal prices were found, and Quebec consumer (OPC) and privacy rules differ. Do not launch there with this version.',
      },
    ],
  },
}
