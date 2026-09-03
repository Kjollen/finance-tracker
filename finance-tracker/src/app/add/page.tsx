'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import { ArrowLeft, Package, CreditCard, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const CATEGORY_ICONS: { [key: string]: string } = {
  'Еда': '🍔', 'Транспорт': '🚗', 'Жилье': '🏠', 'Развлечения': '🎮',
  'Покупки': '🛒', 'Здоровье': '💊', 'Образование': '', 'Подарки': '🎁',
  'Связь': '📱', 'ЖКХ': '💡', 'Питомцы': '🐾', 'Кафе': '☕',
  'Одежда': '👕', 'Красота': '', 'Спорт': '🏋️', 'Путешествия': '✈️',
  'Подписки': '📺', 'Платежи по кредитам': '💳', 'Платежи по кредитным картам': '💳',
  'Зарплата': '💰', 'Фриланс': '💸', 'Подработка': '🎯', 'Инвестиции': '📈',
  'Авито продажи': '📦', 'Продажи бижутерии': '💍', 'Подарок': '🎁',
  'Возврат': '↩️', 'Другое': '📦',
};

export default function AddTransactionPage() {
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [categories, setCategories] = useState<any[]>([]);
  const [creditCards, setCreditCards] = useState<any[]>([]);
  const [sourceType, setSourceType] = useState<'main' | 'credit_card'>('main');
  const [selectedCardId, setSelectedCardId] = useState('');
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadCategories();
    loadCreditCards();
  }, [type]);

  const loadCategories = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', type)
      .order('sort_order');

    if (data) {
      setCategories(data);
      if (data.length > 0 && !categoryId) {
        setCategoryId(data[0].id);
      }
    }
  };

  const loadCreditCards = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('credit_cards')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (data) {
      setCreditCards(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || !categoryId) {
      toast.error('Заполни все обязательные поля');
      return;
    }

    if (type === 'expense' && sourceType === 'credit_card' && !selectedCardId) {
      toast.error('Выбери кредитную карту');
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Не авторизован');
      setLoading(false);
      return;
    }

    const transactionAmount = type === 'expense' ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount));

    // 1. Создаём транзакцию
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        category_id: categoryId,
        amount: transactionAmount,
        note: note || null,
        date: date,
        source_type: type === 'expense' ? sourceType : 'main',
        credit_card_id: (type === 'expense' && sourceType === 'credit_card') ? selectedCardId : null,
      });

    // 2. Если расход с кредитки — увеличиваем долг
    if (!txError && type === 'expense' && sourceType === 'credit_card' && selectedCardId) {
      const { data: card } = await supabase
        .from('credit_cards')
        .select('current_debt')
        .eq('id', selectedCardId)
        .single();

      if (card) {
        const newDebt = (parseFloat(card.current_debt) || 0) + Math.abs(parseFloat(amount));
        await supabase
          .from('credit_cards')
          .update({ current_debt: newDebt })
          .eq('id', selectedCardId);
      }
    }

    // 3. Если расход с основного + выбрана карта = ПОГАШЕНИЕ КРЕДИТКИ
    if (!txError && type === 'expense' && sourceType === 'main' && selectedCardId) {
      const { data: card } = await supabase
        .from('credit_cards')
        .select('current_debt')
        .eq('id', selectedCardId)
        .single();

      if (card) {
        const newDebt = Math.max(0, (parseFloat(card.current_debt) || 0) - Math.abs(parseFloat(amount)));
        await supabase
          .from('credit_cards')
          .update({ current_debt: newDebt })
          .eq('id', selectedCardId);
      }
    }

    // 4. Если доход на кредитку (возврат) — уменьшаем долг
    if (!txError && type === 'income' && sourceType === 'credit_card' && selectedCardId) {
      const { data: card } = await supabase
        .from('credit_cards')
        .select('current_debt')
        .eq('id', selectedCardId)
        .single();

      if (card) {
        const newDebt = Math.max(0, (parseFloat(card.current_debt) || 0) - Math.abs(parseFloat(amount)));
        await supabase
          .from('credit_cards')
          .update({ current_debt: newDebt })
          .eq('id', selectedCardId);
      }
    }

    setLoading(false);

    if (txError) {
      toast.error('Ошибка: ' + txError.message);
    } else {
      toast.success('Транзакция добавлена!');
      if (type === 'expense' && sourceType === 'main' && selectedCardId) {
        toast.success(`Долг по карте уменьшен на ${formatCurrency(parseFloat(amount))}`);
      }
      setTimeout(() => {
        router.push('/');
      }, 1000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      <Toaster richColors position="top-center" />
      
      <div className="flex items-center mb-6 mt-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-800 rounded-lg transition">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold ml-4">Новая транзакция</h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg mx-auto space-y-6">
        {/* Доход/Расход */}
        <div className="bg-gray-900 rounded-xl p-1 flex">
          <button
            type="button"
            onClick={() => { setType('expense'); setCategoryId(''); }}
            className={`flex-1 py-3 rounded-lg font-semibold transition ${
              type === 'expense' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Расход
          </button>
          <button
            type="button"
            onClick={() => { setType('income'); setCategoryId(''); }}
            className={`flex-1 py-3 rounded-lg font-semibold transition ${
              type === 'income' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Доход
          </button>
        </div>

        {/* Сумма */}
        <div className="bg-gray-900 rounded-xl p-6">
          <label className="block text-sm text-gray-400 mb-2">Сумма *</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-gray-400">₽</span>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-12 pr-4 py-4 text-3xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              autoFocus
            />
          </div>
        </div>

        {/* Источник оплаты (только для расходов) */}
        {type === 'expense' && (
          <div className="bg-gray-900 rounded-xl p-6">
            <label className="block text-sm text-gray-400 mb-3">Откуда платим? *</label>
            <div className="space-y-3">
              {/* Основной счёт */}
              <button
                type="button"
                onClick={() => { setSourceType('main'); setSelectedCardId(''); }}
                className={`w-full p-4 rounded-xl border-2 transition flex items-center gap-3 ${
                  sourceType === 'main'
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <Wallet size={24} className={sourceType === 'main' ? 'text-green-500' : 'text-gray-400'} />
                <div className="text-left flex-1">
                  <p className="font-semibold">Основной счёт</p>
                  <p className="text-xs text-gray-400">Твои деньги, влияет на бюджет</p>
                </div>
              </button>

              {/* Кредитные карты */}
              {creditCards.map((card) => {
                const available = parseFloat(card.credit_limit) - parseFloat(card.current_debt);
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => { setSourceType('credit_card'); setSelectedCardId(card.id); }}
                    className={`w-full p-4 rounded-xl border-2 transition flex items-center gap-3 ${
                      sourceType === 'credit_card' && selectedCardId === card.id
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <CreditCard size={24} className={
                      sourceType === 'credit_card' && selectedCardId === card.id
                        ? 'text-blue-500' : 'text-gray-400'
                    } />
                    <div className="text-left flex-1">
                      <p className="font-semibold">{card.name}</p>
                      <p className="text-xs text-gray-400">
                        Доступно: {new Intl.NumberFormat('ru-RU').format(available)} ₽
                      </p>
                    </div>
                  </button>
                );
              })}

              {creditCards.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-2">
                  Нет кредитных карт. Добавь в разделе "Карты"
                </p>
              )}
            </div>

            {/* Если выбран основной счёт — показать опцию погашения кредитки */}
            {sourceType === 'main' && creditCards.length > 0 && (
              <div className="mt-4 p-4 bg-blue-900/20 border border-blue-700 rounded-xl">
                <label className="block text-sm text-blue-300 mb-2">
                  💳 Погасить долг по кредитке? (необязательно)
                </label>
                <select
                  value={selectedCardId}
                  onChange={(e) => setSelectedCardId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Нет, просто расход</option>
                  {creditCards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name} (долг: {new Intl.NumberFormat('ru-RU').format(card.current_debt)} ₽)
                    </option>
                  ))}
                </select>
                <p className="text-xs text-blue-400 mt-2">
                  Если выберешь карту — долг уменьшится на эту сумму
                </p>
              </div>
            )}
          </div>
        )}

        {/* Категории */}
        <div className="bg-gray-900 rounded-xl p-6">
          <label className="block text-sm text-gray-400 mb-3">Категория *</label>
          <div className="grid grid-cols-3 gap-3">
            {categories.map((cat) => {
              const icon = CATEGORY_ICONS[cat.name] || '📦';
              const isSelected = categoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryId(cat.id)}
                  className={`p-4 rounded-xl border-2 transition flex flex-col items-center ${
                    isSelected
                      ? type === 'expense'
                        ? 'border-red-500 bg-red-500/10'
                        : 'border-green-500 bg-green-500/10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <span className="text-2xl mb-2">{icon}</span>
                  <span className="text-sm text-center">{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Заметка */}
        <div className="bg-gray-900 rounded-xl p-6">
          <label className="block text-sm text-gray-400 mb-2">Заметка (необязательно)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Например: продукты на неделю"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Дата */}
        <div className="bg-gray-900 rounded-xl p-6">
          <label className="block text-sm text-gray-400 mb-2">Дата</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Кнопка сохранения */}
        <button
          type="submit"
          disabled={loading || !amount || !categoryId}
          className={`w-full py-4 rounded-xl font-bold text-lg transition ${
            loading || !amount || !categoryId
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : type === 'expense'
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {loading ? 'Сохранение...' : 'Сохранить'}
        </button>
      </form>
    </div>
  );
}