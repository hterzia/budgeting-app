import { ReactNode, createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Transaction, Category, Account } from '../../types';
import { getTransactions, getCategories, getAccounts } from '../../features/import/api';

interface BudgetContextValue {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  addCategory: (category: Category) => void;
}

const BudgetContext = createContext<BudgetContextValue>({
  transactions: [],
  categories: [],
  accounts: [],
  isLoading: true,
  error: null,
  refresh: async () => {},
  updateTransaction: () => {},
  addCategory: () => {},
});

export function BudgetProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      const [txns, cats, accts] = await Promise.all([
        getTransactions(),
        getCategories(),
        getAccounts(),
      ]);
      setTransactions(txns);
      setCategories(prev =>
        prev.length === cats.length && prev.every((c, i) => c.id === cats[i].id && c.name === cats[i].name && c.color === cats[i].color)
          ? prev
          : cats
      );
      setAccounts(accts);
      setError(null);
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateTransaction = useCallback((id: string, patch: Partial<Transaction>) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }, []);

  const addCategory = useCallback((category: Category) => {
    setCategories(prev => [...prev, category]);
  }, []);

  const contextValue = useMemo(
    () => ({ transactions, categories, accounts, isLoading, error, refresh, updateTransaction, addCategory }),
    [transactions, categories, accounts, isLoading, error, refresh, updateTransaction, addCategory]
  );

  return (
    <BudgetContext.Provider value={contextValue}>
      {children}
    </BudgetContext.Provider>
  );
}

export function useBudget() {
  return useContext(BudgetContext);
}
