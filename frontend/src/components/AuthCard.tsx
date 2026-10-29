"use client";

import { useState } from "react";
import { Eye, EyeOff, Stethoscope } from "lucide-react";
import { SocialLoginButtons } from "./SocialLoginButtons";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/config";

export function AuthCard() {
    const router = useRouter();
    const [isSignIn, setIsSignIn] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: ""
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        
        try {
            const endpoint = isSignIn ? "/auth/login" : "/auth/signup";
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(isSignIn ? {
                    email: formData.email,
                    password: formData.password
                } : {
                    name: formData.name,
                    email: formData.email,
                    password: formData.password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || "Something went wrong. Please try again.");
            }

            // Save real user session
            localStorage.setItem("user_session", JSON.stringify(data));
            
            // Redirect to dashboard
            router.push("/");
            // Force a storage event for other components (like Header)
            window.dispatchEvent(new Event("storage"));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="w-full max-w-[440px] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-white/20">
            {/* Tabs */}
            <div className="flex border-b border-slate-100 mb-8 relative">
                <button 
                    onClick={() => setIsSignIn(true)}
                    className={`flex-1 pb-4 text-sm font-semibold transition-colors relative ${isSignIn ? "text-slate-900" : "text-slate-400 hover:text-slate-600"}`}
                >
                    Sign In
                    {isSignIn && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B2635] rounded-full" />}
                </button>
                <button 
                    onClick={() => setIsSignIn(false)}
                    className={`flex-1 pb-4 text-sm font-semibold transition-colors relative ${!isSignIn ? "text-slate-900" : "text-slate-400 hover:text-slate-600"}`}
                >
                    Sign Up
                    {!isSignIn && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B2635] rounded-full" />}
                </button>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-100 flex items-center gap-2 text-red-600 text-sm animate-in fade-in slide-in-from-top-1 duration-200">
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {error}
                </div>
            )}

            {/* Form */}
            <form className="space-y-5" onSubmit={handleSubmit}>
                {!isSignIn && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                        <input 
                            type="text" 
                            name="name"
                            required
                            value={formData.name}
                            onChange={handleInputChange}
                            placeholder="Enter your full name"
                            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#8B2635]/20 focus:border-[#8B2635] transition-all bg-white text-slate-900"
                        />
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
                    <input 
                        type="email" 
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="Enter your email"
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#8B2635]/20 focus:border-[#8B2635] transition-all bg-white text-slate-900"
                    />
                </div>

                <div>
                    <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-sm font-medium text-slate-700">Password</label>
                        {isSignIn && (
                            <button type="button" className="text-xs font-medium text-slate-500 hover:text-[#8B2635] transition-colors">
                                Forgot Password?
                            </button>
                        )}
                    </div>
                    <div className="relative">
                        <input 
                            type={showPassword ? "text" : "password"} 
                            name="password"
                            required
                            value={formData.password}
                            onChange={handleInputChange}
                            placeholder="Enter your password"
                            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#8B2635]/20 focus:border-[#8B2635] transition-all bg-white text-slate-900"
                        />
                        <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#53131D] hover:bg-[#6B1925] text-white font-semibold py-3 rounded-lg shadow-md transition-all active:scale-[0.98] mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? "Processing..." : (isSignIn ? "Sign In" : "Create Account")}
                </button>
            </form>

            <div className="mt-6 text-center">
                <p className="text-sm text-slate-500">
                    {isSignIn ? "Don't have an account? " : "Already have an account? "}
                    <button 
                        onClick={() => setIsSignIn(!isSignIn)}
                        className="text-[#8B2635] font-semibold hover:underline"
                    >
                        {isSignIn ? "Sign up" : "Sign in"}
                    </button>
                </p>
            </div>

            {/* Divider */}
            <div className="relative my-8 text-center">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-100"></div>
                </div>
                <span className="relative px-4 text-xs font-medium text-slate-400 bg-white/95">or sign in with</span>
            </div>

            <SocialLoginButtons />
        </div>
    );
}
