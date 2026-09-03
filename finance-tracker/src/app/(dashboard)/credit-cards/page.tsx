'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { Plus, Trash2, CreditCard, AlertCircle, CheckCircle } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function CreditCardsPage() {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  // Форма добавления
  const [newName, setNewName] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [newDebt, setNewDebt] = useState('');
  const [newDueDate, setNewDueDate] = useState('');

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('credit_cards')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Ошибка загрузки карт');
    } else {
      setCards(data || []);
    }
    setLoading(false);
  };

  const addCard = async () => {
    if (!newName || !newLimit) {
      toast.error('Заполни название и лимит');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('credit_cards')
      .insert({
        user_id: user.id,
        name: newName,
        credit_limit: parseFloat(newLimit),
        current_debt: parseFloat(newDebt) || 0,
        due_date: newDueDate ? parseInt(newDueDate) : null,
      });

    if (error) {
      toast.error('Ошибка добавления');
    } else {
      toast.success('Карта добавлена!');
      setNewName('');
      setNewLimit('');
      setNewDebt('');
      setNewDueDate('');
      setShowForm(false);
      await loadCards();
    }
  };

  const deleteCard = async (id: string) => {
    if (!confirm('Удалить эту карту?')) return;

    const { error } = await supabase
      .from('credit_cards')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      toast.error('Ошибка удаления');
    } else {
      toast.success('Карта удалена');
      await loadCards();
    }
  };

  const updateDebt = async (id: string, newDebt: number) => {
    const { error } = await supabase
      .from('credit_cards')
      .update({ current_debt: newDebt })
      .eq('id', id);

    if (error) {
      toast.error('Ошибка обновления');
    } else {
      await loadCards();
    }
  };

  // Подсчёты
  const totalLimit = cards.reduce((sum, c) => sum + (parseFloat(c.credit_limit) || 0), 0);
  const totalDebt = cards.reduce((sum, c) => sum + (parseFloat(c.current_debt) || 0), 0);
  const totalAvailable = totalLimit - totalDebt;

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
        <h1 className="text-2xl font-bold">Кредитные карты</h1>
        <p className="text-gray-400 text-sm mt-1">
          Учёт лимитов и задолженности
        </p>
      </div>

      {/* Общая сводка */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-xs text-gray-400 mb-1">Общий лимит</p>
          <p className="text-lg font-bold text-blue-500">{formatCurrency(totalLimit)}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-xs text-gray-400 mb-1">Долг</p>
          <p className="text-lg font-bold text-red-500">{formatCurrency(totalDebt)}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-xs text-gray-400 mb-1">Доступно</p>
          <p className="text-lg font-bold text-green-500">{formatCurrency(totalAvailable)}</p>
        </div>
      </div>

      {/* Список карт */}
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Мои карты</h2>
          <button
            onClick={() => setShowForm(true)}
            className="bg-green-600 hover:bg-green-700 p-2 rounded-lg transition"
          >
            <Plus size={20} />
          </button>
        </div>

        {cards.length === 0 ? (
          <p className="text-gray-400 text-center py-4">
            Нет кредитных карт. Добавь первую!
          </p>
        ) : (
          <div className="space-y-3">
            {cards.map((card) => {
              const available = parseFloat(card.credit_limit) - parseFloat(card.current_debt);
              const usagePercent = (parseFloat(card.current_debt) / parseFloat(card.credit_limit)) * 100;
              
              return (
                <div key={card.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-500/10 p-2 rounded-lg">
                        <CreditCard size={24} className="text-blue-500" />
                      </div>
                      <div>
                        <p className="font-bold text-lg">{card.name}</p>
                        {card.due_date && (
                          <p className="text-xs text-gray-400">
                            Платёж до {card.due_date}-го числа
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteCard(card.id)}
                      className="text-gray-400 hover:text-red-500 p-2 transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Прогресс использования */}
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Использовано</span>
                      <span className={usagePercent > 80 ? 'text-red-500' : 'text-gray-300'}>
                        {usagePercent.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(100, usagePercent)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Детали */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-gray-400">Лимит</p>
                      <p className="font-semibold text-blue-500">{formatCurrency(card.credit_limit)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Долг</p>
                      <p className="font-semibold text-red-500">{formatCurrency(card.current_debt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Доступно</p>
                      <p className={`font-semibold ${available > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatCurrency(available)}
                      </p>
                    </div>
                  </div>

                  {/* Быстрое обновление долга */}
                  <div className="mt-3 flex gap-2">
                    <input
                      type="number"
                      placeholder="Новый долг"
                      className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = parseFloat((e.target as HTMLInputElement).value);
                          if (!isNaN(val)) {
                            updateDebt(card.id, val);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        const input = (e: any) => {
                          const val = parseFloat((e.target as HTMLInputElement).value);
                          if (!isNaN(val)) {
                            updateDebt(card.id, val);
                          }
                        };
                      }}
                      className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg text-sm font-medium transition"
                    >
                      Обновить
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Модальное окно добавления карты */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-lg p-6 space-y-4 border border-gray-700">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">Новая кредитная карта</h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Название карты *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Например: Сбербанк Mastercard"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Кредитный лимит *</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">₽</span>
                <input
                  type="number"
                  value={newLimit}
                  onChange={(e) => setNewLimit(e.target.value)}
                  placeholder="100000"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Текущий долг</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">₽</span>
                <input
                  type="number"
                  value={newDebt}
                  onChange={(e) => setNewDebt(e.target.value)}
                  placeholder="0"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">День платежа (необязательно)</label>
              <input
                type="number"
                min="1"
                max="31"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                placeholder="Например: 25"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <button
              onClick={addCard}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition"
            >
              Добавить карту
            </button>
          </div>
        </div>
      )}
    </div>
  );
}