'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatShortDate } from '@/lib/utils';
import { TrendingUp, TrendingDown, Trash2, Filter, Search } from 'lucide-react';
import { Toaster, toast } from 'sonner';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  const supabase = createClient();

  useEffect(() => {
    loadTransactions();
  }, [filter]);

  const loadTransactions = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let query = supabase
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
      .order('date', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('categories.type', filter);
    }

    const { data, error } = await query;

    if (error) {
      toast.error('Ошибка загрузки');
    } else {
      setTransactions(data || []);
    }
    setLoading(false);
  };

  const deleteTransaction = async (id: string) => {
    if (!confirm('Удалить эту транзакцию?')) return;

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Ошибка удаления');
    } else {
      toast.success('Транзакция удалена');
      await loadTransactions();
    }
  };

  // Фильтрация по поиску
  const filteredTransactions = transactions.filter(t =>
    t.categories?.name.toLowerCase().includes(search.toLowerCase()) ||
    t.note?.toLowerCase().includes(search.toLowerCase())
  );

  // Группировка по датам
  const groupedByDate = filteredTransactions.reduce((acc, t) => {
    const date = new Date(t.date).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(t);
    return acc;
  }, {} as Record<string, any[]>);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      <Toaster richColors position="top-center" />

      {/* Заголовок */}
      <div className="mt-4">
        <h1 className="text-2xl font-bold">Транзакции</h1>
        <p className="text-gray-400 text-sm mt-1">
          {filteredTransactions.length} записей
        </p>
      </div>

      {/* Поиск */}
      <div className="relative">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по категории или заметке..."
          className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Фильтры */}
      <div className="flex gap-2">
        {[
          { value: 'all', label: 'Все' },
          { value: 'income', label: 'Доходы' },
          { value: 'expense', label: 'Расходы' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value as any)}
            className={`flex-1 py-2 rounded-lg font-medium transition ${
              filter === f.value
                ? 'bg-green-600 text-white'
                : 'bg-gray-900 text-gray-400 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Список транзакций */}
      {filteredTransactions.length === 0 ? (
        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center">
          <Filter size={48} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400">Транзакции не найдены</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedByDate).map(([date, items]: [string, any[]]) => (
            <div key={date}>
              <h3 className="text-sm text-gray-400 font-medium mb-2 capitalize">{date}</h3>
              <div className="space-y-2">
                {items.map((t) => (
                  <div
                    key={t.id}
                    className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`p-2 rounded-lg ${
                        t.amount > 0 ? 'bg-green-500/10' : 'bg-red-500/10'
                      }`}>
                        <span className="text-2xl">{t.categories?.icon || '📦'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{t.categories?.name || 'Другое'}</p>
                        {t.note && (
                          <p className="text-xs text-gray-400 truncate">{t.note}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center ${
                        t.amount > 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {t.amount > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        <span className="ml-1 font-bold">
                          {t.amount > 0 ? '+' : ''}{formatCurrency(t.amount)}
                        </span>
                      </div>
                      <button
                        onClick={() => deleteTransaction(t.id)}
                        className="text-gray-400 hover:text-red-500 p-2 transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}