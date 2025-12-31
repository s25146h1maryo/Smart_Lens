"use client";

const schedules = [
    { id: 1, title: 'Student Council Meeting', time: '16:00 - 17:30', location: 'Room 3-B', color: 'indigo' },
    { id: 2, title: 'Budget Review', time: 'Tomorrow 09:00', location: 'Staff Room', color: 'emerald' },
    { id: 3, title: 'Festival Planning', time: 'Fri 13:00', location: 'Gym', color: 'fuchsia' },
];

export default function TimelineCalendar() {
    return (
        <div className="col-span-12 lg:col-span-3 lg:row-span-2 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-6 flex flex-col h-full">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-6">Schedule</h3>

            <div className="flex-1 flex flex-col gap-6 relative">
                 {/* Vertical Line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-[1px] bg-zinc-800"></div>

                {schedules.map((item) => (
                    <div key={item.id} className="relative pl-6 group cursor-pointer">
                        {/* Dot */}
                        <div className={`absolute left-0 top-1.5 w-4 h-4 rounded-full border-4 border-zinc-950 bg-${item.color}-500 z-10`}></div>
                        
                        <div className="flex flex-col gap-0.5 p-3 rounded-lg hover:bg-white/5 transition-colors">
                            <span className="text-xs font-mono text-zinc-500">{item.time}</span>
                            <span className="text-sm font-semibold text-zinc-200 group-hover:text-indigo-400 transition-colors">
                                {item.title}
                            </span>
                            <span className="text-xs text-zinc-500 flex items-center gap-1">
                                📍 {item.location}
                            </span>
                        </div>
                    </div>
                ))}

                {/* Add Event Button */}
                <button className="mt-auto w-full py-3 border border-dashed border-zinc-700 rounded-xl text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors flex items-center justify-center gap-2 text-sm">
                    <span>+</span> Add Event
                </button>
            </div>
        </div>
    );
}
