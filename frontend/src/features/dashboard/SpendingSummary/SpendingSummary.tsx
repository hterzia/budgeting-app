import { memo } from 'react';
import { Transaction } from '../../../types';
import { formatCurrency } from '../../../shared/lib/format';
import { summarizeTotals } from '../../transactions/aggregations';
import { LuxuryCard } from './LuxuryCard';

interface Props {
  transactions: Transaction[];
}

export const SpendingSummary = memo(function SpendingSummary({ transactions }: Props) {
  const { income, expenses: netExpenses, refunds, savings, savingsRate } = summarizeTotals(transactions);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
      {/* Income Card - Amber Accent */}
      <LuxuryCard className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-16 h-16 bg-[#2e8b57]/10 rounded-bl-3xl rounded-tr-none" />
        <p className="text-xs tracking-widest text-gray-500 uppercase font-medium">Income</p>
        <p className="text-3xl sm:text-4xl font-serif text-[#2e8b57] mt-2 font-medium">
          {formatCurrency(income)}
        </p>
      </LuxuryCard>

      {/* Expenses Card - Amber Accent */}
      <LuxuryCard className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-16 h-16 bg-[#b04a4a]/10 rounded-bl-3xl rounded-tr-none" />
        <p className="text-xs tracking-widest text-gray-500 uppercase font-medium">Expenses</p>
        <p className="text-3xl sm:text-4xl font-serif text-[#b04a4a] mt-2 font-medium">
          {formatCurrency(netExpenses)}
        </p>
        {refunds > 0 && (
          <p className="text-xs mt-2 text-gray-400 font-medium">
            (after {formatCurrency(refunds)} in refunds)
          </p>
        )}
      </LuxuryCard>

      {/* Savings Card - Amber Accent */}
      <LuxuryCard className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-16 h-16 bg-[#1e3a8a]/10 rounded-bl-3xl rounded-tr-none" />
        <p className="text-xs tracking-widest text-gray-500 uppercase font-medium">Savings</p>
        <p
          className={`text-3xl sm:text-4xl font-serif text-[#1e3a8a] mt-2 font-medium`}
        >
          {formatCurrency(savings)}
        </p>
        <p
          className={`text-xs mt-2 ${
            savings >= 0 ? 'text-[#1e3a8a] font-medium' : 'text-gray-400'
          }`}
        >
          {savingsRate.toFixed(1)}% savings rate
        </p>
      </LuxuryCard>
    </div>
  );
});
