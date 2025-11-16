import React from 'react';
import type { AppState, SavingsGoal } from '../types';
import { PlusCircleIcon, BuildingLibraryIcon } from './Icons';

const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

const SavingsGoalCard: React.FC<{
    goal: SavingsGoal;
    onAddSavings: () => void;
    onViewDetails: () => void;
}> = ({ goal, onAddSavings, onViewDetails }) => {
    const percentage = goal.targetAmount > 0 ? (goal.savedAmount / goal.targetAmount) * 100 : 100;

    return (
        <div className="bg-white rounded-xl shadow-md p-4 space-y-3 animate-fade-in">
            <div className="flex justify-between items-start">
                <h3 className="text-lg font-bold text-dark-text">{goal.name}</h3>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${goal.isCompleted ? 'bg-accent-teal text-white' : 'bg-gray-200 text-dark-text'}`}>
                    {goal.isCompleted ? 'Tercapai!' : 'Aktif'}
                </span>
            </div>
            <div>
                <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-primary-navy">{formatCurrency(goal.savedAmount)}</span>
                    <span className="text-secondary-gray">dari {formatCurrency(goal.targetAmount)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-5 overflow-hidden">
                    <div className="bg-accent-teal h-full rounded-full flex items-center justify-center text-white text-xs font-semibold transition-all duration-500" style={{ width: `${Math.min(percentage, 100)}%` }}>
                        {percentage > 15 ? `${percentage.toFixed(0)}%` : ''}
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
                <button onClick={onAddSavings} disabled={goal.isCompleted} className="bg-primary-navy text-white font-bold py-2 px-4 rounded-lg hover:bg-primary-navy-dark transition-colors disabled:bg-gray-400">
                    Tambah
                </button>
                <button onClick={onViewDetails} className="bg-gray-200 text-dark-text font-bold py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors">
                    Detail
                </button>
            </div>
        </div>
    );
};

interface SavingsProps {
    state: AppState;
    onOpenAddGoalModal: () => void;
    onOpenAddSavingsModal: (goalId: number) => void;
    onOpenDetailModal: (goalId: number) => void;
}

const Savings: React.FC<SavingsProps> = ({ state, onOpenAddGoalModal, onOpenAddSavingsModal, onOpenDetailModal }) => {
    const { savingsGoals } = state;

    return (
        <main id="savings-page" className="p-4 pb-24 animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-primary-navy">Celengan</h1>
                <button onClick={onOpenAddGoalModal} className="flex items-center space-x-2 bg-accent-teal text-white font-bold py-2 px-4 rounded-lg hover:bg-accent-teal-dark transition-colors shadow">
                    <PlusCircleIcon className="w-6 h-6" />
                    <span>Baru</span>
                </button>
            </div>

            {savingsGoals.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl shadow-md space-y-4">
                    <BuildingLibraryIcon className="w-20 h-20 mx-auto text-secondary-gray" />
                    <p className="text-secondary-gray">Anda belum punya celengan.</p>
                    <p className="text-secondary-gray">Yuk, mulai menabung untuk tujuan Anda!</p>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 gap-6">
                    {savingsGoals.map(goal => (
                        <SavingsGoalCard 
                            key={goal.id} 
                            goal={goal}
                            onAddSavings={() => onOpenAddSavingsModal(goal.id)}
                            onViewDetails={() => onOpenDetailModal(goal.id)}
                        />
                    ))}
                </div>
            )}
        </main>
    );
};

export default Savings;
