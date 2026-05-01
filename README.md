# Value Averaging Addon for Wealthfolio

This addon helps you run a value averaging strategy inside [Wealthfolio](https://wealthfolio.app).  
It lets you configure portfolio weights, top-up rules, and growth schedule, then calculates ticker-level investment amounts based on your current holdings.

## What It Does

### Settings

- Configure top-up mode:
  - Fixed amount
  - Percentage
- Set overflow gains behavior.
- Choose purchase unit mode:
  - Fractional unit
  - Whole unit
- Enable or disable maximum top-up limits with multiplier presets.
- Configure growth schedule:
  - Start date
  - Interval
  - End mode
- Build your value averaging portfolio:
  - Enable/disable tickers
  - Set allocation percentages per ticker
  - Use ticker logos from the app

### Allocation Validation

- Portfolio allocation must stay in a valid range before saving:
  - Minimum: `99.9%`
  - Maximum: `100%`
- If allocation is invalid:
  - Total allocation value turns red
  - Save button is disabled
- If total is between `99.9%` and `100%`, it is treated as `100%` for display and save validation.

### Dashboard

- Shows enabled tickers with:
  - Cost basis
  - Market value
  - Calculated amount to invest
- Includes ticker detail panel for selected asset.
- Supports:
  - Refresh latest holdings/prices
  - Auto-generate transaction suggestions

## Install

1. Install or update Wealthfolio.
2. Download this addon package.
3. Install it through Wealthfolio addon installation flow.

## How To Use

1. Open **Settings** and configure strategy parameters.
2. In **Portfolio**, enable tickers and set allocations.
3. Save changes when allocation is valid.
4. Go to **Dashboard** to review suggested investment amounts.
5. Generate transactions for execution in your workflow.

## Requirements

- Wealthfolio with addon support enabled.
- At least one active account and holding in your portfolio.

## License

MIT
