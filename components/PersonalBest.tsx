import React, { useMemo } from 'react';
import type { AppState, GlobalTransaction, Budget, SavingTransaction } from '../types';
import { TrophyIcon, BuildingLibraryIcon, ShieldCheckIcon } from './Icons';

interface PersonalBestProps {
    state: AppState;
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

const formatMonth = (monthStr: string) => {
    if (!monthStr || !monthStr.includes('-')) return "Invalid Date";
    const [year, month] = monthStr.split('-');
    return new Date(Number(year), Number(month) - 1).toLocaleDateString('id-ID', {
        month: 'long',
        year: 'numeric',
    });
};

const RankingCard: React.FC<{
    title: string;
    icon: React.FC<{ className?: string }>;
    data: { month: string; value: any }[];
    valueFormatter: (value: any) => string;
    valueLabel: string;
}> = ({ title, icon: Icon, data, valueFormatter, valueLabel }) => {
    const medalColors = ['text-yellow-500', 'text-gray-400', 'text-yellow-600'];
    const medals = ['🥇', '🥈', '🥉'];

    return (
        <section className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center space-x-3 mb-4">
                <Icon className="w-8 h-8 text-primary-navy" />
                <h2 className="text-xl font-bold text-primary-navy">{title}</h2>
            </div>
            {data.length === 0 ? (
                <p className="text-center text-secondary-gray py-4">Belum ada data yang cukup untuk ditampilkan.</p>
            ) : (
                <ul className="space-y-3">
                    {data.map((item, index) => (
                        <li key={item.month} className={`flex items-center space-x-4 p-3 rounded-lg ${index === 0 ? 'bg-primary-navy text-white' : 'bg-gray-50'}`}>
                            <span className={`text-2xl font-bold w-8 text-center ${index < 3 ? medalColors[index] : 'text-secondary-gray'}`}>
                                {index < 3 ? medals[index] : `#${index + 1}`}
                            </span>
                            <div className="flex-grow">
                                <p className={`font-bold ${index === 0 ? 'text-white' : 'text-dark-text'}`}>{formatMonth(item.month)}</p>
                                <p className={`text-sm ${index === 0 ? 'text-gray-200' : 'text-secondary-gray'}`}>{valueLabel}: {valueFormatter(item.value)}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
};


const PersonalBest: React.FC<PersonalBestProps> = ({ state }) => {
    const rankings = useMemo(() => {
        const dataByMonth: { 
            [month: string]: { 
                totalSpending: number; 
                totalSavings: number; 
                budgetSpending: { [budgetName: string]: { spent: number; total: number } };
            } 
        } = {};

        // Aggregate all transactions with timestamps
        const allTransactions: GlobalTransaction[] = [];
        state.archives.forEach(archive => allTransactions.push(...archive.transactions));
        allTransactions.push(...state.fundHistory);
        allTransactions.push(...state.dailyExpenses.map(t => ({...t, type: 'remove' as const, category: t.sourceCategory || 'Harian' })));
        state.budgets.forEach(b => {
            allTransactions.push(...b.history.map(h => ({ ...h, type: 'remove' as const, category: b.name })));
        });

        const allSavingsTransactions: SavingTransaction[] = state.savingsGoals.flatMap(g => g.history);

        // Process all transactions
        allTransactions.forEach(t => {
            const month = new Date(t.timestamp).toISOString().slice(0, 7);
            if (!dataByMonth[month]) {
                dataByMonth[month] = { totalSpending: 0, totalSavings: 0, budgetSpending: {} };
            }
            if (t.type === 'remove') {
                dataByMonth[month].totalSpending += t.amount;
            }
            if (t.category) {
                const currentBudget = state.budgets.find(b => b.name === t.category);
                if (currentBudget) {
                     if (!dataByMonth[month].budgetSpending[t.category]) {
                        dataByMonth[month].budgetSpending[t.category] = { spent: 0, total: currentBudget.totalBudget };
                    }
                    dataByMonth[month].budgetSpending[t.category].spent += t.amount;
                }
            }
        });

        // Process savings
        allSavingsTransactions.forEach(t => {
            const month = new Date(t.timestamp).toISOString().slice(0, 7);
            if (!dataByMonth[month]) {
                dataByMonth[month] = { totalSpending: 0, totalSavings: 0, budgetSpending: {} };
            }
            dataByMonth[month].totalSavings += t.amount;
        });
        
        // Final calculation and ranking
        const monthlyStats = Object.keys(dataByMonth).map(month => {
            const monthData = dataByMonth[month];
            let disciplinedCount = 0;
            const budgetDetails = monthData.budgetSpending;
            const totalBudgetsInMonth = Object.keys(budgetDetails).length;

            Object.keys(budgetDetails).forEach(budgetName => {
                const { spent, total } = budgetDetails[budgetName];
                if (total > 0 && spent <= total) {
                    disciplinedCount++;
                }
            });
            return {
                month,
                spending: monthData.totalSpending,
                savings: monthData.totalSavings,
                discipline: disciplinedCount,
                totalBudgetsInMonth,
            };
        });

        // Sort for rankings
        const spendingRanking = [...monthlyStats]
            .filter(m => m.spending > 0)
            .sort((a, b) => a.spending - b.spending)
            .map(m => ({ month: m.month, value: m.spending }))
            .slice(0, 5);

        const savingsRanking = [...monthlyStats]
            .filter(m => m.savings > 0)
            .sort((a, b) => b.savings - a.savings)
            .map(m => ({ month: m.month, value: m.savings }))
            .slice(0, 5);
        
        const disciplineRanking = [...monthlyStats]
            .filter(m => m.totalBudgetsInMonth > 0)
            .sort((a, b) => b.discipline - a.discipline)
            .map(m => ({ month: m.month, value: m.discipline }))
            .slice(0, 5);

        return { spendingRanking, savingsRanking, disciplineRanking };
    }, [state]);

    if (rankings.spendingRanking.length < 2 && rankings.savingsRanking.length < 2 && rankings.disciplineRanking.length < 2) {
        return (
            <main className="p-4 pb-24 animate-fade-in text-center">
                <h1 className="text-3xl font-bold text-primary-navy text-center mb-6">Pencapaian Terbaik Pribadi</h1>
                <div className="bg-white rounded-xl shadow-md p-8 mt-6">
                    <TrophyIcon className="w-20 h-20 mx-auto text-secondary-gray opacity-50" />
                    <h2 className="mt-4 text-xl font-bold text-dark-text">Data Belum Cukup</h2>
                    <p className="mt-2 text-secondary-gray max-w-xs mx-auto">
                        Terus gunakan aplikasi setidaknya selama dua bulan untuk melihat perbandingan dan pencapaian terbaik Anda di sini.
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="p-4 pb-24 animate-fade-in space-y-6">
            <h1 className="text-3xl font-bold text-primary-navy text-center">Pencapaian Terbaik Pribadi</h1>
            
            <RankingCard
                title="Bulan Paling Hemat"
                icon={ShieldCheckIcon}
                data={rankings.spendingRanking}
                valueFormatter={formatCurrency}
                valueLabel="Total Pengeluaran"
            />
            
            <RankingCard
                title="Bulan Menabung Terbanyak"
                icon={BuildingLibraryIcon}
                data={rankings.savingsRanking}
                valueFormatter={formatCurrency}
                valueLabel="Total Tabungan"
            />

            <RankingCard
                title="Bulan Paling Disiplin"
                icon={TrophyIcon}
                data={rankings.disciplineRanking}
                valueFormatter={(value) => `${value} Pos Anggaran`}
                valueLabel="Pos Sesuai Anggaran"
            />
        </main>
    );
};

export default PersonalBest;
