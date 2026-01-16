/**
 * Kite Connect API Client
 */

import { KiteConnect } from 'kiteconnect';

// API Configuration
const API_KEY = process.env.KITE_API_KEY || '';
const API_SECRET = process.env.KITE_API_SECRET || '';

// Define type for Kite instance
export type KiteInstance = InstanceType<typeof KiteConnect>;

/**
 * Create a new Kite instance
 */
export function createKiteInstance(accessToken?: string): KiteInstance {
  const kite = new KiteConnect({
    api_key: API_KEY,
    access_token: accessToken
  });
  return kite;
}

/**
 * Get login URL
 */
export function getLoginUrl(): string {
  const kite = createKiteInstance();
  return kite.getLoginURL();
}

/**
 * Generate session from request token
 */
export async function generateSession(requestToken: string) {
  const kite = createKiteInstance();
  const session = await kite.generateSession(requestToken, API_SECRET);
  return session;
}

/**
 * Fetch user profile
 */
export async function getProfile(kite: KiteInstance) {
  return await kite.getProfile();
}

/**
 * Fetch margins
 */
export async function getMargins(kite: KiteInstance) {
  return await kite.getMargins();
}

/**
 * Fetch equity holdings
 */
export async function getHoldings(kite: KiteInstance) {
  return await kite.getHoldings();
}

/**
 * Fetch positions
 */
export async function getPositions(kite: KiteInstance) {
  return await kite.getPositions();
}

/**
 * Fetch mutual fund holdings
 */
export async function getMFHoldings(kite: KiteInstance) {
  return await kite.getMFHoldings();
}

/**
 * Fetch orders
 */
export async function getOrders(kite: KiteInstance) {
  return await kite.getOrders();
}

// Types for portfolio data
export interface Holding {
  tradingsymbol: string;
  exchange: string;
  isin: string;
  quantity: number;
  average_price: number;
  last_price: number;
  pnl: number;
  close_price: number;
  product: string;
  collateral_quantity: number;
  collateral_type: string;
  t1_quantity: number;
}

export interface MFHolding {
  folio: string;
  fund: string;
  tradingsymbol: string;
  average_price: number;
  last_price: number;
  last_price_date: string;
  pnl: number;
  quantity: number;
}

export interface Position {
  tradingsymbol: string;
  exchange: string;
  product: string;
  quantity: number;
  average_price: number;
  last_price: number;
  pnl: number;
  buy_quantity: number;
  sell_quantity: number;
  buy_price: number;
  sell_price: number;
  multiplier: number;
}

export interface UserProfile {
  user_id: string;
  user_name: string;
  user_shortname: string;
  email: string;
  user_type: string;
  broker: string;
  exchanges: string[];
  products: string[];
  order_types: string[];
}

export interface Margins {
  equity: {
    enabled: boolean;
    net: number;
    available: {
      cash: number;
      collateral: number;
      intraday_payin: number;
      live_balance: number;
    };
    utilised: {
      debits: number;
      exposure: number;
      m2m_realised: number;
      m2m_unrealised: number;
      option_premium: number;
      payout: number;
      span: number;
      holding_sales: number;
      turnover: number;
    };
  };
  commodity: {
    enabled: boolean;
    net: number;
    available: {
      cash: number;
      collateral: number;
      intraday_payin: number;
      live_balance: number;
    };
  };
}

