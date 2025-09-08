import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';
import { supabase } from '../supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); // optional for UX
  const navigate = useNavigate();

  const handleForgotPassword = async () => {
    if (!email) {
      alert('Please enter your email address first.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (error) {
      alert('Failed to send reset email: ' + error.message);
    } else {
      alert('Password reset email sent. Check your inbox.');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      alert('Login failed: ' + error.message);
      return;
    }

    if (data.user?.email_confirmed_at) {
      navigate('/user');
    } else {
      alert('Please verify your email before logging in.');
    }
  };

  const goHome = () => {
    navigate('/');
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Login to Your Account</h2>
        <form className="login-form" onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="button" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <button
          type="button"
          className="forgot-password-button"
          onClick={handleForgotPassword}
          disabled={loading}
        >
          Forgot Password?
        </button>
        <br />
        <button onClick={goHome} className="back-button">
          ⬅ Back to Home
        </button>
      </div>
    </div>
  );
}