# Value Averaging Addon for Wealthfolio

Value averaging workflow addon for [Wealthfolio](https://wealthfolio.app), including order draft generation, account selection, confirmation before submit, and deploy record tracking.

## Core Features

- Value averaging plan by ticker with configurable allocation and top-up rules.
- Auto-generate order drafts from current holdings.
- Confirm-first flow: no activity is created until user confirms.
- Editable order fields:
  - Account
  - Price
  - Amount
  - Quantity (truncated to max 8 decimals)
- Optional auto cash deposit before BUY.
- Deploy records table with persisted local history.
- Mobile-first deploy record UX:
  - Compact list
  - Detail sheet
  - Pagination (10 records per page)

## Permissions

This addon requests only the required host API permissions:

- `accounts.getAll`: read active accounts
- `portfolio.getHoldings`: read holdings for calculations
- `settings.get`: read app base currency
- `activities.create`: create confirmed BUY/SELL/DEPOSIT activities
- `ui.sidebar.addItem`, `ui.router.add`: register addon navigation and route

## Installation

1. Build and bundle:
   - `pnpm install`
   - `pnpm bundle`
2. Use the generated zip in `dist/` and install it through Wealthfolio addon installer.

## Usage

1. Open addon **Settings** and configure:
   - Top-up mode and amount/percentage
   - Allocation per enabled ticker
   - Account mapping for auto-generated orders
2. Open **Dashboard** and click **Auto generate transaction**.
3. Review generated orders in the confirm modal/sheet.
4. Adjust fields if needed, then confirm.
5. Check **Deploy Records** for execution history.

## Notes

- Activity creation uses current timestamp (`activityDate`) at confirmation time.
- Cost basis display is refreshed from latest holdings after successful creation.
- Strategy supports continuous VA rounds by executed-period progression.

## License

MIT
