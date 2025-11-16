

import React, { useState } from 'react';
import type { AppState, Budget, Transaction } from '../types';
import { LightbulbIcon, ArrowPathIcon, PlusCircleIcon, BudgetIcon, LockClosedIcon, ListBulletIcon } from './Icons';

interface DashboardProps {
  state: AppState;
  onUseDailyBudget: () => void;
  onManageFunds: () => void;
  onUseBudget: (budgetId: number) => void;
  onEditBudget: (budgetId: number) => void;
  aiInsight: string;
  isFetchingInsight: boolean;
  onRefreshInsight: () => void;
  onViewDailyHistory: () => void;
  onAddBudget: () => void;
  onReorderBudgets: (reorderedBudgets: Budget[]) => void;
  onSetBudgetPermanence: (budgetId: number, isTemporary: boolean) => void;
  onOpenBatchInput: () => void;
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

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


const OverviewCard: React.FC<{
    monthlyIncome: number;
    totalUsedOverall: number;
    totalRemaining: number;
    currentAvailableFunds: number;
    totalDailySpentToday: number;
    onUseDailyBudget: () => void;
    onViewDailyHistory: () => void;
    onOpenBatchInput: () => void;
}> = ({ monthlyIncome, totalUsedOverall, totalRemaining, currentAvailableFunds, totalDailySpentToday, onUseDailyBudget, onViewDailyHistory, onOpenBatchInput }) => {
    const remainingDays = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate() + 1;
    const dailyBudgetMax = remainingDays > 0 ? currentAvailableFunds / remainingDays : currentAvailableFunds;
    const dailyBudgetRemaining = dailyBudgetMax - totalDailySpentToday;
    const dailyPercentageUsed = dailyBudgetMax > 0 ? (totalDailySpentToday / dailyBudgetMax) * 100 : 100;

    return (
        <section className="bg-white rounded-xl p-6 mb-6 shadow-md">
            <div className="text-center mb-4">
                <h3 className="text-sm font-medium text-secondary-gray">Sisa Dana Bulan Ini</h3>
                <p className={`font-bold text-4xl ${totalRemaining < 0 ? 'text-danger-red' : 'text-primary-navy'}`}>{formatCurrency(totalRemaining)}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center mb-6">
                <div>
                    <h4 className="text-xs text-secondary-gray">Pemasukan</h4>
                    <p className="font-semibold text-dark-text">{formatCurrency(monthlyIncome)}</p>
                </div>
                <div>
                    <h4 className="text-xs text-secondary-gray">Terpakai</h4>
                    <p className="font-semibold text-dark-text">{formatCurrency(totalUsedOverall)}</p>
                </div>
            </div>

            <div className="space-y-3 border-t pt-4">
                <h3 className="font-semibold text-dark-text text-center">Anggaran Harian (Dana Tersedia)</h3>
                 <div onClick={onViewDailyHistory} className="cursor-pointer group">
                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden my-2">
                        <div
                            className="bg-primary-navy h-full rounded-full transition-all duration-500 group-hover:bg-primary-navy-dark"
                            style={{ width: `${Math.min(Math.max(0, dailyPercentageUsed), 100)}%` }}
                        ></div>
                    </div>
                    <p className="text-xs text-secondary-gray text-right group-hover:text-dark-text transition-colors">
                        Sisa {formatCurrency(dailyBudgetRemaining)} dari kuota {formatCurrency(dailyBudgetMax)}
                    </p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={onUseDailyBudget} className="w-full bg-accent-teal text-white font-bold py-3 px-4 rounded-lg hover:bg-accent-teal-dark transition-colors shadow flex items-center justify-center gap-2">
                         <PlusCircleIcon className="w-5 h-5" />
                        <span>Catat</span>
                    </button>
                     <button onClick={onOpenBatchInput} className="w-full bg-white border-2 border-accent-teal text-accent-teal font-bold py-3 px-4 rounded-lg hover:bg-teal-50 transition-colors shadow flex items-center justify-center gap-2">
                        <ListBulletIcon className="w-5 h-5" />
                        <span>Sekaligus</span>
                    </button>
                </div>
            </div>
        </section>
    );
};

const AIInsightCard: React.FC<{
    insight: string;
    isLoading: boolean;
    onRefresh: () => void;
}> = ({ insight, isLoading, onRefresh }) => {
    return (
        <section className="bg-white rounded-xl p-6 mb-6 shadow-md">
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center space-x-2">
                    <LightbulbIcon className="w-6 h-6 text-warning-yellow" />
                    <h2 className="text-xl font-bold text-primary-navy">Wawasan AI</h2>
                </div>
                <button disabled={true} className="text-primary-navy disabled:text-gray-400 disabled:cursor-not-allowed">
                    <ArrowPathIcon className="w-6 h-6" isSpinning={false} />
                </button>
            </div>
            <div className="text-center py-4 text-secondary-gray">
                <LockClosedIcon className="w-12 h-12 mx-auto text-gray-300" />
                <p className="mt-2 font-semibold">Fitur Terkunci</p>
                <p className="text-sm">Tingkatkan ke versi premium untuk membuka wawasan AI.</p>
            </div>
        </section>
    );
};


const BudgetItem: React.FC<{
    budget: Budget;
    onUse: () => void;
    onEdit: () => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
    isDragging: boolean;
    onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
    showDropIndicator: boolean;
    onDragOverItem: (e: React.DragEvent<HTMLDivElement>) => void;
    onDropOnItem: (e: React.DragEvent<HTMLDivElement>) => void;
    onDragLeaveItem: () => void;
}> = ({ budget, onUse, onEdit, isExpanded, onToggleExpand, isDragging, onDragStart, showDropIndicator, onDragOverItem, onDropOnItem, onDragLeaveItem }) => {
    const usedAmount = budget.history.reduce((sum, item) => sum + item.amount, 0);
    const remaining = budget.totalBudget - usedAmount;
    const percentageUsed = budget.totalBudget > 0 ? (usedAmount / budget.totalBudget) * 100 : 0;

    let barColorClass = 'bg-accent-teal';
    if (percentageUsed >= 100) barColorClass = 'bg-danger-red';
    else if (percentageUsed > 80) barColorClass = 'bg-orange-400';
    else if (percentageUsed > 50) barColorClass = 'bg-warning-yellow';

    return (
        <div 
            draggable
            onDragStart={onDragStart}
            onDragOver={onDragOverItem}
            onDrop={onDropOnItem}
            onDragLeave={onDragLeaveItem}
            className={`relative bg-white rounded-xl shadow-md transition-all duration-300 ${isDragging ? 'opacity-50 scale-105' : 'opacity-100'}`}
        >
            {showDropIndicator && (
                 <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-400 rounded-full animate-pulse" style={{ marginTop: '-0.375rem' }} />
            )}
            <div onClick={onToggleExpand} className="p-4 cursor-pointer">
                <div className="flex justify-between items-start mb-2 gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                         {budget.icon && budget.color ? (
                            <div style={{ backgroundColor: budget.color }} className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0">
                                <BudgetIcon icon={budget.icon} className="w-6 h-6 text-white" />
                            </div>
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
                        )}
                        <h3 className="text-lg font-bold text-dark-text flex-1 truncate">{budget.name}</h3>
                    </div>
                    <div className="text-right flex-shrink-0">
                        <p className="font-bold text-primary-navy">{formatCurrency(remaining)}</p>
                        <p className="text-xs text-secondary-gray">dari {formatCurrency(budget.totalBudget)}</p>
                    </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-5 overflow-hidden">
                    <div className={`${barColorClass} h-full rounded-full flex items-center justify-center text-white text-xs font-semibold transition-all duration-500`} style={{ width: `${Math.min(percentageUsed, 100)}%` }}>
                        {percentageUsed > 15 ? `${percentageUsed.toFixed(0)}%` : ''}
                    </div>
                </div>
            </div>

            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-96' : 'max-h-0'}`}>
                <div className="pb-4 px-4 border-t pt-3">
                    <button onClick={onUse} className="w-full bg-accent-teal text-white font-bold py-2 px-4 rounded-lg hover:bg-accent-teal-dark transition-colors mb-3">
                        Gunakan Dana
                    </button>
                    <h4 className="font-semibold text-sm text-secondary-gray mb-2">Riwayat Transaksi</h4>
                    {budget.history.length > 0 ? (
                        <ul className="space-y-2 text-sm max-h-40 overflow-y-auto pr-2">
                            {[...budget.history].reverse().map((item: Transaction) => (
                                <li key={item.timestamp} className="flex justify-between items-center">
                                    <span className="truncate pr-2 text-dark-text">{item.desc}</span>
                                    <span className="font-semibold text-danger-red flex-shrink-0">-{formatCurrency(item.amount)}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-secondary-gray text-center py-2">Belum ada transaksi.</p>
                    )}
                    <button onClick={onEdit} className="mt-4 w-full bg-gray-200 text-dark-text font-bold py-2 px-4 rounded-lg hover:bg-gray-300 text-sm">
                        Edit / Arsipkan
                    </button>
                </div>
            </div>
        </div>
    );
};


const Dashboard: React.FC<DashboardProps> = (props) => {
    const { state } = props;
    const [expandedBudgetId, setExpandedBudgetId] = useState<number | null>(null);
    const [draggedId, setDraggedId] = useState<number | null>(null);
    const [dragOverZone, setDragOverZone] = useState<'fixed' | 'temporary' | null>(null);
    const [dragOverBudgetId, setDragOverBudgetId] = useState<number | null>(null);

    const activeBudgets = state.budgets.filter(b => !b.isArchived);
    const fixedBudgets = activeBudgets.filter(b => !b.isTemporary).sort((a,b) => a.order - b.order);
    const temporaryBudgets = activeBudgets.filter(b => b.isTemporary).sort((a,b) => a.order - b.order);
    
    const monthlyIncome = state.fundHistory.filter(t => t.type === 'add').reduce((sum, t) => sum + t.amount, 0);
    const monthlyGeneralExpense = state.fundHistory.filter(t => t.type === 'remove').reduce((sum, t) => sum + t.amount, 0);
    const totalUsedFromPosts = state.budgets.reduce((sum, b) => sum + b.history.reduce((s, h) => s + h.amount, 0), 0);
    const totalDailySpent = state.dailyExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalUsedOverall = monthlyGeneralExpense + totalUsedFromPosts + totalDailySpent;
    const totalRemaining = monthlyIncome - totalUsedOverall;

    const totalAllocated = state.budgets.reduce((sum, b) => sum + b.totalBudget, 0);
    const unallocatedFunds = monthlyIncome - totalAllocated;
    const currentAvailableFunds = unallocatedFunds - monthlyGeneralExpense - totalDailySpent;
    const todaysDailyExpenses = state.dailyExpenses.filter(exp => new Date(exp.timestamp).toDateString() === new Date().toDateString());
    const totalDailySpentToday = todaysDailyExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    const handleDropOnZone = (targetZone: 'fixed' | 'temporary') => {
        if (draggedId === null) return;
        const budget = activeBudgets.find(b => b.id === draggedId);
        if (!budget) return;

        if (targetZone === 'fixed' && budget.isTemporary) {
            props.onSetBudgetPermanence(draggedId, false);
        } else if (targetZone === 'temporary' && !budget.isTemporary) {
            props.onSetBudgetPermanence(draggedId, true);
        }
    };
    
    const handleReorder = (targetId: number) => {
        if (draggedId === null || draggedId === targetId) return;

        const draggedBudget = activeBudgets.find(b => b.id === draggedId);
        const targetBudget = activeBudgets.find(b => b.id === targetId);

        if (!draggedBudget || !targetBudget || draggedBudget.isTemporary !== targetBudget.isTemporary) {
            return;
        }

        const listToReorder = draggedBudget.isTemporary ? [...temporaryBudgets] : [...fixedBudgets];
        
        const draggedIndex = listToReorder.findIndex(b => b.id === draggedId);
        const targetIndex = listToReorder.findIndex(b => b.id === targetId);
        
        const [removed] = listToReorder.splice(draggedIndex, 1);
        listToReorder.splice(targetIndex, 0, removed);
        
        const reorderedSublist = listToReorder.map((budget, index) => ({ ...budget, order: index }));

        const otherList = draggedBudget.isTemporary ? fixedBudgets : temporaryBudgets;
        
        props.onReorderBudgets([...reorderedSublist, ...otherList]);
    };
    
    const handleDragEnd = () => {
        setDraggedId(null);
        setDragOverZone(null);
        setDragOverBudgetId(null);
    };

    const isSameCategory = (id1: number | null, id2: number | null) => {
        if (id1 === null || id2 === null) return false;
        const budget1 = activeBudgets.find(b => b.id === id1);
        const budget2 = activeBudgets.find(b => b.id === id2);
        if (!budget1 || !budget2) return false;
        return budget1.isTemporary === budget2.isTemporary;
    };


    const renderBudgetList = (budgets: Budget[]) => {
        return budgets.map(budget => (
            <BudgetItem 
                key={budget.id}
                budget={budget}
                isExpanded={expandedBudgetId === budget.id}
                onToggleExpand={() => setExpandedBudgetId(prev => prev === budget.id ? null : budget.id)}
                onUse={() => props.onUseBudget(budget.id)}
                onEdit={() => props.onEditBudget(budget.id)}
                isDragging={draggedId === budget.id}
                onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggedId(budget.id);
                }}
                showDropIndicator={dragOverBudgetId === budget.id && draggedId !== budget.id && isSameCategory(draggedId, budget.id)}
                onDragOverItem={(e) => {
                    e.preventDefault();
                    if (isSameCategory(draggedId, budget.id)) {
                        setDragOverBudgetId(budget.id);
                    }
                }}
                onDropOnItem={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleReorder(budget.id);
                    setDragOverBudgetId(null);
                }}
                onDragLeaveItem={() => {
                    setDragOverBudgetId(null);
                }}
            />
        ));
    };

    return (
        <main id="dashboard-page" className="p-4 pb-24" onDragEnd={handleDragEnd}>
            <h1 className="text-3xl font-bold text-primary-navy text-center">Dashboard</h1>
            <p className="text-center text-secondary-gray mb-6">
                {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>

            <OverviewCard
                monthlyIncome={monthlyIncome}
                totalUsedOverall={totalUsedOverall}
                totalRemaining={totalRemaining}
                currentAvailableFunds={currentAvailableFunds}
                totalDailySpentToday={totalDailySpentToday}
                onUseDailyBudget={props.onUseDailyBudget}
                onViewDailyHistory={props.onViewDailyHistory}
                onOpenBatchInput={props.onOpenBatchInput}
            />
            
            <AIInsightCard 
                insight={props.aiInsight}
                isLoading={props.isFetchingInsight}
                onRefresh={props.onRefreshInsight}
            />

            <section className="space-y-8">
                {/* Fixed Budgets Section */}
                <div 
                    onDragOver={(e) => { e.preventDefault(); setDragOverZone('fixed'); }}
                    onDragLeave={() => setDragOverZone(null)}
                    onDrop={() => handleDropOnZone('fixed')}
                    className={`p-4 rounded-xl transition-colors duration-300 ${dragOverZone === 'fixed' ? 'bg-blue-100' : ''}`}
                >
                    <h2 className="text-2xl font-bold text-primary-navy mb-4">Anggaran Tetap</h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        {renderBudgetList(fixedBudgets)}
                    </div>
                </div>
                
                {/* Temporary Budgets Section */}
                <div 
                    onDragOver={(e) => { e.preventDefault(); setDragOverZone('temporary'); }}
                    onDragLeave={() => setDragOverZone(null)}
                    onDrop={() => handleDropOnZone('temporary')}
                    className={`p-4 rounded-xl transition-colors duration-300 border-2 border-dashed ${dragOverZone === 'temporary' ? 'bg-green-100 border-accent-teal' : 'border-secondary-gray'}`}
                >
                    <h2 className="text-2xl font-bold text-primary-navy mb-2">Anggaran Sementara (Bulan Ini Saja)</h2>
                    <p className="text-sm text-secondary-gray mb-4">Seret pos dari atas ke sini untuk menjadikannya sementara. Anggaran di sini akan otomatis diarsipkan di akhir bulan.</p>
                    <div className="grid md:grid-cols-2 gap-6">
                        {temporaryBudgets.length === 0 ? (
                             <div className="md:col-span-2 text-center text-secondary-gray py-6">
                                <p>Belum ada anggaran sementara.</p>
                            </div>
                        ) : (
                            renderBudgetList(temporaryBudgets)
                        )}
                    </div>
                </div>

                 <div className="mt-6">
                    <button 
                        onClick={props.onAddBudget} 
                        className="w-full flex items-center justify-center gap-2 bg-white border-2 border-dashed border-secondary-gray text-secondary-gray font-bold py-3 px-4 rounded-lg hover:bg-gray-50 hover:text-dark-text hover:border-dark-text transition-colors"
                    >
                        <PlusCircleIcon className="w-6 h-6" />
                        <span>Tambah Pos Anggaran Baru</span>
                    </button>
                </div>
            </section>
        </main>
    );
};

export default Dashboard;