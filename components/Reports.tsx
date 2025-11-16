

import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { AppState, GlobalTransaction } from '../types';
import { SparklesIcon, CalendarDaysIcon, ListBulletIcon, ChevronLeftIcon, ChevronRightIcon, BudgetIcon, TrashIcon, LockClosedIcon } from './Icons';

interface ReportsProps {
    state: AppState;
    onBack: () => void;
    onEditAsset: () => void;
    onDeleteTransaction: (timestamp: number) => void;
    aiSearchResults: GlobalTransaction[] | null;
    isSearchingWithAI: boolean;
    aiSearchError: string | null;
    onAiSearch: (query: string) => void;
    onClearAiSearch: () => void;
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
const formatShortCurrency = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}jt`;
    if (amount >= 1000) return `${Math.round(amount / 1000)}rb`;
    return amount;
};

const Reports: React.FC<ReportsProps> = ({ 
    state, onBack, onEditAsset, onDeleteTransaction,
    aiSearchResults, isSearchingWithAI, aiSearchError, onAiSearch, onClearAiSearch 
}) => {
    const [selectedMonth, setSelectedMonth] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
    const [calendarDate, setCalendarDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
    const monthPickerRef = useRef<HTMLDivElement>(null);

    // For hiding header on scroll
    const [isHeaderVisible, setIsHeaderVisible] = useState(true);
    const lastScrollY = useRef(0);
    const scrollableContainerRef = useRef<HTMLDivElement>(null);


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (monthPickerRef.current && !monthPickerRef.current.contains(event.target as Node)) {
                setIsMonthPickerOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        const container = scrollableContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const currentScrollY = container.scrollTop;
            if (Math.abs(currentScrollY - lastScrollY.current) < 20) return; // Threshold to prevent flickering

            if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
                setIsHeaderVisible(false); // Scrolling down
            } else if (currentScrollY < lastScrollY.current) {
                setIsHeaderVisible(true); // Scrolling up
            }
            lastScrollY.current = currentScrollY <= 0 ? 0 : currentScrollY;
        };
        
        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);

    }, [viewMode]);


    const allTransactions = useMemo((): GlobalTransaction[] => {
        let transactions: GlobalTransaction[] = [];
        state.archives.forEach(archive => transactions.push(...archive.transactions));
        transactions.push(...state.fundHistory);
        transactions.push(...state.dailyExpenses.map(t => {
            const overageBudget = t.sourceCategory ? state.budgets.find(b => b.name === t.sourceCategory) : null;
            return {
                ...t,
                type: 'remove',
                category: t.sourceCategory || 'Harian',
                icon: overageBudget?.icon,
                color: overageBudget?.color
            };
        }));
        state.budgets.forEach(b => {
            transactions.push(...b.history.map(h => ({...h, type: 'remove' as const, category: b.name, icon: b.icon, color: b.color })));
        });
        return transactions.sort((a, b) => b.timestamp - a.timestamp);
    }, [state]);

    const totalAsset = useMemo(() => allTransactions.reduce((sum, t) => t.type === 'add' ? sum + t.amount : sum - t.amount, 0), [allTransactions]);

    const monthOptions = useMemo(() => {
        const options = new Set(allTransactions.map(t => new Date(t.timestamp).toISOString().slice(0, 7)));
        return [...options].sort().reverse();
    }, [allTransactions]);

    const transactionsToDisplay = useMemo(() => {
        if (aiSearchResults !== null) {
            return aiSearchResults;
        }

        let filtered = allTransactions.filter(t => {
            const monthMatch = selectedMonth === 'all' || new Date(t.timestamp).toISOString().startsWith(selectedMonth);
            return monthMatch;
        });

        if (searchQuery.trim()) {
            const lowercasedQuery = searchQuery.trim().toLowerCase();
            filtered = filtered.filter(t => 
                t.desc.toLowerCase().includes(lowercasedQuery) ||
                (t.category && t.category.toLowerCase().includes(lowercasedQuery))
            );
        }

        return filtered;
    }, [allTransactions, selectedMonth, aiSearchResults, searchQuery]);
    
    const summaryExpense = useMemo(() => {
        return transactionsToDisplay.reduce((sum, t) => (t.type === 'remove' ? sum + t.amount : sum), 0);
    }, [transactionsToDisplay]);

    const groupedTransactions = useMemo(() => {
        const groups: { [date: string]: { transactions: GlobalTransaction[], dailyTotal: number } } = {};

        transactionsToDisplay.forEach(t => {
            const date = new Date(t.timestamp).toLocaleDateString('fr-CA'); // YYYY-MM-DD
            if (!groups[date]) {
                groups[date] = { transactions: [], dailyTotal: 0 };
            }
            groups[date].transactions.push(t);
            if (t.type === 'remove') {
                groups[date].dailyTotal += t.amount;
            }
        });

        return groups;
    }, [transactionsToDisplay]);

    const handleAiSearchClick = () => {
        if (searchQuery.trim()) {
            onAiSearch(searchQuery);
        }
    };
    
    const calendarTransactionsByDate = useMemo(() => {
        const groups: { [date: string]: { income: number, expense: number, transactions: GlobalTransaction[] } } = {};
        allTransactions.forEach(t => {
            const date = new Date(t.timestamp).toLocaleDateString('fr-CA'); // YYYY-MM-DD
            if (!groups[date]) {
                groups[date] = { income: 0, expense: 0, transactions: [] };
            }
            if (t.type === 'add') groups[date].income += t.amount;
            else groups[date].expense += t.amount;
            groups[date].transactions.push(t);
        });
        return groups;
    }, [allTransactions]);

    const changeMonth = (offset: number) => {
        setCalendarDate(prev => {
            const newDate = new Date(prev);
            newDate.setDate(1); // Avoid issues with day overflow
            newDate.setMonth(newDate.getMonth() + offset);
            return newDate;
        });
        setSelectedDate(null);
    };

    const TransactionItem: React.FC<{t: GlobalTransaction, onDelete: (ts: number) => void}> = ({t, onDelete}) => (
        <li key={t.timestamp} className="flex justify-between items-center py-3 px-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors duration-150">
            <div className="flex items-center gap-4 flex-1 min-w-0">
                {t.icon && t.color ? (
                    <div style={{ backgroundColor: t.color }} className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0">
                        <BudgetIcon icon={t.icon} className="w-6 h-6 text-white" />
                    </div>
                ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <ListBulletIcon className="w-5 h-5 text-gray-500"/>
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-dark-text truncate">{t.desc}</p>
                    <p className="text-xs text-secondary-gray mt-1">
                        {t.category ? `${t.category} • ` : ''}
                        {new Date(t.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}, {new Date(t.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                 <div className="text-right">
                    <p className={`font-bold text-base ${t.type === 'add' ? 'text-accent-teal' : 'text-danger-red'}`}>{t.type === 'add' ? '+' : '-'} {formatCurrency(t.amount)}</p>
                </div>
                <button onClick={() => onDelete(t.timestamp)} className="text-gray-400 hover:text-danger-red p-2">
                    <TrashIcon className="w-5 h-5" />
                </button>
            </div>
        </li>
    );

    const displayMonthText = selectedMonth === 'all' 
        ? 'Semua' 
        : new Date(selectedMonth + '-02').toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });

    return (
        <main className="p-4 pb-24 animate-fade-in">
            <h1 className="text-3xl font-bold text-primary-navy text-center mb-6">Laporan Global</h1>

            <section className="bg-white rounded-xl shadow-md flex flex-col">
                <div className={`z-30 bg-white p-6 rounded-t-xl transition-transform duration-300 ease-in-out ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full'}`}>
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
                        <h2 className="text-xl font-bold text-primary-navy">Riwayat Transaksi</h2>
                        <div className="flex items-center gap-4 self-start sm:self-center">
                            <div className="flex-shrink-0 bg-gray-100 p-1 rounded-lg flex space-x-1">
                                <button onClick={() => setViewMode('list')} className={`flex items-center gap-2 px-3 py-1 text-sm font-semibold rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow' : 'text-secondary-gray hover:bg-gray-200'}`}><ListBulletIcon className="w-4 h-4" /> Daftar</button>
                                <button onClick={() => setViewMode('calendar')} className={`flex items-center gap-2 px-3 py-1 text-sm font-semibold rounded-md transition-all ${viewMode === 'calendar' ? 'bg-white shadow' : 'text-secondary-gray hover:bg-gray-200'}`}><CalendarDaysIcon className="w-4 h-4" /> Kalender</button>
                            </div>
                            <div className="flex-shrink-0 relative" ref={monthPickerRef}>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-secondary-gray">{displayMonthText}</span>
                                    <button
                                        onClick={() => setIsMonthPickerOpen(prev => !prev)}
                                        className="p-2 border border-gray-300 rounded-full bg-white hover:bg-gray-100"
                                    >
                                        <CalendarDaysIcon className="w-5 h-5 text-primary-navy" />
                                    </button>
                                </div>
                                {isMonthPickerOpen && (
                                    <div className="absolute z-20 mt-1 right-0 w-48 bg-white rounded-lg shadow-lg border max-h-60 overflow-y-auto">
                                        <button 
                                            onClick={() => { setSelectedMonth('all'); setIsMonthPickerOpen(false); }}
                                            className="w-full text-left px-4 py-2 hover:bg-gray-100"
                                        >
                                            Semua Waktu
                                        </button>
                                        {monthOptions.map(month => (
                                            <button 
                                                key={month} 
                                                onClick={() => { setSelectedMonth(month); setIsMonthPickerOpen(false); }}
                                                className="w-full text-left px-4 py-2 hover:bg-gray-100"
                                            >
                                                {new Date(month + '-02').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                
                    {viewMode === 'list' && (
                        <div className="flex flex-col md:flex-row gap-4 items-end">
                                <div className="flex-grow">
                                    <label htmlFor="search-filter" className="text-sm font-medium text-secondary-gray mb-1">Cari / Tanya AI</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            id="search-filter"
                                            value={searchQuery} 
                                            onChange={e => setSearchQuery(e.target.value)} 
                                            placeholder="Ketik keterangan atau kategori..." 
                                            className="w-full p-3 pl-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-navy focus:border-transparent"
                                            disabled={isSearchingWithAI}
                                        />
                                        <button 
                                            type="button" 
                                            className="bg-primary-navy text-white font-bold p-3 rounded-lg hover:bg-primary-navy-dark transition-colors disabled:bg-gray-400 flex items-center justify-center" 
                                            disabled={true}
                                            title="Pencarian Cerdas (AI) - Fitur Terkunci"
                                        >
                                            <LockClosedIcon className="w-6 h-6" />
                                        </button>
                                    </div>
                                    {aiSearchError && <p className="text-sm text-danger-red mt-1">{aiSearchError}</p>}
                                </div>
                                {aiSearchResults !== null && (
                                    <div className="self-end">
                                        <button onClick={() => { onClearAiSearch(); setSearchQuery(''); }} className="bg-gray-200 text-dark-text font-bold py-3 px-3 rounded-lg hover:bg-gray-300 transition-colors h-full">
                                            Reset
                                        </button>
                                    </div>
                                )}
                        </div>
                    )}
                </div>
                
                {viewMode === 'list' && (
                    <div className="flex-grow">
                        {isSearchingWithAI && (
                            <div className="text-center py-4">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-navy mx-auto"></div>
                                <p className="mt-2 text-secondary-gray">AI sedang mencari...</p>
                            </div>
                        )}

                        <div ref={scrollableContainerRef} className="max-h-[65vh] overflow-y-auto space-y-4 px-6 pb-6">
                            {Object.keys(groupedTransactions).length === 0 && !isSearchingWithAI ? (
                                <div className="text-center text-secondary-gray py-12 px-6">
                                    <ListBulletIcon className="w-16 h-16 mx-auto text-gray-300" />
                                    <h3 className="mt-4 text-lg font-semibold text-dark-text">Tidak Ada Transaksi Ditemukan</h3>
                                    <p className="mt-1 text-sm text-secondary-gray">
                                        {aiSearchResults !== null ? 'Pencarian AI tidak menemukan hasil.' : 'Coba ubah kata kunci pencarian atau pilih periode bulan yang berbeda.'}
                                    </p>
                                </div>
                            ) : (
                                Object.keys(groupedTransactions).map((date) => {
                                    const group = groupedTransactions[date];
                                    const aDate = new Date(date + 'T00:00:00');
                                    return (
                                    <div key={date}>
                                        <div className="flex justify-between items-center bg-gray-100 p-3 rounded-t-lg border-b sticky top-0 z-10">
                                            <div className="flex items-center space-x-3">
                                                <span className="text-2xl font-bold text-dark-text w-8 text-center">{aDate.getDate().toString().padStart(2, '0')}</span>
                                                <div>
                                                    <p className="font-semibold text-dark-text">{aDate.toLocaleDateString('id-ID', { weekday: 'long' })}</p>
                                                    <p className="text-xs text-secondary-gray">{aDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</p>
                                                </div>
                                            </div>
                                            {group.dailyTotal > 0 && (
                                                <p className="font-bold text-danger-red">-{formatCurrency(group.dailyTotal)}</p>
                                            )}
                                        </div>
                                        <ul className="bg-white rounded-b-lg ">
                                            {group.transactions.map(t => (
                                                <TransactionItem key={t.timestamp} t={t} onDelete={onDeleteTransaction} />
                                            ))}
                                        </ul>
                                    </div>
                                )})
                            )}
                        </div>
                        
                        <div className="mt-auto p-6 border-t">
                            <div className="bg-blue-50 border-l-4 border-accent-teal p-4 rounded-md text-center">
                                <p className="text-lg font-bold text-danger-red">{formatCurrency(summaryExpense)}</p>
                                <span className="text-sm text-secondary-gray">Total Pengeluaran (sesuai filter)</span>
                            </div>
                        </div>
                    </div>
                )}

                {viewMode === 'calendar' && (
                   <div className="p-6">
                       <CalendarView 
                           currentDate={calendarDate}
                           transactionsByDate={calendarTransactionsByDate}
                           selectedDate={selectedDate}
                           onDateClick={(date) => setSelectedDate(prev => prev === date ? null : date)}
                           onChangeMonth={changeMonth}
                           onDeleteTransaction={onDeleteTransaction}
                           TransactionItem={TransactionItem}
                       />
                   </div>
                )}
            </section>
            
            <section className="bg-white rounded-xl p-6 mt-6 shadow-md">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-primary-navy">Dana Umum (Total Aset)</h2>
                    <button onClick={onEditAsset} className="text-accent-teal font-semibold hover:underline">Edit</button>
                </div>
                <p className="text-3xl font-bold text-primary-navy text-center mt-2">{formatCurrency(totalAsset)}</p>
            </section>
        </main>
    );
};


const CalendarView: React.FC<{
    currentDate: Date;
    transactionsByDate: { [key: string]: { income: number, expense: number, transactions: GlobalTransaction[] }};
    selectedDate: string | null;
    onDateClick: (date: string) => void;
    onChangeMonth: (offset: number) => void;
    onDeleteTransaction: (timestamp: number) => void;
    TransactionItem: React.FC<{t: GlobalTransaction, onDelete: (ts: number) => void}>;
}> = ({ currentDate, transactionsByDate, selectedDate, onDateClick, onChangeMonth, onDeleteTransaction, TransactionItem }) => {
    const calendarDays = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const days = [];
        // Pad with days from previous month
        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push({ key: `prev-${i}`, isCurrentMonth: false });
        }
        // Add days of current month
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            days.push({ 
                key: dateStr, 
                day, 
                date: dateStr, 
                isCurrentMonth: true, 
                data: transactionsByDate[dateStr] 
            });
        }
        return days;
    }, [currentDate, transactionsByDate]);

    const today = new Date().toLocaleDateString('fr-CA');

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => onChangeMonth(-1)} className="p-2 rounded-full hover:bg-gray-100"><ChevronLeftIcon className="w-6 h-6" /></button>
                <h3 className="text-lg font-bold text-primary-navy">{currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</h3>
                <button onClick={() => onChangeMonth(1)} className="p-2 rounded-full hover:bg-gray-100"><ChevronRightIcon className="w-6 h-6" /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-secondary-gray mb-2">
                {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(day => <div key={day}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {calendarDays.map(dayInfo => {
                    if (!dayInfo.isCurrentMonth) return <div key={dayInfo.key} className="h-20 sm:h-24"></div>;
                    
                    const isSelected = selectedDate === dayInfo.date;
                    const isToday = today === dayInfo.date;

                    return (
                        <div 
                            key={dayInfo.key} 
                            onClick={() => onDateClick(dayInfo.date!)}
                            className={`relative h-20 sm:h-24 p-1.5 border rounded-lg cursor-pointer transition-all duration-200
                                ${isSelected ? 'bg-primary-navy-dark text-white ring-2 ring-primary-navy' : 'bg-white hover:bg-gray-50'}
                                ${isToday && !isSelected ? 'border-primary-navy' : 'border-gray-200'}
                            `}
                        >
                            <span className={`text-sm font-semibold ${isToday && !isSelected ? 'text-primary-navy' : ''}`}>{dayInfo.day}</span>
                            {dayInfo.data && (
                                <div className="absolute bottom-1.5 right-1.5 text-right">
                                    {dayInfo.data.income > 0 && <p className="text-xs text-accent-teal font-medium leading-tight">+{formatShortCurrency(dayInfo.data.income)}</p>}
                                    {dayInfo.data.expense > 0 && <p className="text-xs text-danger-red font-medium leading-tight">-{formatShortCurrency(dayInfo.data.expense)}</p>}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {selectedDate && (
                <div className="mt-6 animate-fade-in">
                    <h4 className="font-bold text-primary-navy mb-2 border-b pb-2">
                        Transaksi pada {new Date(selectedDate + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h4>
                     <ul className="max-h-60 overflow-y-auto">
                        {(transactionsByDate[selectedDate]?.transactions || []).length > 0 ? (
                           [...transactionsByDate[selectedDate].transactions].sort((a,b) => b.timestamp - a.timestamp).map(t => (
                            <TransactionItem key={t.timestamp} t={t} onDelete={onDeleteTransaction} />
                           ))
                        ) : (
                            <li className="text-center text-secondary-gray py-4">Tidak ada transaksi pada tanggal ini.</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default Reports;