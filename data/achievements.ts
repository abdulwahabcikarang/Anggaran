// FIX: Import GlobalTransaction type to resolve compilation error.
import type { AppState, FundTransaction, Transaction, SavingTransaction, GlobalTransaction } from '../types';
import type { Achievement } from '../types';

export const allAchievements: Achievement[] = [
    // --- Kategori: Dasar ---
    {
        id: 'first-transaction',
        name: 'Langkah Pertama',
        description: 'Mencatat transaksi pertama Anda.',
        icon: 'ShoppingCartIcon',
        category: 'Dasar',
        points: 10,
        condition: (state: AppState) => {
            const allTransactionsCount =
                state.fundHistory.length +
                state.dailyExpenses.length +
                state.budgets.reduce((sum, b) => sum + b.history.length, 0);
            return allTransactionsCount > 0;
        },
        progress: (state) => ({
            current: state.fundHistory.length + state.dailyExpenses.length + state.budgets.reduce((sum, b) => sum + b.history.length, 0),
            target: 1
        })
    },
    {
        id: 'first-budget',
        name: 'Perencana Andal',
        description: 'Membuat pos anggaran pertama.',
        icon: 'ListBulletIcon',
        category: 'Dasar',
        points: 10,
        condition: (state: AppState) => state.budgets.length > 0,
        progress: (state) => ({ current: state.budgets.length, target: 1 })
    },
    {
        id: 'first-saving-goal',
        name: 'Mimpi Besar',
        description: 'Membuat celengan (tujuan menabung) pertama.',
        icon: 'BuildingLibraryIcon',
        category: 'Dasar',
        points: 15,
        condition: (state: AppState) => state.savingsGoals.length > 0,
        progress: (state) => ({ current: state.savingsGoals.length, target: 1 })
    },
    {
        id: 'super-saver',
        name: 'Penabung Sejati',
        description: 'Berhasil mencapai target di salah satu celengan.',
        icon: 'TrophyIcon',
        category: 'Dasar',
        points: 50,
        condition: (state: AppState) => state.savingsGoals.some(g => g.isCompleted)
    },
    {
        id: 'over-budget',
        name: 'Belajar dari Kesalahan',
        description: 'Pengeluaran melebihi kuota di salah satu pos anggaran.',
        icon: 'LightbulbIcon',
        category: 'Dasar',
        points: 5,
        condition: (state: AppState) => {
            return state.budgets.some(b => {
                const used = b.history.reduce((sum, h) => sum + h.amount, 0);
                return b.totalBudget > 0 && used > b.totalBudget;
            });
        }
    },

    // --- Kategori: Kebiasaan Baik ---
    {
        id: 'daily-streak-7',
        name: 'Disiplin Harian',
        description: 'Dana harian tidak minus selama 7 hari berturut-turut.',
        icon: 'CalendarDaysIcon',
        category: 'Kebiasaan Baik',
        points: 25,
        condition: (state: AppState) => (state.achievementData?.dailyStreak ?? 0) >= 7,
        streakKey: 'dailyStreak',
        streakTarget: 7
    },
    {
        id: 'daily-streak-30',
        name: 'Master Harian',
        description: 'Dana harian tidak minus selama 30 hari berturut-turut.',
        icon: 'CalendarDaysIcon',
        category: 'Kebiasaan Baik',
        points: 75,
        condition: (state: AppState) => (state.achievementData?.dailyStreak ?? 0) >= 30,
        streakKey: 'dailyStreak',
        streakTarget: 30
    },
    {
        id: 'monthly-streak-14',
        name: 'Momentum Keuangan',
        description: 'Dana bulanan tidak minus selama 14 hari berturut-turut.',
        icon: 'ChartBarIcon',
        category: 'Kebiasaan Baik',
        points: 30,
        condition: (state: AppState) => (state.achievementData?.monthlyStreak ?? 0) >= 14,
        streakKey: 'monthlyStreak',
        streakTarget: 14
    },
    {
        id: 'monthly-streak-30',
        name: 'Pakar Anggaran',
        description: 'Dana bulanan tidak minus selama 30 hari berturut-turut.',
        icon: 'ChartBarIcon',
        category: 'Kebiasaan Baik',
        points: 80,
        condition: (state: AppState) => (state.achievementData?.monthlyStreak ?? 0) >= 30,
        streakKey: 'monthlyStreak',
        streakTarget: 30
    },
    {
        id: 'monthly-streak-90',
        name: 'Raja Keuangan',
        description: 'Dana bulanan tidak minus selama 90 hari berturut-turut.',
        icon: 'TrophyIcon',
        category: 'Kebiasaan Baik',
        points: 150,
        condition: (state: AppState) => (state.achievementData?.monthlyStreak ?? 0) >= 90,
        streakKey: 'monthlyStreak',
        streakTarget: 90
    },
    {
        id: 'no-spend-day',
        name: 'Hari Tanpa Belanja',
        description: 'Berhasil melewati satu hari tanpa transaksi pengeluaran.',
        icon: 'CalendarDaysIcon',
        category: 'Kebiasaan Baik',
        points: 15,
        condition: (state: AppState) => (state.achievementData?.noSpendStreak ?? 0) >= 1,
        streakKey: 'noSpendStreak',
        streakTarget: 1
    },
    {
        id: 'habit-app-open-7',
        name: 'Rutinitas Emas',
        description: 'Membuka aplikasi 7 hari berturut-turut.',
        icon: 'CalendarDaysIcon',
        category: 'Kebiasaan Baik',
        points: 20,
        condition: (state: AppState) => (state.achievementData?.appOpenStreak ?? 0) >= 7,
        streakKey: 'appOpenStreak',
        streakTarget: 7
    },
    {
        id: 'habit-app-open-30',
        name: 'Pengguna Berdedikasi',
        description: 'Membuka aplikasi 30 hari berturut-turut.',
        icon: 'CalendarDaysIcon',
        category: 'Kebiasaan Baik',
        points: 60,
        condition: (state: AppState) => (state.achievementData?.appOpenStreak ?? 0) >= 30,
        streakKey: 'appOpenStreak',
        streakTarget: 30
    },
    {
        id: 'habit-morning-person-5',
        name: 'Burung Pagi',
        description: 'Mencatat pengeluaran sebelum jam 12 siang selama 5 hari berturut-turut.',
        icon: 'SunIcon',
        category: 'Kebiasaan Baik',
        points: 25,
        condition: (state: AppState) => (state.achievementData?.morningTransactionStreak ?? 0) >= 5,
        streakKey: 'morningTransactionStreak',
        streakTarget: 5
    },
     {
        id: 'milestone-saving-marathon',
        name: 'Sprinter Tabungan',
        description: 'Menambah tabungan di celengan setiap hari selama satu minggu penuh.',
        icon: 'ArrowPathIcon',
        category: 'Kebiasaan Baik',
        points: 40,
        condition: (state: AppState) => (state.achievementData?.savingStreak ?? 0) >= 7,
        streakKey: 'savingStreak',
        streakTarget: 7
    },

    // --- Kategori: Master Anggaran ---
    {
        id: 'budget-master',
        name: 'Kolektor Pos',
        description: 'Memiliki 5 atau lebih pos anggaran.',
        icon: 'Squares2x2Icon',
        category: 'Master Anggaran',
        points: 20,
        condition: (state: AppState) => state.budgets.length >= 5,
        progress: (state) => ({ current: state.budgets.length, target: 5 })
    },
     {
        id: 'budget-portfolio-manager',
        name: 'Manajer Portofolio',
        description: 'Memiliki 10 atau lebih pos anggaran aktif.',
        icon: 'Squares2x2Icon',
        category: 'Master Anggaran',
        points: 40,
        condition: (state: AppState) => state.budgets.length >= 10,
        progress: (state) => ({ current: state.budgets.length, target: 10 })
    },
    {
        id: 'budget-all-surplus',
        name: 'Surplus di Mana-mana',
        description: 'Menyelesaikan bulan dengan sisa dana positif di semua pos anggaran.',
        icon: 'BanknotesIcon',
        category: 'Master Anggaran',
        points: 50,
        condition: (state: AppState) => {
            if (state.budgets.length === 0) return false;
            return state.budgets.every(b => {
                const used = b.history.reduce((sum, h) => sum + h.amount, 0);
                return (b.totalBudget - used) >= 0;
            });
        }
    },
    {
        id: 'budget-architect',
        name: 'Arsitek Keuangan',
        description: 'Mengalokasikan 100% pemasukan ke pos anggaran.',
        icon: 'BuildingLibraryIcon',
        category: 'Master Anggaran',
        points: 30,
        condition: (state: AppState) => {
            const monthlyIncome = state.fundHistory.filter(t => t.type === 'add').reduce((sum, t) => sum + t.amount, 0);
            if (monthlyIncome === 0) return false;
            const totalAllocated = state.budgets.reduce((sum, b) => sum + b.totalBudget, 0);
            return totalAllocated >= monthlyIncome;
        },
        progress: (state) => {
            const monthlyIncome = state.fundHistory.filter(t => t.type === 'add').reduce((sum, t) => sum + t.amount, 0);
            const totalAllocated = state.budgets.reduce((sum, b) => sum + b.totalBudget, 0);
            return { current: totalAllocated, target: monthlyIncome };
        }
    },
    {
        id: 'budget-emergency-fund',
        name: 'Benteng Pertahanan',
        description: 'Membuat pos "Dana Darurat" dengan kuota minimal Rp 1.000.000.',
        icon: 'ShieldCheckIcon',
        category: 'Master Anggaran',
        points: 60,
        condition: (state: AppState) => state.budgets.some(b => b.name.toLowerCase().includes('dana darurat') && b.totalBudget >= 1000000)
    },
     {
        id: 'finance-early-retirement',
        name: 'Visioner Masa Depan',
        description: 'Membuat pos anggaran dengan nama "Pensiun" atau "Dana Hari Tua".',
        icon: 'RocketLaunchIcon',
        category: 'Master Anggaran',
        points: 25,
        condition: (state: AppState) => state.budgets.some(b => b.name.toLowerCase().includes('pensiun') || b.name.toLowerCase().includes('hari tua'))
    },
    {
        id: 'finance-no-leaks',
        name: 'Keran Tertutup Rapat',
        description: 'Pengeluaran umum/harian kurang dari 5% total pengeluaran bulanan.',
        icon: 'LockClosedIcon',
        category: 'Master Anggaran',
        points: 40,
        condition: (state: AppState) => {
            const totalUsedFromPosts = state.budgets.reduce((sum, b) => sum + b.history.reduce((s, h) => s + h.amount, 0), 0);
            const totalDailySpent = state.dailyExpenses.reduce((sum, e) => sum + e.amount, 0);
            const monthlyGeneralExpense = state.fundHistory.filter(t => t.type === 'remove').reduce((sum, t) => sum + t.amount, 0);
            const totalUsedOverall = monthlyGeneralExpense + totalUsedFromPosts + totalDailySpent;
            if (totalUsedOverall === 0) return false;
            const generalAndDaily = totalDailySpent + monthlyGeneralExpense;
            return (generalAndDaily / totalUsedOverall) < 0.05;
        }
    },
    
    // --- Kategori: Tantangan ---
    {
        id: 'challenge-survival-mode',
        name: 'Mode Survival',
        description: 'Menghabiskan kurang dari Rp 50.000 dalam satu hari.',
        icon: 'FireIcon',
        category: 'Tantangan',
        points: 20,
        condition: (state: AppState) => {
            const allExpensesByDay: { [key: string]: number } = {};
            const allExpenses: (Transaction | FundTransaction)[] = [...state.fundHistory.filter(t => t.type === 'remove'), ...state.dailyExpenses, ...state.budgets.flatMap(b => b.history), ...state.archives.flatMap(a => a.transactions.filter(t => t.type === 'remove'))];
            allExpenses.forEach(t => {
                const dayKey = new Date(t.timestamp).toISOString().slice(0, 10);
                if (!allExpensesByDay[dayKey]) allExpensesByDay[dayKey] = 0;
                allExpensesByDay[dayKey] += t.amount;
            });
            return Object.values(allExpensesByDay).some(total => total > 0 && total < 50000);
        }
    },
    {
        id: 'milestone-millionaire',
        name: 'Klub Jutawan',
        description: 'Total aset (dana umum) berhasil mencapai Rp 1.000.000.',
        icon: 'TrophyIcon',
        category: 'Tantangan',
        points: 80,
        condition: (state: AppState) => {
            const allTxns: GlobalTransaction[] = [...state.fundHistory, ...state.archives.flatMap(a => a.transactions)];
            const totalAsset = allTxns.reduce((sum, t) => t.type === 'add' ? sum + t.amount : sum - t.amount, 0);
            return totalAsset >= 1000000;
        },
        progress: (state) => {
             const allTxns: GlobalTransaction[] = [...state.fundHistory, ...state.archives.flatMap(a => a.transactions)];
            const totalAsset = allTxns.reduce((sum, t) => t.type === 'add' ? sum + t.amount : sum - t.amount, 0);
            return { current: totalAsset, target: 1000000 };
        }
    },
    {
        id: 'milestone-safe-finish',
        name: 'Garis Finis Kuat',
        description: 'Tidak ada pengeluaran sama sekali di 3 hari terakhir bulan.',
        icon: 'FlagIcon',
        category: 'Tantangan',
        points: 35,
        condition: (state: AppState) => {
            const today = new Date();
            const year = today.getFullYear();
            const month = today.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            if (today.getDate() < daysInMonth - 2) return false;

            const allExpenses: (Transaction | FundTransaction)[] = [...state.fundHistory.filter(t => t.type === 'remove'), ...state.dailyExpenses, ...state.budgets.flatMap(b => b.history)];
            for (let i = 0; i < 3; i++) {
                const dayToCheck = daysInMonth - i;
                const hasExpense = allExpenses.some(t => {
                    const d = new Date(t.timestamp);
                    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === dayToCheck;
                });
                if (hasExpense) return false;
            }
            return true;
        }
    },
    {
        id: 'habit-perfect-month',
        name: 'Pencatat Sempurna',
        description: 'Mencatat transaksi setiap hari dalam satu bulan penuh.',
        icon: 'DocumentTextIcon',
        category: 'Tantangan',
        points: 100,
        condition: (state: AppState) => {
            const allTxnsByMonth: { [key: string]: Set<number> } = {};
            const allTxns: (Transaction | FundTransaction | SavingTransaction)[] = [
                ...state.fundHistory, ...state.dailyExpenses,
                ...state.budgets.flatMap(b => b.history), ...state.savingsGoals.flatMap(g => g.history),
                ...state.archives.flatMap(a => a.transactions)
            ];
            allTxns.forEach(t => {
                const date = new Date(t.timestamp);
                const monthKey = date.toISOString().slice(0, 7);
                if (!allTxnsByMonth[monthKey]) allTxnsByMonth[monthKey] = new Set();
                allTxnsByMonth[monthKey].add(date.getDate());
            });
            for (const monthKey in allTxnsByMonth) {
                const [year, month] = monthKey.split('-').map(Number);
                const daysInMonth = new Date(year, month, 0).getDate();
                if (allTxnsByMonth[monthKey].size === daysInMonth) return true;
            }
            return false;
        }
    },
    {
        id: 'habit-no-impulse-buy',
        name: 'Pikiran Tenang',
        description: 'Tidak ada pengeluaran "Hiburan" atau "Jajan" di akhir pekan.',
        icon: 'HeartIcon',
        category: 'Tantangan',
        points: 25,
        condition: (state: AppState) => {
            const impulseCategories = ['hiburan', 'jajan'];
            return !state.budgets.some(b => {
                if (impulseCategories.includes(b.name.toLowerCase())) {
                    return b.history.some(h => {
                        const day = new Date(h.timestamp).getDay();
                        return day === 0 || day === 6; // Sunday or Saturday
                    });
                }
                return false;
            });
        }
    },
     {
        id: 'finance-no-subscription',
        name: 'Bebas Komitmen',
        description: 'Melewati satu bulan tanpa pengeluaran "Langganan".',
        icon: 'ScissorsIcon',
        category: 'Tantangan',
        points: 30,
        condition: (state: AppState) => {
            const subscriptionBudget = state.budgets.find(b => b.name.toLowerCase().includes('langganan'));
            return !!subscriptionBudget && subscriptionBudget.history.length === 0;
        }
    },
    {
        id: 'event-new-year-resolution',
        name: 'Resolusi Tahun Baru',
        description: 'Membuat celengan baru di bulan Januari.',
        icon: 'RocketLaunchIcon',
        category: 'Tantangan',
        points: 50,
        isTimeLimited: true,
        condition: (state: AppState) => {
            const today = new Date();
            if (today.getMonth() !== 0) return false; // 0 = January
            return state.savingsGoals.some(goal => new Date(goal.createdAt).getMonth() === 0 && new Date(goal.createdAt).getFullYear() === today.getFullYear());
        },
    },
    {
        id: 'event-independence-day-saver',
        name: 'Pejuang Kemerdekaan Finansial',
        description: 'Menabung minimal Rp 170.845 di bulan Agustus.',
        icon: 'FlagIcon',
        category: 'Tantangan',
        points: 50,
        isTimeLimited: true,
        condition: (state: AppState) => {
            const today = new Date();
            if (today.getMonth() !== 7) return false; // 7 = August
            const augustSavings = state.savingsGoals
                .flatMap(g => g.history)
                .filter(h => {
                    const d = new Date(h.timestamp);
                    return d.getMonth() === 7 && d.getFullYear() === today.getFullYear()
                })
                .reduce((sum, h) => sum + h.amount, 0);
            return augustSavings >= 170845;
        },
        progress: (state) => {
            const today = new Date();
            const augustSavings = state.savingsGoals
                .flatMap(g => g.history)
                .filter(h => {
                    const d = new Date(h.timestamp);
                    return d.getMonth() === 7 && d.getFullYear() === today.getFullYear()
                })
                .reduce((sum, h) => sum + h.amount, 0);
            return { current: augustSavings, target: 170845 };
        }
    },

    // --- Kategori: Eksplorasi ---
    {
        id: 'finance-discount-hunter',
        name: 'Jeli Melihat Peluang',
        description: 'Mencatat 5 transaksi dengan kata "diskon", "cashback", atau "promo".',
        icon: 'MagnifyingGlassIcon',
        category: 'Eksplorasi',
        points: 15,
        condition: (state: AppState) => {
            const keywords = ['diskon', 'cashback', 'promo'];
            const allTxns: (Transaction | FundTransaction)[] = [...state.fundHistory, ...state.dailyExpenses, ...state.budgets.flatMap(b => b.history)];
            const count = allTxns.filter(t => keywords.some(k => t.desc.toLowerCase().includes(k))).length;
            return count >= 5;
        },
        progress: (state) => {
            const keywords = ['diskon', 'cashback', 'promo'];
            const allTxns: (Transaction | FundTransaction)[] = [...state.fundHistory, ...state.dailyExpenses, ...state.budgets.flatMap(b => b.history)];
            const count = allTxns.filter(t => keywords.some(k => t.desc.toLowerCase().includes(k))).length;
            return { current: count, target: 5 };
        }
    },
    {
        id: 'finance-multiple-incomes',
        name: 'Mesin Uang',
        description: 'Memiliki 3 atau lebih sumber pemasukan berbeda dalam satu bulan.',
        icon: 'BanknotesIcon',
        category: 'Eksplorasi',
        points: 45,
        condition: (state: AppState) => state.fundHistory.filter(t => t.type === 'add').length >= 3,
        progress: (state) => ({ current: state.fundHistory.filter(t => t.type === 'add').length, target: 3 })
    },
    {
        id: 'explore-icon-artist',
        name: 'Seniman Anggaran',
        description: 'Menggunakan 10 ikon yang berbeda untuk pos-pos anggaran Anda.',
        icon: 'PaintBrushIcon',
        category: 'Eksplorasi',
        points: 20,
        condition: (state: AppState) => {
            const uniqueIcons = new Set(state.budgets.map(b => b.icon).filter(Boolean));
            return uniqueIcons.size >= 10;
        },
        progress: (state) => {
            const uniqueIcons = new Set(state.budgets.map(b => b.icon).filter(Boolean));
            return { current: uniqueIcons.size, target: 10 };
        }
    }
];