# Budgeting App Insights Guide

A comprehensive guide to understanding and using the Insights feature for personal finance analysis.

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Widget Types](#widget-types)
   - [Basic Widgets](#basic-widgets)
   - [Stage 2 Widgets](#stage-2-widgets)
   - [Stage 3 Widgets](#stage-3-widgets)
4. [Using Filters](#using-filters)
5. [Date Range Presets](#date-range-presets)
6. [Best Practices](#best-practices)

---

## Overview

The Insights page is a customizable dashboard that displays financial data through interactive widgets. Each widget aggregates your transaction data in different ways to reveal spending patterns, savings trends, and financial health metrics.

**Key Features:**
- Drag-and-drop style grid layout
- Persistent widget configuration (saved to localStorage)
- Real-time filtering by date, category, account, and transaction type
- Multiple chart types: Line, Bar, Pie, and Summary cards

---

## Getting Started

### Accessing Insights

1. Navigate to the **Insights** page in your app
2. If no widgets exist, you'll see a "No widgets" message with an "Add Widget" button
3. Click **Add Widget** to open the widget picker

### Adding a Widget

1. Click the **Add Widget** button in the top right
2. Select a widget from the picker modal
3. Optionally add a custom title
4. Click **Add Widget**

Widgets are automatically added to a responsive grid that adjusts based on screen size.

### Removing a Widget

1. Hover over any widget
2. Click the **X** icon in the top right corner
3. The widget is immediately removed (and removed from localStorage)

---

## Widget Types

All widgets support filters (date range, categories, accounts, and transaction types) that can be applied by clicking the **Filters** button on each widget.

### Basic Widgets

#### 1. Summary (spending_summary)

**Template:** Summary cards

**Description:** Income, expenses, and savings at a glance

**What it shows:**
- Total Income
- Total Expenses
- Refunds
- Net Savings
- Savings Rate (%)

**Best for:** Quick overview of current financial activity

**Default date range:** Current Month

---

#### 2. Cash Flow (cashflow)

**Template:** Line chart

**Description:** Running balance over time

**What it shows:**
- Income line (green)
- Expense line (red)
- Balance line (blue - cumulative income minus expenses)

**How it works:** Shows running totals that accumulate across the date range. Use the calendar/running toggle (if available) to see month-by-month performance.

**Best for:** Tracking cash position over time

**Default date range:** Last 30 Days

---

#### 3. Spending by Category (category_pie)

**Template:** Pie chart

**Description:** Where your money goes

**What it shows:**
- Pie chart showing expense distribution by category
- Percentage breakdown of spending by category

**Best for:** Understanding spending composition at a glance

**Default date range:** Current Month

---

#### 4. Spending by Category (Bar) (category_bar)

**Template:** Horizontal bar chart

**Description:** Category spending as a horizontal bar chart

**What it shows:**
- Categories on Y-axis
- Spending amounts on X-axis
- Bars sorted from highest to lowest spending

**Best for:** Comparing spending across categories with category names easily readable

**Default date range:** Current Month

---

#### 5. Category Spending by Month (category_monthly_bar)

**Template:** Grouped horizontal bar chart

**Description:** Horizontal grouped bars of category expenses across months

**What it shows:**
- Categories on Y-axis
- Multiple bars per category representing different months
- Visual comparison of category spending over time

**Best for:** Tracking how spending in each category changes month-over-month

**Default date range:** Last 6 Months

**Grid size:** Medium (2 columns), Large (3 columns)

---

#### 6. Monthly Trends (monthly_comparison)

**Template:** Vertical bar chart

**Description:** Income vs expenses by month

**What it shows:**
- Each month has two bars: income (green) and expenses (red)
- Easy to spot months with high expenses or good savings

**Best for:** Identifying seasonal spending patterns

**Default date range:** Last 6 Months

---

#### 7. Day-of-Week Patterns (weekday_spending)

**Template:** Vertical bar chart

**Description:** Which days you spend most

**What it shows:**
- Days of the week on X-axis (Sunday through Saturday)
- Average spending amount for each day

**Best for:** Identifying spending habits tied to specific days

**Default date range:** Last 90 Days

---

#### 8. Top Merchants (merchant_ranking)

**Template:** Vertical bar chart

**Description:** Where you spend the most

**What it shows:**
- Top merchants by total spending
- Configurable limit (default: top 10)

**Best for:** Identifying major spending categories (e.g., streaming services, grocery chains)

**Default date range:** Last 30 Days

---

#### 9. Transaction Sizes (histogram)

**Template:** Vertical bar chart

**Description:** Distribution of transaction amounts

**What it shows:**
- Amount buckets (e.g., $0-25, $25-50, $50-75)
- Count of transactions in each bucket
- Configurable bucket size (default: $25)

**Best for:** Understanding your typical transaction size

**Default date range:** Last 90 Days

---

#### 10. Savings Rate (savings_rate)

**Template:** Line chart

**Description:** Monthly savings as percentage of income

**What it shows:**
- Savings rate percentage on Y-axis
- Months on X-axis
- Shows how your savings rate changes over time

**Best for:** Tracking savings rate trends

**Default date range:** Last 6 Months

---

## Stage 2 Widgets

These widgets require more data analysis and provide deeper financial insights.

### Widget Filter Configuration

Some widgets require additional filter configuration beyond the basic date range, categories, accounts, and types. Click the **Filters** button on each widget to access these advanced options.

#### Advanced Filters Available:
- **Budget Amounts** - For Budget vs Actual widget (enter monthly budget per category)
- **Fixed Categories** - For Fixed vs Variable and Emergency Runway widgets (select categories classified as fixed costs)
- **Variable Categories** - For Fixed vs Variable widget (select categories classified as variable spending)

**Important Note:** The Fixed Categories and Variable Categories filters apply in real-time. When you select or deselect categories in the filter modal, the widget immediately recalculates and updates the displayed values without requiring a page refresh.

**Example: Configuring Fixed vs Variable**
1. Click **Filters** on the Fixed vs Variable widget
2. Under "Fixed Categories", select categories like: Housing, Utilities, Insurance, Debt Payments
3. Under "Variable Categories", select categories like: Food, Entertainment, Shopping, Dining
4. The widget will immediately update to show the recalculated fixed and variable spending based on your selections

**Example: Configuring Budget vs Actual**
1. Click **Filters** on the Budget vs Actual widget
2. Enter your monthly budget amount for each category (in dollars)
3. The widget will show bars for both budgeted and actual amounts, with variance

---

#### 11. Fixed vs Variable (fixed_vs_variable)

**Template:** Summary cards

**Description:** Fixed costs vs discretionary spending

**What it shows:**
- Fixed Costs (housing, utilities, insurance, debt, loan)
- Variable Spending (food, entertainment, shopping, dining, transport)
- Uncategorized Spending
- Fixed % and Variable % breakdown

**How it works:**
- Automatically categorizes expenses as fixed or variable based on category names
- Supports custom category lists via filters
- **Real-time updates:** The widget filters for Fixed Categories and Variable Categories are applied immediately. When you select different categories in the filter modal, the widget recalculates and updates the displayed values without requiring a page refresh.

**Filter Configuration:**
| Filter | Purpose |
|--------|---------|
| **Fixed Categories** | Select categories that represent fixed monthly costs (e.g., housing, utilities, insurance, debt). These are recurring, predictable expenses. Changes apply immediately. |
| **Variable Categories** | Select categories that represent discretionary spending (e.g., food, entertainment, shopping). These are variable, optional expenses. Changes apply immediately. |
| **Date Range** | Default is Last 12 Months; adjust based on your analysis needs |

**Best for:** Budget planning and identifying areas for cost reduction

**Default date range:** Last 12 Months

**Grid size:** Medium (2 columns), Large (1 column)

**Troubleshooting:**
- If the widget values don't update after changing categories, ensure your browser has JavaScript enabled and try refreshing the page
- The widget stores its filter selections in localStorage, so they persist across page reloads

---

#### 12. Budget vs Actual (budget_vs_actual)

**Template:** Vertical bar chart

**Description:** Planned vs actual spending by category

**What it shows:**
- Bars for budgeted amounts (blue)
- Bars for actual spending (orange)
- Variance between budget and actual

**Filter Configuration:**
| Filter | Purpose |
|--------|---------|
| **Budget Amounts** | Enter your monthly budget for each category. Budgets are stored per-widget, so you can have different budget scenarios for different widgets. |
| **Categories** | Filter to only show specific categories (optional) |
| **Date Range** | Default is Current Month |

**How to configure:**
1. Click **Filters** on the widget
2. In the "Budget Amounts by Category" section, enter the monthly budget for each category
3. The widget compares your actual spending against these budget amounts

**Best for:** Budget tracking and adherence monitoring

**Default date range:** Current Month

**Grid size:** Medium (1 column), Large (2 columns)

---

#### 13. Income Stability (income_stability)

**Template:** Summary cards

**Description:** Monthly income variability and safe baseline

**What it shows:**
- Average Income
- Safe Baseline (25th percentile)
- Variability % (coefficient of variation)
- Months Analyzed

**How it works:**
- Analyzes 24 months of income data
- Calculates statistics: mean, standard deviation, percentiles
- "Safe Baseline" shows the income level you exceed 75% of months

**Filter Configuration:**
| Filter | Purpose |
|--------|---------|
| **Accounts** | Filter to only include income from specific accounts (e.g., primary checking) |
| **Types** | Filter to only include income transactions |
| **Date Range** | Default is Last 24 Months |

**Best for:** Assessing income reliability for budget planning

**Default date range:** Last 24 Months

**Grid size:** Medium (1 column), Large (2 columns)

---

## Stage 3 Widgets

Advanced financial metrics requiring historical data.

#### 14. Net Worth Trend (net_worth)

**Template:** Line chart

**Description:** Assets minus liabilities over time

**What it shows:**
- Net worth trajectory over time
- Monthly net worth values
- Trend direction (increasing/decreasing/stable)

**How it works:**
- Calculates running net worth from transaction history
- In a full implementation, would track asset and liability accounts separately
- Currently computes based on overall transaction flow

**Best for:** Long-term financial health tracking

**Default date range:** Last 36 Months

**Grid size:** Medium (2 columns), Large (2 columns, 2 rows)

---

#### 15. Goal Progress (goal_progress)

**Template:** Summary cards

**Description:** Progress toward savings goals

**What it shows:**
- Total Target
- Total Saved
- Average Progress %
- Completed Goals

**Configuration needed:** Requires goal data (not yet implemented in the backend)

**Planned goal data structure:**
```json
{
  "goals": [
    {
      "id": "goal-1",
      "name": "Emergency Fund",
      "targetAmount": 1200000,
      "currentAmount": 450000,
      "targetDate": "2026-12-31"
    }
  ]
}
```

**Best for:** Motivation and tracking long-term savings goals

**Default date range:** All Time

**Grid size:** Medium (2 columns), Large (1 column)

---

#### 16. Emergency Runway (emergency_runway)

**Template:** Summary cards

**Description:** Months of expenses covered by savings

**What it shows:**
- Current Balance
- Monthly Essentials
- Runway (Months)
- Target (Months - typically 3)

**How it works:**
- Calculates current balance from liquid accounts
- Determines monthly essential expenses from category data
- Computes how many months of expenses are covered

**Filter Configuration:**
| Filter | Purpose |
|--------|---------|
| **Accounts** | Select liquid accounts (checking, savings) to calculate current balance |
| **Fixed Categories** | Select essential expense categories (housing, utilities, food, etc.) to calculate monthly essentials. Changes apply immediately. |
| **Date Range** | Default is Current Month |

**How to configure:**
1. Click **Filters** on the widget
2. Under "Accounts", select your checking and savings accounts
3. Under "Fixed Categories", select your essential expense categories
4. The widget immediately recalculates: `Runway = Current Balance / Monthly Essentials`

**Best for:** Financial preparedness assessment

**Default date range:** Current Month

**Grid size:** Medium (1 column), Large (1 column)

**Note:** The Fixed Categories filter for Emergency Runway works the same way as the Fixed vs Variable widget. Selecting different categories will immediately update the calculated Monthly Essentials and Runway values.

---

#### 17. Debt Payoff (debt_payoff)

**Template:** Summary cards

**Description:** Debt balances and payoff progress

**What it shows:**
- Total Debt Payments
- Number of Payments

**How it works:**
- Identifies debt payments by merchant name containing "payment"
- Tracks debt payment patterns over time
- Can be used with 6-month history for trend analysis

**Best for:** Monitoring debt reduction progress

**Default date range:** Last 24 Months

**Grid size:** Medium (1 column), Large (2 columns)

---

## Using Filters

Each widget supports customizable filters to refine the data it displays.

### How to Apply Filters

1. Click the **Filters** button on any widget
2. Adjust the filter values
3. **Filters apply immediately** - no save button is needed. Widgets update in real-time as you change selections.

### Filter Types

#### Date Range
- Preset ranges: Current Month, Last 30/90/180/360 Days, Year to Date, All Time
- Custom date ranges via picker
- Affects all data aggregations

#### Categories
- Multi-select dropdown of all your categories
- Only transactions matching selected categories are included
- Useful for isolating specific spending areas
- **Note:** Category filters apply to all widgets that support them

#### Accounts
- Multi-select dropdown of all your accounts
- Only transactions from selected accounts are included
- Useful for tracking specific bank accounts or credit cards
- **Note:** Account filters apply to all widgets that support them

#### Types
- Multi-select: Income, Expense, Transfer
- Only transactions matching selected types are included
- Useful for analyzing specific transaction flows

### Advanced Filters (Real-time Updates)

Some widgets have additional filters that update immediately:

**Fixed Categories / Variable Categories** (Fixed vs Variable, Emergency Runway)
- Select categories that classify as fixed or variable spending
- Changes apply immediately without needing to save or close the modal
- These filters work in conjunction with the default category lists to customize analysis

### Filter Examples

**Example 1: Track only credit card spending**
```
Filters:
- Accounts: [Credit Card]
- Types: [Expense]
```

**Example 2: Analyze food spending patterns**
```
Filters:
- Categories: [Groceries, Restaurants]
- Date Range: Last 90 Days
```

**Example 3: Monitor income stability with specific accounts**
```
Filters:
- Accounts: [Primary Checking]
- Types: [Income]
- Date Range: Last 24 Months
```

### Advanced Filter Strategies by Widget

#### Fixed vs Variable Widget
**Goal:** Understand your cost structure for budget planning
```
Filters:
- Fixed Categories: [Housing, Utilities, Insurance, Debt Payments]
- Variable Categories: [Food, Entertainment, Shopping, Dining, Transport]
- Date Range: Last 12 Months
```
**Interpretation:** A high fixed percentage indicates stable but mandatory costs. A high variable percentage suggests more discretionary spending.

#### Budget vs Actual Widget
**Goal:** Track budget adherence by category
```
Filters:
- Budget Amounts: { Food: $400, Entertainment: $100, Shopping: $150 }
- Date Range: Current Month
```
**Interpretation:** Positive variance means you underspent your budget. Negative variance means you overspent.

#### Emergency Runway Widget
**Goal:** Calculate how many months of expenses your savings would cover
```
Filters:
- Accounts: [Primary Checking, Savings Account]
- Fixed Categories: [Housing, Utilities, Food, Insurance, Debt]
- Date Range: Current Month
```
**Interpretation:** Aim for 3-6 months of runway. Below 1 month indicates urgent need to review spending.

#### Category Spending by Month Widget
**Goal:** Track category trends over time
```
Filters:
- Categories: [Food, Housing, Entertainment]
- Date Range: Last 6 Months
```
**Interpretation:** Rising trends in specific categories may indicate need for budget adjustment.

#### Cash Flow Widget
**Goal:** Monitor daily/weekly cash position
```
Filters:
- Date Range: Last 30 Days
```
**Interpretation:** Negative balance periods indicate cash flow issues. Look for patterns in when cash is tight.

---

## Date Range Presets

---

## Date Range Presets

| Preset | Duration | Best For |
|--------|----------|----------|
| Current Month | Month-to-date | Recent activity overview |
| Last 30 Days | 30 days | Short-term cash flow |
| Last 90 Days | 3 months | Quarter-over-quarter trends |
| Last 6 Months | 6 months | Medium-term patterns |
| Last 12 Months | 12 months | Annual comparison |
| Year to Date | Jan 1 - today | YTD performance |
| All Time | Entire history | Lifetime analysis |
| Last 24 Months | 2 years | Multi-year trends |
| Last 36 Months | 3 years | Long-term patterns |

---

## Best Practices

### For Accurate Insights

1. **Categorize transactions consistently** - The widget aggregations rely on proper category assignment
2. **Update your budget data** - For Budget vs Actual, keep your budgets current
3. **Review date ranges** - Match the range to what you want to analyze
4. **Use filters strategically** - Isolate specific accounts or categories for focused analysis

### Widget Combination Strategies

**Strategy 1: Monthly Budget Review**
```
- Summary (for total overview)
- Category Bar (for spending breakdown)
- Budget vs Actual (for budget adherence)
- Monthly Trends (for trend comparison)
```

**Strategy 2: Financial Health Check**
```
- Emergency Runway (for preparedness)
- Income Stability (for income reliability)
- Fixed vs Variable (for cost structure)
- Net Worth Trend (for long-term health)
```

**Strategy 3: Spending Pattern Analysis**
```
- Day-of-Week Patterns (for timing)
- Transaction Sizes (for amount patterns)
- Top Merchants (for merchant analysis)
- Cash Flow (for timing of cash)
```

### Common Use Cases

**Q: How do I see my spending by category for a specific month?**
> A: Apply the "Current Month" date range filter and use the Category Bar or Pie widget.

**Q: How do I track if I'm staying within budget?**
> A: Add the Budget vs Actual widget and configure your budget amounts in the filters.

**Q: How do I know if I have enough emergency savings?**
> A: Use the Emergency Runway widget. It calculates how many months of expenses your current balance would cover.

**Q: Why does my Cash Flow show a negative balance?**
> A: This means your expenses have exceeded your income during that period. Review your spending patterns.

**Q: How can I identify which merchants I spend the most with?**
> A: Use the Top Merchants widget - it aggregates spending by merchant name.

---

## Troubleshooting

### Widget shows "No data available"
- Check that you have transactions in your selected date range
- Verify that your filters aren't too restrictive
- Ensure categories are assigned to transactions

### Unexpected values in widgets
- Review your filters - you may have excluded relevant transactions
- Check that date ranges are correct
- Verify transaction types are properly classified

### Widgets not saving
- Check browser localStorage is enabled
- Refresh the page to verify persistence
- Clear localStorage if experiencing corruption (widgets will reset to defaults)

---

## Technical Notes

### Storage
- Widgets and their configurations are stored in browser localStorage
- The key is `budget-insights-widgets`
- Deleting browser data will reset widgets to defaults

### Data Aggregation
- All aggregations use the `filterTransactions` helper with options pattern
- Date filtering normalizes to local timezone midnight
- Currency values are stored in cents but displayed in dollars

### Chart Library
- Uses Recharts for all visualizations
- Responsive containers adapt to available space
- Tooltips show formatted currency values

### Recent Updates
- **Fixed vs Variable Widget Filters (March 2026):** The Fixed Categories and Variable Categories filters now update in real-time. Previously, changing these filters required a page refresh to see updated values. The widget now uses React's useMemo with proper dependency tracking to recalculate and display updated values immediately when filter selections change.

---

## Feedback

If you encounter issues or have suggestions for new widgets, please check the project's issue tracker or documentation.
