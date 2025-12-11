import React, { createContext, useContext } from 'react';
import useAppContext from './useAppContext';

const AppContext = createContext(null);

export function useApp() {
    return useContext(AppContext);
}

export function AppProvider({ children }) {
    const contextValue = useAppContext();

    // Dev-only exposure removed; keep provider return below.

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
}

export default AppContext;