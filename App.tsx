import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GoogleGenAI, Type, Chat, LiveSession, LiveServerMessage, Modality, Blob as GenAIBlob, FunctionDeclaration } from '@google/genai';
import type { AppState, Budget, Transaction, FundTransaction, GlobalTransaction, ScannedItem, SavingsGoal, SavingTransaction, Achievement, Asset } from './types';
import Dashboard from './components/Dashboard';
import Reports from './components/Reports';
import Visualizations from './components/Visualizations';
import Savings from './components/Savings';
import Achievements from './components/Achievements';
import PersonalBest from './components/PersonalBest';
import NetWorth from './components/NetWorth';
import { allAchievements } from './data/achievements';
import { HomeIcon, ChartBarIcon, DocumentTextIcon, ListBulletIcon, Squares2x2Icon, PlusCircleIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, CameraIcon, LightbulbIcon, SparklesIcon, SpeakerWaveIcon, ChatBubbleLeftRightIcon, PaperAirplaneIcon, TrashIcon, BuildingLibraryIcon, BudgetIcon, availableIcons, availableColors, TrophyIcon, Cog6ToothIcon, InformationCircleIcon, ExclamationTriangleIcon, ArchiveBoxIcon, ArrowUturnLeftIcon, ServerStackIcon, FireIcon, CircleStackIcon, LockClosedIcon } from './components/Icons';

// --- UTILITY FUNCTIONS ---
const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
const formatNumberInput = (value: string | number) => {
    const numString = String(value).replace(/[^0-9]/g, '');
    if (numString === '') return '';
    return new Intl.NumberFormat('id-ID').format(Number(numString));
};
const getRawNumber = (value: string) => Number(value.replace(/[^0-9]/g, ''));

const fileToBase64 = (file: File | Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};

// --- AUDIO UTILITY FUNCTIONS for Gemini Live API ---
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): GenAIBlob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}


// --- MODAL COMPONENTS ---
interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    contentClassName?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, title, size = 'md', contentClassName = 'p-6' }) => {
    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className={`bg-white rounded-xl shadow-2xl w-full ${sizeClasses[size]} animate-fade-in-up flex flex-col max-h-[90vh]`} onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b flex-shrink-0">
                    <h3 className="text-lg font-bold text-primary-navy">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
                </div>
                <div className={`${contentClassName} overflow-y-auto`}>{children}</div>
            </div>
        </div>
    );
};


interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    message: React.ReactNode;
}
const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose, onConfirm, message }) => {
    if(!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm text-center p-6 animate-fade-in-up">
                <div className="text-dark-text mb-6">{message}</div>
                <div className="flex justify-center gap-4">
                    <button onClick={onClose} className="px-6 py-2 rounded-lg bg-gray-200 text-dark-text font-semibold hover:bg-gray-300">Batal</button>
                    <button onClick={onConfirm} className="px-6 py-2 rounded-lg bg-danger-red text-white font-semibold hover:bg-danger-red-dark">OK</button>
                </div>
            </div>
        </div>
    );
};

// --- APP COMPONENT ---
type Page = 'dashboard' | 'reports' | 'visualizations' | 'savings' | 'achievements' | 'personalBest' | 'netWorth';
type ModalType = 'input' | 'funds' | 'addBudget' | 'history' | 'info' | 'menu' | 'editAsset' | 'confirm' | 'scanResult' | 'aiAdvice' | 'smartInput' | 'aiChat' | 'voiceAssistant' | 'voiceResult' | 'addSavingsGoal' | 'addSavings' | 'savingsDetail' | 'settings' | 'archivedBudgets' | 'backupRestore' | 'asset' | 'batchInput';

const APP_VERSION = '3.12.0';
const BACKUP_PREFIX = 'budgetAppBackup_';
const MAX_BACKUPS = 4;

const initialState: AppState = {
    budgets: [],
    dailyExpenses: [],
    fundHistory: [],
    archives: [],
    lastArchiveDate: null,
    savingsGoals: [],
    unlockedAchievements: {},
    achievementData: {
        monthlyStreak: 0,
        dailyStreak: 0,
        noSpendStreak: 0,
        appOpenStreak: 0,
        morningTransactionStreak: 0,
        savingStreak: 0,
        lastStreakCheck: undefined,
    },
    assets: [],
};

const DailyBackupToast: React.FC<{
    backup: { url: string; filename: string };
    onClose: () => void;
}> = ({ backup, onClose }) => {
    return (
        <div 
            className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] bg-white rounded-xl shadow-2xl p-4 flex items-center space-x-4 max-w-md w-[90%] animate-fade-in-down"
        >
            <ArrowDownTrayIcon className="w-10 h-10 text-accent-teal flex-shrink-0" />
            <div>
                <p className="font-bold text-primary-navy">Cadangan Periodik Tersedia</p>
                <p className="text-sm text-secondary-gray">Simpan data Anda untuk keamanan.</p>
                <div className="flex gap-3 mt-2">
                    <a 
                        href={backup.url}
                        download={backup.filename}
                        className="text-sm bg-accent-teal text-white font-semibold py-1 px-3 rounded-lg hover:bg-accent-teal-dark transition-colors"
                    >
                        Unduh Sekarang
                    </a>
                     <button onClick={onClose} className="text-sm text-secondary-gray font-semibold hover:underline">
                        Nanti
                    </button>
                </div>
            </div>
        </div>
    );
};


