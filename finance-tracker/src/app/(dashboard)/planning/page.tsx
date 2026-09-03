'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { Plus, Trash2, CreditCard, Home, Car, Heart, PawPrint, Package, TrendingUp, Calculator, Save } from 'lucide-react';

const CATEGORY_ICONS: { [key: string]: any } = {
  'Платежи по кредитам': CreditCard,
  'Платежи по кредитным картам': CreditCard,
  'Жилье': Home,
  'Транспорт': Car,
  'Здоровье': Heart,
  'Питомцы': PawPrint,
  'Другое': Package,
};

export default function PlanningPage() {
  const [expectedIncome, setExpectedIncome] = useState('');
  const [recurring, setRecurring] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingIncome, setSavingIncome] = useState(false);
  
  // Форма добавления нового платежа
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newDay, setNewDay] = useState('');

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Загружаем профиль (ожидаемый доход)
    const { data: profile } = await supabase
      .from('profiles')
      .select('monthly_budget')
      .eq('id', user.id)
      .single();

    if (profile) {
      setExpectedIncome(profile.monthly_budget?.toString() || '0');
    }

    // Загружаем обязательные платежи
    const { data: recurringData } = await supabase
      .from('recurring_expenses')
      .select(`
        *,
        categories (
          name,
          icon
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (recurringData) {
      setRecurring(recurringData);
    }

    // Загружаем категории расходов для выбора
    const { data: cats } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .order('sort_order');

    if (cats) {
      setCategories(cats);
    }

    setLoading(false);
  };

  const saveIncome = async () => {
    setSavingIncome(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({ monthly_budget: parseFloat(expectedIncome) || 0 })
      .eq('id', user.id);

    setSavingIncome(false);

    if (error) {
      toast.error('Ошибка сохранения');
    } else {
      toast.success('Доход сохранён!');
    }
  };

  const addRecurring = async () => {
    if (!newName || !newAmount || !newCategoryId) {
      toast.error('Заполни название, сумму и категорию');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('recurring_expenses')
      .insert({
        user_id: user.id,
        category_id: newCategoryId,
        name: newName,
        amount: parseFloat(newAmount),
        day_of_month: newDay ? parseInt(newDay) : null,
      });

    if (error) {
      toast.error('Ошибка добавления');
    } else {
      toast.success('Платёж добавлен!');
      setNewName('');
      setNewAmount('');
      setNewCategoryId('');
      setNewDay('');
      setShowForm(false);
      await loadData();
    }
  };

  const deleteRecurring = async (id: string) => {
    const { error } = await supabase
      .from('recurring_expenses')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      toast.error('Ошибка удаления');
    } else {
      toast.success('Платёж удалён');
      await loadData();
    }
  };

  // Подсчёты
  const income = parseFloat(expectedIncome) || 0;
  const totalRecurring = recurring.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const remaining = income - totalRecurring;
  const remainingPercent = income > 0 ? (remaining / income) * 100 : 0;

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
        <h1 className="text-2xl font-bold"> Планирование месяца</h1>
        <p className="text-gray-400 text-sm mt-1">
          Укажи ожидаемый доход и обязательные платежи
        </p>
      </div>

      {/* Ожидаемый доход */}
      <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-2xl p-6 shadow-xl">
        <label className="text-green-100 text-sm mb-2 block"> Ожидаемый доход в этом месяце</label>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-green-200">₽</span>
            <input
              type="number"
              value={expectedIncome}
              onChange={(e) => setExpectedIncome(e.target.value)}
              className="w-full bg-green-900/50 border border-green-600 rounded-lg pl-12 pr-4 py-3 text-3xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-white"
            />
          </div>
          <button
            onClick={saveIncome}
            disabled={savingIncome}
            className="bg-white text-green-700 font-bold px-4 py-3 rounded-lg hover:bg-green-100 transition disabled:opacity-50"
          >
            <Save size={20} />
          </button>
        </div>
      </div>

      {/* Итоговая карточка */}
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calculator size={24} className="text-green-500" />
            <h2 className="text-lg font-semibold">Остаток на жизнь</h2>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Доход:</span>
            <span className="text-green-500 font-semibold">{formatCurrency(income)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Обязательные платежи:</span>
            <span className="text-red-500 font-semibold">-{formatCurrency(totalRecurring)}</span>
          </div>
          <div className="border-t border-gray-700 my-2"></div>
          <div className="flex justify-between items-center">
            <span className="text-gray-300 font-medium">Останется:</span>
            <span className={`text-2xl font-bold ${remaining >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatCurrency(remaining)}
            </span>
          </div>
        </div>

        {/* Прогресс-бар */}
        <div className="mt-4">
          <div className="w-full bg-gray-800 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                remainingPercent < 10 ? 'bg-red-500' : remainingPercent < 30 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, remainingPercent))}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-400 mt-1 text-right">
            {remainingPercent.toFixed(0)}% от дохода свободно
          </p>
        </div>
      </div>

      {/* Список обязательных платежей */}
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Обязательные платежи</h2>
          <button
            onClick={() => setShowForm(true)}
            className="bg-green-600 hover:bg-green-700 p-2 rounded-lg transition"
          >
            <Plus size={20} />
          </button>
        </div>

        {recurring.length === 0 ? (
          <p className="text-gray-400 text-center py-4">
            Нет обязательных платежей. Добавь первый!
          </p>
        ) : (
          <div className="space-y-2">
            {recurring.map((r) => {
              const Icon = CATEGORY_ICONS[r.categories?.name] || Package;
              return (
                <div key={r.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="bg-gray-700 p-2 rounded-lg">
                      <Icon size={20} className="text-gray-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{r.name}</p>
                      <p className="text-xs text-gray-400">
                        {r.categories?.name}
                        {r.day_of_month && ` • ${r.day_of_month}-го числа`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-500 font-bold whitespace-nowrap">
                      -{formatCurrency(r.amount)}
                    </span>
                    <button
                      onClick={() => deleteRecurring(r.id)}
                      className="text-gray-400 hover:text-red-500 p-1 transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Модальное окно добавления платежа */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-lg p-6 space-y-4 border border-gray-700">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">Новый обязательный платёж</h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Название *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Например: Кредит Сбербанк"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Сумма *</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">₽</span>
                <input
                  type="number"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  placeholder="0"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Категория *</label>
              <select
                value={newCategoryId}
                onChange={(e) => setNewCategoryId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Выбери категорию</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">День месяца (необязательно)</label>
              <input
                type="number"
                min="1"
                max="31"
                value={newDay}
                onChange={(e) => setNewDay(e.target.value)}
                placeholder="Например: 15"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <button
              onClick={addRecurring}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition"
            >
              Добавить платёж
            </button>
          </div>
        </div>
      )}
    </div>
  );
}