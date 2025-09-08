import { createContext, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null); // Track user ID to prevent unnecessary updates

  const fetchAvatar = async (user) => {
    if (user?.user_metadata?.avatar_path) {
      const { data, error } = await supabase.storage
        .from("avatars")
        .createSignedUrl(user.user_metadata.avatar_path, 60 * 60);
      if (!error && data?.signedUrl) {
        setAvatarUrl(`${data.signedUrl}&t=${Date.now()}`);
      }
    } else {
      setAvatarUrl(null);
    }
  };

  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.id !== currentUserId) {
      setUser(user);
      setCurrentUserId(user.id);
      await fetchAvatar(user);
    } else if (!user) {
      setUser(null);
      setAvatarUrl(null);
      setCurrentUserId(null);
    }
  };

  useEffect(() => {
    fetchUser(); // initial fetch

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const newUser = session?.user || null;
      if (!newUser) {
        setUser(null);
        setAvatarUrl(null);
        setCurrentUserId(null);
      } else if (newUser.id !== currentUserId) {
        setUser(newUser);
        setCurrentUserId(newUser.id);
        await fetchAvatar(newUser);
      }
    });

    // Only refetch user if tab was hidden for a long time
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchUser();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      listener.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [currentUserId]);

  return (
    <UserContext.Provider value={{ user, setUser, avatarUrl, setAvatarUrl }}>
      {children}
    </UserContext.Provider>
  );
};
