import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import Services from './pages/Services';
import Subscriptions from './pages/Subscriptions';
import Payments from './pages/Payments';
import Expenses from './pages/Expenses';
import Reports from './pages/Reports';

function App() {
  const [isAuth, setIsAuth] = useState(!!localStorage.getItem('token'));

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuth(!!token);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuth(false);
  };

  return (
    <Router>
      <Routes>
        {/* Login Route */}
        <Route 
          path="/login" 
          element={!isAuth ? <Login setIsAuth={setIsAuth} /> : <Navigate to="/" />} 
        />

        {/* Protected Application Routes */}
        <Route
          path="/*"
          element={
            isAuth ? (
              <Layout onLogout={handleLogout}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/members" element={<Members />} />
                  <Route path="/services" element={<Services />} />
                  <Route path="/subscriptions" element={<Subscriptions />} />
                  <Route path="/payments" element={<Payments />} />
                  <Route path="/expenses" element={<Expenses />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;