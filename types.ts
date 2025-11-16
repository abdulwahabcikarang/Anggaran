import React from 'react';

export interface Transaction {
  desc: string;
  amount: number;
  timestamp: number;
  sourceCategory?: string; // For daily expense overages
}

export interface Budget {
  id: number;
  name: string;
  totalBudget: number;
  history: Transaction[];
  icon?: string;
  color?: string;
  order: number;
  isArchived: boolean;
  isTemporary: boolean;
}

export interface FundTransaction {
  type: 'add' | 'remove';
  desc: string;
  amount: number;
  timestamp: number;
}

export interface GlobalTransaction extends FundTransaction {
    category?: string;
    icon?: string;
    color?: string;
}

export interface Archive {
  month: string; // YYYY-MM
  transactions: GlobalTransaction[];
}

export interface SavingTransaction {
  amount: number;
  timestamp: number;
  note?: string;
}

export interface SavingsGoal {
  id: number;
  name: string;
  targetAmount?: number;
  isInfinite: boolean;
  savedAmount: number;
  history: SavingTransaction[];
  createdAt: number;
  isCompleted: boolean;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (state: AppState) => boolean;
  streakKey?: 'dailyStreak' | 'monthlyStreak' | 'noSpendStreak' | 'appOpenStreak' | 'morningTransactionStreak' | 'savingStreak';
  category: string;
  points: number;
  streakTarget?: number;
  progress?: (state: AppState) => { current: number; target: number };
  isTimeLimited?: boolean;
}

export interface Asset {
  id: number;
  name: string;
  quantity: number;
  pricePerUnit: number;
}

export interface AppState {
  budgets: Budget[];
  dailyExpenses: Transaction[];
  fundHistory: FundTransaction[];
  archives: Archive[];
  lastArchiveDate: string | null;
  savingsGoals: SavingsGoal[];
  unlockedAchievements: { [id: string]: number }; // id: timestamp
  achievementData?: {
    monthlyStreak?: number;
    dailyStreak?: number;
    noSpendStreak?: number;
    appOpenStreak?: number;
    morningTransactionStreak?: number;
    savingStreak?: number;
    lastStreakCheck?: string; // YYYY-MM-DD
  };
  assets: Asset[];
}

export interface ScannedItem {
  desc: string;
  amount: number;
  budgetId: number | 'daily' | 'none';
}