import React, { useState, useMemo } from 'react';
import type { Achievement, AppState } from '../types';
import { BudgetIcon, LockClosedIcon, ClockIcon, TrophyIcon } from './Icons';

interface AchievementsProps {
    state: AppState;
    allAchievements: Achievement[];
    unlockedAchievements: { [id: string]: number };
    achievementData?: AppState['achievementData'];
    totalPoints: number;
    userLevel: {
        level: string;
        currentLevelPoints: number;
        nextLevelPoints: number | null;
    };
}

const achievementCategories = ['Dasar', 'Kebiasaan Baik', 'Master Anggaran', 'Tantangan', 'Eksplorasi'];

const ProgressBar: React.FC<{ current: number; target: number, className?: string }> = ({ current, target, className }) => {
    const percentage = target > 0 ? (current / target) * 100 : 0;
    return (
        <div className={`w-full bg-gray-200 rounded-full h-2 ${className}`}>
            <div className="bg-accent-teal h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(percentage, 100)}%` }}></div>
        </div>
    );
};

const AchievementCard: React.FC<{
    achievement: Achievement;
    isUnlocked: boolean;
    progress?: { current: number; target: number };
    onClick: () => void;
}> = ({ achievement, isUnlocked, progress, onClick }) => {
    return (
        <div onClick={onClick} className={`flex items-start space-x-4 p-4 rounded-xl transition-all duration-300 cursor-pointer ${isUnlocked ? 'bg-white shadow-md hover:shadow-lg' : 'bg-gray-100 hover:bg-gray-200'}`}>
            <div className={`relative flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center ${isUnlocked ? 'bg-accent-teal' : 'bg-gray-300'}`}>
                <BudgetIcon 
                    icon={achievement.icon} 
                    className={`w-8 h-8 ${isUnlocked ? 'text-white' : 'text-gray-500'}`}
                />
                {!isUnlocked && (
                    <div className="absolute inset-0 bg-black bg-opacity-30 rounded-full flex items-center justify-center">
                        <LockClosedIcon className="w-6 h-6 text-white" />
                    </div>
                )}
            </div>
            <div className={`flex-grow ${!isUnlocked ? 'opacity-60' : ''}`}>
                <div className="flex justify-between items-start">
                    <h3 className="font-bold text-dark-text pr-2">{achievement.name}</h3>
                    {achievement.isTimeLimited && <ClockIcon className="w-5 h-5 text-secondary-gray flex-shrink-0" title="Lencana Terbatas Waktu"/>}
                </div>
                <p className="text-sm text-secondary-gray">{achievement.description}</p>
                {!isUnlocked && progress && progress.target > 1 && (
                     <div className="mt-2">
                        <ProgressBar current={progress.current} target={progress.target} />
                        <p className="text-xs text-secondary-gray text-right mt-1">{progress.current.toLocaleString()} / {progress.target.toLocaleString()}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const AchievementDetailModal: React.FC<{
    achievement: Achievement;
    isUnlocked: boolean;
    unlockedTimestamp?: number;
    progress?: { current: number; target: number };
    onClose: () => void;
}> = ({ achievement, isUnlocked, unlockedTimestamp, progress, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm text-center p-6 animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <div className={`relative mx-auto w-24 h-24 mb-4 rounded-full flex items-center justify-center ${isUnlocked ? 'bg-accent-teal' : 'bg-gray-300'}`}>
                    <BudgetIcon icon={achievement.icon} className={`w-12 h-12 ${isUnlocked ? 'text-white' : 'text-gray-500'}`} />
                     {!isUnlocked && (
                        <div className="absolute inset-0 bg-black bg-opacity-30 rounded-full flex items-center justify-center">
                            <LockClosedIcon className="w-10 h-10 text-white" />
                        </div>
                    )}
                </div>
                <h3 className="text-xl font-bold text-primary-navy">{achievement.name}</h3>
                <p className="text-secondary-gray mt-1">{achievement.description}</p>
                <p className="text-sm font-semibold text-warning-yellow mt-2">{achievement.points} Poin</p>

                <div className="mt-4 border-t pt-4">
                    {isUnlocked && unlockedTimestamp ? (
                        <div>
                            <p className="font-semibold text-dark-text">Didapatkan pada:</p>
                            <p className="text-secondary-gray">{new Date(unlockedTimestamp).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        </div>
                    ) : (
                        <div>
                            <p className="font-semibold text-dark-text">Progress:</p>
                            {progress ? (
                                <>
                                    <p className="text-primary-navy text-2xl font-bold my-1">{progress.current.toLocaleString()} / {progress.target.toLocaleString()}</p>
                                    <ProgressBar current={progress.current} target={progress.target} className="h-4"/>
                                </>
                            ) : (
                                <p className="text-secondary-gray">Anda belum memulai progress untuk lencana ini.</p>
                            )}
                        </div>
                    )}
                </div>

                <button onClick={onClose} className="mt-6 w-full bg-gray-200 text-dark-text font-bold py-2 px-4 rounded-lg hover:bg-gray-300">Tutup</button>
            </div>
        </div>
    );
}

const Achievements: React.FC<AchievementsProps> = ({ state, allAchievements, unlockedAchievements, achievementData, totalPoints, userLevel }) => {
    const [activeCategory, setActiveCategory] = useState(achievementCategories[0]);
    const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);

    const filteredAchievements = useMemo(() => {
        return allAchievements.filter(ach => ach.category === activeCategory);
    }, [allAchievements, activeCategory]);

    const levelProgress = userLevel.nextLevelPoints 
        ? ((totalPoints - userLevel.currentLevelPoints) / (userLevel.nextLevelPoints - userLevel.currentLevelPoints)) * 100
        : 100;

    return (
        <main className="p-4 pb-24 animate-fade-in">
            <h1 className="text-3xl font-bold text-primary-navy text-center mb-2">Lencana & Pencapaian</h1>

            <section className="bg-white rounded-xl shadow-md p-4 mb-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-primary-navy">{userLevel.level}</h2>
                    <p className="font-semibold text-warning-yellow">{totalPoints} Poin</p>
                </div>
                <div className="mt-2">
                    <ProgressBar current={totalPoints - userLevel.currentLevelPoints} target={userLevel.nextLevelPoints ? userLevel.nextLevelPoints - userLevel.currentLevelPoints : 1} className="h-3" />
                    <div className="flex justify-between text-xs text-secondary-gray mt-1">
                        <span>Lv. Sebelumnya: {userLevel.currentLevelPoints}</span>
                        {userLevel.nextLevelPoints && <span>Lv. Berikutnya: {userLevel.nextLevelPoints}</span>}
                    </div>
                </div>
            </section>

            <div className="flex space-x-2 overflow-x-auto pb-4 mb-4 -mx-4 px-4">
                {achievementCategories.map(category => (
                    <button 
                        key={category}
                        onClick={() => setActiveCategory(category)}
                        className={`px-4 py-2 text-sm font-semibold rounded-full whitespace-nowrap transition-colors ${activeCategory === category ? 'bg-primary-navy text-white' : 'bg-white text-secondary-gray hover:bg-gray-100'}`}
                    >
                        {category}
                    </button>
                ))}
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
                {filteredAchievements.map(ach => {
                    let progress: { current: number; target: number } | undefined = undefined;
                    if (ach.progress) {
                        progress = ach.progress(state);
                    } else if (ach.streakKey && ach.streakTarget) {
                        progress = { current: achievementData?.[ach.streakKey] || 0, target: ach.streakTarget };
                    }
                    
                    return (
                        <AchievementCard 
                            key={ach.id}
                            achievement={ach}
                            isUnlocked={!!unlockedAchievements[ach.id]}
                            progress={progress}
                            onClick={() => setSelectedAchievement(ach)}
                        />
                    );
                })}
            </div>

            {selectedAchievement && (
                <AchievementDetailModal
                    achievement={selectedAchievement}
                    isUnlocked={!!unlockedAchievements[selectedAchievement.id]}
                    unlockedTimestamp={unlockedAchievements[selectedAchievement.id]}
                    progress={
                        selectedAchievement.progress ? selectedAchievement.progress(state) :
                        (selectedAchievement.streakKey && selectedAchievement.streakTarget ? { current: achievementData?.[selectedAchievement.streakKey] || 0, target: selectedAchievement.streakTarget } : undefined)
                    }
                    onClose={() => setSelectedAchievement(null)}
                />
            )}
        </main>
    );
};

export default Achievements;