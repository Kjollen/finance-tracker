'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LayoutDashboard, Wallet, PieChart, TrendingUp, LogOut, Calendar, CreditCard } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
      } else {
        setLoading(false);
      }
    };
    checkUser();
  }, [router, supabase.auth]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  const navItems = [
    { href: '/', icon: LayoutDashboard, label: 'Дашборд' },
    { href: '/transactions', icon: Wallet, label: 'Транзакции' },
    { href: '/planning', icon: Calendar, label: 'План' },
    { href: '/credit-cards', icon: CreditCard, label: 'Карты' },
    { href: '/analytics', icon: TrendingUp, label: 'Аналитика' },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-20">
      {children}
      
      {/* Нижняя навигация */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-4 py-2">
        <div className="max-w-lg mx-auto flex justify-around items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`flex flex-col items-center p-2 rounded-lg transition ${
                  isActive ? 'text-green-500' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon size={24} />
                <span className="text-xs mt-1">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={handleLogout}
            className="flex flex-col items-center p-2 rounded-lg transition text-gray-400 hover:text-red-500"
          >
            <LogOut size={24} />
            <span className="text-xs mt-1">Выход</span>
          </button>
        </div>
      </nav>
    </div>
  );
}