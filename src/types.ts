export type Sentiment = "Bullish" | "Bearish" | "Neutral";

export type Urgency = "Critical" | "High" | "Medium" | "Low";

export type SourceType =
  | "Regulator"
  | "Exchange"
  | "Newswire"
  | "Company Filing"
  | "Brokerage"
  | "Tier-1 Media"
  | "Trade Publication"
  | "Government"
  | "Industry Body"
  | "Social";

export type TimeHorizon =
  | "Immediate"
  | "Short-term"
  | "Medium-term"
  | "Long-term";

export type Theme =
  | "Policy"
  | "Regulation"
  | "Earnings"
  | "Demand"
  | "Pricing"
  | "Raw Materials"
  | "Capex"
  | "Exports"
  | "Imports"
  | "Order Wins"
  | "M&A"
  | "Supply Chain"
  | "Litigation"
  | "Global Macro";

export interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  sector: string; // sector id
  subsector: string;
  theme: Theme;
  sentiment: Sentiment;
  impactScore: number; // 0-10
  urgency: Urgency;
  source: string;
  sourceType: SourceType;
  sourceConfidence: number; // 0-100
  publishedAt: string; // ISO
  affectedCompanies: string[];
  kpiAffected: string[];
  timeHorizon: TimeHorizon;
  whyItMatters: string;
  bullCase: string;
  bearCase: string;
  relatedCatalyst: string;
  newsUrl: string;
}

export interface SectorMeta {
  id: string;
  name: string;
  shortName: string;
  iconKey: SectorIconKey;
  accent: string; // hex color
  accentRgb: string; // "r,g,b"
  subsectors: string[];
  companies: string[];
  kpis: string[];
}

export type SectorIconKey =
  | "Banknote"
  | "Cpu"
  | "Pill"
  | "Car"
  | "Flame"
  | "Pickaxe"
  | "ShoppingBasket"
  | "Building2"
  | "Signal"
  | "Cog"
  | "Zap"
  | "BrickWall"
  | "FlaskConical"
  | "HeartPulse"
  | "Clapperboard"
  | "Store"
  | "Plane"
  | "Truck"
  | "Wheat"
  | "Shield"
  | "Sun"
  | "MemoryStick"
  | "BatteryCharging"
  | "Umbrella"
  | "Shirt"
  | "Hotel"
  | "Construction"
  | "Beaker"
  | "Landmark";

export interface SectorAggregate {
  sector: SectorMeta;
  heatScore: number; // 0-100
  sentiment: Sentiment;
  sentimentScore: number; // -100..100
  newsCount: number;
  topTheme: Theme;
  topNews: NewsItem[]; // top 5
}