const App: React.FC = () => {
    const [state, setState] = useState<AppState>(initialState);
    const [currentPage, setCurrentPage] = useState<Page>('dashboard');
    const [activeModal, setActiveModal] = useState<ModalType | null>(null);
    const [internalBackups, setInternalBackups] = useState<{ key: string, timestamp: number }[]>([]);
    const [dailyBackup, setDailyBackup] = useState<{ url: string; filename: string } | null>(null);
    const backupCreatedToday = useRef(false);

    // Modal-specific state
    const [inputModalMode, setInputModalMode] = useState<'use-daily' | 'use-post' | 'edit-post'>('use-daily');
    const [currentBudgetId, setCurrentBudgetId] = useState<number | null>(null);
    const [currentSavingsGoalId, setCurrentSavingsGoalId] = useState<number | null>(null);
    const [currentAssetId, setCurrentAssetId] = useState<number | null>(null);
    const [historyModalContent, setHistoryModalContent] = useState({ title: '', transactions: [] as any[], type: '', budgetId: undefined as (number | undefined) });
    const [confirmModalContent, setConfirmModalContent] = useState({ message: '' as React.ReactNode, onConfirm: () => {} });
    const [prefillData, setPrefillData] = useState<{ desc: string, amount: string } | null>(null);

    // Scan feature state
    const [isScanning, setIsScanning] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);
    const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
    
    // Smart Input state
    const [smartInputResult, setSmartInputResult] = useState<ScannedItem[]>([]);
    const [isProcessingSmartInput, setIsProcessingSmartInput] = useState(false);
    const [smartInputError, setSmartInputError] = useState<string | null>(null);
    
    // AI Advice state
    const [aiAdvice, setAiAdvice] = useState<string>('');
    const [isFetchingAdvice, setIsFetchingAdvice] = useState<boolean>(false);
    const [adviceError, setAdviceError] = useState<string | null>(null);
    
    // AI Dashboard Insight State
    const [aiDashboardInsight, setAiDashboardInsight] = useState<string>('');
    const [isFetchingDashboardInsight, setIsFetchingDashboardInsight] = useState<boolean>(false);

    // AI Chat State
    const [aiChatSession, setAiChatSession] = useState<Chat | null>(null);
    const [aiChatHistory, setAiChatHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
    const [isAiChatLoading, setIsAiChatLoading] = useState<boolean>(false);
    const [aiChatError, setAiChatError] = useState<string | null>(null);

    // AI Search State
    const [aiSearchResults, setAiSearchResults] = useState<GlobalTransaction[] | null>(null);
    const [isSearchingWithAI, setIsSearchingWithAI] = useState<boolean>(false);
    const [aiSearchError, setAiSearchError] = useState<string | null>(null);

    // Voice Assistant State
    const [voiceAssistantResult, setVoiceAssistantResult] = useState<ScannedItem[]>([]);
    
    // Gamification State
    const [newlyUnlockedAchievement, setNewlyUnlockedAchievement] = useState<Achievement | null>(null);


    const importFileInputRef = useRef<HTMLInputElement>(null);
    const scanFileInputRef = useRef<HTMLInputElement>(null);
    
    // Wrapper for setState to also check for achievements and streak resets
    const updateState = useCallback((updater: (prevState: AppState) => AppState) => {
        setState(prevState => {
            const newState = updater(prevState);
            
            // --- INSTANT STREAK RESET LOGIC ---
            const newAchievementData = { ...newState.achievementData };

            // Calculate new financial state for immediate check
            const newMonthlyIncome = newState.fundHistory.filter(t => t.type === 'add').reduce((sum, t) => sum + t.amount, 0);
            const newTotalUsedFromPosts = newState.budgets.reduce((sum, b) => sum + b.history.reduce((s, h) => s + h.amount, 0), 0);
            const newTotalDailySpent = newState.dailyExpenses.reduce((sum, e) => sum + e.amount, 0);
            const newMonthlyGeneralExpense = newState.fundHistory.filter(t => t.type === 'remove').reduce((sum, t) => sum + t.amount, 0);
            const newTotalUsedOverall = newMonthlyGeneralExpense + newTotalUsedFromPosts + newTotalDailySpent;
            const newTotalRemaining = newMonthlyIncome - newTotalUsedOverall;
            
            const newTotalAllocated = newState.budgets.reduce((sum, b) => sum + b.totalBudget, 0);
            const newUnallocatedFunds = newMonthlyIncome - newTotalAllocated;
            const newCurrentAvailableFunds = newUnallocatedFunds - newMonthlyGeneralExpense - newTotalDailySpent;
            const remainingDays = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate() + 1;
            const todaysDailyExpenses = newState.dailyExpenses.filter(exp => new Date(exp.timestamp).toDateString() === new Date().toDateString());
            const totalDailySpentToday = todaysDailyExpenses.reduce((sum, exp) => sum + exp.amount, 0);
            const dailyBudgetMax = remainingDays > 0 ? newCurrentAvailableFunds / remainingDays : newCurrentAvailableFunds;
            const dailyBudgetRemaining = dailyBudgetMax - totalDailySpentToday;

            if (newTotalRemaining < 0) {
                newAchievementData.monthlyStreak = 0;
            }
            if (dailyBudgetRemaining < 0) {
                newAchievementData.dailyStreak = 0;
            }
            
            newState.achievementData = newAchievementData;
            // --- END OF INSTANT STREAK RESET LOGIC ---

            const newlyUnlocked: Achievement[] = [];
            const updatedUnlocked = { ...newState.unlockedAchievements };

            for (const achievement of allAchievements) {
                if (!updatedUnlocked[achievement.id]) {
                    if (achievement.condition(newState)) {
                        updatedUnlocked[achievement.id] = Date.now();
                        newlyUnlocked.push(achievement);
                    }
                }
            }
            
            if (newlyUnlocked.length > 0) {
                setNewlyUnlockedAchievement(newlyUnlocked[0]); // Show toast for the first new one
                setTimeout(() => setNewlyUnlockedAchievement(null), 4000);
                return { ...newState, unlockedAchievements: updatedUnlocked };
            }

            return newState;
        });
    }, []);

    const listInternalBackups = useCallback(() => {
        const backupList: { key: string; timestamp: number }[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(BACKUP_PREFIX)) {
                const timestamp = parseInt(key.split('_')[1], 10);
                if (!isNaN(timestamp)) {
                    backupList.push({ key, timestamp });
                }
            }
        }
        return backupList.sort((a, b) => b.timestamp - a.timestamp);
    }, []);

    // Load state from localStorage on initial render & handle automatic backup
    useEffect(() => {
        // 1. Load main state
        let loadedState = { ...initialState };
        const savedState = localStorage.getItem(`budgetAppState_v${APP_VERSION}`);
        if (savedState) {
            try {
                const parsed = JSON.parse(savedState);
                 if (Array.isArray(parsed.unlockedAchievements)) {
                    const migrated: { [id: string]: number } = {};
                    parsed.unlockedAchievements.forEach((id: string) => { migrated[id] = Date.now(); });
                    parsed.unlockedAchievements = migrated;
                }
                parsed.achievementData = { ...initialState.achievementData, ...parsed.achievementData };
                loadedState = { ...initialState, ...parsed };
            } catch (error) { console.error("Failed to parse state from localStorage", error); }
        }
        setState(loadedState);

        // 2. Handle automatic backup logic with the fresh state
        const backups = listInternalBackups();
        const lastBackupTimestamp = backups.length > 0 ? backups[0].timestamp : 0;
        const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;

        if (Date.now() - lastBackupTimestamp > oneWeekInMs) {
            const newBackupKey = `${BACKUP_PREFIX}${Date.now()}`;
            localStorage.setItem(newBackupKey, JSON.stringify(loadedState));

            // Rotation: if more than MAX_BACKUPS, remove the oldest
            const updatedBackups = listInternalBackups(); // Re-list to include the new one
            if (updatedBackups.length > MAX_BACKUPS) {
                const oldestBackup = updatedBackups[updatedBackups.length - 1];
                localStorage.removeItem(oldestBackup.key);
            }
        }
        
        // 3. Update the UI state for the modal
        setInternalBackups(listInternalBackups());
    }, [listInternalBackups]);

    // Save state to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem(`budgetAppState_v${APP_VERSION}`, JSON.stringify(state));
    }, [state]);

    // Periodic backup useEffect (every 4 days)
    useEffect(() => {
        if (backupCreatedToday.current) return;

        const hasData = state.budgets.length > 0 || state.dailyExpenses.length > 0 || state.fundHistory.length > 0;
        if (!hasData) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lastExportDateStr = localStorage.getItem('lastAutoExportDate');
        let shouldCreateBackup = true;

        if (lastExportDateStr) {
            const lastExportDate = new Date(lastExportDateStr);
            lastExportDate.setHours(0, 0, 0, 0);
            const timeDiff = today.getTime() - lastExportDate.getTime();
            const daysDiff = timeDiff / (1000 * 3600 * 24);
            if (daysDiff < 4) {
                shouldCreateBackup = false;
            }
        }

        if (shouldCreateBackup) {
            try {
                const todayStrForFilename = new Date().toLocaleDateString('fr-CA');
                const dataStr = JSON.stringify(state, null, 2);
                const dataBlob = new Blob([dataStr], { type: "application/json" });
                const url = URL.createObjectURL(dataBlob);
                const filename = `cadangan_anggaran_${todayStrForFilename}.json`;
                
                setDailyBackup({ url, filename });
                localStorage.setItem('lastAutoExportDate', new Date().toLocaleDateString('fr-CA'));
                backupCreatedToday.current = true;
            } catch (error) {
                console.error("Failed to create periodic backup:", error);
            }
        } else {
            backupCreatedToday.current = true; // Mark as checked for this session
        }
    }, [state]);

    // --- CORE LOGIC & DERIVED STATE ---
    const allTransactions = useMemo((): GlobalTransaction[] => {
        let transactions: GlobalTransaction[] = [];
        state.archives.forEach(archive => transactions.push(...archive.transactions));
        transactions.push(...state.fundHistory);
        transactions.push(...state.dailyExpenses.map(t => ({...t, type: 'remove', category: t.sourceCategory || 'Harian'})));
        state.budgets.forEach(b => {
            transactions.push(...b.history.map(h => ({...h, type: 'remove' as const, category: b.name})));
        });
        return transactions.sort((a, b) => b.timestamp - a.timestamp);
    }, [state]);

    const currentAsset = useMemo(() => allTransactions.reduce((sum, t) => t.type === 'add' ? sum + t.amount : sum - t.amount, 0), [allTransactions]);

    const { monthlyIncome, totalUsedOverall, totalRemaining, totalAllocated, unallocatedFunds, generalAndDailyExpenses, remainingUnallocated, totalDailySpent, currentAvailableFunds } = useMemo(() => {
        const monthlyIncome = state.fundHistory.filter(t => t.type === 'add').reduce((sum, t) => sum + t.amount, 0);
        const totalAllocated = state.budgets.reduce((sum, b) => sum + b.totalBudget, 0);
        const totalUsedFromPosts = state.budgets.reduce((sum, b) => sum + b.history.reduce((s, h) => s + h.amount, 0), 0);
        const totalDailySpent = state.dailyExpenses.reduce((sum, e) => sum + e.amount, 0);
        const monthlyGeneralExpense = state.fundHistory.filter(t => t.type === 'remove').reduce((sum, t) => sum + t.amount, 0);
        
        const totalUsedOverall = monthlyGeneralExpense + totalUsedFromPosts + totalDailySpent;
        const totalRemaining = monthlyIncome - totalUsedOverall;
        const unallocatedFunds = monthlyIncome - totalAllocated;
        const generalAndDailyExpenses = monthlyGeneralExpense + totalDailySpent;
        const remainingUnallocated = unallocatedFunds - generalAndDailyExpenses;
        const currentAvailableFunds = unallocatedFunds - generalAndDailyExpenses;
        
        return { monthlyIncome, totalUsedOverall, totalRemaining, totalAllocated, unallocatedFunds, generalAndDailyExpenses, remainingUnallocated, totalDailySpent, currentAvailableFunds };
    }, [state.fundHistory, state.budgets, state.dailyExpenses]);
    
     // --- STREAK INCREMENT & DAILY CHECK LOGIC ---
    useEffect(() => {
        const today = new Date();
        const todayStr = today.toLocaleDateString('fr-CA'); // YYYY-MM-DD
        const lastCheck = state.achievementData?.lastStreakCheck;

        if (todayStr !== lastCheck) {
             const todayNorm = new Date(today);
            todayNorm.setHours(0, 0, 0, 0);
            const lastCheckDate = lastCheck ? new Date(lastCheck) : null;
            if(lastCheckDate) lastCheckDate.setHours(0, 0, 0, 0);
            
            const yesterday = new Date(todayNorm);
            yesterday.setDate(todayNorm.getDate() - 1);
            
            const isConsecutiveDay = lastCheckDate && lastCheckDate.getTime() === yesterday.getTime();
            
            // Check yesterday's data for streaks
            const remainingDays = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate() + 1;
            const yesterdaysDailyExpenses = state.dailyExpenses.filter(exp => new Date(exp.timestamp).toDateString() === yesterday.toDateString());
            const totalDailySpentYesterday = yesterdaysDailyExpenses.reduce((sum, exp) => sum + exp.amount, 0);
            const dailyBudgetMax = remainingDays > 0 ? currentAvailableFunds / remainingDays : currentAvailableFunds;
            const dailyBudgetRemainingYesterday = dailyBudgetMax - totalDailySpentYesterday;
            const hasSpendYesterday = allTransactions.some(t => t.type === 'remove' && new Date(t.timestamp).toDateString() === yesterday.toDateString());
            const hasMorningTxnYesterday = allTransactions.some(t => {
                const d = new Date(t.timestamp);
                return d.toDateString() === yesterday.toDateString() && d.getHours() < 12;
            });
            const hasSavingTxnYesterday = state.savingsGoals.some(g => g.history.some(h => new Date(h.timestamp).toDateString() === yesterday.toDateString()));
            

            updateState(prev => {
                const currentData = prev.achievementData || { ...initialState.achievementData };
                
                let newMonthlyStreak = (totalRemaining >= 0) ? (currentData.monthlyStreak || 0) + 1 : 0;
                let newDailyStreak = (dailyBudgetRemainingYesterday >= 0) ? (currentData.dailyStreak || 0) + 1 : 0;
                let newNoSpendStreak = !hasSpendYesterday ? (currentData.noSpendStreak || 0) + 1 : 0;
                let newAppOpenStreak = isConsecutiveDay ? (currentData.appOpenStreak || 0) + 1 : 1;
                let newMorningTxnStreak = hasMorningTxnYesterday ? (currentData.morningTransactionStreak || 0) + 1 : 0;
                let newSavingStreak = hasSavingTxnYesterday ? (currentData.savingStreak || 0) + 1 : 0;

                return {
                    ...prev,
                    achievementData: {
                        ...currentData,
                        dailyStreak: newDailyStreak,
                        monthlyStreak: newMonthlyStreak,
                        noSpendStreak: newNoSpendStreak,
                        appOpenStreak: newAppOpenStreak,
                        morningTransactionStreak: newMorningTxnStreak,
                        savingStreak: newSavingStreak,
                        lastStreakCheck: todayStr,
                    }
                };
            });
        }
    }, [state.achievementData?.lastStreakCheck, totalRemaining, currentAvailableFunds, state.dailyExpenses, allTransactions, state.savingsGoals, updateState]);


    const handleAddBudget = (name: string, amount: number, icon: string, color: string) => {
        updateState(prev => {
            const newBudget: Budget = { 
                id: Date.now(), 
                name, 
                totalBudget: amount, 
                history: [], 
                icon, 
                color,
                order: prev.budgets.filter(b => !b.isArchived && !b.isTemporary).length,
                isArchived: false,
                isTemporary: false,
            };
            return { ...prev, budgets: [...prev.budgets, newBudget] };
        });
        setActiveModal(null);
    };

    const handleEditBudget = (name: string, amount: number, icon: string, color: string) => {
        if (!currentBudgetId) return;
        updateState(prev => ({
            ...prev,
            budgets: prev.budgets.map(b => b.id === currentBudgetId ? { ...b, name, totalBudget: amount, icon, color } : b)
        }));
        setActiveModal(null);
    };

    const handleArchiveBudget = () => {
        if (!currentBudgetId) return;
        openConfirm("Anda yakin ingin mengarsipkan pos ini? Anda bisa memulihkannya kapan saja dari menu Pengaturan.", () => {
            updateState(prev => {
                const budgetsToReorder = prev.budgets
                    .filter(b => !b.isArchived && b.id !== currentBudgetId)
                    .sort((a, b) => a.order - b.order);

                const newBudgets = prev.budgets.map(b => {
                    if (b.id === currentBudgetId) {
                        return { ...b, isArchived: true };
                    }
                    const newOrder = budgetsToReorder.findIndex(bo => bo.id === b.id);
                    if (newOrder !== -1) {
                        return { ...b, order: newOrder };
                    }
                    return b;
                });

                return { ...prev, budgets: newBudgets };
            });
            setActiveModal(null);
        });
    };

    const handleRestoreBudget = (budgetId: number) => {
        updateState(prev => {
            const numActiveBudgets = prev.budgets.filter(b => !b.isArchived).length;
            const newBudgets = prev.budgets.map(b => 
                b.id === budgetId 
                ? { ...b, isArchived: false, order: numActiveBudgets } 
                : b
            );
            return { ...prev, budgets: newBudgets };
        });
    };

    const handleDeleteBudgetPermanently = (budgetId: number) => {
        const budgetToDelete = state.budgets.find(b => b.id === budgetId);
        if (!budgetToDelete) return;

        openConfirm(
            <>
                <strong>Hapus Permanen?</strong>
                <br />
                Anda akan menghapus pos "<strong>{budgetToDelete.name}</strong>" dan SEMUA riwayat transaksinya. Tindakan ini tidak dapat diurungkan.
            </>,
            () => {
                updateState(prev => ({
                    ...prev,
                    budgets: prev.budgets.filter(b => b.id !== budgetId)
                }));
            }
        );
    };

    const handleReorderBudgets = (reorderedActiveBudgets: Budget[]) => {
        updateState(prev => {
            const activeBudgetMap = new Map(reorderedActiveBudgets.map((b, index) => [b.id, index]));
            const newBudgets = prev.budgets.map(b => {
                if (activeBudgetMap.has(b.id)) {
                    return { ...b, order: activeBudgetMap.get(b.id)! };
                }
                return b;
            });
            return { ...prev, budgets: newBudgets };
        });
    };
    
    const handleSetBudgetPermanence = (budgetId: number, isTemporary: boolean) => {
        updateState(prev => {
            const updatedBudgets = prev.budgets.map(b => b.id === budgetId ? { ...b, isTemporary } : b);
            
            const fixedBudgets = updatedBudgets.filter(b => !b.isArchived && !b.isTemporary).sort((a,b) => a.order - b.order);
            const temporaryBudgets = updatedBudgets.filter(b => !b.isArchived && b.isTemporary).sort((a,b) => a.order - b.order);

            const reorderedBudgets = updatedBudgets.map(b => {
                let newOrder = b.order;
                if (!b.isArchived) {
                    if (b.isTemporary) {
                        newOrder = temporaryBudgets.findIndex(tb => tb.id === b.id);
                    } else {
                        newOrder = fixedBudgets.findIndex(fb => fb.id === b.id);
                    }
                }
                return { ...b, order: newOrder };
            });

            return { ...prev, budgets: reorderedBudgets };
        });
    };

    const handleAddTransaction = (desc: string, amount: number, targetId: 'daily' | number) => {
        const newTransaction: Transaction = { desc, amount, timestamp: Date.now() };

        if (targetId === 'daily') {
            updateState(prev => ({ ...prev, dailyExpenses: [...prev.dailyExpenses, newTransaction] }));
            setActiveModal(null);
        } else { // It's a budget ID
            const budget = state.budgets.find(b => b.id === targetId);
            if (!budget) return;
            const usedAmount = budget.history.reduce((sum, item) => sum + item.amount, 0);
            const remainingQuota = Math.max(0, budget.totalBudget - usedAmount);

            if (amount > remainingQuota) {
                const overageAmount = amount - remainingQuota;
                const confirmOverage = () => {
                    updateState(prev => {
                        const newBudgets = prev.budgets.map(b => {
                            if (b.id === targetId && remainingQuota > 0) {
                                return { ...b, history: [...b.history, { desc, amount: remainingQuota, timestamp: Date.now() }] };
                            }
                            return b;
                        });
                        const newDailyExpenses = [...prev.dailyExpenses, { desc: `[Overage] ${desc}`, amount: overageAmount, timestamp: Date.now(), sourceCategory: budget.name }];
                        return { ...prev, budgets: newBudgets, dailyExpenses: newDailyExpenses };
                    });
                    setActiveModal(null);
                }
                setConfirmModalContent({
                    message: <>Pengeluaran <strong>{formatCurrency(amount)}</strong> melebihi sisa kuota.<br />Sebesar <strong>{formatCurrency(overageAmount)}</strong> akan diambil dari "Dana Tersedia". Lanjutkan?</>,
                    onConfirm: confirmOverage
                });
                setActiveModal('confirm');
                return;
            } else {
                updateState(prev => ({
                    ...prev,
                    budgets: prev.budgets.map(b => b.id === targetId ? { ...b, history: [...b.history, newTransaction] } : b)
                }));
                setActiveModal(null);
            }
        }
    };
    
    const handleSaveScannedItems = (items: ScannedItem[]) => {
        updateState(prev => {
            const newDailyExpenses = [...prev.dailyExpenses];
            const newBudgets = JSON.parse(JSON.stringify(prev.budgets)); // Deep copy

            items.forEach(item => {
                if (item.budgetId === 'none' || item.amount <= 0 || !item.desc.trim()) return;
                
                const newTransaction: Transaction = {
                    desc: item.desc,
                    amount: item.amount,
                    timestamp: Date.now()
                };

                if (item.budgetId === 'daily') {
                    newDailyExpenses.push(newTransaction);
                } else {
                    const budget = newBudgets.find((b: Budget) => b.id === item.budgetId);
                    if (budget) {
                        budget.history.push(newTransaction);
                    }
                }
            });

            return { ...prev, dailyExpenses: newDailyExpenses, budgets: newBudgets };
        });
        setActiveModal(null);
    };

    const handleFundTransaction = (type: 'add' | 'remove', desc: string, amount: number) => {
        const newFundTransaction: FundTransaction = { type, desc, amount, timestamp: Date.now() };
        updateState(prev => ({...prev, fundHistory: [...prev.fundHistory, newFundTransaction]}));
        setActiveModal(null);
    }
    
    const handleDeleteTransaction = (timestamp: number, type: string, budgetId?: number) => {
        updateState(prev => {
            let newState = {...prev};
            if (type === 'daily') {
                newState.dailyExpenses = prev.dailyExpenses.filter(t => t.timestamp !== timestamp);
            } else if (type === 'fund') {
                newState.fundHistory = prev.fundHistory.filter(t => t.timestamp !== timestamp);
            } else if (type === 'post' && budgetId) {
                newState.budgets = prev.budgets.map(b => b.id === budgetId ? {...b, history: b.history.filter(h => h.timestamp !== timestamp)} : b);
            }
            return newState;
        });
        setActiveModal(null);
    }
    
    const handleDeleteGlobalTransaction = (timestamp: number) => {
        updateState(prev => {
            const newState = JSON.parse(JSON.stringify(prev)); // Deep copy

            // Find the transaction to be deleted to check if it's a savings one
            let transactionToDelete: FundTransaction | GlobalTransaction | undefined;
            transactionToDelete = newState.fundHistory.find((t: FundTransaction) => t.timestamp === timestamp);
            if (!transactionToDelete) {
                for (const archive of newState.archives) {
                    const found = archive.transactions.find((t: GlobalTransaction) => t.timestamp === timestamp);
                    if (found) {
                        transactionToDelete = found;
                        break;
                    }
                }
            }
            
            // If it's a savings transaction, update the corresponding goal
            if (transactionToDelete && transactionToDelete.type === 'remove' && transactionToDelete.desc.startsWith('Tabungan: ')) {
                const goalName = transactionToDelete.desc.substring('Tabungan: '.length);
                const goalIndex = newState.savingsGoals.findIndex((g: SavingsGoal) => g.name === goalName);

                if (goalIndex !== -1) {
                    const goal = newState.savingsGoals[goalIndex];
                    const originalHistoryLength = goal.history.length;
                    goal.history = goal.history.filter((h: SavingTransaction) => h.timestamp !== timestamp);

                    // Only update amount if a history item was actually removed
                    if (goal.history.length < originalHistoryLength) {
                        const newSavedAmount = goal.savedAmount - transactionToDelete.amount;
                        goal.savedAmount = newSavedAmount < 0 ? 0 : newSavedAmount;
                        goal.isCompleted = !goal.isInfinite && goal.targetAmount ? goal.savedAmount >= goal.targetAmount : false;
                    }
                }
            }
            
            // The original deletion logic
            newState.fundHistory = newState.fundHistory.filter((t: FundTransaction) => t.timestamp !== timestamp);
            newState.dailyExpenses = newState.dailyExpenses.filter((t: Transaction) => t.timestamp !== timestamp);
            newState.budgets.forEach((b: Budget) => { b.history = b.history.filter((h: Transaction) => h.timestamp !== timestamp); });
            newState.archives.forEach((a: any) => { a.transactions = a.transactions.filter((t: any) => t.timestamp !== timestamp); });
            
            return newState;
        });
    }

    const handleEditAsset = (newAssetAmount: number) => {
        const difference = newAssetAmount - currentAsset;
        if (difference !== 0) {
            const correction: GlobalTransaction = {
                type: difference > 0 ? 'add' : 'remove',
                desc: 'Koreksi Saldo',
                amount: Math.abs(difference),
                timestamp: Date.now()
            };
            updateState(prev => {
                const newArchives = JSON.parse(JSON.stringify(prev.archives));
                if (newArchives.length > 0) {
                    newArchives[newArchives.length - 1].transactions.push(correction);
                } else {
                    const archiveMonth = new Date().toISOString().slice(0, 7);
                    newArchives.push({ month: archiveMonth, transactions: [correction] });
                }
                return { ...prev, archives: newArchives };
            });
        }
        setActiveModal(null);
    };

    // --- ASSET HANDLERS ---
    const handleAddAsset = (name: string, quantity: number, pricePerUnit: number) => {
        const newAsset: Asset = {
            id: Date.now(),
            name,
            quantity,
            pricePerUnit,
        };
        updateState(prev => ({ ...prev, assets: [...prev.assets, newAsset] }));
        setActiveModal(null);
    };

    const handleEditAssetItem = (id: number, name: string, quantity: number, pricePerUnit: number) => {
        updateState(prev => ({
            ...prev,
            assets: prev.assets.map(a => a.id === id ? { ...a, name, quantity, pricePerUnit } : a)
        }));
        setActiveModal(null);
    };

    const handleDeleteAsset = (id: number) => {
        openConfirm("Anda yakin ingin menghapus aset ini dari daftar?", () => {
            updateState(prev => ({ ...prev, assets: prev.assets.filter(a => a.id !== id) }));
        });
    };

    // --- SAVINGS GOAL HANDLERS ---
    const handleAddSavingsGoal = (name: string, isInfinite: boolean, targetAmount?: number) => {
        const newGoal: SavingsGoal = {
            id: Date.now(),
            name,
            targetAmount: isInfinite ? undefined : targetAmount,
            isInfinite: isInfinite,
            savedAmount: 0,
            history: [],
            createdAt: Date.now(),
            isCompleted: false,
        };
        updateState(prev => ({ ...prev, savingsGoals: [...prev.savingsGoals, newGoal] }));
        setActiveModal(null);
    };

    const handleAddSavings = (goalId: number, amount: number) => {
        const goal = state.savingsGoals.find(g => g.id === goalId);
        if (!goal) return;

        // Check if there are enough unallocated funds
        if (amount > currentAvailableFunds) {
            openConfirm(<>Dana tersedia tidak mencukupi. Sisa dana tersedia hanya <strong>{formatCurrency(currentAvailableFunds)}</strong>.</>, () => {});
            return;
        }

        updateState(prev => {
            const transactionTimestamp = Date.now();
            const newFundHistory = [...prev.fundHistory, {
                type: 'remove' as const,
                desc: `Tabungan: ${goal.name}`,
                amount: amount,
                timestamp: transactionTimestamp,
            }];

            const newSavingsGoals = prev.savingsGoals.map(g => {
                if (g.id === goalId) {
                    const newSavedAmount = g.savedAmount + amount;
                    const newHistory: SavingTransaction = { amount, timestamp: transactionTimestamp };
                    return {
                        ...g,
                        savedAmount: newSavedAmount,
                        history: [...g.history, newHistory],
                        isCompleted: !g.isInfinite && g.targetAmount ? newSavedAmount >= g.targetAmount : false,
                    };
                }
                return g;
            });

            return { ...prev, fundHistory: newFundHistory, savingsGoals: newSavingsGoals };
        });
        setActiveModal(null);
    };

    const handleOpenSavingsGoal = (goalId: number) => {
        const goal = state.savingsGoals.find(g => g.id === goalId);
        if (!goal || !goal.isInfinite) return;

        openConfirm(`Anda yakin ingin "membuka" tabungan "${goal.name}"? Dana sebesar ${formatCurrency(goal.savedAmount)} akan dikembalikan ke dana tersedia dan tabungan ini akan menjadi kosong.`, () => {
             updateState(prev => {
                const newFundHistory = goal.savedAmount > 0 ? [...prev.fundHistory, {
                    type: 'add' as const,
                    desc: `Dana dari tabungan: ${goal.name}`,
                    amount: goal.savedAmount,
                    timestamp: Date.now(),
                }] : prev.fundHistory;

                const newSavingsGoals = prev.savingsGoals.map(g => 
                    g.id === goalId ? { ...g, savedAmount: 0, history: [], isCompleted: false } : g
                );

                return { ...prev, fundHistory: newFundHistory, savingsGoals: newSavingsGoals };
            });
        });
    };

     const handleDeleteSavingsGoal = (goalId: number) => {
        const goal = state.savingsGoals.find(g => g.id === goalId);
        if (!goal) return;

        const message = goal.isInfinite ?
            `Anda yakin ingin menghapus celengan "${goal.name}"? Dana sebesar ${formatCurrency(goal.savedAmount)} akan dikembalikan.` :
            `Anda yakin ingin menghapus celengan "${goal.name}"? Dana sebesar ${formatCurrency(goal.savedAmount)} akan dikembalikan ke dana tersedia.`;

        openConfirm(message, () => {
             updateState(prev => {
                const newFundHistory = goal.savedAmount > 0 ? [...prev.fundHistory, {
                    type: 'add' as const,
                    desc: `Batal Tabungan: ${goal.name}`,
                    amount: goal.savedAmount,
                    timestamp: Date.now(),
                }] : prev.fundHistory;

                const newSavingsGoals = prev.savingsGoals.filter(g => g.id !== goalId);

                return { ...prev, fundHistory: newFundHistory, savingsGoals: newSavingsGoals };
            });
            setActiveModal(null);
        });
    };

    const handleExportData = () => {
        const dataStr = JSON.stringify(state, null, 2);
        const dataBlob = new Blob([dataStr], {type: "application/json"});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.download = `data_anggaran_${new Date().toISOString().slice(0, 10)}.json`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setActiveModal(null);
    };

    const handleTriggerImport = () => {
        openConfirm(
            <><strong>PERINGATAN!</strong><br />Mengimpor data akan menghapus semua data saat ini. Lanjutkan?</>,
            () => {
                importFileInputRef.current?.click();
            }
        );
    };

    const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedState = JSON.parse(e.target.result as string);
                if (typeof importedState.budgets !== 'object' || typeof importedState.archives !== 'object') {
                    throw new Error("Format file tidak valid.");
                }
                setState({ ...initialState, ...importedState });
                setCurrentPage('dashboard');
            } catch (err) {
                openConfirm("Gagal memuat file. Pastikan file cadangan tidak rusak dan berformat .json yang benar.", () => {});
            } finally {
                if(importFileInputRef.current) importFileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleManualBackup = () => {
        const newBackupKey = `${BACKUP_PREFIX}${Date.now()}`;
        localStorage.setItem(newBackupKey, JSON.stringify(state));

        const allBackups = listInternalBackups();

        // Rotation
        if (allBackups.length > MAX_BACKUPS) {
            const oldestBackup = allBackups[allBackups.length - 1]; // list is sorted descending, so last is oldest
            localStorage.removeItem(oldestBackup.key);
        }
        
        // Update UI state and show the modal
        setInternalBackups(listInternalBackups());
        setActiveModal('backupRestore');
    };

    const handleRestoreBackup = (key: string) => {
        openConfirm("Memulihkan cadangan ini akan menimpa semua data Anda saat ini. Tindakan ini tidak dapat diurungkan.", () => {
            const backupData = localStorage.getItem(key);
            if (backupData) {
                try {
                    const importedState = JSON.parse(backupData);
                    if (typeof importedState.budgets !== 'object' || typeof importedState.archives !== 'object') {
                       throw new Error("Format cadangan tidak valid.");
                    }
                    setState({ ...initialState, ...importedState });
                    setActiveModal(null);
                    setCurrentPage('dashboard');
                } catch (err) {
                    openConfirm("Gagal memuat cadangan. File mungkin rusak.", () => {});
                }
            } else {
                 openConfirm("Gagal menemukan data cadangan.", () => {});
            }
        });
    };

    const handleResetMonthlyData = () => {
        openConfirm('PERINGATAN: Ini akan menghapus semua data bulan ini TANPA diarsipkan. Hanya untuk uji coba. Lanjutkan?', () => {
            updateState(prev => ({
                ...prev,
                fundHistory: [],
                dailyExpenses: [],
                budgets: prev.budgets.map(b => ({...b, history: []}))
            }));
            setActiveModal(null);
        })
    }
    
    const handleResetAllData = () => {
        openConfirm(
            <><strong>HAPUS SEMUA DATA?</strong><br/>Tindakan ini tidak dapat diurungkan dan akan menghapus semua anggaran, transaksi, dan pencapaian Anda secara permanen.</>,
            () => {
                localStorage.removeItem(`budgetAppState_v${APP_VERSION}`);
                // Also remove internal backups
                Object.keys(localStorage)
                    .filter(key => key.startsWith(BACKUP_PREFIX))
                    .forEach(key => localStorage.removeItem(key));
                window.location.reload();
            }
        );
    };

    // --- SCAN RECEIPT LOGIC ---
    const handleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setActiveModal('scanResult');
        setIsScanning(true);
        setScanError(null);
        setScannedItems([]);
        try {
            const base64Data = await fileToBase64(file);
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

            const imagePart = {
                inlineData: { mimeType: file.type, data: base64Data },
            };
            const textPart = {
                text: "Analyze the receipt image and extract only the individual purchased items with their corresponding prices. Exclude any lines that are not items, such as totals, subtotals, taxes, discounts, or store information. All prices must be positive numbers. Ignore any hyphens or stray characters that are not part of the item's name or price. Your response must be a valid JSON array of objects. Each object must contain 'desc' (string) for the item name and 'amount' (number) for the price. Do not include anything else in your response besides the JSON array."
            };

            const schema = {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    desc: { type: Type.STRING, description: "Nama barang yang dibeli." },
                    amount: { type: Type.NUMBER, description: "Harga barang sebagai angka positif. Abaikan karakter non-numerik seperti tanda hubung (-)." },
                  },
                  required: ["desc", "amount"],
                },
            };
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [imagePart, textPart] },
                config: { responseMimeType: 'application/json', responseSchema: schema },
            });
            
            const resultData = JSON.parse(response.text);
            if (Array.isArray(resultData)) {
                // Ensure all amounts are positive and data is clean
                const sanitizedData = resultData.map(item => ({
                    ...item,
                    amount: Math.abs(Number(item.amount) || 0),
                    budgetId: 'none'
                })).filter(item => item.amount > 0 && item.desc && item.desc.trim() !== ''); // Filter out items with 0 amount or empty description
                setScannedItems(sanitizedData);
            } else {
                throw new Error("AI response is not in the expected format.");
            }
        } catch (error) {
            console.error("Error scanning receipt:", error);
            setScanError("Gagal memindai struk. Coba lagi dengan gambar yang lebih jelas.");
        } finally {
            setIsScanning(false);
            if (scanFileInputRef.current) scanFileInputRef.current.value = '';
        }
    };

    // --- SMART INPUT LOGIC ---
    const handleProcessSmartInput = async (text: string) => {
        if (!text.trim()) {
            setSmartInputError("Mohon masukkan deskripsi transaksi.");
            return;
        }
        setIsProcessingSmartInput(true);
        setSmartInputError(null);
        setSmartInputResult([]);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const budgetCategories = [...state.budgets.filter(b => !b.isArchived).map(b => b.name), 'Uang Harian'];
            
            const schema = {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        desc: { type: Type.STRING },
                        amount: { type: Type.NUMBER },
                        category: { type: Type.STRING, enum: budgetCategories },
                    },
                    required: ["desc", "amount", "category"],
                },
            };

            const prompt = `Analisis teks berikut yang berisi transaksi keuangan dalam Bahasa Indonesia. Ekstrak setiap transaksi individual (deskripsi dan jumlahnya). Untuk setiap transaksi, tentukan kategori anggaran yang paling sesuai dari daftar ini: [${budgetCategories.join(', ')}]. Jika tidak ada yang cocok, gunakan "Uang Harian". Respons Anda HARUS berupa array JSON yang valid dari objek, di mana setiap objek memiliki kunci "desc", "amount", dan "category". Teks: "${text}"`;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [{ text: prompt }] },
                config: { responseMimeType: 'application/json', responseSchema: schema },
            });

            const resultData = JSON.parse(response.text);
            if (Array.isArray(resultData)) {
                const mappedItems: ScannedItem[] = resultData.map(item => {
                    const matchedBudget = state.budgets.find(b => b.name === item.category);
                    let budgetId: ScannedItem['budgetId'] = 'daily';
                    if (matchedBudget) {
                        budgetId = matchedBudget.id;
                    }
                    return { desc: item.desc, amount: item.amount, budgetId: budgetId };
                });
                setSmartInputResult(mappedItems);
            } else {
                throw new Error("Format respons AI tidak terduga.");
            }
        } catch (error) {
            console.error("Error processing smart input:", error);
            setSmartInputError("Gagal memproses input. Coba lagi dengan format yang lebih sederhana.");
        } finally {
            setIsProcessingSmartInput(false);
        }
    };
    
    // --- AI DEEPER INTEGRATION ---
    const handleGetAIAdvice = async () => {
        setActiveModal('aiAdvice');
        setIsFetchingAdvice(true);
        setAiAdvice('');
        setAdviceError(null);

        try {
            const budgetDetails = state.budgets.map(b => {
                const used = b.history.reduce((sum, h) => sum + h.amount, 0);
                return `* ${b.name}: Terpakai ${formatCurrency(used)} dari kuota ${formatCurrency(b.totalBudget)}`;
            }).join('\n');

            const prompt = `
Berikut adalah ringkasan data keuangan saya untuk bulan ini dalam Rupiah (IDR):

* Total Pemasukan: ${formatCurrency(monthlyIncome)}
* Total Pengeluaran: ${formatCurrency(totalUsedOverall)}
* Sisa Dana Bulan Ini: ${formatCurrency(totalRemaining)}

Rincian Pengeluaran berdasarkan Pos Anggaran:
${budgetDetails || "Tidak ada pos anggaran yang dibuat."}

Total Pengeluaran Harian (di luar pos anggaran): ${formatCurrency(totalDailySpent)}

Sisa Dana yang Tidak Terikat Anggaran: ${formatCurrency(remainingUnallocated)}

Berdasarkan data ini, berikan saya analisis singkat dan beberapa saran praktis dalam Bahasa Indonesia untuk mengelola keuangan saya dengan lebih baik. Fokus pada area di mana saya bisa berhemat atau melakukan optimalisasi. Berikan jawaban dalam format poin-poin (bullet points) menggunakan markdown.
            `;

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });

            setAiAdvice(response.text);

        } catch (error) {
            console.error("Error getting AI advice:", error);
            setAdviceError("Gagal mendapatkan saran dari AI. Silakan coba lagi nanti.");
        } finally {
            setIsFetchingAdvice(false);
        }
    };

    const handleFetchDashboardInsight = useCallback(async () => {
        setIsFetchingDashboardInsight(true);
        try {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            sevenDaysAgo.setHours(0, 0, 0, 0);

            // Filter transactions from the last 7 days
            const lastWeekFundHistory = state.fundHistory.filter(t => new Date(t.timestamp) >= sevenDaysAgo);
            const lastWeekDailyExpenses = state.dailyExpenses.filter(t => new Date(t.timestamp) >= sevenDaysAgo);
            const lastWeekBudgets = state.budgets.map(b => ({
                ...b,
                history: b.history.filter(h => new Date(h.timestamp) >= sevenDaysAgo),
            }));

            // Recalculate summaries for the last 7 days
            const lastWeekIncome = lastWeekFundHistory.filter(t => t.type === 'add').reduce((sum, t) => sum + t.amount, 0);
            const lastWeekGeneralExpense = lastWeekFundHistory.filter(t => t.type === 'remove').reduce((sum, t) => sum + t.amount, 0);
            const lastWeekUsedFromPosts = lastWeekBudgets.reduce((sum, b) => sum + b.history.reduce((s, h) => s + h.amount, 0), 0);
            const lastWeekTotalDailySpent = lastWeekDailyExpenses.reduce((sum, e) => sum + e.amount, 0);
            const lastWeekTotalUsed = lastWeekGeneralExpense + lastWeekUsedFromPosts + lastWeekTotalDailySpent;

            const lastWeekBudgetDetails = lastWeekBudgets.map(b => {
                const used = b.history.reduce((sum, h) => sum + h.amount, 0);
                if (used > 0) {
                    return `* ${b.name}: Terpakai ${formatCurrency(used)}`;
                }
                return null;
            }).filter(Boolean).join('\n');


            const prompt = `
Sebagai asisten keuangan AI, berikan analisis singkat dan peringatan proaktif berdasarkan data keuangan 7 hari terakhir ini (dalam IDR). 
Fokus pada:
1. Pemasukan atau pengeluaran terbesar yang signifikan.
2. Peringatan jika total pengeluaran mendekati atau melebihi pemasukan.
3. Sorot tren boros jika ada.

Berikan jawaban singkat, tajam, dan langsung ke intinya dalam Bahasa Indonesia tanpa sapaan.

Data Keuangan 7 Hari Terakhir:
- Pemasukan: ${formatCurrency(lastWeekIncome)}
- Pengeluaran Total: ${formatCurrency(lastWeekTotalUsed)}
- Pengeluaran dari Pos Anggaran:
${lastWeekBudgetDetails || "Tidak ada pengeluaran signifikan dari pos anggaran."}
- Pengeluaran Harian/Umum: ${formatCurrency(lastWeekGeneralExpense + lastWeekTotalDailySpent)}
            `;

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
            setAiDashboardInsight(response.text || "Tidak ada saran untuk saat ini.");
        } catch (error) {
            console.error("Error fetching dashboard insight:", error);
            setAiDashboardInsight("Gagal mengambil wawasan. Periksa koneksi atau coba lagi.");
        } finally {
            setIsFetchingDashboardInsight(false);
        }
    }, [state]);

    useEffect(() => {
        if(monthlyIncome > 0) { // Only fetch if there's data
            handleFetchDashboardInsight();
        } else {
            setAiDashboardInsight("Tambahkan pemasukan bulan ini untuk mendapatkan wawasan dari AI.");
        }
    }, [monthlyIncome, handleFetchDashboardInsight]); // Re-fetch only when income changes as a trigger


    // --- AI CHAT LOGIC ---

    const getFinancialContextForAI = useCallback(() => {
        const budgetDetails = state.budgets.map(b => {
            const used = b.history.reduce((sum, h) => sum + h.amount, 0);
            return `* Pos Anggaran "${b.name}": Kuota ${formatCurrency(b.totalBudget)}, Terpakai ${formatCurrency(used)}, Sisa ${formatCurrency(b.totalBudget - used)}`;
        }).join('\n');
    
        return `Anda adalah asisten keuangan AI yang ramah dan membantu. Tugas Anda adalah menjawab pertanyaan pengguna HANYA berdasarkan data keuangan yang saya berikan di bawah ini. Jangan membuat informasi atau memberikan saran di luar data. Jawab dalam Bahasa Indonesia. Berikut adalah ringkasan data keuangan pengguna untuk bulan ini (dalam IDR): **Ringkasan Umum:** * Total Pemasukan: ${formatCurrency(monthlyIncome)}, * Total Pengeluaran Keseluruhan: ${formatCurrency(totalUsedOverall)}, * Sisa Dana (Pemasukan - Pengeluaran): ${formatCurrency(totalRemaining)}, * Total Dana yang Dialokasikan ke Pos Anggaran: ${formatCurrency(totalAllocated)}, * Dana Tersedia Untuk Pengeluaran Harian/Umum (di luar pos): ${formatCurrency(currentAvailableFunds)}. **Rincian Pos Anggaran:** ${budgetDetails || "Tidak ada pos anggaran yang dibuat."}. **Rincian 10 Transaksi Terakhir:** ${allTransactions.slice(0, 10).map(t => `* ${new Date(t.timestamp).toLocaleDateString('id-ID')}: ${t.desc} (${t.type === 'add' ? '+' : '-'} ${formatCurrency(t.amount)}) - Kategori: ${t.category || (t.type === 'add' ? 'Pemasukan' : 'Umum')}`).join(', ')}. Data sudah lengkap. Anda siap menjawab pertanyaan pengguna.`;
    }, [state, monthlyIncome, totalUsedOverall, totalRemaining, totalAllocated, currentAvailableFunds, allTransactions]);


    const handleOpenAIChat = useCallback(async () => {
        setActiveModal('aiChat');
        setAiChatHistory([]);
        setAiChatError(null);
        setIsAiChatLoading(true);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const contextPrompt = getFinancialContextForAI();
            
            const chat = ai.chats.create({
                model: 'gemini-2.5-flash',
                history: [
                    { role: 'user', parts: [{ text: contextPrompt }] },
                    { role: 'model', parts: [{ text: 'Data diterima. Saya siap membantu.' }] }
                ]
            });

            setAiChatSession(chat);
            setAiChatHistory([{ role: 'model', text: 'Halo! Saya asisten AI Anda. Silakan tanyakan apa saja tentang data keuangan Anda bulan ini.' }]);

        } catch (error) {
            console.error("Error initializing AI Chat:", error);
            setAiChatError("Gagal memulai sesi chat. Silakan coba lagi.");
        } finally {
            setIsAiChatLoading(false);
        }

    }, [getFinancialContextForAI]);

    const handleSendChatMessage = async (message: string) => {
        if (!aiChatSession) {
            setAiChatError("Sesi chat tidak aktif. Silakan tutup dan buka kembali.");
            return;
        }

        setAiChatHistory(prev => [...prev, { role: 'user', text: message }]);
        setIsAiChatLoading(true);
        setAiChatError(null);

        try {
            const response = await aiChatSession.sendMessage({ message });
            setAiChatHistory(prev => [...prev, { role: 'model', text: response.text }]);
        } catch (error) {
            console.error("Error sending AI Chat message:", error);
            setAiChatError("Gagal mengirim pesan. Mohon coba lagi.");
        } finally {
            setIsAiChatLoading(false);
        }
    };
    
    // --- AI SEARCH LOGIC ---
    const handleAiSearch = async (query: string) => {
        setIsSearchingWithAI(true);
        setAiSearchError(null);
        setAiSearchResults(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

            const transactionsForPrompt = allTransactions.map(t => ({
                timestamp: t.timestamp,
                desc: t.desc,
                amount: t.amount,
                type: t.type,
                category: t.category || (t.type === 'add' ? 'Pemasukan' : 'Umum')
            }));

            const prompt = `You are a smart search engine for a user's financial transactions. Analyze the user's natural language query and the provided JSON data of all their transactions. Your task is to identify and return ONLY the timestamps of the transactions that precisely match the user's query.

User Query: "${query}"

Transaction Data (JSON):
${JSON.stringify(transactionsForPrompt)}

Your response MUST be a valid JSON array containing only the numbers (timestamps) of the matching transactions. For example: [1678886400000, 1678972800000]. If no transactions match, return an empty array [].`;

            const schema = {
                type: Type.ARRAY,
                items: { type: Type.NUMBER },
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [{ text: prompt }] },
                config: { responseMimeType: 'application/json', responseSchema: schema },
            });
            
            const matchingTimestamps = JSON.parse(response.text) as number[];
            
            const results = allTransactions.filter(t => matchingTimestamps.includes(t.timestamp));
            setAiSearchResults(results.sort((a, b) => b.timestamp - a.timestamp));

        } catch (error) {
            console.error("Error with AI Search:", error);
            setAiSearchError("Gagal melakukan pencarian AI. Coba lagi.");
        } finally {
            setIsSearchingWithAI(false);
        }
    };

    const handleClearAiSearch = () => {
        setAiSearchResults(null);
        setAiSearchError(null);
    };


    // --- MODAL OPEN HANDLERS ---
    const openUseDailyBudget = () => { setInputModalMode('use-daily'); setActiveModal('input'); };
    const openUseBudget = (budgetId: number) => { setInputModalMode('use-post'); setCurrentBudgetId(budgetId); setActiveModal('input'); };
    const openEditBudget = (budgetId: number) => { setInputModalMode('edit-post'); setCurrentBudgetId(budgetId); setActiveModal('input'); };
    const openFundHistory = () => {
        setHistoryModalContent({ title: 'Riwayat Dana Bulan Ini', transactions: state.fundHistory.slice().reverse(), type: 'fund', budgetId: undefined });
        setActiveModal('history');
    };
    const openDailyHistory = () => {
        setHistoryModalContent({
            title: 'Riwayat Pengeluaran Harian',
            transactions: state.dailyExpenses.slice().reverse(),
            type: 'daily',
            budgetId: undefined,
        });
        setActiveModal('history');
    };
    const openConfirm = (message: React.ReactNode, onConfirm: () => void) => {
        setConfirmModalContent({ message, onConfirm });
        setActiveModal('confirm');
    };
    const openAssetModal = (assetId: number | null) => {
        setCurrentAssetId(assetId);
        setActiveModal('asset');
    }
    const openBatchInput = () => setActiveModal('batchInput');
    
    // --- RENDER LOGIC ---
    const calculateUserLevel = (points: number): { level: string; currentLevelPoints: number; nextLevelPoints: number | null; } => {
        const levels = [
            { name: 'Pemula Finansial', points: 0 },
            { name: 'Pengelola Cerdas', points: 150 },
            { name: 'Pakar Anggaran', points: 400 },
            { name: 'Sultan Finansial', points: 750 },
            { name: 'Master Keuangan', points: 1200 },
        ];
        let currentLevel = levels[0];
        let nextLevel: { name: string; points: number; } | null = null;
    
        for (let i = 0; i < levels.length; i++) {
            if (points >= levels[i].points) {
                currentLevel = levels[i];
                if (i + 1 < levels.length) {
                    nextLevel = levels[i + 1];
                } else {
                    nextLevel = null;
                }
            } else {
                if (!nextLevel) {
                    nextLevel = levels[i];
                }
                break;
            }
        }
        return { level: currentLevel.name, currentLevelPoints: currentLevel.points, nextLevelPoints: nextLevel ? nextLevel.points : null };
    };

    const renderPage = () => {
        switch (currentPage) {
            case 'reports':
                return <Reports 
                            state={state} 
                            onBack={() => setCurrentPage('dashboard')} 
                            onEditAsset={() => setActiveModal('editAsset')}
                            onDeleteTransaction={(timestamp) => openConfirm(
                                'Yakin ingin menghapus transaksi ini secara PERMANEN dari seluruh data?',
                                () => handleDeleteGlobalTransaction(timestamp)
                            )}
                            aiSearchResults={aiSearchResults}
                            isSearchingWithAI={isSearchingWithAI}
                            aiSearchError={aiSearchError}
                            onAiSearch={handleAiSearch}
                            onClearAiSearch={handleClearAiSearch}
                       />;
            case 'visualizations':
                 return <Visualizations state={state} onBack={() => setCurrentPage('dashboard')} />;
            case 'savings':
                 return <Savings 
                            state={state} 
                            onOpenAddGoalModal={() => setActiveModal('addSavingsGoal')} 
                            onOpenAddSavingsModal={(goalId) => { setCurrentSavingsGoalId(goalId); setActiveModal('addSavings'); }}
                            onOpenDetailModal={(goalId) => { setCurrentSavingsGoalId(goalId); setActiveModal('savingsDetail'); }}
                            onOpenSavingsGoal={handleOpenSavingsGoal}
                        />;
            case 'achievements':
                const unlockedAchIds = Object.keys(state.unlockedAchievements);
                const totalPoints = allAchievements
                    .filter(ach => unlockedAchIds.includes(ach.id))
                    .reduce((sum, ach) => sum + (ach.points || 0), 0);
                const levelInfo = calculateUserLevel(totalPoints);
                return <Achievements 
                    state={state}
                    allAchievements={allAchievements} 
                    unlockedAchievements={state.unlockedAchievements} 
                    achievementData={state.achievementData}
                    totalPoints={totalPoints}
                    userLevel={levelInfo}
                />;
            case 'personalBest':
                return <PersonalBest state={state} />;
            case 'netWorth':
                return <NetWorth 
                    state={state}
                    currentCashAsset={currentAsset}
                    onAddAsset={() => openAssetModal(null)}
                    onEditAsset={(assetId) => openAssetModal(assetId)}
                    onDeleteAsset={handleDeleteAsset}
                />;
            case 'dashboard':
            default:
                return <Dashboard
                    state={state}
                    onUseDailyBudget={openUseDailyBudget}
                    onManageFunds={() => setActiveModal('funds')}
                    onUseBudget={openUseBudget}
                    onEditBudget={openEditBudget}
                    aiInsight={aiDashboardInsight}
                    isFetchingInsight={isFetchingDashboardInsight}
                    onRefreshInsight={handleFetchDashboardInsight}
                    onViewDailyHistory={openDailyHistory}
                    onAddBudget={() => setActiveModal('addBudget')}
                    onReorderBudgets={handleReorderBudgets}
                    onSetBudgetPermanence={handleSetBudgetPermanence}
                    onOpenBatchInput={openBatchInput}
                />;
        }
    };

    const budgetForInputModal = state.budgets.find(b => b.id === currentBudgetId);
    const savingsGoalForModal = state.savingsGoals.find(g => g.id === currentSavingsGoalId);
    const assetForModal = state.assets.find(a => a.id === currentAssetId);
    
    const handleInputSubmit = (data: { description: string, amount: number, targetId?: 'daily' | number, icon?: string, color?: string }) => {
        if (inputModalMode === 'edit-post' && data.icon && data.color) {
            handleEditBudget(data.description, data.amount, data.icon, data.color);
        } else if (data.targetId !== undefined) {
            handleAddTransaction(data.description, data.amount, data.targetId);
        }
    };

    const handleCloseBackupToast = () => {
        if (dailyBackup) {
            URL.revokeObjectURL(dailyBackup.url);
        }
        setDailyBackup(null);
    };


    // --- JSX ---
    return (
        <div className="container mx-auto max-w-3xl font-sans text-dark-text">
            <input type="file" ref={importFileInputRef} accept=".json" className="hidden" onChange={handleImportData} />
            <input type="file" ref={scanFileInputRef} accept="image/*" className="hidden" onChange={handleImageFileChange} />
            
            <AchievementUnlockedToast achievement={newlyUnlockedAchievement} />

            {dailyBackup && <DailyBackupToast backup={dailyBackup} onClose={handleCloseBackupToast} />}

            {renderPage()}
            
            <BottomNavBar 
                currentPage={currentPage}
                onNavigate={setCurrentPage}
                onOpenMenu={() => setActiveModal('menu')}
            />

            {/* --- MODALS --- */}
            <Modal isOpen={activeModal === 'input'} onClose={() => setActiveModal(null)} title={
                inputModalMode === 'edit-post' ? 'Edit Pos Anggaran' : 'Gunakan Uang'
            }>
                <InputModalContent 
                    mode={inputModalMode} 
                    budget={budgetForInputModal}
                    allBudgets={state.budgets.filter(b => !b.isArchived)}
                    onSubmit={handleInputSubmit}
                    onArchive={handleArchiveBudget}
                    prefillData={prefillData}
                    onPrefillConsumed={() => setPrefillData(null)}
                />
            </Modal>
            
            <Modal isOpen={activeModal === 'asset'} onClose={() => setActiveModal(null)} title={currentAssetId ? 'Edit Aset' : 'Tambah Aset Baru'}>
                <AssetModalContent
                    assetToEdit={assetForModal}
                    onSubmit={(id, name, quantity, price) => {
                        if(id) {
                            handleEditAssetItem(id, name, quantity, price);
                        } else {
                            handleAddAsset(name, quantity, price);
                        }
                    }}
                />
            </Modal>

            <Modal isOpen={activeModal === 'batchInput'} onClose={() => setActiveModal(null)} title="Catat Banyak Pengeluaran" size="lg">
                <BatchInputModalContent 
                    budgets={state.budgets.filter(b => !b.isArchived)}
                    onSave={handleSaveScannedItems}
                />
            </Modal>

            <Modal isOpen={activeModal === 'addBudget'} onClose={() => setActiveModal(null)} title="Buat Pos Anggaran Baru">
                <AddBudgetModalContent onSubmit={handleAddBudget} />
            </Modal>

            <Modal isOpen={activeModal === 'addSavingsGoal'} onClose={() => setActiveModal(null)} title="Buat Celengan Baru">
                <AddSavingsGoalModalContent onSubmit={handleAddSavingsGoal} />
            </Modal>
            
            <Modal isOpen={activeModal === 'addSavings'} onClose={() => setActiveModal(null)} title={`Tambah Tabungan: ${savingsGoalForModal?.name || ''}`}>
                <AddSavingsModalContent
                    goal={savingsGoalForModal}
                    availableFunds={currentAvailableFunds}
                    onSubmit={(amount) => currentSavingsGoalId && handleAddSavings(currentSavingsGoalId, amount)}
                />
            </Modal>

            <Modal isOpen={activeModal === 'savingsDetail'} onClose={() => setActiveModal(null)} title={`Detail: ${savingsGoalForModal?.name || ''}`}>
                <SavingsDetailModalContent
                    goal={savingsGoalForModal}
                    onDelete={() => currentSavingsGoalId && handleDeleteSavingsGoal(currentSavingsGoalId)}
                />
            </Modal>


            <Modal isOpen={activeModal === 'funds'} onClose={() => setActiveModal(null)} title="Kelola Dana Bulan Ini">
                <FundsManagementModalContent onSubmit={handleFundTransaction} onViewHistory={openFundHistory} />
            </Modal>
            
            <Modal isOpen={activeModal === 'history'} onClose={() => setActiveModal(null)} title={historyModalContent.title}>
                <HistoryModalContent 
                    transactions={historyModalContent.transactions} 
                    type={historyModalContent.type} 
                    budgetId={historyModalContent.budgetId}
                    onDelete={(timestamp, type, budgetId) => openConfirm("Yakin menghapus transaksi ini? Dana akan dikembalikan.", () => handleDeleteTransaction(timestamp, type, budgetId))} 
                />
            </Modal>

             <Modal isOpen={activeModal === 'info'} onClose={() => setActiveModal(null)} title="Info Keuangan Bulan Ini">
                <InfoModalContent
                    monthlyIncome={monthlyIncome}
                    totalAllocated={totalAllocated}
                    unallocatedFunds={unallocatedFunds}
                    generalAndDailyExpenses={generalAndDailyExpenses}
                    remainingUnallocated={remainingUnallocated}
                />
            </Modal>

             <Modal isOpen={activeModal === 'editAsset'} onClose={() => setActiveModal(null)} title="Koreksi Saldo Aset">
                <EditAssetModalContent currentAsset={currentAsset} onSubmit={handleEditAsset} />
            </Modal>
            
            <Modal isOpen={activeModal === 'menu'} onClose={() => setActiveModal(null)} title="Menu & Opsi">
                <MainMenu 
                    onNavigate={(page) => { setCurrentPage(page); setActiveModal(null); }}
                    onShowInfo={() => setActiveModal('info')}
                    onManageFunds={() => setActiveModal('funds')}
                    onScanReceipt={() => {}}
                    onSmartInput={() => {}}
                    onVoiceInput={() => {}}
                    onAskAI={() => {}}
                    onGetAIAdvice={() => {}}
                    onOpenSettings={() => setActiveModal('settings')}
                />
            </Modal>
            
            <Modal isOpen={activeModal === 'settings'} onClose={() => setActiveModal(null)} title="Pengaturan & Opsi">
                <SettingsModalContent
                    onExport={() => { setActiveModal(null); handleExportData(); }}
                    onImport={handleTriggerImport}
                    onManageArchived={() => setActiveModal('archivedBudgets')}
                    onManualBackup={handleManualBackup}
                    onManageBackups={() => setActiveModal('backupRestore')}
                    onResetMonthly={handleResetMonthlyData}
                    onResetAll={handleResetAllData}
                />
            </Modal>
            
            <Modal isOpen={activeModal === 'archivedBudgets'} onClose={() => setActiveModal(null)} title="Kelola Anggaran Diarsipkan">
                <ArchivedBudgetsModalContent
                    archivedBudgets={state.budgets.filter(b => b.isArchived)}
                    onRestore={handleRestoreBudget}
                    onDelete={handleDeleteBudgetPermanently}
                />
            </Modal>
            
            <Modal isOpen={activeModal === 'backupRestore'} onClose={() => setActiveModal(null)} title="Cadangan Internal Otomatis">
                <BackupRestoreModalContent
                    backups={internalBackups}
                    onRestore={handleRestoreBackup}
                />
            </Modal>

            <Modal isOpen={activeModal === 'scanResult'} onClose={() => setActiveModal(null)} title="Hasil Pindai Struk">
                <ScanResultModalContent 
                    isLoading={isScanning}
                    error={scanError}
                    items={scannedItems}
                    budgets={state.budgets.filter(b => !b.isArchived)}
                    onItemsChange={setScannedItems}
                    onSave={() => handleSaveScannedItems(scannedItems)}
                />
            </Modal>
            
             <Modal isOpen={activeModal === 'voiceAssistant'} onClose={() => setActiveModal(null)} title="Asisten Suara Interaktif" size="lg" contentClassName="p-0">
                {activeModal === 'voiceAssistant' && (
                    <VoiceAssistantModalContent
                        budgets={state.budgets.filter(b => !b.isArchived)}
                        onFinish={(items) => {
                            setVoiceAssistantResult(items);
                            setActiveModal('voiceResult');
                        }}
                        onClose={() => setActiveModal(null)}
                    />
                )}
            </Modal>
            
            <Modal isOpen={activeModal === 'voiceResult'} onClose={() => setActiveModal(null)} title="Konfirmasi Transaksi Suara">
                <ScanResultModalContent
                    isLoading={false}
                    error={null}
                    items={voiceAssistantResult}
                    budgets={state.budgets.filter(b => !b.isArchived)}
                    onItemsChange={setVoiceAssistantResult}
                    onSave={() => {
                        handleSaveScannedItems(voiceAssistantResult);
                        setVoiceAssistantResult([]);
                    }}
                />
            </Modal>


            <Modal isOpen={activeModal === 'smartInput'} onClose={() => setActiveModal(null)} title="Input Transaksi Cerdas">
                <SmartInputModalContent
                    isProcessing={isProcessingSmartInput}
                    error={smartInputError}
                    resultItems={smartInputResult}
                    budgets={state.budgets.filter(b => !b.isArchived)}
                    onProcess={handleProcessSmartInput}
                    onSave={() => handleSaveScannedItems(smartInputResult)}
                    onItemsChange={setSmartInputResult}
                    onClearError={() => setSmartInputError(null)}
                />
            </Modal>
            
             <Modal isOpen={activeModal === 'aiAdvice'} onClose={() => setActiveModal(null)} title="Saran Keuangan dari AI">
                <AIAdviceModalContent 
                    isLoading={isFetchingAdvice}
                    error={adviceError}
                    advice={aiAdvice}
                />
            </Modal>
            
            <Modal isOpen={activeModal === 'aiChat'} onClose={() => {setActiveModal(null); setAiChatSession(null);}} title="Tanya AI" size="lg" contentClassName="p-0">
                <AIChatModalContent
                    history={aiChatHistory}
                    isLoading={isAiChatLoading}
                    error={aiChatError}
                    onSendMessage={handleSendChatMessage}
                />
            </Modal>

            <ConfirmModal 
                isOpen={activeModal === 'confirm'}
                onClose={() => setActiveModal(null)}
                onConfirm={() => { confirmModalContent.onConfirm(); setActiveModal(null); }}
                message={confirmModalContent.message}
            />

        </div>
    );
};


