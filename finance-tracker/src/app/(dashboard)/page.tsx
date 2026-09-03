'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { Plus, TrendingUp, TrendingDown, Wallet, CreditCard, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export default function DashboardPage() {
  const [balance, setBalance] = useState(0);
  const [monthlySpent, setMonthlySpent] = useState(0);
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  const [categories, setCategories] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Кредитные карты
  const [totalCreditLimit, setTotalCreditLimit] = useState(0);
  const [totalCreditDebt, setTotalCreditDebt] = useState(0);
  const [totalCreditAvailable, setTotalCreditAvailable] = useState(0);
  const [creditUsagePercent, setCreditUsagePercent] = useState(0);

  // Предупреждения по категориям
  const [categoryWarnings, setCategoryWarnings] = useState<any[]>([]);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Загрузка профиля (бюджет)
    const { data: profile } = await supabase
      .from('profiles')
      .select('monthly_budget')
      .eq('id', user.id)
      .single();

    if (profile) {
      setMonthlyBudget(profile.monthly_budget || 0);
    }

    // Загрузка транзакций за текущий месяц (только основной счёт)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data: transactions } = await supabase
      .from('transactions')
      .select(`
        *,
        categories (
          name,
          icon,
          type
        )
      `)
      .eq('user_id', user.id)
      .eq('source_type', 'main')
      .gte('date', firstDay.toISOString())
      .order('date', { ascending: false })
      .limit(5);

    if (transactions) {
      setRecentTransactions(transactions);

      // Подсчёт баланса и потраченного
      let totalIncome = 0;
      let totalExpense = 0;
      const categoryTotals: { [key: string]: { name: string; value: number; icon: string } } = {};

      transactions.forEach(t => {
        const amount = t.amount;
        const categoryName = t.categories?.name || 'Другое';
        const icon = t.categories?.icon || '📦';

        if (amount > 0) {
          totalIncome += amount;
        } else {
          totalExpense += Math.abs(amount);

          if (!categoryTotals[categoryName]) {
            categoryTotals[categoryName] = { name: categoryName, value: 0, icon };
          }
          categoryTotals[categoryName].value += Math.abs(amount);
        }
      });

      setBalance(totalIncome - totalExpense);
      setMonthlySpent(totalExpense);
      setCategories(Object.values(categoryTotals));
    }

    // Загрузка кредитных карт
    const { data: cards } = await supabase
      .from('credit_cards')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (cards) {
      const limit = cards.reduce((sum, c) => sum + (parseFloat(c.credit_limit) || 0), 0);
      const debt = cards.reduce((sum, c) => sum + (parseFloat(c.current_debt) || 0), 0);
      setTotalCreditLimit(limit);
      setTotalCreditDebt(debt);
      setTotalCreditAvailable(limit - debt);
      setCreditUsagePercent(limit > 0 ? (debt / limit) * 100 : 0);
      
      console.log('Кредитные карты:', cards);
      console.log('Общий лимит:', limit);
      console.log('Общий долг:', debt);
      console.log('Доступно:', limit - debt);
    }

    // Загрузка лимитов по категориям и проверка предупреждений
    const { data: budgets } = await supabase
      .from('category_budgets')
      .select(`
        *,
        categories (
          name,
          icon
        )
      `)
      .eq('user_id', user.id);

    if (budgets) {
      const warnings = [];

      for (const budget of budgets) {
        const categoryId = budget.category_id;
        const limit = parseFloat(budget.monthly_limit);

        // Подсчёт потраченного по этой категории за месяц
        const { data: catTransactions } = await supabase
          .from('transactions')
          .select('amount')
          .eq('user_id', user.id)
          .eq('category_id', categoryId)
          .eq('source_type', 'main')
          .gte('date', firstDay.toISOString())
          .lt('amount', 0);

        const spent = catTransactions?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;
        const percent = (spent / limit) * 100;

        if (percent >= 70) {
          warnings.push({
            categoryId,
            categoryName: budget.categories?.name || 'Категория',
            icon: budget.categories?.icon || '',
            spent,
            limit,
            percent,
          });
        }
      }

      setCategoryWarnings(warnings.sort((a, b) => b.percent - a.percent));
    }

    setLoading(false);
  };

  const budgetPercent = monthlyBudget > 0 ? (monthlySpent / monthlyBudget) * 100 : 0;

  const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Заголовок */}
      <div className="flex justify-between items-center mt-4">
        <h1 className="text-2xl font-bold">Мои Финансы</h1>
        <button
          onClick={() => router.push('/add')}
          className="bg-green-600 hover:bg-green-700 p-3 rounded-full shadow-lg transition"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Карточка баланса - основной счёт */}
      <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Wallet size={20} className="text-green-200" />
            <p className="text-green-100 text-sm">Мои деньги (основной счёт)</p>
          </div>
        </div>
        <h2 className="text-4xl font-bold text-white">{formatCurrency(balance)}</h2>
      </div>

      {/* Карточка доступных кредитных средств - ИСПРАВЛЕНО УСЛОВИЕ */}
      {totalCreditLimit > 0 && (
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CreditCard size={20} className="text-blue-200" />
              <p className="text-blue-100 text-sm">Доступно по кредиткам</p>
            </div>
          </div>
          <div className="flex items-baseline gap-3">
            <h2 className="text-3xl font-bold text-white">{formatCurrency(totalCreditAvailable)}</h2>
            <span className="text-blue-200 text-sm">из {formatCurrency(totalCreditLimit)}</span>
          </div>
          <div className="mt-3 w-full bg-blue-900/50 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                creditUsagePercent > 80 ? 'bg-red-400' : creditUsagePercent > 50 ? 'bg-yellow-400' : 'bg-green-400'
              }`}
              style={{ width: `${Math.min(100, creditUsagePercent)}%` }}
            ></div>
          </div>
          <p className="text-xs text-blue-200 mt-1">
            Использовано {(creditUsagePercent || 0).toFixed(0)}% ({formatCurrency(totalCreditDebt)})
          </p>
        </div>
      )}

      {/* Карточка бюджета с предупреждениями */}
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
        <div className="flex justify-between items-center mb-3">
          <div>
            <p className="text-gray-400 text-sm">Потрачено в этом месяце</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(monthlySpent)}</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm">Бюджет</p>
            <p className="text-xl font-semibold text-gray-300">{formatCurrency(monthlyBudget)}</p>
          </div>
        </div>

        {/* Прогресс-бар */}
        <div className="w-full bg-gray-800 rounded-full h-3 mb-2">
          <div
            className={`h-3 rounded-full transition-all ${
              budgetPercent > 90 ? 'bg-red-500' : budgetPercent > 70 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(budgetPercent, 100)}%` }}
          ></div>
        </div>
        <p className="text-sm text-gray-400">
          {budget(Number(percent || 0).toFixed(0)}% от бюджета
        </p>

        {/* Предупреждения по категориям */}
        {categoryWarnings.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-yellow-500 font-medium flex items-center gap-1">
              <AlertCircle size={14} />
              Приближаешься к лимиту:
            </p>
            {categoryWarnings.map((warning) => (
              <div
                key={warning.categoryId}
                className="flex items-center justify-between text-xs bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2"
              >
                <span className="text-yellow-200">
                  {warning.icon} {warning.categoryName}
                </span>
                <span className="text-yellow-400 font-semibold">
                  {(Number(warning?.percent || 0).toFixed(0)}% ({formatCurrency(warning.spent)} / {formatCurrency(warning.limit)})
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Круговая диаграмма */}
      {categories.length > 0 && (
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h3 className="text-lg font-semibold mb-4">Расходы по категориям</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categories}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                >
                  {categories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => formatCurrency(Number(value) || 0)}
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Последние транзакции */}
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold mb-4">Последние транзакции</h3>
        {recentTransactions.length === 0 ? (
          <p className="text-gray-400 text-center py-4">Нет транзакций</p>
        ) : (
          <div className="space-y-3">
            {recentTransactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{t.categories?.icon || '📦'}</span>
                  <div>
                    <p className="font-medium">{t.categories?.name || 'Другое'}</p>
                    <p className="text-sm text-gray-400">{new Date(t.date).toLocaleDateString('ru-RU')}</p>
                  </div>
                </div>
                <div className={`flex items-center ${t.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {t.amount > 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                  <span className="ml-2 font-semibold">{formatCurrency(Math.abs(t.amount))}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}