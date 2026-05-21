import React, { createContext, useContext, useState, useEffect } from 'react';

type User = { id: string; email: string; name: string };
type Workspace = { id: string; name: string };

interface AuthState {
  user: User | null;
  workspace: Workspace | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User, workspace: Workspace | null) => void;
  logout: () => void;
  setWorkspace: (ws: Workspace) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspaceState] = useState<Workspace | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    const storedWorkspace = localStorage.getItem('workspace');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      if (storedWorkspace) {
        setWorkspaceState(JSON.parse(storedWorkspace));
      }
    }
    setIsLoading(false);
  }, []);

  const login = (newToken: string, newUser: User, newWorkspace: Workspace | null) => {
    setToken(newToken);
    setUser(newUser);
    setWorkspaceState(newWorkspace);
    
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    if (newWorkspace) {
      localStorage.setItem('workspace', JSON.stringify(newWorkspace));
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setWorkspaceState(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('workspace');
  };

  const setWorkspace = (ws: Workspace) => {
    setWorkspaceState(ws);
    localStorage.setItem('workspace', JSON.stringify(ws));
  };

  return (
    <AuthContext.Provider value={{ user, workspace, token, isLoading, login, logout, setWorkspace }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
