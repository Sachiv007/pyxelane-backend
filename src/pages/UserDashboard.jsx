import React, { useEffect, useState } from 'react';
import { useNavigate, NavLink, Outlet } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import './UserDashboard.css';

export default function UserDashboard() {
  const navigate = useNavigate();
  const [userPhoto, setUserPhoto] = useState('/default-avatar.png');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [avatarError, setAvatarError] = useState(false);

  const fetchUserData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/login');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    setUsername(user?.user_metadata?.username || '');

    if (user?.user_metadata?.avatar_path) {
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(user.user_metadata.avatar_path);

      const newAvatarUrl = data?.publicUrl
        ? `${data.publicUrl}?t=${Date.now()}`
        : '/default-avatar.png';

      if (userPhoto !== newAvatarUrl) {
        setUserPhoto(newAvatarUrl);
        setAvatarError(false);
      }
    } else {
      if (userPhoto !== '/default-avatar.png') {
        setUserPhoto('/default-avatar.png');
        setAvatarError(false);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    let timeout;
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (!session) {
          navigate('/login');
        } else {
          fetchUserData();
        }
      }, 200);
    });

    fetchUserData();

    return () => {
      clearTimeout(timeout);
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) {
    return <div className="dashboard-loading">Loading...</div>;
  }

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="sidebar">
        {/* Top Section */}
        <div className="sidebar-top">
          <div className="profile-section">
            <h2>{username ? `Welcome, ${username}` : 'My Dashboard'}</h2>
          </div>

          <nav className="sidebar-nav">
            <NavLink
              to="/user"
              end
              className={({ isActive }) =>
                isActive ? 'sidebar-link active' : 'sidebar-link'
              }
            >
              My Account
            </NavLink>
            <NavLink
              to="/user/products"
              className={({ isActive }) =>
                isActive ? 'sidebar-link active' : 'sidebar-link'
              }
            >
              My Products
            </NavLink>
            <NavLink
              to="/user/mystats"
              className={({ isActive }) =>
                isActive ? 'sidebar-link active' : 'sidebar-link'
              }
            >
              My Stats
            </NavLink>
            <NavLink
              to="/"
              className={({ isActive }) =>
                isActive ? 'sidebar-link active' : 'sidebar-link'
              }
            >
              Home
            </NavLink>
          </nav>
        </div>

        {/* Bottom Section (Logout) */}
        <div className="sidebar-bottom">
          <button onClick={handleLogout} className="logout-button">
            Log out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        <Outlet />
      </main>
    </div>
  );
}
