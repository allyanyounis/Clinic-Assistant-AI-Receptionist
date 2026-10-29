"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    useEffect(() => {
        const checkAuth = () => {
            const session = localStorage.getItem("user_session");
            const isAuth = !!session;
            setIsAuthenticated(isAuth);

            if (!isAuth && pathname !== "/login") {
                router.push("/login");
            } else if (isAuth && pathname === "/login") {
                router.push("/");
            }
        };

        checkAuth();
        
        // Listen for storage changes (optional but good for multi-tab)
        window.addEventListener("storage", checkAuth);
        return () => window.removeEventListener("storage", checkAuth);
    }, [pathname, router]);

    // Prevent splash of content during check
    if (isAuthenticated === null && pathname !== "/login") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8B2635]"></div>
            </div>
        );
    }

    return <>{children}</>;
}
