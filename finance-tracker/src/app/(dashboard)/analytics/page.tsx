'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, TrendingDown, Calendar, PieChart as PieChartIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function AnalyticsPage() {
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const supabase = createClient();

  useEffect(() => {
    loadAnalytics();
  }, [selectedYear]);

  const loadAnalytics = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Загрузка транзакций за выбранный год
    const startDate = new Date(selectedYear, 0, 1).toISOString();
    const endDate = new Date(selectedYear, 11, 31, 23, 59, 59).toISOString();

    const { data: transactions, error } = await supabase
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
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) {
      console.error('Ошибка загрузки:', error);
      setLoading(false);
      return;
    }

    // Группировка по месяцам
    const monthlyStats: { [key: string]: { month: string; income: number; expense: number } } = {};
    const categoryStats: { [key: string]: { name: string; value: number; icon: string } } = {};

    transactions?.forEach(t => {
      const date = new Date(t.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('ru-RU', { month: 'short' });

      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = { month: monthName, income: 0, expense: 0 };
      }

      if (t.amount > 0) {
        monthlyStats[monthKey].income += t.amount;
      } else {
        monthlyStats[monthKey].expense += Math.abs(t.amount);
        
        const catName = t.categories?.name || 'Другое';
        const icon = t.categories?.icon || '';
        if (!categoryStats[catName]) {
          categoryStats[catName] = { name: catName, value: 0, icon };
        }
        categoryStats[catName].value += Math.abs(t.amount);
      }
    });

    setMonthlyData(Object.values(monthlyStats));
    setCategoryData(Object.values(categoryStats).sort((a, b) => b.value - a.value));
    setLoading(false);
  };

  const totalIncome = monthlyData.reduce((sum, m) => sum + m.income, 0);
  const totalExpense = monthlyData.reduce((sum, m) => sum + m.expense, 0);
  const balance = totalIncome - totalExpense;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Заголовок */}
      <div className="mt-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Аналитика</h1>
          <p className="text-gray-400 text-sm mt-1">Статистика за {selectedYear} год</p>
        </div>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          {[2024, 2025, 2026].map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* Сводка */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-green-500" />
            <p className="text-xs text-gray-400">Доходы</p>
          </div>
          <p className="text-lg font-bold text-green-500">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={16} className="text-red-500" />
            <p className="text-xs text-gray-400">Расходы</p>
          </div>
          <p className="text-lg font-bold text-red-500">{formatCurrency(totalExpense)}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={16} className="text-blue-500" />
            <p className="text-xs text-gray-400">Баланс</p>
          </div>
          <p className={`text-lg font-bold ${balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {formatCurrency(balance)}
          </p>
        </div>
      </div>

      {/* График по месяцам */}
      {monthlyData.length > 0 && (
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar size={20} />
            Доходы и расходы по месяцам
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                />
                <Legend />
                <Bar dataKey="income" name="Доходы" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Расходы" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Круговая диаграмма по категориям */}
      {categoryData.length > 0 && (
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <PieChartIcon size={20} />
            Расходы по категориям
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Легенда */}
          <div className="mt-4 space-y-2">
            {categoryData.slice(0, 8).map((cat, index) => (
              <div key={cat.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  ></div>
                  <span className="text-gray-300">{cat.icon} {cat.name}</span>
                </div>
                <span className="font-semibold text-gray-400">{formatCurrency(cat.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {monthlyData.length === 0 && (
        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center">
          <Calendar size={48} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400">Нет данных за {selectedYear} год</p>
          <p className="text-sm text-gray-500 mt-2">Добавь транзакции, чтобы увидеть аналитику</p>
        </div>
      )}
    </div>
  );
}