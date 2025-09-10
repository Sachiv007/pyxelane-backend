import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SignUp.css';
import { supabase } from '../supabaseClient';

export default function SignUp() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username }, // Save username to user_metadata
        emailRedirectTo: `${window.location.origin}/login`
      }
    });

    setLoading(false);

    if (error) {
      if (error.message.includes('already registered')) {
        alert('This email is already registered. Try logging in instead.');
      } else {
        console.error('Signup error:', error.message);
        alert(error.message);
      }
    } else {
      alert('Verification email sent. Please check your inbox.');
      navigate('/login');
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-box">
        <h2>Create Your Account</h2>
        <form className="signup-form" onSubmit={handleSignUp}>
          <input
            type="text"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
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
            {loading ? 'Signing Up...' : 'Sign Up'}
          </button>
        </form>

        <button onClick={() => navigate('/')} className="back-button">
          ⬅ Back to Home
        </button>
      </div>
    </div>
  );
}