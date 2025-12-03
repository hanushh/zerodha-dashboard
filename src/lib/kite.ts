/**
 * Kite Connect API Client
 */

import { KiteConnect } from 'kiteconnect';

// API Configuration
const API_KEY = process.env.KITE_API_KEY || '';
const API_SECRET = process.env.KITE_API_SECRET || '';

// Define type for Kite instance
type KiteInstance = InstanceType<typeof KiteConnect>;

// Store access token in memory (in production, use a proper session store)
let accessToken: string | null = null;
let kiteInstance: KiteInstance | null = null;

/**
 * Get or create Kite instance
 */
export function getKiteInstance(): KiteInstance {
  if (!kiteInstance) {
    kiteInstance = new KiteConnect({
      api_key: API_KEY,
    });
  }
  return kiteInstance;
}

/**
 * Get login URL
 */
export function getLoginUrl(): string {
  const kite = getKiteInstance();
  return kite.getLoginURL();
}

/**
 * Generate session from request token
 */
export async function generateSession(requestToken: string) {
  const kite = getKiteInstance();
  const session = await kite.generateSession(requestToken, API_SECRET);
  accessToken = session.access_token;
  kite.setAccessToken(accessToken);
  return session;
}

/**
 * Set access token
 */
export function setAccessToken(token: string) {
  accessToken = token;
  const kite = getKiteInstance();
  kite.setAccessToken(token);
}

/**
 * Get current access token
 */
export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Check if authenticated
 */
export function isAuthenticated(): boolean {
  return accessToken !== null;
}

/**
 * Fetch user profile
 */
export async function getProfile() {
  const kite = getKiteInstance();
  return await kite.getProfile();
}

/**
 * Fetch margins
 */
export async function getMargins() {
  const kite = getKiteInstance();
  return await kite.getMargins();
}

/**
 * Fetch equity holdings
 */
export async function getHoldings() {
  const kite = getKiteInstance();
  return await kite.getHoldings();
}

/**
 * Fetch positions
 */
export async function getPositions() {
  const kite = getKiteInstance();
  return await kite.getPositions();
}

/**
 * Fetch mutual fund holdings
 */
export async function getMFHoldings() {
  const kite = getKiteInstance();
  return await kite.getMFHoldings();
}

/**
 * Fetch orders
 */
export async function getOrders() {
  const kite = getKiteInstance();
  return await kite.getOrders();
}

/**
 * Logout - clear access token
 */
export function logout() {
  accessToken = null;
  kiteInstance = null;
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

