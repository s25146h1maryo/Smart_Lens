"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'Done', value: 75, color: '#8b5cf6' }, // Violet
  { name: 'Pending', value: 25, color: '#3f3f46' }, // Zinc 700
];

export default function ProductivityChart() {
    return (
        <div className="col-span-12 md:col-span-6 lg:col-span-4 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden min-h-[300px]">
             <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 opacity-50"></div>
             
             <h3 className="text-lg font-semibold text-zinc-100 mb-2 self-start w-full flex justify-between">
                 <span>Productivity</span>
                 <span className="text-xs text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">+12%</span>
             </h3>

             <div className="relative w-[200px] h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={85}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                
                {/* Center Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <span className="text-3xl font-bold text-white tracking-tighter shadow-violet-500/50 drop-shadow-lg">75%</span>
                     <span className="text-xs text-zinc-500 uppercase tracking-widest mt-1">Efficiency</span>
                </div>
             </div>
             
             <div className="flex gap-8 mt-4">
                 <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full bg-violet-500 shadow-[0_0_8px_#8b5cf6]"></div>
                     <span className="text-xs text-zinc-400">Completed</span>
                 </div>
                 <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full bg-zinc-700"></div>
                     <span className="text-xs text-zinc-400">Pending</span>
                 </div>
             </div>
        </div>
    );
}
