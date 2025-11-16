import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { AppState, Asset } from '../types';
import { CircleStackIcon, PlusCircleIcon, TrashIcon } from './Icons';

interface NetWorthProps {
    state: AppState;
    currentCashAsset: number;
    onAddAsset: () => void;
    onEditAsset: (assetId: number) => void;
    onDeleteAsset: (assetId: number) => void;
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

const COLORS = ['#2C3E50', '#1ABC9C']; // primary-navy for Non-Tunai, accent-teal for Tunai

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
                <p className="font-semibold mb-1 text-dark-text">{payload[0].name}</p>
                <p style={{ color: payload[0].payload.fill }}>
                    {`${formatCurrency(payload[0].value)} (${(payload[0].payload.percent * 100).toFixed(1)}%)`}
                </p>
            </div>
        );
    }
    return null;
};

const NetWorth: React.FC<NetWorthProps> = ({ state, currentCashAsset, onAddAsset, onEditAsset, onDeleteAsset }) => {
    const totalNonCashAssetValue = useMemo(() => {
        return state.assets.reduce((sum, asset) => sum + (asset.quantity * asset.pricePerUnit), 0);
    }, [state.assets]);

    const netWorth = currentCashAsset + totalNonCashAssetValue;

    const pieChartData = [
        { name: 'Aset Non-Tunai', value: totalNonCashAssetValue },
        { name: 'Aset Tunai', value: currentCashAsset },
    ].filter(d => d.value > 0);

    return (
        <main className="p-4 pb-24 animate-fade-in space-y-6">
            <h1 className="text-3xl font-bold text-primary-navy text-center">Aset & Kekayaan Bersih</h1>
            
            <section className="bg-white rounded-xl shadow-md p-6 text-center">
                <h2 className="text-sm font-medium text-secondary-gray">Total Nilai Bersih</h2>
                <p className="font-bold text-4xl text-primary-navy mt-1">{formatCurrency(netWorth)}</p>
            </section>

            <section className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-xl font-bold text-primary-navy text-center mb-4">Alokasi Aset</h2>
                {pieChartData.length > 0 ? (
                    <div className="w-full h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieChartData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {pieChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{fontSize: '14px'}}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="text-center text-secondary-gray py-8">
                        <p>Mulai tambahkan aset untuk melihat alokasi kekayaan Anda.</p>
                    </div>
                )}
            </section>
            
            <section>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-primary-navy">Inventaris Aset Non-Tunai</h2>
                    <button onClick={onAddAsset} className="flex items-center space-x-2 bg-accent-teal text-white font-bold py-2 px-4 rounded-lg hover:bg-accent-teal-dark transition-colors shadow">
                        <PlusCircleIcon className="w-5 h-5" />
                        <span>Tambah</span>
                    </button>
                </div>
                
                {state.assets.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl shadow-md space-y-4">
                        <CircleStackIcon className="w-16 h-16 mx-auto text-secondary-gray opacity-50" />
                        <p className="text-secondary-gray">Anda belum menambahkan aset non-tunai.</p>
                        <p className="text-secondary-gray text-sm">Contoh: Laptop, Kendaraan, Emas, dll.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {state.assets.map(asset => (
                            <div key={asset.id} className="bg-white rounded-xl shadow-md p-4">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex-grow">
                                        <h3 className="font-bold text-lg text-dark-text">{asset.name}</h3>
                                        <p className="text-sm text-secondary-gray">
                                            {asset.quantity} unit @ {formatCurrency(asset.pricePerUnit)}
                                        </p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="font-bold text-primary-navy text-lg">{formatCurrency(asset.quantity * asset.pricePerUnit)}</p>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 mt-3 border-t pt-3">
                                    <button onClick={() => onEditAsset(asset.id)} className="text-sm font-semibold text-secondary-gray hover:text-primary-navy py-1 px-3">Edit</button>
                                    <button onClick={() => onDeleteAsset(asset.id)} className="text-sm font-semibold text-secondary-gray hover:text-danger-red py-1 px-3">Hapus</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

        </main>
    );
};

export default NetWorth;