// --- UI COMPONENTS ---
const BottomNavBar: React.FC<{
    currentPage: Page;
    onNavigate: (page: Page) => void;
    onOpenMenu: () => void;
}> = ({ currentPage, onNavigate, onOpenMenu }) => {
    const navItems = [
        { page: 'dashboard', icon: HomeIcon, label: 'Dashboard' },
        { page: 'reports', icon: DocumentTextIcon, label: 'Laporan' },
        { page: 'visualizations', icon: ChartBarIcon, label: 'Grafik' },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)] max-w-3xl mx-auto border-t">
            <div className="flex justify-around items-center h-16">
                {navItems.map(item => (
                    <button 
                        key={item.page} 
                        onClick={() => onNavigate(item.page as Page)}
                        className={`flex flex-col items-center justify-center space-y-1 w-full h-full transition-colors ${currentPage === item.page ? 'text-primary-navy' : 'text-secondary-gray'}`}
                    >
                        <item.icon className="w-6 h-6" />
                        <span className={`text-xs font-medium ${currentPage === item.page ? 'font-bold' : ''}`}>{item.label}</span>
                    </button>
                ))}
                <button
                    onClick={onOpenMenu}
                    className="flex flex-col items-center justify-center space-y-1 w-full h-full text-secondary-gray"
                >
                    <Squares2x2Icon className="w-6 h-6" />
                    <span className="text-xs font-medium">Menu</span>
                </button>
            </div>
        </nav>
    );
}

