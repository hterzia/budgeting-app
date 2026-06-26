import { memo } from 'react';
import { Transaction, Category } from '../../../types';
import { groupByCategory } from '../../transactions/aggregations';
import { Card } from '../../../shared/ui';
import { BarTemplate } from '../../insights/templates/BarTemplate';

interface Props {
  transactions: Transaction[];
  categories: Category[];
}

export const SpendingByCategory = memo(function SpendingByCategory({ transactions, categories }: Props) {
  const data = groupByCategory(transactions).map(({ category: categoryId, amount }) => {
    const category = categories.find((c) => c.id === categoryId);
    return { category: category?.name ?? categoryId, amount };
  });

  return (
    <Card className="h-full">
      <div className="px-6 pt-6 pb-4">
        <h3 className="text-lg font-serif text-gray-900 font-medium">Spending by Category</h3>
      </div>
      <div className="h-[300px] sm:h-[340px] px-6">
        <BarTemplate
          data={data}
          xAxisKey="category"
          layout="vertical"
          series={[{ key: 'amount', color: '#78350f', label: 'Amount' }]}
        />
      </div>
    </Card>
  );
});
