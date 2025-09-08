import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function VerifyEmail() {
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase automatically verifies user when they click the link
    // Just check if user is confirmed/logged in

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && session.user.email_confirmed_at) {
        alert('Your email is verified! You can now login.');
        navigate('/login');
      } else {
        alert('Email not verified or session expired. Please check your email.');
        navigate('/login');
      }
    });
  }, [navigate]);

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Verifying your email, please wait...</h2>
    </div>
  );
}