const AchievementUnlockedToast: React.FC<{ achievement: Achievement | null }> = ({ achievement }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (achievement) {
            setVisible(true);
            const timer = setTimeout(() => setVisible(false), 3500);
            return () => clearTimeout(timer);
        }
    }, [achievement]);

    return (
        <div 
            className={`fixed top-5 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 ease-in-out ${visible ? 'translate-y-0 opacity-100' : '-translate-y-20 opacity-0'}`}
        >
            {achievement && (
                <div className="bg-primary-navy text-white rounded-xl shadow-2xl p-4 flex items-center space-x-4 max-w-sm mx-auto">
                    <TrophyIcon className="w-10 h-10 text-warning-yellow flex-shrink-0" />
                    <div>
                        <p className="font-bold">Lencana Terbuka!</p>
                        <p className="text-sm">{achievement.name}</p>
                    </div>
                </div>
            )}
        </div>
    );
};


// --- MODAL CONTENT COMPONENTS ---

const InputModalContent: React.FC<{
    mode: 'use-daily' | 'use-post' | 'edit-post';
    budget?: Budget;
    allBudgets: Budget[];
    onSubmit: (data: { description: string, amount: number, targetId?: 'daily' | number, icon?: string, color?: string }) => void;
    onArchive: () => void;
    prefillData: { desc: string, amount: string } | null;
    onPrefillConsumed: () => void;
}> = ({ mode, budget, allBudgets, onSubmit, onArchive, prefillData, onPrefillConsumed }) => {
    const [amount, setAmount] = useState('');
    const [desc, setDesc] = useState('');
    const [target, setTarget] = useState<'daily' | number>('daily');
    const [suggestion, setSuggestion] = useState<string | null>(null);
    const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [selectedIcon, setSelectedIcon] = useState(budget?.icon || availableIcons[0]);
    const [selectedColor, setSelectedColor] = useState(budget?.color || availableColors[0]);

    useEffect(() => {
        if (prefillData) {
            setDesc(prefillData.desc);
            setAmount(prefillData.amount);
            onPrefillConsumed();
        } else if (mode === 'edit-post' && budget) {
            setAmount(formatNumberInput(budget.totalBudget));
            setDesc(budget.name);
            setSelectedIcon(budget.icon || availableIcons[0]);
            setSelectedColor(budget.color || availableColors[0]);
        } else {
            setAmount('');
            setDesc('');
        }
        
        if (mode === 'use-post' && budget) {
            setTarget(budget.id);
        } else {
            setTarget('daily');
        }

        setSuggestion(null);
        setSuggestedCategory(null);
        setIsSuggesting(false);
    }, [mode, budget, prefillData]);

    const handleDescBlur = () => {
        // AI suggestion feature is now locked/disabled.
    };


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const rawAmount = getRawNumber(amount);
        if (rawAmount > 0 && desc.trim()) {
            if (mode === 'edit-post') {
                onSubmit({ description: desc, amount: rawAmount, icon: selectedIcon, color: selectedColor });
            } else {
                onSubmit({ description: desc, amount: rawAmount, targetId: target });
            }
        }
    };

    const handleSwitchCategory = () => {
        if (suggestedCategory) {
            const suggestedBudget = allBudgets.find(b => b.name === suggestedCategory);
            if (suggestedBudget) {
                setTarget(suggestedBudget.id);
            }
            setSuggestion(null);
            setSuggestedCategory(null);
        }
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {mode !== 'edit-post' && (
                 <div>
                    <label htmlFor="input-target" className="block text-sm font-medium text-secondary-gray">Alokasi Dana</label>
                    <select 
                        id="input-target" 
                        value={target} 
                        onChange={e => setTarget(e.target.value === 'daily' ? 'daily' : Number(e.target.value))}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary-navy focus:border-primary-navy"
                    >
                        <option value="daily">Uang Harian</option>
                        {allBudgets.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
            )}
            
            {mode !== 'edit-post' ? (
                <div>
                    <label htmlFor="input-desc" className="block text-sm font-medium text-secondary-gray">Keterangan</label>
                    <input type="text" id="input-desc" value={desc} onChange={e => setDesc(e.target.value)} onBlur={handleDescBlur} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-navy focus:border-primary-navy"/>
                    {isSuggesting && <p className="text-xs text-gray-500 mt-1 animate-pulse">Menganalisis...</p>}
                    {suggestion && suggestedCategory && (
                        <div className="mt-2 text-sm text-primary-navy bg-blue-50 p-3 rounded-md">
                            <div className="flex items-start space-x-2">
                                <SparklesIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>{suggestion}</span>
                            </div>
                            <button
                                type="button"
                                onClick={handleSwitchCategory}
                                className="mt-2 w-full text-sm bg-primary-navy text-white font-semibold py-2 px-3 rounded-lg hover:bg-primary-navy-dark transition-colors"
                            >
                                Pindahkan ke "{suggestedCategory}"
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                 <div>
                    <label htmlFor="input-desc-edit" className="block text-sm font-medium text-secondary-gray">Nama Pos Anggaran</label>
                    <input type="text" id="input-desc-edit" value={desc} onChange={e => setDesc(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-navy focus:border-primary-navy"/>
                </div>
            )}
            <div>
                <label htmlFor="input-amount" className="block text-sm font-medium text-secondary-gray">{mode === 'edit-post' ? 'Kuota Dana (Rp)' : 'Nominal (Rp)'}</label>
                <input type="text" id="input-amount" value={amount} onChange={e => setAmount(formatNumberInput(e.target.value))} required inputMode="numeric" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-navy focus:border-primary-navy"/>
            </div>
             {mode === 'edit-post' && (
                <div className="space-y-4">
                    <IconColorPicker 
                        selectedIcon={selectedIcon} 
                        selectedColor={selectedColor}
                        onIconSelect={setSelectedIcon}
                        onColorSelect={setSelectedColor}
                    />
                </div>
            )}
            <div className="pt-2 flex flex-col gap-3">
                <button type="submit" className="w-full bg-primary-navy text-white font-bold py-3 rounded-lg hover:bg-primary-navy-dark transition-colors">Simpan</button>
                {mode === 'edit-post' && (
                    <button type="button" onClick={onArchive} className="w-full flex items-center justify-center gap-2 bg-yellow-500 text-white font-bold py-3 rounded-lg hover:bg-yellow-600 transition-colors">
                        <ArchiveBoxIcon className="w-5 h-5" />
                        <span>Arsipkan Pos Ini</span>
                    </button>
                )}
            </div>
        </form>
    );
};

const AddBudgetModalContent: React.FC<{ onSubmit: (name: string, amount: number, icon: string, color: string) => void }> = ({ onSubmit }) => {
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const [selectedIcon, setSelectedIcon] = useState(availableIcons[0]);
    const [selectedColor, setSelectedColor] = useState(availableColors[0]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const rawAmount = getRawNumber(amount);
        if (name && rawAmount > 0) {
            onSubmit(name, rawAmount, selectedIcon, selectedColor);
        }
    };
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="budget-name" className="block text-sm font-medium text-secondary-gray">Nama Anggaran</label>
                <input type="text" id="budget-name" value={name} onChange={e => setName(e.target.value)} required placeholder="Contoh: Belanja Bulanan" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-navy focus:border-primary-navy"/>
            </div>
            <div>
                <label htmlFor="budget-amount" className="block text-sm font-medium text-secondary-gray">Kuota Dana (Rp)</label>
                <input type="text" id="budget-amount" value={amount} onChange={e => setAmount(formatNumberInput(e.target.value))} required placeholder="Contoh: 1.000.000" inputMode="numeric" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-navy focus:border-primary-navy"/>
            </div>
            <IconColorPicker 
                selectedIcon={selectedIcon} 
                selectedColor={selectedColor}
                onIconSelect={setSelectedIcon}
                onColorSelect={setSelectedColor}
            />
            <button type="submit" className="w-full bg-primary-navy text-white font-bold py-3 rounded-lg hover:bg-primary-navy-dark transition-colors">Tambah Pos Anggaran</button>
        </form>
    );
};

const AssetModalContent: React.FC<{
    assetToEdit?: Asset;
    onSubmit: (id: number | null, name: string, quantity: number, pricePerUnit: number) => void;
}> = ({ assetToEdit, onSubmit }) => {
    const [name, setName] = useState('');
    const [quantity, setQuantity] = useState('');
    const [price, setPrice] = useState('');

    useEffect(() => {
        if (assetToEdit) {
            setName(assetToEdit.name);
            setQuantity(String(assetToEdit.quantity));
            setPrice(formatNumberInput(assetToEdit.pricePerUnit));
        }
    }, [assetToEdit]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const rawQuantity = getRawNumber(quantity);
        const rawPrice = getRawNumber(price);
        if (name.trim() && rawQuantity > 0 && rawPrice > 0) {
            onSubmit(assetToEdit?.id || null, name.trim(), rawQuantity, rawPrice);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="asset-name" className="block text-sm font-medium text-secondary-gray">Nama Aset</label>
                <input type="text" id="asset-name" value={name} onChange={e => setName(e.target.value)} required placeholder="Contoh: Laptop MacBook Pro" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-navy focus:border-primary-navy"/>
            </div>
            <div>
                <label htmlFor="asset-quantity" className="block text-sm font-medium text-secondary-gray">Jumlah</label>
                <input type="text" id="asset-quantity" value={quantity} onChange={e => setQuantity(formatNumberInput(e.target.value))} required placeholder="Contoh: 1" inputMode="numeric" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-navy focus:border-primary-navy"/>
            </div>
            <div>
                <label htmlFor="asset-price" className="block text-sm font-medium text-secondary-gray">Perkiraan Harga per Unit (Rp)</label>
                <input type="text" id="asset-price" value={price} onChange={e => setPrice(formatNumberInput(e.target.value))} required placeholder="Contoh: 20.000.000" inputMode="numeric" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-navy focus:border-primary-navy"/>
            </div>
            <button type="submit" className="w-full bg-primary-navy text-white font-bold py-3 rounded-lg hover:bg-primary-navy-dark transition-colors">Simpan Aset</button>
        </form>
    );
};


const IconColorPicker: React.FC<{
    selectedIcon: string;
    selectedColor: string;
    onIconSelect: (icon: string) => void;
    onColorSelect: (color: string) => void;
}> = ({ selectedIcon, selectedColor, onIconSelect, onColorSelect }) => {
    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-secondary-gray">Pilih Ikon</label>
                <div className="mt-2 grid grid-cols-6 gap-2">
                    {availableIcons.map(iconName => (
                        <button
                            type="button"
                            key={iconName}
                            onClick={() => onIconSelect(iconName)}
                            className={`flex items-center justify-center p-2 rounded-lg border-2 ${selectedIcon === iconName ? 'border-primary-navy bg-blue-50' : 'border-transparent hover:bg-gray-100'}`}
                        >
                            <BudgetIcon icon={iconName} className="w-6 h-6 text-dark-text" />
                        </button>
                    ))}
                </div>
            </div>
            <div>
                 <label className="block text-sm font-medium text-secondary-gray">Pilih Warna</label>
                 <div className="mt-2 flex flex-wrap gap-3">
                    {availableColors.map(color => (
                        <button
                            type="button"
                            key={color}
                            onClick={() => onColorSelect(color)}
                            style={{ backgroundColor: color }}
                            className={`w-8 h-8 rounded-full border-2 transition-transform transform hover:scale-110 ${selectedColor === color ? 'border-white ring-2 ring-primary-navy' : 'border-transparent'}`}
                            aria-label={`Select color ${color}`}
                        />
                    ))}
                 </div>
            </div>
        </div>
    )
};

const FundsManagementModalContent: React.FC<{ onSubmit: (type: 'add' | 'remove', desc: string, amount: number) => void, onViewHistory: () => void }> = ({ onSubmit, onViewHistory }) => {
    const [type, setType] = useState<'add' | 'remove'>('add');
    const [desc, setDesc] = useState('');
    const [amount, setAmount] = useState('');
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const rawAmount = getRawNumber(amount);
        if (desc && rawAmount > 0) {
            onSubmit(type, desc, rawAmount);
            setDesc('');
            setAmount('');
        }
    };
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="fund-trans-type" className="block text-sm font-medium text-secondary-gray">Jenis Transaksi</label>
                <select id="fund-trans-type" value={type} onChange={e => setType(e.target.value as 'add' | 'remove')} className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary-navy focus:border-primary-navy">
                    <option value="add">Pemasukan</option>
                    <option value="remove">Pengeluaran Umum</option>
                </select>
            </div>
            <div>
                <label htmlFor="fund-trans-desc" className="block text-sm font-medium text-secondary-gray">Keterangan</label>
                <input type="text" id="fund-trans-desc" value={desc} onChange={e => setDesc(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-navy focus:border-primary-navy"/>
            </div>
            <div>
                <label htmlFor="fund-trans-amount" className="block text-sm font-medium text-secondary-gray">Nominal (Rp)</label>
                <input type="text" id="fund-trans-amount" value={amount} onChange={e => setAmount(formatNumberInput(e.target.value))} required inputMode="numeric" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-navy focus:border-primary-navy"/>
            </div>
            <button type="submit" className="w-full bg-primary-navy text-white font-bold py-3 rounded-lg hover:bg-primary-navy-dark transition-colors">Proses Transaksi</button>
            <button type="button" onClick={onViewHistory} className="w-full bg-gray-200 text-dark-text font-bold py-3 rounded-lg hover:bg-gray-300 transition-colors mt-2">Lihat Riwayat</button>
        </form>
    );
};

const HistoryModalContent: React.FC<{ transactions: any[], type: string, budgetId?: number, onDelete: (timestamp: number, type: string, budgetId?: number) => void }> = ({ transactions, type, budgetId, onDelete }) => {
    return (
        <ul className="max-h-80 overflow-y-auto -mx-6">
            {transactions.length === 0 ? (
                <li className="px-6 py-4 text-center text-secondary-gray">Tidak ada riwayat.</li>
            ) : (
                transactions.map((item) => (
                    <li key={item.timestamp} className="flex justify-between items-center px-6 py-3 border-b border-gray-100">
                        <div>
                            <p className="font-semibold text-dark-text">{item.desc}</p>
                            <p className={`font-bold ${item.type === 'add' ? 'text-accent-teal' : 'text-danger-red'}`}>{item.type === 'add' ? '+' : '-'} {formatCurrency(item.amount)}</p>
                            <p className="text-xs text-secondary-gray mt-1">{new Date(item.timestamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                        </div>
                        <button onClick={() => onDelete(item.timestamp, type, budgetId)} className="text-gray-400 hover:text-danger-red text-xl p-2">&#128465;</button>
                    </li>
                ))
            )}
        </ul>
    );
};

const InfoModalContent: React.FC<{ monthlyIncome: number, totalAllocated: number, unallocatedFunds: number, generalAndDailyExpenses: number, remainingUnallocated: number }> = 
({ monthlyIncome, totalAllocated, unallocatedFunds, generalAndDailyExpenses, remainingUnallocated }) => {
    return (
        <div>
            <div className="space-y-3 text-sm text-dark-text">
                <div className="flex justify-between items-center"><h3 className="text-secondary-gray">Total Pemasukan Bulan Ini</h3><p className="font-semibold text-primary-navy">{formatCurrency(monthlyIncome)}</p></div>
                <div className="flex justify-between items-center"><h3 className="text-secondary-gray">Dialokasikan ke Pos</h3><p className="font-semibold text-dark-text">- {formatCurrency(totalAllocated)}</p></div>
                <hr/>
                <div className="flex justify-between items-center"><h3 className="text-secondary-gray">Dana Tak Terikat (Awal)</h3><p className="font-semibold text-primary-navy">{formatCurrency(unallocatedFunds)}</p></div>
                <div className="flex justify-between items-center"><h3 className="text-secondary-gray">Pengeluaran Umum & Harian</h3><p className="font-semibold text-dark-text">- {formatCurrency(generalAndDailyExpenses)}</p></div>
                <hr/>
                <div className="flex justify-between items-center font-bold text-base"><h3 className="text-dark-text">Sisa Dana Tak Terikat</h3><p className="text-primary-navy">{formatCurrency(remainingUnallocated)}</p></div>
            </div>
        </div>
    );
};

const EditAssetModalContent: React.FC<{ currentAsset: number; onSubmit: (newAmount: number) => void; }> = ({ currentAsset, onSubmit }) => {
    const [amount, setAmount] = useState('');
    useEffect(() => {
        setAmount(formatNumberInput(currentAsset));
    }, [currentAsset]);
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(getRawNumber(amount));
    };
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="new-asset-amount" className="block text-sm font-medium text-secondary-gray">Total Aset Seharusnya (Rp)</label>
                <input type="text" id="new-asset-amount" value={amount} onChange={e => setAmount(formatNumberInput(e.target.value))} required inputMode="numeric" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-navy focus:border-primary-navy"/>
            </div>
            <button type="submit" className="w-full bg-primary-navy text-white font-bold py-3 rounded-lg hover:bg-primary-navy-dark transition-colors">Simpan Koreksi</button>
        </form>
    );
};

const SettingsModalContent: React.FC<{
    onExport: () => void;
    onImport: () => void;
    onManageArchived: () => void;
    onManualBackup: () => void;
    onManageBackups: () => void;
    onResetMonthly: () => void;
    onResetAll: () => void;
}> = ({ onExport, onImport, onManageArchived, onManualBackup, onManageBackups, onResetMonthly, onResetAll }) => {
    return (
        <div className="space-y-6">
             <div className="bg-gray-50 rounded-lg border p-4">
                <h4 className="font-bold text-dark-text mb-3">Manajemen Anggaran</h4>
                <div className="flex flex-col gap-3">
                    <button
                        onClick={onManageArchived}
                        className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 text-dark-text font-bold py-3 px-4 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <ArchiveBoxIcon className="w-6 h-6"/>
                        <span>Kelola Pos Anggaran Diarsipkan</span>
                    </button>
                </div>
            </div>
            
            <div className="bg-blue-50 rounded-lg border border-blue-300 p-4">
                <h4 className="font-bold text-dark-text mb-3">Cadangan & Pemulihan</h4>
                <div className="flex flex-col gap-3">
                     <button
                        onClick={onManualBackup}
                        className="w-full flex items-center justify-center gap-3 bg-white border-2 border-primary-navy text-primary-navy font-bold py-3 px-4 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                        <ArrowDownTrayIcon className="w-6 h-6"/>
                        <span>Cadangkan Manual Sekarang</span>
                    </button>
                     <button
                        onClick={onManageBackups}
                        className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 text-dark-text font-bold py-3 px-4 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <ServerStackIcon className="w-6 h-6"/>
                        <span>Kelola Cadangan Internal</span>
                    </button>
                </div>
                <p className="text-xs text-secondary-gray mt-3 text-center">Cadangan otomatis mingguan untuk memulihkan data jika terjadi kesalahan.</p>
            </div>


            <div className="bg-gray-50 rounded-lg border p-4">
                <h4 className="font-bold text-dark-text mb-3">Manajemen Data</h4>
                <div className="flex flex-col gap-3">
                    <button
                        onClick={onImport}
                        className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 text-dark-text font-bold py-3 px-4 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <ArrowUpTrayIcon className="w-6 h-6"/>
                        <span>Impor Data dari File</span>
                    </button>
                    <button
                        onClick={onExport}
                        className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 text-dark-text font-bold py-3 px-4 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                         <ArrowDownTrayIcon className="w-6 h-6"/>
                        <span>Ekspor Data ke File</span>
                    </button>
                </div>
            </div>

            <div className="bg-red-50 rounded-lg border border-danger-red p-4">
                <div className="flex items-center gap-2 mb-3">
                    <ExclamationTriangleIcon className="w-6 h-6 text-danger-red"/>
                    <h4 className="font-bold text-danger-red">Zona Berbahaya</h4>
                </div>
                <div className="flex flex-col gap-3">
                    <button onClick={onResetMonthly} className="w-full bg-white border-2 border-danger-red text-danger-red font-bold py-3 px-4 rounded-lg hover:bg-red-100 transition-colors">
                        Reset Data Bulan Ini
                    </button>
                    <button onClick={onResetAll} className="w-full bg-danger-red text-white font-bold py-3 px-4 rounded-lg hover:bg-danger-red-dark transition-colors">
                        Reset Semua Data Aplikasi
                    </button>
                </div>
            </div>

            <div className="bg-gray-50 rounded-lg border p-4 text-center">
                <h4 className="font-bold text-dark-text mb-2">Tentang Aplikasi</h4>
                <div className="space-y-1 text-sm text-secondary-gray">
                    <p>Versi: {APP_VERSION}</p>
                    <p>Pembuat Asli: Abdul Wahab Maulana</p>
                    <p className="pt-1 text-xs">Teknologi: React, TypeScript, Tailwind, Gemini API</p>
                </div>
            </div>
        </div>
    );
};

const ArchivedBudgetsModalContent: React.FC<{
    archivedBudgets: Budget[];
    onRestore: (budgetId: number) => void;
    onDelete: (budgetId: number) => void;
}> = ({ archivedBudgets, onRestore, onDelete }) => {
    return (
        <div className="space-y-3">
            {archivedBudgets.length === 0 ? (
                <p className="text-center text-secondary-gray py-6">Tidak ada pos anggaran yang diarsipkan.</p>
            ) : (
                archivedBudgets.map(budget => (
                    <div key={budget.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3 min-w-0">
                            {budget.icon && budget.color && (
                                <div style={{ backgroundColor: budget.color }} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
                                    <BudgetIcon icon={budget.icon} className="w-5 h-5 text-white" />
                                </div>
                            )}
                            <span className="font-semibold text-dark-text truncate">{budget.name}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={() => onRestore(budget.id)} className="flex items-center gap-2 text-sm bg-accent-teal text-white font-semibold py-2 px-3 rounded-lg hover:bg-accent-teal-dark transition-colors">
                                <ArrowUturnLeftIcon className="w-4 h-4" />
                                <span>Pulihkan</span>
                            </button>
                            <button 
                                onClick={() => onDelete(budget.id)} 
                                title="Hapus Permanen"
                                className="p-2 text-gray-400 hover:text-white hover:bg-danger-red rounded-lg transition-colors"
                            >
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

const BackupRestoreModalContent: React.FC<{
    backups: { key: string; timestamp: number }[];
    onRestore: (key: string) => void;
}> = ({ backups, onRestore }) => {
    return (
        <div className="space-y-3">
            {backups.length === 0 ? (
                <p className="text-center text-secondary-gray py-6">Tidak ada cadangan internal yang ditemukan.</p>
            ) : (
                backups.map(backup => (
                    <div key={backup.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3 min-w-0">
                           <ServerStackIcon className="w-6 h-6 text-secondary-gray flex-shrink-0" />
                            <span className="font-semibold text-dark-text truncate">
                                {new Date(backup.timestamp).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={() => onRestore(backup.key)} className="flex items-center gap-2 text-sm bg-accent-teal text-white font-semibold py-2 px-3 rounded-lg hover:bg-accent-teal-dark transition-colors">
                                <ArrowUturnLeftIcon className="w-4 h-4" />
                                <span>Pulihkan</span>
                            </button>
                        </div>
                    </div>
                ))
            )}
            <p className="text-xs text-secondary-gray pt-2">Aplikasi menyimpan hingga 4 cadangan mingguan terakhir secara otomatis. Cadangan ini disimpan di perangkat Anda dan akan hilang jika data browser dihapus.</p>
        </div>
    );
};


const ScanResultModalContent: React.FC<{ 
    isLoading: boolean;
    error: string | null;
    items: ScannedItem[];
    budgets: Budget[];
    onItemsChange: (newItems: ScannedItem[]) => void;
    onSave: () => void;
}> = ({ isLoading, error, items, budgets, onItemsChange, onSave }) => {

    const handleBudgetChange = (index: number, budgetId: string) => {
        const newItems = [...items];
        newItems[index].budgetId = budgetId === 'daily' || budgetId === 'none' ? budgetId : Number(budgetId);
        onItemsChange(newItems);
    };
    
    const handleDeleteItem = (indexToDelete: number) => {
        const newItems = items.filter((_, index) => index !== indexToDelete);
        onItemsChange(newItems);
    };

    if (isLoading) {
        return <div className="text-center py-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-navy mx-auto"></div>
            <p className="mt-4 text-secondary-gray">Memindai struk Anda...</p>
        </div>;
    }

    if (error) {
        return <div className="text-center py-10 text-danger-red">{error}</div>;
    }

    if (items.length === 0) {
        return <div className="text-center py-10 text-secondary-gray">Tidak ada item yang terdeteksi.</div>;
    }
    
    return (
        <div className="space-y-4">
            <div className="max-h-80 overflow-y-auto space-y-3 pr-2">
            {items.map((item, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg border">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex-grow mr-2">
                            <p className="font-semibold text-dark-text">{item.desc}</p>
                            <p className="font-bold text-primary-navy">{formatCurrency(item.amount)}</p>
                        </div>
                        <button onClick={() => handleDeleteItem(index)} className="p-1 text-gray-400 hover:text-danger-red transition-colors flex-shrink-0">
                           <TrashIcon className="w-5 h-5" />
                        </button>
                    </div>
                    <select 
                        value={String(item.budgetId)} 
                        onChange={e => handleBudgetChange(index, e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm text-dark-text focus:outline-none focus:ring-primary-navy focus:border-primary-navy"
                    >
                        <option value="none">-- Pilih Pos Anggaran --</option>
                        <option value="daily">Uang Harian</option>
                        {budgets.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
            ))}
            </div>
            <button onClick={onSave} disabled={items.filter(i => i.budgetId !== 'none').length === 0} className="w-full bg-accent-teal text-white font-bold py-3 rounded-lg hover:bg-accent-teal-dark transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed">
                Simpan Transaksi Terpilih
            </button>
        </div>
    );
};

// --- VOICE ASSISTANT MODAL (NEW) ---
type ConversationStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'processing' | 'finished' | 'error';
type TranscriptItem = { speaker: 'user' | 'ai' | 'system'; text: string; isFinal?: boolean };

const VoiceAssistantModalContent: React.FC<{
    budgets: Budget[];
    onFinish: (items: ScannedItem[]) => void;
    onClose: () => void;
}> = ({ budgets, onFinish, onClose }) => {
    const [status, setStatus] = useState<ConversationStatus>('idle');
    const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
    const [stagedTransactions, setStagedTransactions] = useState<ScannedItem[]>([]);
    const [error, setError] = useState<string | null>(null);

    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const nextAudioStartTimeRef = useRef<number>(0);
    const outputAudioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    
    const currentUserTranscriptionRef = useRef('');
    const currentAiTranscriptionRef = useRef('');

    const closeSession = useCallback(() => {
        sessionPromiseRef.current?.then(session => session.close());
        
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (inputAudioContextRef.current?.state !== 'closed') {
            inputAudioContextRef.current?.close();
        }
        if (outputAudioContextRef.current?.state !== 'closed') {
            outputAudioContextRef.current?.close();
        }
        outputAudioSourcesRef.current.forEach(source => source.stop());
        outputAudioSourcesRef.current.clear();

    }, []);

    useEffect(() => {
        const startSession = async () => {
            setStatus('connecting');
            setError(null);
            setTranscript([{ speaker: 'system', text: 'Menghubungkan ke Asisten AI...', isFinal: true }]);

            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
                const budgetCategories = [...budgets.map(b => b.name), 'Uang Harian'];

                const recordTransactionTool: FunctionDeclaration = {
                    name: 'catatTransaksi',
                    description: 'Mencatat satu transaksi keuangan. Gunakan ini untuk setiap item yang disebutkan pengguna.',
                    parameters: {
                        type: Type.OBJECT,
                        properties: {
                            desc: { type: Type.STRING, description: 'Deskripsi singkat transaksi, misal "Kopi" atau "Makan siang"' },
                            amount: { type: Type.NUMBER, description: 'Jumlah uang yang dikeluarkan' },
                            category: { type: Type.STRING, description: 'Kategori anggaran yang paling sesuai', enum: budgetCategories }
                        },
                        required: ['desc', 'amount', 'category']
                    }
                };
                
                inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                
                if (outputAudioContextRef.current.state === 'suspended') {
                    outputAudioContextRef.current.resume();
                }

                nextAudioStartTimeRef.current = 0;

                sessionPromiseRef.current = ai.live.connect({
                    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                    config: {
                        responseModalities: [Modality.AUDIO],
                        inputAudioTranscription: {},
                        outputAudioTranscription: {},
                        tools: [{ functionDeclarations: [recordTransactionTool] }],
                        systemInstruction: `Anda adalah asisten keuangan AI yang ramah dalam Bahasa Indonesia. Tugas Anda adalah membantu pengguna mencatat transaksi. Tanyakan detail jika perlu, konfirmasikan setiap transaksi setelah Anda memanggil fungsi 'catatTransaksi', dan tanyakan apakah ada lagi. Gunakan kategori yang tersedia: [${budgetCategories.join(', ')}]. Jika ragu, gunakan 'Uang Harian'.`
                    },
                    callbacks: {
                        onopen: async () => {
                            try {
                                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                                streamRef.current = stream;
                                const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                                scriptProcessorRef.current = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);

                                scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                                    const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                                    const pcmBlob = createBlob(inputData);
                                    sessionPromiseRef.current?.then((session) => {
                                        session.sendRealtimeInput({ media: pcmBlob });
                                    });
                                };

                                source.connect(scriptProcessorRef.current);
                                scriptProcessorRef.current.connect(inputAudioContextRef.current!.destination);
                                // The initial audio greeting comes from the model as the first message
                                setStatus('listening');
                            } catch (err) {
                                console.error('Microphone error:', err);
                                setError('Gagal mengakses mikrofon. Mohon berikan izin dan coba lagi.');
                                setStatus('error');
                            }
                        },
                        onmessage: async (message: LiveServerMessage) => {
                            if (message.serverContent?.inputTranscription) {
                                currentUserTranscriptionRef.current += message.serverContent.inputTranscription.text;
                                setTranscript(prev => {
                                    const newTranscript = [...prev];
                                    const last = newTranscript[newTranscript.length - 1];
                                    if (last?.speaker === 'user' && !last.isFinal) {
                                        last.text = currentUserTranscriptionRef.current;
                                    } else {
                                        newTranscript.push({ speaker: 'user', text: currentUserTranscriptionRef.current, isFinal: false });
                                    }
                                    return newTranscript;
                                });
                            }
                             if (message.serverContent?.outputTranscription) {
                                currentAiTranscriptionRef.current += message.serverContent.outputTranscription.text;
                                 setTranscript(prev => {
                                    const newTranscript = [...prev];
                                    const last = newTranscript[newTranscript.length - 1];
                                    if (last?.speaker === 'ai' && !last.isFinal) {
                                        last.text = currentAiTranscriptionRef.current;
                                    } else {
                                        newTranscript.push({ speaker: 'ai', text: currentAiTranscriptionRef.current, isFinal: false });
                                    }
                                    return newTranscript;
                                });
                            }
                             if(message.serverContent?.turnComplete) {
                                setTranscript(prev => prev.map(t => ({...t, isFinal: true})));
                                currentUserTranscriptionRef.current = '';
                                currentAiTranscriptionRef.current = '';
                            }
                            if (message.toolCall?.functionCalls) {
                                setStatus('processing');
                                for (const fc of message.toolCall.functionCalls) {
                                    const { desc, amount, category } = fc.args;
                                    const matchedBudget = budgets.find(b => b.name === category);
                                    const budgetId = matchedBudget ? matchedBudget.id : 'daily';
                                    setStagedTransactions(prev => [...prev, { desc, amount, budgetId }]);
                                    
                                    const session = await sessionPromiseRef.current;
                                    session?.sendToolResponse({
                                      functionResponses: { id : fc.id, name: fc.name, response: { result: "OK" } }
                                    });
                                }
                            }
                             const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                            if (base64Audio) {
                                setStatus('speaking');
                                const audioContext = outputAudioContextRef.current!;
                                nextAudioStartTimeRef.current = Math.max(nextAudioStartTimeRef.current, audioContext.currentTime);
                                
                                const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
                                const source = audioContext.createBufferSource();
                                source.buffer = audioBuffer;
                                source.connect(audioContext.destination);

                                source.addEventListener('ended', () => {
                                    outputAudioSourcesRef.current.delete(source);
                                    if (outputAudioSourcesRef.current.size === 0) {
                                        setStatus('listening');
                                    }
                                });

                                source.start(nextAudioStartTimeRef.current);
                                nextAudioStartTimeRef.current += audioBuffer.duration;
                                outputAudioSourcesRef.current.add(source);
                            }
                        },
                        onerror: (e: ErrorEvent) => {
                             console.error('Session error:', e);
                             setError('Koneksi ke Asisten AI gagal. Pastikan koneksi internet Anda stabil dan coba lagi.');
                             setStatus('error');
                             closeSession();
                        },
                        onclose: () => {
                            setStatus('finished');
                        }
                    }
                });
            } catch (err) {
                console.error('Failed to start session:', err);
                setError('Gagal memulai sesi Asisten AI. Coba lagi.');
                setStatus('error');
            }
        };

        startSession();
        return () => closeSession();
    }, [budgets, closeSession]);

    const handleFinishSession = () => {
        onFinish(stagedTransactions);
    };
    
    const StatusIndicator = () => {
        let color = 'bg-gray-400';
        let text = 'Menunggu';
        switch (status) {
            case 'connecting': color = 'bg-yellow-400 animate-pulse'; text = 'Menghubungkan...'; break;
            case 'listening': color = 'bg-green-500 animate-pulse'; text = 'Mendengarkan...'; break;
            case 'speaking': color = 'bg-blue-500'; text = 'AI Berbicara...'; break;
            case 'processing': color = 'bg-yellow-400'; text = 'Memproses...'; break;
            case 'finished': color = 'bg-gray-500'; text = 'Sesi Selesai'; break;
            case 'error': color = 'bg-danger-red'; text = 'Error'; break;
        }
        return <div className="flex items-center space-x-2 text-sm"><div className={`w-3 h-3 rounded-full ${color}`}></div><span>{text}</span></div>;
    };

    return (
        <div className="flex flex-col h-[70vh]">
            <div className="flex justify-between items-center p-2 bg-gray-50 rounded-t-lg">
                <StatusIndicator />
                <button onClick={onClose} className="px-4 py-2 text-sm bg-danger-red text-white font-semibold rounded-lg hover:bg-danger-red-dark">Tutup Sesi</button>
            </div>
             {error && <p className="p-2 text-center text-sm bg-red-100 text-danger-red">{error}</p>}
            
            <div className="flex-grow overflow-y-auto p-4 space-y-3 bg-gray-100">
                 {transcript.map((item, index) => (
                    <div key={index} className={`flex ${item.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs md:max-w-md p-3 rounded-2xl ${item.speaker === 'user' ? 'bg-primary-navy text-white' : 'bg-white text-dark-text shadow-sm'}`}>
                            {item.text}
                        </div>
                    </div>
                ))}
            </div>

            {stagedTransactions.length > 0 && (
                 <div className="flex-shrink-0 p-4 border-t">
                    <h4 className="font-bold text-primary-navy mb-2">Transaksi yang akan dikonfirmasi:</h4>
                    <div className="max-h-28 overflow-y-auto space-y-2">
                        {stagedTransactions.map((item, index) => (
                            <div key={index} className="flex justify-between items-center text-sm p-2 bg-blue-50 rounded">
                                <span>{item.desc}</span>
                                <span className="font-semibold">{formatCurrency(item.amount)}</span>
                            </div>
                        ))}
                    </div>
                    <button onClick={handleFinishSession} className="w-full mt-3 bg-accent-teal text-white font-bold py-3 rounded-lg hover:bg-accent-teal-dark">
                        Selesai & Konfirmasi ({stagedTransactions.length})
                    </button>
                 </div>
            )}
        </div>
    );
};

const SmartInputModalContent: React.FC<{
    isProcessing: boolean;
    error: string | null;
    resultItems: ScannedItem[];
    budgets: Budget[];
    onProcess: (text: string) => void;
    onSave: () => void;
    onItemsChange: (items: ScannedItem[]) => void;
    onClearError: () => void;
}> = ({ isProcessing, error, resultItems, budgets, onProcess, onSave, onItemsChange, onClearError }) => {
    const [text, setText] = useState('');

    const handleBudgetChange = (index: number, budgetId: string) => {
        const newItems = [...resultItems];
        newItems[index].budgetId = budgetId === 'daily' || budgetId === 'none' ? budgetId : Number(budgetId);
        onItemsChange(newItems);
    };

    const handleRetry = () => {
        onItemsChange([]);
        onClearError();
    };

    if (isProcessing) {
        return <div className="text-center py-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-navy mx-auto"></div>
            <p className="mt-4 text-secondary-gray">AI sedang memproses...</p>
        </div>;
    }

    if (resultItems.length > 0) {
        return (
            <div className="space-y-4">
                <div className="max-h-80 overflow-y-auto space-y-3 pr-2">
                    {resultItems.map((item, index) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-lg border">
                            <div className="flex justify-between items-center mb-2">
                                <p className="font-semibold text-dark-text flex-grow">{item.desc}</p>
                                <p className="font-bold text-primary-navy">{formatCurrency(item.amount)}</p>
                            </div>
                            <select 
                                value={String(item.budgetId)} 
                                onChange={e => handleBudgetChange(index, e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm text-dark-text focus:outline-none focus:ring-primary-navy focus:border-primary-navy"
                            >
                                <option value="none">-- Jangan Simpan --</option>
                                <option value="daily">Uang Harian</option>
                                {budgets.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={handleRetry} className="w-full bg-gray-200 text-dark-text font-bold py-3 rounded-lg hover:bg-gray-300 transition-colors">
                        Input Ulang
                    </button>
                    <button onClick={onSave} className="w-full bg-accent-teal text-white font-bold py-3 rounded-lg hover:bg-accent-teal-dark transition-colors">
                        Simpan
                    </button>
                </div>
            </div>
        );
    }
    
    return (
        <form onSubmit={(e) => { e.preventDefault(); onProcess(text); }} className="space-y-4">
            <div>
                <label htmlFor="smart-input-text" className="block text-sm font-medium text-secondary-gray">Tuliskan pengeluaran Anda</label>
                <textarea 
                    id="smart-input-text"
                    rows={4}
                    value={text}
                    onChange={e => setText(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-navy focus:border-primary-navy"
                    placeholder="Contoh: Beli kopi 25rb, makan siang 30000, dan bayar parkir 5rb"
                />
            </div>
            {error && <p className="text-sm text-center text-danger-red bg-red-50 p-2 rounded-md">{error}</p>}
            <button type="submit" className="w-full bg-primary-navy text-white font-bold py-3 rounded-lg hover:bg-primary-navy-dark transition-colors">
                Proses dengan AI
            </button>
        </form>
    );
};

const AIAdviceModalContent: React.FC<{ 
    isLoading: boolean;
    error: string | null;
    advice: string;
}> = ({ isLoading, error, advice }) => {
    if (isLoading) {
        return (
            <div className="text-center py-10">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-navy mx-auto"></div>
                <p className="mt-4 text-secondary-gray">AI sedang menganalisis data Anda...</p>
            </div>
        );
    }

    if (error) {
        return <div className="text-center py-10 text-danger-red">{error}</div>;
    }

    // A simple markdown to HTML converter for bullet points
    const formatAdvice = (text: string) => {
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
    
    return (
        <div className="max-h-96 overflow-y-auto prose prose-sm">
            {formatAdvice(advice)}
        </div>
    );
};

const AIChatModalContent: React.FC<{
    history: { role: 'user' | 'model', text: string }[];
    isLoading: boolean;
    error: string | null;
    onSendMessage: (message: string) => void;
}> = ({ history, isLoading, error, onSendMessage }) => {
    const [message, setMessage] = useState('');
    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [history, isLoading]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim() && !isLoading) {
            onSendMessage(message);
            setMessage('');
        }
    };

    const formatMessage = (text: string) => {
        return text.split('\n').map((line, index) => {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('* ')) {
                return <li key={index} className="ml-5 list-disc">{trimmedLine.substring(2)}</li>;
            }
             if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
                return <p key={index} className="font-bold">{trimmedLine.replace(/\*\*/g, '')}</p>
            }
            return <p key={index}>{line}</p>;
        });
    };

    return (
        <div className="flex flex-col h-[70vh]">
            <div ref={chatContainerRef} className="flex-grow overflow-y-auto p-4 space-y-4">
                {history.map((chat, index) => (
                    <div key={index} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs md:max-w-md p-3 rounded-2xl ${chat.role === 'user' ? 'bg-primary-navy text-white' : 'bg-gray-200 text-dark-text'}`}>
                           <div className="prose prose-sm max-w-none text-current">{formatMessage(chat.text)}</div>
                        </div>
                    </div>
                ))}
                {isLoading && (
                     <div className="flex justify-start">
                        <div className="max-w-xs md:max-w-md p-3 rounded-2xl bg-gray-200 text-dark-text">
                           <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: '0s' }}></div>
                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                           </div>
                        </div>
                    </div>
                )}
            </div>
            <div className="p-4 border-t flex-shrink-0">
                 {error && <p className="text-sm text-center text-danger-red mb-2">{error}</p>}
                <form onSubmit={handleSubmit} className="flex items-center space-x-2">
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Ketik pertanyaan Anda..."
                        className="flex-grow px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-1 focus:ring-primary-navy"
                        disabled={isLoading}
                    />
                    <button type="submit" className="bg-primary-navy text-white rounded-full p-3 hover:bg-primary-navy-dark transition-colors disabled:bg-gray-400" disabled={isLoading || !message.trim()}>
                        <PaperAirplaneIcon className="w-5 h-5" />
                    </button>
                </form>
            </div>
        </div>
    );
};

const MainMenu: React.FC<{ 
    onNavigate: (page: Page) => void, 
    onShowInfo: () => void, 
    onManageFunds: () => void,
    onScanReceipt: () => void,
    onSmartInput: () => void,
    onVoiceInput: () => void,
    onAskAI: () => void,
    onGetAIAdvice: () => void, 
    onOpenSettings: () => void 
}> = (props) => {
    const menuItems = [
        { icon: BuildingLibraryIcon, label: 'Celengan', action: () => props.onNavigate('savings'), disabled: false },
        { icon: CircleStackIcon, label: 'Aset & Kekayaan', action: () => props.onNavigate('netWorth'), disabled: false },
        { icon: TrophyIcon, label: 'Lencana', action: () => props.onNavigate('achievements'), disabled: false },
        { icon: FireIcon, label: 'Pencapaian Terbaik', action: () => props.onNavigate('personalBest'), disabled: false },
        { icon: ListBulletIcon, label: 'Info Bulanan', action: props.onShowInfo, disabled: false },
        { icon: DocumentTextIcon, label: 'Kelola Dana', action: props.onManageFunds, disabled: false },
        { icon: CameraIcon, label: 'Scan Struk', action: () => {}, disabled: true },
        { icon: SparklesIcon, label: 'Input Cerdas', action: () => {}, disabled: true },
        { icon: LightbulbIcon, label: 'Saran AI', action: () => {}, disabled: true },
        { icon: ChatBubbleLeftRightIcon, label: 'Tanya AI', action: () => {}, disabled: true },
        { icon: SpeakerWaveIcon, label: 'Asisten Suara', action: () => {}, disabled: true },
        { icon: Cog6ToothIcon, label: 'Pengaturan', action: props.onOpenSettings, disabled: false },
    ];
    return (
         <div className="grid grid-cols-4 gap-2">
            {menuItems.map(item => (
                <button 
                    key={item.label} 
                    onClick={item.action} 
                    disabled={item.disabled}
                    className="relative flex flex-col items-center justify-center p-2 rounded-lg hover:bg-gray-100 transition-colors space-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    title={item.disabled ? 'Fitur Terkunci' : ''}
                >
                    <item.icon className="w-8 h-8 text-primary-navy" />
                    {item.disabled && (
                        <div className="absolute top-1 right-1 bg-gray-600 bg-opacity-80 rounded-full p-0.5">
                            <LockClosedIcon className="w-3 h-3 text-white" />
                        </div>
                    )}
                    <span className="text-xs text-center text-secondary-gray">{item.label}</span>
                </button>
            ))}
        </div>
    );
};

const AddSavingsGoalModalContent: React.FC<{ onSubmit: (name: string, isInfinite: boolean, targetAmount?: number) => void }> = ({ onSubmit }) => {
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const [isInfinite, setIsInfinite] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const rawAmount = getRawNumber(amount);
        if (name.trim() && (isInfinite || rawAmount > 0)) {
            onSubmit(name.trim(), isInfinite, isInfinite ? undefined : rawAmount);
        }
    };
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="goal-name" className="block text-sm font-medium text-secondary-gray">Nama Tujuan</label>
                <input type="text" id="goal-name" value={name} onChange={e => setName(e.target.value)} required placeholder="Contoh: Dana Darurat" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-navy focus:border-primary-navy"/>
            </div>
            
            <div className="flex items-center">
                <input
                    id="is-infinite-checkbox"
                    type="checkbox"
                    checked={isInfinite}
                    onChange={e => setIsInfinite(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-navy focus:ring-primary-navy"
                />
                <label htmlFor="is-infinite-checkbox" className="ml-2 block text-sm text-secondary-gray">
                    Tabungan tanpa target
                </label>
            </div>

            {!isInfinite && (
                <div>
                    <label htmlFor="goal-amount" className="block text-sm font-medium text-secondary-gray">Target Dana (Rp)</label>
                    <input type="text" id="goal-amount" value={amount} onChange={e => setAmount(formatNumberInput(e.target.value))} required={!isInfinite} placeholder="Contoh: 15.000.000" inputMode="numeric" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-navy focus:border-primary-navy"/>
                </div>
            )}
            <button type="submit" className="w-full bg-primary-navy text-white font-bold py-3 rounded-lg hover:bg-primary-navy-dark transition-colors">Buat Celengan</button>
        </form>
    );
};

const AddSavingsModalContent: React.FC<{ goal?: SavingsGoal; availableFunds: number; onSubmit: (amount: number) => void; }> = ({ goal, availableFunds, onSubmit }) => {
    const [amount, setAmount] = useState('');
    if (!goal) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const rawAmount = getRawNumber(amount);
        if (rawAmount > 0) {
            onSubmit(rawAmount);
        }
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
             <div className="p-3 bg-blue-50 rounded-lg text-center">
                <p className="text-sm text-secondary-gray">Sisa Dana Tersedia</p>
                <p className="font-bold text-lg text-primary-navy">{formatCurrency(availableFunds)}</p>
            </div>
            <div>
                <label htmlFor="savings-amount" className="block text-sm font-medium text-secondary-gray">Nominal (Rp)</label>
                <input type="text" id="savings-amount" value={amount} onChange={e => setAmount(formatNumberInput(e.target.value))} required inputMode="numeric" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-navy focus:border-primary-navy"/>
            </div>
            <button type="submit" className="w-full bg-primary-navy text-white font-bold py-3 rounded-lg hover:bg-primary-navy-dark transition-colors">Simpan</button>
        </form>
    );
};

const SavingsDetailModalContent: React.FC<{ goal?: SavingsGoal; onDelete: () => void; }> = ({ goal, onDelete }) => {
    if (!goal) return null;
    return (
        <div className="space-y-4">
            <div className="max-h-80 overflow-y-auto -mx-6">
                <h4 className="font-semibold text-secondary-gray px-6 pb-2 border-b">Riwayat Menabung</h4>
                {goal.history.length === 0 ? (
                    <p className="px-6 py-4 text-center text-secondary-gray">Belum ada riwayat.</p>
                ) : (
                    [...goal.history].reverse().map(item => (
                        <div key={item.timestamp} className="flex justify-between items-center px-6 py-3 border-b border-gray-100">
                            <div>
                                <p className="font-semibold text-accent-teal">+ {formatCurrency(item.amount)}</p>
                                <p className="text-xs text-secondary-gray mt-1">{new Date(item.timestamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
             <button type="button" onClick={onDelete} className="w-full bg-danger-red text-white font-bold py-3 rounded-lg hover:bg-danger-red-dark transition-colors">Hapus Celengan</button>
        </div>
    );
}

const BatchInputModalContent: React.FC<{ 
    budgets: Budget[];
    onSave: (items: ScannedItem[]) => void;
}> = ({ budgets, onSave }) => {
    const [items, setItems] = useState<ScannedItem[]>([{ desc: '', amount: 0, budgetId: 'daily' }]);

    const updateItem = (index: number, field: keyof ScannedItem, value: string | number) => {
        const newItems = [...items];
        if (field === 'amount') {
            newItems[index][field] = getRawNumber(value as string);
        } else if (field === 'budgetId') {
            newItems[index][field] = value === 'daily' ? 'daily' : Number(value);
        } else {
            newItems[index][field] = value as string;
        }
        setItems(newItems);
    };

    const addItem = () => {
        setItems([...items, { desc: '', amount: 0, budgetId: 'daily' }]);
    };

    const deleteItem = (indexToDelete: number) => {
        if (items.length > 1) {
            setItems(items.filter((_, index) => index !== indexToDelete));
        }
    };

    const totalAmount = useMemo(() => items.reduce((sum, item) => sum + item.amount, 0), [items]);

    return (
        <div className="space-y-4">
            <div className="max-h-[50vh] overflow-y-auto space-y-3 pr-2 -mx-2 px-2">
                {items.map((item, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg border flex flex-col sm:flex-row gap-3">
                        <div className="flex-grow space-y-2">
                            <input
                                type="text"
                                placeholder="Keterangan"
                                value={item.desc}
                                onChange={(e) => updateItem(index, 'desc', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm"
                            />
                            <input
                                type="text"
                                placeholder="Nominal"
                                value={item.amount > 0 ? formatNumberInput(item.amount) : ''}
                                onChange={(e) => updateItem(index, 'amount', e.target.value)}
                                inputMode="numeric"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm"
                            />
                        </div>
                        <div className="flex-shrink-0 sm:w-48 space-y-2">
                             <select 
                                value={String(item.budgetId)} 
                                onChange={(e) => updateItem(index, 'budgetId', e.target.value)}
                                className="w-full h-10 px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm text-sm"
                            >
                                <option value="daily">Uang Harian</option>
                                {budgets.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                            <button onClick={() => deleteItem(index)} disabled={items.length <= 1} className="w-full h-10 flex items-center justify-center bg-gray-200 text-dark-text font-bold rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed">
                               <TrashIcon className="w-5 h-5"/>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
             <button onClick={addItem} className="w-full flex items-center justify-center gap-2 bg-white border-2 border-dashed border-secondary-gray text-secondary-gray font-bold py-2 px-4 rounded-lg hover:bg-gray-50 hover:text-dark-text hover:border-dark-text transition-colors">
                <PlusCircleIcon className="w-5 h-5" />
                <span>Tambah Item</span>
            </button>
            <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-4">
                    <span className="font-semibold text-secondary-gray">Total Pengeluaran</span>
                    <span className="font-bold text-xl text-danger-red">{formatCurrency(totalAmount)}</span>
                </div>
                <button onClick={() => onSave(items)} disabled={items.every(i => i.amount <= 0 || !i.desc.trim())} className="w-full bg-accent-teal text-white font-bold py-3 rounded-lg hover:bg-accent-teal-dark transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed">
                    Simpan Semua
                </button>
            </div>
        </div>
    );
};


export default App;