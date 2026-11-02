import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Whether a staff member is logged in (kept in sync across tabs), plus logout. */
export function useSession() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const session = localStorage.getItem("user_session");
      setIsLoggedIn(!!session);
    };
    checkAuth();
    window.addEventListener("storage", checkAuth);
    return () => window.removeEventListener("storage", checkAuth);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user_session");
    setIsLoggedIn(false);
    router.push("/login");
  };

  return { isLoggedIn, handleLogout };
}
