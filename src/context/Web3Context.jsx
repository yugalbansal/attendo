import { createContext, useContext, useState, useEffect } from 'react';
import { connectWallet, saveWalletAddress, hasConnectedWallet } from '../utils/web3Utils';
import { useAuth } from './AuthContext';
import { ethers } from 'ethers';

const Web3Context = createContext();

export function useWeb3() {
  return useContext(Web3Context);
}

export function Web3Provider({ children }) {
  const { user, profile, updateProfile } = useAuth();
  const [walletAddress, setWalletAddress] = useState('');
  const [provider, setProvider] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  // Check if wallet is already connected
  useEffect(() => {
    const checkWalletConnection = async () => {
      if (!window.ethereum) return;

      try {
        // Check if MetaMask is connected
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        
        if (accounts.length > 0) {
          const connectedAddress = accounts[0];
          
          // Create provider
          const newProvider = new ethers.BrowserProvider(window.ethereum);
          setProvider(newProvider);
          
          // If we have a saved address in profile, check if it matches
          if (profile?.wallet_address) {
            if (profile.wallet_address.toLowerCase() === connectedAddress.toLowerCase()) {
              setWalletAddress(connectedAddress);
            } else {
              // Address mismatch - user switched accounts in MetaMask
              console.log('Wallet address mismatch, updating profile...');
              setWalletAddress(connectedAddress);
              if (user?.id) {
                await saveWalletAddress(user.id, connectedAddress);
                updateProfile({ wallet_address: connectedAddress });
              }
            }
          } else {
            // No saved address but wallet is connected
            setWalletAddress(connectedAddress);
            if (user?.id) {
              await saveWalletAddress(user.id, connectedAddress);
              updateProfile({ wallet_address: connectedAddress });
            }
          }
        } else {
          // No accounts connected in MetaMask
          setWalletAddress('');
          setProvider(null);
        }
      } catch (error) {
        console.error('Error checking wallet connection:', error);
        setProvider(null);
        setWalletAddress('');
      }
    };

    if (user) {
      checkWalletConnection();
    }

    // Listen for account changes
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
          // User disconnected wallet
          setWalletAddress('');
          setProvider(null);
        } else {
          // User switched accounts
          const newAddress = accounts[0];
          setWalletAddress(newAddress);
          if (user?.id) {
            saveWalletAddress(user.id, newAddress);
            updateProfile({ wallet_address: newAddress });
          }
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, [user, profile?.wallet_address]);

  // Connect wallet function
  const connectUserWallet = async () => {
    if (!user) {
      setError('Please log in to connect your wallet');
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      // Connect to MetaMask
      const { address, provider: newProvider } = await connectWallet();
      
      // Save wallet address to user profile
      await saveWalletAddress(user.id, address);
      
      // Update local state
      setWalletAddress(address);
      setProvider(newProvider);
      
      // Update profile context
      updateProfile({ wallet_address: address });
      
      return address;
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setError(error.message || 'Failed to connect wallet');
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect wallet function
  const disconnectWallet = () => {
    setWalletAddress('');
    setProvider(null);
    setError(null);
  };

  // Check if wallet is connected
  const isWalletConnected = () => {
    return !!walletAddress && !!provider;
  };

  // Format wallet address for display
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const value = {
    walletAddress,
    provider,
    isConnecting,
    error,
    connectWallet: connectUserWallet,
    disconnectWallet,
    isWalletConnected,
    formatAddress,
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
}
