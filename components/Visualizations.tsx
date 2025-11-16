import React, { useState, useMemo, useEffect } from 'react';
import { 
    PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, 
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid 
} from 'recharts';
import { GoogleGenAI } from '@google/genai';
import type { AppState, Budget, GlobalTransaction } from '../types';
import { LightbulbIcon, SparklesIcon } from './Icons';

interface VisualizationsProps {
    state: AppState;
    onBack: () => void;
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
const formatShortCurrency = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)} Jt`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)} rb`;
    return amount;
};


const COLORS = ['#2C3E50', '#1ABC9C', '#F1C40F', '#E74C3C', '#3498DB', '#9B59B6', '#E67E22', '#7F8C8D'];

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
                <p className="font-semibold mb-1 text-dark-text">{label || payload[0].name}</p>
                {payload.map((pld: any, index: number) => (
                    <p key={index} style={{ color: pld.color || pld.fill }}>
                        {`${pld.name}: ${formatCurrency(pld.value)}`}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const formatMarkdown = (text: string) => {
    return text
        .split('\n')
        .map((line, index) => {
            if (line.trim().startsWith('* ')) {
                return <li key={index} className="ml-5 list-disc">{line.trim().substring(2)}</li>;
            }
            if (line.trim().startsWith('**') && line.trim().endsWith('**')) {
                return <p key={index} className="font-bold mt-2">{line.trim().replace(/\*\*/g, '')}</p>
            }
            return <p key={index}>{line}</p>;
        });
};


const AIAnalysisCard: React.FC<{
    title: string;
    analysis: string | null;
    isLoading: boolean;
    error: string | null;
}> = ({ title, analysis, isLoading, error }) => {
    return (
        <div className="mt-6 bg-blue-50 border-l-4 border-primary-navy p-4 rounded-r-lg">
            <div className="flex items-center space-x-2 mb-2">
                <LightbulbIcon className="w-6 h-6 text-primary-navy" />
                <h3 className="text-lg font-bold text-primary-navy">{title}</h3>
            </div>
            {isLoading && <p className="text-secondary-gray animate-pulse">Menganalisis data...</p>}
            {error && <p className="text-danger-red">{error}</p>}
            {analysis && !isLoading && !error && (
                <div className="text-dark-text prose prose-sm max-w-none">
                    {formatMarkdown(analysis)}
                </div>
            )}
        </div>
    );
};

const AIForecastCard: React.FC<{
    forecast: string | null;
    isLoading: boolean;
    error: string | null;
}> = ({ forecast, isLoading, error }) => {
    return (
        <section className="bg-white rounded-xl p-6 shadow-md border-t-4 border-accent-teal">
            <div className="flex items-center space-x-3 mb-2">
                <SparklesIcon className="w-7 h-7 text-accent-teal" />
                <h2 className="text-xl font-bold text-primary-navy">Prediksi & Peringatan Dini</h2>
            </div>
             {isLoading && <p className="text-secondary-gray text-center animate-pulse">AI sedang menghitung proyeksi keuangan Anda...</p>}
             {error && <p className="text-danger-red text-center">{error}</p>}
             {forecast && !isLoading && !error && (
                <p className="text-center text-lg text-dark-text font-semibold mt-2">
                    {forecast}
                </p>
            )}
        </section>
    );
};


const TransactionDetailModal: React.FC<{
    data: { category: string; transactions: GlobalTransaction[] };
    onClose: () => void;
}> = ({ data, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-fade-in-up flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b flex-shrink-0">
                    <h3 className="text-lg font-bold text-primary-navy">Detail Transaksi: {data.category}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
                </div>
                <div className="p-6 overflow-y-auto">
                    {data.transactions.length > 0 ? (
                        <ul className="space-y-2">
                            {data.transactions.map(t => (
                                <li key={t.timestamp} className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                                    <div>
                                        <p className="font-semibold text-dark-text">{t.desc}</p>
                                        <p className="text-xs text-secondary-gray mt-1">
                                            {new Date(t.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </p>
                                    </div>
                                    <p className="font-bold text-danger-red flex-shrink-0 ml-4">
                                        -{formatCurrency(t.amount)}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                         <p className="text-center text-secondary-gray py-4">Tidak ada transaksi untuk ditampilkan.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

const Visualizations: React.FC<VisualizationsProps> = ({ state, onBack }) => {
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [detailModalData, setDetailModalData] = useState<{ category: string; transactions: GlobalTransaction[] } | null>(null);

    // AI Analysis State
    const [trendAnalysis, setTrendAnalysis] = useState<string | null>(null);
    const [isFetchingTrend, setIsFetchingTrend] = useState(false);
    const [trendError, setTrendError] = useState<string | null>(null);

    const [budgetAnalysis, setBudgetAnalysis] = useState<string | null>(null);
    const [isFetchingBudget, setIsFetchingBudget] = useState(false);
    const [budgetError, setBudgetError] = useState<string | null>(null);

    const [pieAnalysis, setPieAnalysis] = useState<string | null>(null);
    const [isFetchingPie, setIsFetchingPie] = useState(false);
    const [pieError, setPieError] = useState<string | null>(null);
    
    // AI Forecast State
    const [aiForecast, setAiForecast] = useState<string | null>(null);
    const [isFetchingForecast, setIsFetchingForecast] = useState(false);
    const [forecastError, setForecastError] = useState<string | null>(null);


    const allExpenses = useMemo((): GlobalTransaction[] => {
        let expenses: GlobalTransaction[] = [];
        state.archives.forEach(archive => expenses.push(...archive.transactions.filter(t => t.type === 'remove')));
        expenses.push(...state.fundHistory.filter(t => t.type === 'remove').map(t => ({...t, category: 'Pengeluaran Umum'})));
        state.budgets.forEach(b => {
            expenses.push(...b.history.map(h => ({...h, type: 'remove', category: b.name})));
        });
        expenses.push(...state.dailyExpenses.map(t => ({...t, type: 'remove', category: t.sourceCategory || 'Harian'})));
        return expenses;
    }, [state]);
    
    const monthOptions = useMemo(() => {
        const options = new Set(allExpenses.map(t => new Date(t.timestamp).toISOString().slice(0, 7)));
        // Get current month if no other data exists
        if (options.size === 0) {
            options.add(new Date().toISOString().slice(0, 7));
        }
        return ['all', ...[...options].sort().reverse()];
    }, [allExpenses]);
    
    const filteredExpenses = useMemo(() => {
         return selectedMonth === 'all' 
            ? allExpenses 
            : allExpenses.filter(e => new Date(e.timestamp).toISOString().startsWith(selectedMonth));
    }, [allExpenses, selectedMonth]);
    
    const totalIncomeForMonth = useMemo(() => {
        if (selectedMonth === 'all') return 0;
        
        const incomeTransactions = state.fundHistory.filter(t => 
            t.type === 'add' && new Date(t.timestamp).toISOString().startsWith(selectedMonth)
        );
        return incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
    }, [state.fundHistory, selectedMonth]);


    const pieChartData = useMemo(() => {
        const expenseByCategory: { [key: string]: number } = {};
        filteredExpenses.forEach(expense => {
            const category = expense.category || 'Lain-lain';
            if (!expenseByCategory[category]) {
                expenseByCategory[category] = 0;
            }
            expenseByCategory[category] += expense.amount;
        });

        return Object.entries(expenseByCategory)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredExpenses]);

    const handlePieClick = (data: any) => {
        if (!data || !data.name) return;
        const category = data.name;
        const transactions = filteredExpenses
            .filter(e => (e.category || 'Lain-lain') === category)
            .sort((a, b) => b.amount - a.amount); // Sort by amount descending
        setDetailModalData({ category, transactions });
    };

    const trendData = useMemo(() => {
        if (selectedMonth === 'all') return [];

        const dailyTotals: { [key: string]: number } = {};
        filteredExpenses.forEach(expense => {
            const date = new Date(expense.timestamp).toLocaleDateString('fr-CA'); // YYYY-MM-DD format
            if (!dailyTotals[date]) {
                dailyTotals[date] = 0;
            }
            dailyTotals[date] += expense.amount;
        });

        const daysInMonth = new Date(Number(selectedMonth.slice(0,4)), Number(selectedMonth.slice(5,7)), 0).getDate();
        const data = [];
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${selectedMonth}-${String(i).padStart(2, '0')}`;
            data.push({
                day: String(i),
                total: dailyTotals[dateStr] || 0,
            });
        }
        return data;
    }, [filteredExpenses, selectedMonth]);

    const budgetComparisonData = useMemo(() => {
        const expenseByCategory: { [key: string]: number } = {};
        filteredExpenses.forEach(expense => {
            const category = expense.category || 'Lain-lain';
            if (!expenseByCategory[category]) expenseByCategory[category] = 0;
            expenseByCategory[category] += expense.amount;
        });

        return state.budgets.map(budget => ({
            name: budget.name,
            Dianggarkan: budget.totalBudget,
            Terpakai: expenseByCategory[budget.name] || 0
        }));
    }, [filteredExpenses, state.budgets]);
    
    // --- AI Analysis Effects ---
    useEffect(() => {
        const fetchAnalysis = async () => {
            if (!trendData || trendData.every(d => d.total === 0)) {
                setTrendAnalysis("Tidak ada data pengeluaran untuk dianalisis pada periode ini.");
                return;
            }
            setIsFetchingTrend(true);
            setTrendError(null);
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
                const prompt = `Jelaskan tren pengeluaran harian ini dalam 2-3 poin singkat dan mudah dimengerti. Fokus pada kapan pengeluaran tertinggi terjadi dan apa pola utamanya. Gunakan Bahasa Indonesia yang santai. Data (IDR): ${JSON.stringify(trendData.filter(d => d.total > 0))}`;

                const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
                setTrendAnalysis(response.text);
            } catch (error) {
                console.error("Trend Analysis Error:", error);
                setTrendError("Gagal mendapatkan analisis AI.");
            } finally {
                setIsFetchingTrend(false);
            }
        };
        fetchAnalysis();
    }, [trendData]);
    
    useEffect(() => {
        const fetchAnalysis = async () => {
            if (budgetComparisonData.length === 0) {
                setBudgetAnalysis("Tidak ada pos anggaran untuk dibandingkan.");
                return;
            }
            setIsFetchingBudget(true);
            setBudgetError(null);
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
                const prompt = `Dari data perbandingan anggaran ini, sebutkan kategori mana yang paling boros dan mana yang paling hemat. Berikan satu saran praktis yang mudah diikuti. Gunakan Bahasa Indonesia yang santai dalam format poin. Data (IDR): ${JSON.stringify(budgetComparisonData)}`;

                const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
                setBudgetAnalysis(response.text);
            } catch (error) {
                console.error("Budget Analysis Error:", error);
                setBudgetError("Gagal mendapatkan analisis AI.");
            } finally {
                setIsFetchingBudget(false);
            }
        };
        fetchAnalysis();
    }, [budgetComparisonData]);

    useEffect(() => {
        const fetchAnalysis = async () => {
            if (pieChartData.length === 0) {
                setPieAnalysis("Tidak ada data pengeluaran untuk dianalisis pada periode ini.");
                return;
            }
            setIsFetchingPie(true);
            setPieError(null);
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
                const prompt = `Lihat data alokasi pengeluaran ini. Sebutkan 2 kategori teratas kemana uang paling banyak dihabiskan. Beri satu kesimpulan singkat yang mudah dipahami. Gunakan Bahasa Indonesia yang santai dalam format poin. Data (IDR): ${JSON.stringify(pieChartData)}`;

                const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
                setPieAnalysis(response.text);
            } catch (error) {
                console.error("Pie Analysis Error:", error);
                setPieError("Gagal mendapatkan analisis AI.");
            } finally {
                setIsFetchingPie(false);
            }
        };
        fetchAnalysis();
    }, [pieChartData]);
    
     useEffect(() => {
        const fetchForecast = async () => {
            if (selectedMonth === 'all') {
                setAiForecast(null);
                return;
            }
            
            const year = Number(selectedMonth.slice(0, 4));
            const month = Number(selectedMonth.slice(5, 7)) - 1;
            const today = new Date();
            const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

            if (!isCurrentMonth) {
                setAiForecast('Prediksi hanya tersedia untuk bulan berjalan.');
                return;
            }
            if (totalIncomeForMonth === 0) {
                setAiForecast('Tambahkan pemasukan bulan ini untuk melihat prediksi.');
                return;
            }
            
            setIsFetchingForecast(true);
            setForecastError(null);
            
            const daysPassed = today.getDate();
            const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
            const totalExpensesSoFar = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

            if (totalExpensesSoFar === 0) {
                setAiForecast("Belum ada pengeluaran. Anda di jalur yang tepat untuk berhemat!");
                setIsFetchingForecast(false);
                return;
            }

            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
                const prompt = `
                    Anda adalah seorang analis keuangan. Berdasarkan data berikut, buat prediksi pengeluaran total di akhir bulan dan berikan peringatan dini jika diproyeksikan akan melebihi pemasukan.

                    Data Keuangan (Bulan Berjalan dalam IDR):
                    - Total Pemasukan Bulan Ini: ${totalIncomeForMonth}
                    - Total Pengeluaran Hingga Saat Ini: ${totalExpensesSoFar}
                    - Hari yang Telah Berlalu: ${daysPassed}
                    - Total Hari dalam Bulan Ini: ${totalDaysInMonth}

                    Tugas:
                    1. Hitung proyeksi pengeluaran total untuk akhir bulan berdasarkan rata-rata pengeluaran harian saat ini.
                    2. Bandingkan proyeksi tersebut dengan total pemasukan.
                    3. Berikan satu kalimat kesimpulan yang singkat, jelas, dan ramah dalam Bahasa Indonesia. Contoh: "Peringatan! Dengan tren saat ini, Anda diproyeksikan akan melebihi anggaran sebesar [jumlah]." atau "Anda di jalur yang tepat! Diprediksi akan ada sisa dana sebesar [jumlah] di akhir bulan."
                    
                    Langsung berikan kalimat kesimpulan tersebut tanpa penjelasan tambahan.
                `;
                
                const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
                setAiForecast(response.text);

            } catch (error) {
                console.error("AI Forecast Error:", error);
                setForecastError("Gagal mendapatkan prediksi AI.");
            } finally {
                setIsFetchingForecast(false);
            }
        };

        fetchForecast();
    }, [selectedMonth, filteredExpenses, totalIncomeForMonth]);


    const titleText = selectedMonth === 'all' 
                    ? 'Semua Waktu' 
                    : new Date(selectedMonth + '-02').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    return (
        <main className="p-4 pb-24 animate-fade-in max-w-4xl mx-auto space-y-6">
            <style>{`
                .clickable-pie .recharts-pie-sector {
                    cursor: pointer;
                    transition: opacity 0.2s;
                }
                .clickable-pie .recharts-pie-sector:hover {
                    opacity: 0.8;
                }
            `}</style>
            
            <header>
                <h1 className="text-3xl font-bold text-primary-navy text-center">Visualisasi Pengeluaran</h1>
                <div className="mt-4 max-w-md mx-auto">
                    <label htmlFor="month-filter-visual" className="block text-sm font-medium text-secondary-gray mb-1">Pilih Periode Laporan</label>
                    <select id="month-filter-visual" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md">
                        {monthOptions.map(month => (
                            <option key={month} value={month}>
                                {month === 'all' ? 'Semua Waktu' : new Date(month + '-02').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                            </option>
                        ))}
                    </select>
                </div>
            </header>

            {selectedMonth !== 'all' && (
                 <AIForecastCard
                    forecast={aiForecast}
                    isLoading={isFetchingForecast}
                    error={forecastError}
                />
            )}

            {selectedMonth !== 'all' && (
                <section className="bg-white rounded-xl p-6 shadow-md">
                    <h2 className="text-xl font-bold text-primary-navy text-center mb-4">{`Tren Pengeluaran Harian (${titleText})`}</h2>
                    <div className="w-full h-80">
                        {trendData.length > 0 && trendData.some(d => d.total > 0) ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trendData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="day" />
                                    <YAxis tickFormatter={formatShortCurrency} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                    <Line type="monotone" dataKey="total" name="Total Pengeluaran" stroke="#2C3E50" strokeWidth={2} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                             <div className="flex items-center justify-center h-full text-secondary-gray">
                                <p>Tidak ada data pengeluaran pada periode ini.</p>
                            </div>
                        )}
                    </div>
                     <AIAnalysisCard
                        title="Analisis AI Tren Harian"
                        analysis={trendAnalysis}
                        isLoading={isFetchingTrend}
                        error={trendError}
                    />
                </section>
            )}

            {budgetComparisonData.length > 0 && (
                <section className="bg-white rounded-xl p-6 shadow-md">
                    <h2 className="text-xl font-bold text-primary-navy text-center mb-4">{`Perbandingan Anggaran (${titleText})`}</h2>
                    <div className="w-full h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={budgetComparisonData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis tickFormatter={formatShortCurrency} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend />
                                <Bar dataKey="Dianggarkan" fill="#3498DB" />
                                <Bar dataKey="Terpakai" fill="#E67E22" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                     <AIAnalysisCard
                        title="Analisis AI Perbandingan Anggaran"
                        analysis={budgetAnalysis}
                        isLoading={isFetchingBudget}
                        error={budgetError}
                    />
                </section>
            )}

            <section className="bg-white rounded-xl p-6 shadow-md">
                <h2 className="text-xl font-bold text-primary-navy text-center mb-4">{`Alokasi Pengeluaran (${titleText})`}</h2>
                <div className="w-full h-80 mb-6">
                   {pieChartData.length > 0 ? (
                     <ResponsiveContainer width="100%" height="100%">
                        <PieChart className="clickable-pie">
                            <Pie
                                data={pieChartData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={120}
                                fill="#8884d8"
                                dataKey="value"
                                onClick={handlePieClick}
                            >
                                {pieChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{fontSize: '14px'}}/>
                        </PieChart>
                    </ResponsiveContainer>
                   ) : (
                    <div className="flex items-center justify-center h-full text-secondary-gray">
                        <p>Tidak ada data pengeluaran pada periode ini.</p>
                    </div>
                   )}
                </div>

                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3">Kategori</th>
                            <th scope="col" className="px-6 py-3 text-right">Total Terpakai</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pieChartData.length > 0 ? pieChartData.map((item, index) => (
                            <tr key={index} className="bg-white border-b">
                                <td className="px-6 py-4 font-medium text-dark-text whitespace-nowrap">{item.name}</td>
                                <td className="px-6 py-4 text-right font-semibold text-primary-navy">{formatCurrency(item.value)}</td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={2} className="text-center py-4">Tidak ada data.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
                 <AIAnalysisCard
                    title="Analisis AI Alokasi Pengeluaran"
                    analysis={pieAnalysis}
                    isLoading={isFetchingPie}
                    error={pieError}
                />
            </section>
            
            {detailModalData && (
                <TransactionDetailModal data={detailModalData} onClose={() => setDetailModalData(null)} />
            )}
        </main>
    );
};

export default Visualizations;