# Wealthfolio Value Averaging Addon

A professional addon for [Wealthfolio](https://wealthfolio.app) that automates recurring investment calculations using the **value averaging** method – helping you grow your portfolio along a predefined target path, regardless of market fluctuations.

## Features

### 🔧 Settings Page

Configure your value averaging strategy with precision:

- **Top-up amount / percentage** – Define the base contribution per period (fixed amount or % of portfolio value)
- **Maximum top-up multiplier** – Protect against extreme market drops by setting a cap:
  - Preset multipliers: 1.5×, 2×, 3×, 4×, 5×
  - Custom multiplier: adjustable via slider (**1× to 10×**)
- **Growth period** – Set the target time horizon; the addon notifies you when each period ends or when recalibration is needed
- **Portfolio allocation per ticker** – Add tickers from different accounts:
  - Toggle switch to include/exclude each account
  - Assign percentage weights to each ticker within the value averaging portfolio
- **Confirm settings** – Save your strategy with a single confirmation

### 📊 Dashboard Page

Real‑time overview and control of your value averaging plan:

#### Ticker / Asset List
Each row displays:
- **Ticker symbol** + asset name
- **Cost basis** – Average purchase price per unit
- **Market value** – Current price per unit
- **Total invested** (accessible via drill‑down)

#### Drill‑down Detail View (per ticker)
- **Total invested via value averaging** – Cumulative contributions made specifically through this strategy
- **Amount to invest** – Required top‑up for the current period to reach the target portfolio value
- Historical contribution logs

#### Action Buttons
- **Fetch latest prices** – Manually refresh market data for all or selected tickers
- **Auto‑generate transaction** – Creates a ready‑to‑use transaction entry based on the calculated top‑up amount, respecting your maximum multiplier rule

## Installation

1. Ensure Wealthfolio is installed and up to date
2. Download the latest release of this addon from the [Releases](../../releases) page
3. Follow Wealthfolio’s addon installation guide (typically: place in `~/.wealthfolio/addons/` or use the built‑in addon manager)

## Usage Example

1. **Settings**:  
   - Set base top‑up = $500  
   - Max multiplier = 3× → maximum allowed top‑up = $1,500  
   - Growth period = 12 months  
   - Add tickers `VTI`, `BND`, `VXUS` with 50%, 30%, 20% weights

2. **Dashboard**:  
   - After price fetch, the addon calculates required contributions per ticker (max $1,500 total across all)  
   - Click **Auto‑generate transaction** to create a single consolidated buy order or individual orders per ticker

## Requirements

- Wealthfolio v1.x or later
- Active internet connection for price fetching (configurable data source – e.g., Yahoo Finance, Alpha Vantage)

## License

MIT – see [LICENSE](LICENSE) file for details.

## Contributing

Pull requests and issue reports are welcome. Please follow the [contributing guidelines](CONTRIBUTING.md).

---

*Built for disciplined investors who want systematic growth beyond dollar‑cost averaging.*
