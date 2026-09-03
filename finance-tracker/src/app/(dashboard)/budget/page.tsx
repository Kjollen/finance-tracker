'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { Plus, Trash2, Edit2, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';
import { Toaster, toast } from 'sonner';

export default function BudgetPage() {
  const [budgets, setBudgets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<any>(null);
  
  // Форма
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [newLimit, setNewLimit] = useState('');

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Загружаем категории расходов
    const { data: cats } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .order('sort_order');

    if (cats) {
      setCategories(cats);
    }

    // Загружаем установленные лимиты
    const { data: budgetsData } = await supabase
      .from('category_budgets')
      .select(`
        *,
        categories (
          name,
          icon
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (budgetsData) {
      setBudgets(budgetsData);
    }

    setLoading(false);
  };

  const saveBudget = async () => {
    if (!selectedCategoryId || !newLimit) {
      toast.error('Выбери категорию и укажи лимит');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const budgetData = {
      user_id: user.id,
      category_id: selectedCategoryId,
      monthly_limit: parseFloat(newLimit),
    };

    let error;

    if (editingBudget) {
      // Обновление существующего лимита
      const result = await supabase
        .from('category_budgets')
        .update(budgetData)
        .eq('id', editingBudget.id);
      error = result.error;
    } else {
      // Создание нового лимита
      const result = await supabase
        .from('category_budgets')
        .insert(budgetData);
      error = result.error;
    }

    if (error) {
      toast.error('Ошибка сохранения: ' + error.message);
    } else {
      toast.success(editingBudget ? 'Лимит обновлён!' : 'Лимит установлен!');
      setNewLimit('');
      setSelectedCategoryId('');
      setEditingBudget(null);
      setShowForm(false);
      await loadData();
    }
  };

  const deleteBudget = async (id: string) => {
    if (!confirm('Удалить этот лимит?')) return;

    const { error } = await supabase
      .from('category_budgets')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Ошибка удаления');
    } else {
      toast.success('Лимит удалён');
      await loadData();
    }
  };

  const editBudget = (budget: any) => {
    setEditingBudget(budget);
    setSelectedCategoryId(budget.category_id);
    setNewLimit(budget.monthly_limit.toString());
    setShowForm(true);
  };

  // Подсчёт потраченного за текущий месяц по каждой категории
  const getSpentAmount = async (categoryId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', user.id)
      .eq('category_id', categoryId)
      .eq('source_type', 'main')
      .gte('date', firstDay.toISOString())
      .lt('amount', 0); // Только расходы

    if (data) {
      return data.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    }
    return 0;
  };

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
      <div className="mt-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Бюджет по категориям</h1>
          <p className="text-gray-400 text-sm mt-1">
            Установи лимиты расходов на месяц
          </p>
        </div>
        <button
          onClick={() => {
            setEditingBudget(null);
            setSelectedCategoryId('');
            setNewLimit('');
            setShowForm(true);
          }}
          className="bg-green-600 hover:bg-green-700 p-3 rounded-lg transition"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Общая сводка */}
      {budgets.length > 0 && (
        <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl p-6 shadow-xl">
          <p className="text-purple-100 text-sm mb-2">Общий бюджет на месяц</p>
          <h2 className="text-3xl font-bold text-white">
            {formatCurrency(budgets.reduce((sum, b) => sum + parseFloat(b.monthly_limit), 0))}
          </h2>
          <p className="text-purple-200 text-xs mt-2">
            {budgets.length} {budgets.length === 1 ? 'категория' : budgets.length < 5 ? 'категории' : 'категорий'}
          </p>
        </div>
      )}

      {/* Список лимитов */}
      {budgets.length === 0 ? (
        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center">
          <TrendingDown size={48} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400 mb-2">Нет установленных лимитов</p>
          <p className="text-sm text-gray-500">
            Добавь первый лимит, чтобы контролировать расходы
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map((budget) => {
            const spent = budget.spent || 0;
            const limit = parseFloat(budget.monthly_limit);
            const remaining = limit - spent;
            const percent = (spent / limit) * 100;
            
            let statusColor = 'bg-green-500';
            let statusIcon = <CheckCircle size={16} className="text-green-500" />;
            
            if (percent >= 90) {
              statusColor = 'bg-red-500';
              statusIcon = <AlertCircle size={16} className="text-red-500" />;
            } else if (percent >= 70) {
              statusColor = 'bg-yellow-500';
              statusIcon = <AlertCircle size={16} className="text-yellow-500" />;
            }

            return (
              <div key={budget.id} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{budget.categories?.icon || '📦'}</span>
                    <div>
                      <p className="font-semibold">{budget.categories?.name || 'Категория'}</p>
                      <p className="text-xs text-gray-400">
                        Лимит: {formatCurrency(limit)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusIcon}
                    <button
                      onClick={() => editBudget(budget)}
                      className="text-gray-400 hover:text-blue-500 p-1 transition"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => deleteBudget(budget.id)}
                      className="text-gray-400 hover:text-red-500 p-1 transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Прогресс-бар */}
                <div className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">
                      Потрачено: {formatCurrency(spent)}
                    </span>
                    <span className={percent >= 90 ? 'text-red-500' : percent >= 70 ? 'text-yellow-500' : 'text-green-500'}>
                      {percent.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${statusColor}`}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Остаток */}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Осталось:</span>
                  <span className={`font-semibold ${remaining >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {formatCurrency(remaining)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Модальное окно добавления/редактирования */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-lg p-6 space-y-4 border border-gray-700">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">
                {editingBudget ? 'Редактировать лимит' : 'Новый лимит'}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Категория *</label>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                disabled={!!editingBudget}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
              >
                <option value="">Выбери категорию</option>
                {categories
                  .filter(cat => !editingBudget || cat.id === selectedCategoryId)
                  .map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Месячный лимит *</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">₽</span>
                <input
                  type="number"
                  value={newLimit}
                  onChange={(e) => setNewLimit(e.target.value)}
                  placeholder="15000"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <button
              onClick={saveBudget}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition"
            >
              {editingBudget ? 'Обновить' : 'Установить лимит'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}