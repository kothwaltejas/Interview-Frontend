import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import styles from './Navbar.module.css';

const Navbar: React.FC = () => {
  const { user, signOut } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    setShowDropdown(false);
    navigate('/');
  };

  const getUserDisplayName = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name;
    }
    return user?.email?.split('@')[0] || 'User';
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        <Link to="/" className={styles.logo}>
          <h2>Intervu AI</h2>
        </Link>
        
        <div className={styles.authButtons}>
          {user ? (
            <div className={styles.userMenu}>
              <button 
                className={styles.userButton}
                onClick={() => setShowDropdown(!showDropdown)}
              >
                <span className={styles.userAvatar}>
                  {getUserDisplayName().charAt(0).toUpperCase()}
                </span>
                <span className={styles.userName}>
                  {getUserDisplayName()}
                </span>
                <span className={styles.dropdownIcon}>▼</span>
              </button>
              
              {showDropdown && (
                <div className={styles.dropdown}>
                  <div className={styles.dropdownItem}>
                    <span className={styles.userEmail}>{user.email}</span>
                  </div>
                  <hr className={styles.dropdownDivider} />
                  <button 
                    className={styles.dropdownItem}
                    onClick={handleSignOut}
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className={styles.loginBtn}>
                Login
              </Link>
              <Link to="/register" className={styles.registerBtn}>
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;