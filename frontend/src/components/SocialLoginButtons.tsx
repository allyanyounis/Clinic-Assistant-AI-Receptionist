"use client";

export function SocialLoginButtons() {
    return (
        <div className="grid grid-cols-2 gap-4">
            <button className="flex-1 flex items-center justify-center gap-3 px-4 py-2.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all font-medium text-slate-700 active:scale-[0.98]">
                <img 
                    src="https://www.google.com/favicon.ico" 
                    alt="Google" 
                    width={18} 
                    height={18} 
                />
                Google
            </button>
            <button className="flex-1 flex items-center justify-center gap-3 px-4 py-2.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all font-medium text-slate-700 active:scale-[0.98]">
                <img 
                    src="https://www.microsoft.com/favicon.ico" 
                    alt="Microsoft" 
                    width={18} 
                    height={18} 
                />
                Microsoft
            </button>
        </div>
    );
}
