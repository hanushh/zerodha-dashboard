# Kite Portfolio Tracker

A Next.js application to track your Zerodha investments - equity holdings and mutual funds.

![Kite Portfolio](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC?style=flat-square&logo=tailwind-css)

## Features

- 🔐 **Secure OAuth Authentication** with Zerodha Kite
- 📈 **Equity Holdings** - View all your stock holdings with P&L
- 📊 **Mutual Funds** - Track all your MF investments
- 💰 **Portfolio Summary** - Quick overview of your investments
- 🔄 **Real-time Data** - Fetch latest prices from Kite API
- 🌙 **Dark Mode UI** - Beautiful dark theme interface

## Prerequisites

1. **Zerodha Account** - You need a Zerodha trading account
2. **Kite Connect API** - Get API credentials from [Kite Connect](https://developers.kite.trade/)
   - Create an app on the Kite Connect developer console
   - Note down your `API Key` and `API Secret`
   - Set the redirect URL to `http://localhost:3000/api/auth/callback`

## Setup

### 1. Clone and Install

```bash
cd kite
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp env.example .env.local
```

Edit `.env.local` and add your credentials:

```env
KITE_API_KEY=your_api_key_here
KITE_API_SECRET=your_api_secret_here
```

### 3. Configure Kite Connect App

In your [Kite Connect Developer Console](https://developers.kite.trade/):

1. Go to your app settings
2. Set the **Redirect URL** to: `http://localhost:3000/api/auth/callback`
3. Save the settings

### 4. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Click **"Login with Zerodha"** on the home page
2. You'll be redirected to Zerodha's login page
3. Enter your Zerodha credentials and complete 2FA
4. After successful login, you'll be redirected to the dashboard
5. View your equity holdings and mutual fund investments

## Project Structure

```
kite/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts      # Get login URL
│   │   │   │   ├── callback/route.ts   # OAuth callback
│   │   │   │   └── logout/route.ts     # Logout handler
│   │   │   └── portfolio/route.ts      # Fetch portfolio data
│   │   ├── dashboard/
│   │   │   └── page.tsx                # Dashboard page
│   │   ├── layout.tsx                  # Root layout
│   │   ├── page.tsx                    # Home/Login page
│   │   └── globals.css                 # Global styles
│   ├── components/
│   │   ├── HoldingsTable.tsx           # Equity holdings table
│   │   ├── MFHoldingsTable.tsx         # MF holdings table
│   │   ├── PortfolioCard.tsx           # Summary cards
│   │   └── LoadingSpinner.tsx          # Loading indicator
│   └── lib/
│       └── kite.ts                     # Kite API client
├── env.example                         # Environment template
├── package.json
├── tailwind.config.ts
└── README.md
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/login` | GET | Get Zerodha login URL |
| `/api/auth/callback` | GET | OAuth callback handler |
| `/api/auth/logout` | POST | Logout and clear session |
| `/api/portfolio` | GET | Fetch portfolio data |

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never commit `.env.local`** - It contains your API secrets
2. **API Secret** - Keep it confidential, never expose to client-side
3. **Access Token** - Stored in HTTP-only cookies for security
4. **Session Duration** - Tokens expire after 24 hours

## Technologies Used

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **KiteConnect** - Official Zerodha Kite API client

## Troubleshooting

### "Invalid API Key" Error
- Verify your `KITE_API_KEY` in `.env.local`
- Make sure you're using the correct API key from Kite Connect

### "Invalid Redirect URL" Error
- Check that your redirect URL in Kite Connect matches exactly:
  `http://localhost:3000/api/auth/callback`

### "Session Expired" Error
- Kite access tokens expire after 24 hours
- Simply login again to get a new token

### Empty Portfolio
- Make sure you have holdings in your Zerodha demat account
- Check if the market is open (for real-time prices)

## License

MIT License - feel free to use this for personal projects.

## Disclaimer

This application is for personal use only. The developer is not responsible for any financial decisions made based on the data displayed. Always verify important information on the official Zerodha Kite platform.
