import React, { useState } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Auth = () => {
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:3000/api/login', { email, password });
      localStorage.setItem('token', res.data.token);
      navigate('/');
    } catch (err) {
      alert(err.response?.data?.error || 'Login failed');
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3000/api/forgot-password', { email });
      alert('OTP sent to your email!');
      setOtpSent(true);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send OTP');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3000/api/reset-password', { email, otp, newPassword });
      alert('Password reset successfully! Please login.');
      setIsForgotPassword(false);
      setOtpSent(false);
      setOtp('');
      setNewPassword('');
      setPassword('');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reset password');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3000/api/register', { name, email, password });
      alert('Registration successful! Please login.');
      // Switch back to login form
      document.getElementById('doodle-flip').checked = false;
      setEmail('');
      setPassword('');
    } catch (err) {
      alert(err.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <StyledWrapper>
      <div className="doodle-wrapper">
        <input type="checkbox" id="doodle-flip" className="doodle-toggle" aria-label="Toggle Login and Sign up" onChange={() => setIsForgotPassword(false)} />
        <div className="doodle-header">
          <span className="doodle-mode-text login-text">Log in</span>
          <label className="doodle-switch-label" htmlFor="doodle-flip" tabIndex={0}>
            <span className="doodle-switch-handle" />
          </label>
          <span className="doodle-mode-text signup-text">Sign up</span>
        </div>
        <div className="doodle-card-scene">
          <svg className="doodle-svg doodle-star" viewBox="0 0 24 24" fill="#ffd166" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <svg className="doodle-svg doodle-sparkle" viewBox="0 0 24 24" fill="#06d6a0" stroke="var(--ink)" strokeWidth="1.5">
            <path d="M12 2 Q12 12 22 12 Q12 12 12 22 Q12 12 2 12 Q12 12 12 2 Z" />
          </svg>
          <svg className="doodle-svg doodle-swirl" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round">
            <path d="M3 12 C 3 5 10 5 16 5 C 20 5 21 9 18 12 C 15 15 10 13 12 9 C 14 5 22 9 21 16" />
          </svg>
          <div className="doodle-card-inner">
            <div className="doodle-card-front">
              {!isForgotPassword ? (
                <>
                  <div className="doodle-title">Welcome!</div>
                  <form className="doodle-form" onSubmit={handleLogin}>
                    <div className="doodle-input-wrapper">
                      <input className="doodle-input" value={email} onChange={(e) => setEmail(e.target.value)} name="email" placeholder="Email" type="email" required />
                    </div>
                    <div className="doodle-input-wrapper">
                      <input className="doodle-input" value={password} onChange={(e) => setPassword(e.target.value)} name="password" placeholder="Password" type={showLoginPassword ? 'text' : 'password'} required style={{ paddingRight: '60px' }} />
                      <button type="button" className="password-toggle-btn" onClick={() => setShowLoginPassword(!showLoginPassword)}>
                        {showLoginPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <button className="doodle-btn" type="submit">Let's Go!</button>
                    <button type="button" className="doodle-link" onClick={() => setIsForgotPassword(true)}>Forgot Password?</button>
                  </form>
                </>
              ) : (
                <>
                  <div className="doodle-title" style={{ fontSize: '20px' }}>Reset Password</div>
                  {!otpSent ? (
                    <form className="doodle-form" onSubmit={handleSendOtp}>
                      <div className="doodle-input-wrapper">
                        <input className="doodle-input" value={email} onChange={(e) => setEmail(e.target.value)} name="email" placeholder="Email Address" type="email" required />
                      </div>
                      <button className="doodle-btn" type="submit">Send OTP</button>
                      <button type="button" className="doodle-link" onClick={() => setIsForgotPassword(false)}>Back to Login</button>
                    </form>
                  ) : (
                    <form className="doodle-form" onSubmit={handleResetPassword}>
                      <div className="doodle-input-wrapper">
                        <input className="doodle-input" value={otp} onChange={(e) => setOtp(e.target.value)} name="otp" placeholder="6-digit OTP" type="text" required />
                      </div>
                      <div className="doodle-input-wrapper">
                        <input className="doodle-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} name="newPassword" placeholder="New Password" type="password" required />
                      </div>
                      <button className="doodle-btn" type="submit">Reset</button>
                      <button type="button" className="doodle-link" onClick={() => {setOtpSent(false); setIsForgotPassword(false);}}>Cancel</button>
                    </form>
                  )}
                </>
              )}
            </div>
            <div className="doodle-card-back">
              <div className="doodle-title doodle-title-alt">Join Us!</div>
              <form className="doodle-form" onSubmit={handleRegister}>
                <div className="doodle-input-wrapper">
                  <input className="doodle-input" value={name} onChange={(e) => setName(e.target.value)} name="username" placeholder="Name" type="text" required />
                </div>
                <div className="doodle-input-wrapper">
                  <input className="doodle-input" value={email} onChange={(e) => setEmail(e.target.value)} name="email" placeholder="Email" type="email" required />
                </div>
                <div className="doodle-input-wrapper">
                  <input className="doodle-input" value={password} onChange={(e) => setPassword(e.target.value)} name="password" placeholder="Password" type={showRegisterPassword ? 'text' : 'password'} required style={{ paddingRight: '60px' }} />
                  <button type="button" className="password-toggle-btn" onClick={() => setShowRegisterPassword(!showRegisterPassword)}>
                    {showRegisterPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <button className="doodle-btn doodle-btn-alt" type="submit">Confirm!</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .doodle-wrapper {
    /* Color Palette */
    --ink: #323232;
    --paper-front: #fff9e6;
    --paper-back: #e6f0ff;
    --bg-color: #ffffff;
    --primary-btn: #ff6b6b;
    --primary-btn-hover: #ff5252;
    --secondary-btn: #4ecdc4;
    --secondary-btn-hover: #3bbfb6;
    --switch-bg: #ffe66d;
    --input-focus: #2d8cf0;

    /* Sizing */
    --card-width: 400px;
    --card-height: 500px;
    --input-width: 320px;
    --input-height: 50px;
    --btn-width: 160px;
    --btn-height: 50px;

    --border-width: 2px;
    --shadow-offset: 4px;

    /* Doodle Border Radiuses */
    --sketch-radius-1: 8px 24px 8px 24px / 24px 8px 24px 8px;
    --sketch-radius-2: 24px 8px 24px 8px / 8px 24px 8px 24px;
    --sketch-radius-btn: 16px 5px 16px 5px / 5px 16px 5px 16px;

    font-family: "Comic Sans MS", "Chalkboard SE", "Marker Felt", "Gochi Hand",
      sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    box-sizing: border-box;
    padding: 40px;
  }

  /* Hide Checkbox Visually but keep accessible */
  .doodle-toggle {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  /* Header & Switch */
  .doodle-header {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 25px;
    z-index: 5;
  }

  .doodle-mode-text {
    font-size: 22px;
    font-weight: bold;
    color: var(--ink);
    transition: opacity 0.3s;
  }

  .doodle-toggle:not(:checked) ~ .doodle-header .signup-text {
    opacity: 0.5;
  }
  .doodle-toggle:checked ~ .doodle-header .login-text {
    opacity: 0.5;
  }

  .doodle-switch-label {
    position: relative;
    display: inline-block;
    width: 50px;
    height: 24px;
    background-color: var(--switch-bg);
    border: var(--border-width) solid var(--ink);
    border-radius: 20px;
    cursor: pointer;
    box-shadow: 2px 2px 0px var(--ink);
    transition:
      transform 0.1s,
      box-shadow 0.1s;
  }

  .doodle-switch-label:active {
    transform: translate(2px, 2px);
    box-shadow: 0px 0px 0px var(--ink);
  }

  .doodle-switch-handle {
    position: absolute;
    top: 2px;
    left: 3px;
    width: 16px;
    height: 16px;
    background-color: var(--bg-color);
    border: var(--border-width) solid var(--ink);
    border-radius: 50%;
    transition: transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  }

  .doodle-toggle:checked
    ~ .doodle-header
    .doodle-switch-label
    .doodle-switch-handle {
    transform: translateX(24px);
  }

  /* 3D Scene Setup */
  .doodle-card-scene {
    position: relative;
    perspective: 1000px;
    width: var(--card-width);
    height: var(--card-height);
    z-index: 2;
  }

  /* Decorative SVGs */
  .doodle-svg {
    position: absolute;
    z-index: -1;
    pointer-events: none;
  }
  .doodle-star {
    top: -25px;
    left: -35px;
    width: 48px;
    height: 48px;
    animation: float-star 4s ease-in-out infinite;
  }
  .doodle-sparkle {
    bottom: -20px;
    right: -25px;
    width: 40px;
    height: 40px;
    animation: float-sparkle 4s ease-in-out infinite 1s;
  }
  .doodle-swirl {
    top: 30px;
    right: -30px;
    width: 32px;
    height: 32px;
    animation: float-swirl 4s ease-in-out infinite 2s;
  }

  /* Individual animations to preserve their rotations */
  @keyframes float-star {
    0%,
    100% {
      transform: translateY(0) rotate(-15deg);
    }
    50% {
      transform: translateY(-8px) rotate(-10deg);
    }
  }
  @keyframes float-sparkle {
    0%,
    100% {
      transform: translateY(0) rotate(10deg);
    }
    50% {
      transform: translateY(-8px) rotate(15deg);
    }
  }
  @keyframes float-swirl {
    0%,
    100% {
      transform: translateY(0) rotate(0deg);
    }
    50% {
      transform: translateY(-8px) rotate(5deg);
    }
  }

  /* Card Inner & Faces */
  .doodle-card-inner {
    width: 100%;
    height: 100%;
    position: relative;
    transform-style: preserve-3d;
    transition: transform 0.8s cubic-bezier(0.4, 0.2, 0.2, 1);
  }

  .doodle-toggle:checked ~ .doodle-card-scene .doodle-card-inner {
    transform: rotateY(180deg);
  }

  .doodle-card-front,
  .doodle-card-back {
    position: absolute;
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    box-sizing: border-box;
    border: var(--border-width) solid var(--ink);
    border-radius: var(--sketch-radius-1);
    box-shadow: var(--shadow-offset) var(--shadow-offset) 0px var(--ink);

    /* Lined Notebook Paper Effect */
    background-image: repeating-linear-gradient(
      transparent,
      transparent 28px,
      rgba(0, 0, 0, 0.06) 28px,
      rgba(0, 0, 0, 0.06) 30px
    );
    background-position: 0 15px;
  }

  .doodle-card-front {
    background-color: var(--paper-front);
  }

  .doodle-card-back {
    background-color: var(--paper-back);
    transform: rotateY(180deg);
    border-radius: var(--sketch-radius-2);
  }

  /* Typography & Forms */
  .doodle-title {
    font-size: 32px;
    font-weight: 900;
    color: var(--ink);
    margin: 15px 0 25px 0;
    text-transform: uppercase;
    letter-spacing: 1px;
    transform: rotate(-3deg);
    text-shadow: 1px 1px 0px rgba(0, 0, 0, 0.1);
  }

  .doodle-title-alt {
    transform: rotate(2deg);
    margin: 0px 0 15px 0;
  }

  .doodle-form {
    display: flex;
    flex-direction: column;
    gap: 15px;
    width: 100%;
    align-items: center;
  }

  .doodle-input-wrapper {
    position: relative;
  }

  /* Inputs */
  .doodle-input {
    width: var(--input-width);
    height: var(--input-height);
    padding: 5px 15px;
    box-sizing: border-box;
    font-family: inherit;
    font-size: 18px;
    font-weight: 600;
    color: var(--ink);
    background-color: var(--bg-color);
    border: var(--border-width) solid var(--ink);
    border-radius: var(--sketch-radius-1);
    box-shadow: 3px 3px 0px var(--ink);
    outline: none;
    transition: all 0.2s ease;
  }

  .doodle-input::placeholder {
    color: #666;
    opacity: 0.8;
  }

  .doodle-input:hover {
    transform: translateY(-2px);
    box-shadow: 4px 4px 0px var(--ink);
  }

  .doodle-input:focus,
  .doodle-input:focus-visible {
    border: var(--border-width) solid var(--input-focus);
    border-radius: var(--sketch-radius-2);
    background-color: #fffdf5;
    box-shadow: 4px 4px 0px var(--ink);
  }

  /* Buttons */
  .doodle-btn {
    margin: 10px 0;
    width: var(--btn-width);
    height: var(--btn-height);
    font-family: inherit;
    font-size: 20px;
    font-weight: 900;
    letter-spacing: 1px;
    color: var(--ink);
    background-color: var(--primary-btn);
    border: var(--border-width) solid var(--ink);
    border-radius: var(--sketch-radius-btn);
    box-shadow: 4px 4px 0px var(--ink);
    cursor: pointer;
    transition: all 0.15s ease;
    transform: rotate(-1deg);
  }

  .doodle-btn-alt {
    background-color: var(--secondary-btn);
    transform: rotate(1deg);
  }

  /* Button States */
  .doodle-btn:hover {
    background-color: var(--primary-btn-hover);
    transform: translateY(-2px) rotate(-2deg);
    box-shadow: 5px 5px 0px var(--ink);
  }

  .doodle-btn-alt:hover {
    background-color: var(--secondary-btn-hover);
    transform: translateY(-2px) rotate(2deg);
  }

  .doodle-btn:active {
    transform: translate(3px, 3px) rotate(0deg);
    box-shadow: 0px 0px 0px var(--ink);
  }

  /* Link Button for Forgot Password */
  .doodle-link {
    background: none;
    border: none;
    color: var(--ink);
    font-family: inherit;
    font-size: 16px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    padding: 5px;
    margin-top: -5px;
    transition: all 0.2s ease;
  }

  .doodle-link:hover {
    color: #ff6b6b;
    transform: rotate(-2deg);
  }

  /* Title Wiggle on Hover */
  .doodle-card-scene:hover .doodle-title {
    animation: doodle-wiggle 0.5s ease-in-out;
  }

  @keyframes doodle-wiggle {
    0%,
    100% {
      transform: rotate(-3deg);
    }
    25% {
      transform: rotate(2deg);
    }
    50% {
      transform: rotate(-4deg);
    }
    75% {
      transform: rotate(1deg);
    }
  }

  .password-toggle-btn {
    position: absolute;
    right: 15px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    font-family: inherit;
    font-weight: bold;
    color: var(--ink);
    opacity: 0.7;
    font-size: 14px;
    outline: none;
  }
  .password-toggle-btn:hover {
    opacity: 1;
  }
`;

export default Auth;
