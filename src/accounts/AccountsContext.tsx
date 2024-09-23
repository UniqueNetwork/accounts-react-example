import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { SdkContext } from "../sdk/SdkContext";
import { noop } from "../utils/common";
import { Account, AccountsContextValue, SignerTypeEnum } from "./types";
import { useAccount } from "wagmi";
import { Address } from "@unique-nft/utils";
import { ConnectedWalletsName } from "./useWalletCenter";
import { useWalletCenter } from "./useWalletCenter";
import { PolkadotWallet } from "./PolkadotWallet";

/**
 * React context for managing blockchain accounts, including Polkadot and Ethereum wallets.
 * 
 * @remarks
 * This context is responsible for initializing, updating, and clearing accounts, as well as managing account balances.
 */
export const AccountsContext = createContext<AccountsContextValue>({
  accounts: new Map(),
  setAccounts: noop,
  selectedAccountId: 0,
  selectedAccount: undefined,
  setSelectedAccountId: noop,
  setPolkadotAccountsWithBalance: async () => Promise.resolve(),
  updateEthereumWallet: async () => Promise.resolve(),
  reinitializePolkadotAccountsWithBalance: async () => Promise.resolve(),
  clearAccounts: noop,
});

/**
 * Provider component for the AccountsContext, which manages blockchain accounts and their states.
 * 
 * @param {PropsWithChildren} children - The child components that will consume the AccountsContext.
 * 
 * @example
 * ```tsx
 * <AccountsContextProvider>
 *   <App />
 * </AccountsContextProvider>
 * ```
 */
export const AccountsContextProvider = ({ children }: PropsWithChildren) => {
  const { address } = useAccount();
  const [accounts, setAccounts] = useState<Map<string, Account>>(new Map());
  const [selectedAccountId, setSelectedAccountId] = useState<number>(() => {
    const savedId = localStorage.getItem("selectedAccountId");
    return savedId ? Number(savedId) : 0;
  });

  useEffect(() => {
    const savedAccounts = localStorage.getItem("accounts");
    if (!savedAccounts) {
      setAccounts(new Map());
      setSelectedAccountId(0);
    } else {
      try {
        const parsedAccounts = JSON.parse(savedAccounts);
        setAccounts(new Map(parsedAccounts));
      } catch (error) {
        console.error("Failed to restore accounts from localStorage", error);
      }
    }
  }, []);

  useEffect(() => {
    if (accounts.size > 0) {
      localStorage.setItem("accounts", JSON.stringify([...accounts]));
    }
  }, [accounts]);

  const clearAccounts = useCallback(() => {
    localStorage.removeItem("accounts");
    localStorage.removeItem("selectedAccountId");
    setAccounts(new Map());
    setSelectedAccountId(0);
  }, []);

  const selectedAccount = useMemo(
    () => [...accounts.values()][selectedAccountId],
    [selectedAccountId, accounts]
  );

  const { sdk } = useContext(SdkContext);

  useEffect(() => {
    localStorage.setItem("selectedAccountId", String(selectedAccountId));
  }, [selectedAccountId]);

  const updateEthereumWallet = useCallback(async () => {
    if (!sdk || !address) return;

    const ethereumAddress = Address.extract.substrateOrMirrorIfEthereumNormalized(address);
    const account: Account = { address, signerType: SignerTypeEnum.Ethereum, name: '', signer: undefined, normalizedAddress: '', sign: undefined };

    const balanceResponse = await sdk.balance.get({ address: ethereumAddress });
    account.balance = Number(balanceResponse.available) / Math.pow(10, Number(balanceResponse.decimals));

    setAccounts((prevAccounts) => {
      const newAccounts = new Map(prevAccounts);
      newAccounts.set(ethereumAddress, { ...account, balance: account.balance });
      return newAccounts;
    });
  }, [sdk, address]);

  useEffect(() => {
    updateEthereumWallet();
  }, [updateEthereumWallet]);

  const reinitializePolkadotAccountsWithBalance = useCallback(async () => {
    if (!sdk || accounts.size === 0) return;
  
    const updatedPolkadotAccounts = new Map();
    for (let [address, account] of accounts) {
      if (account.signerType === SignerTypeEnum.Polkadot) {
        try {
          const polkadotWallet = new PolkadotWallet(account.walletType);
          const walletAccounts = await polkadotWallet.getAccounts();
          const walletAccount = walletAccounts.get(account.normalizedAddress);
          if (walletAccount) {
            account.signer = walletAccount.signer;
            const balanceResponse = await sdk.balance.get({ address });
            account.balance = Number(balanceResponse.available) / Math.pow(10, Number(balanceResponse.decimals));
            updatedPolkadotAccounts.set(address, account);
          }
        } catch (e) {
          console.error(`Failed to reinitialize Polkadot account ${address}:`, e);
        }
      }
    }

    setAccounts((prevAccounts) => {
      const newAccounts = new Map(prevAccounts);
      updatedPolkadotAccounts.forEach((account, address) => {
        newAccounts.set(address, account);
      });
  
      return newAccounts;
    });
  }, [sdk, accounts]);
  
  useEffect(() => {
    if (!reinitializePolkadotAccountsWithBalance) return;
    reinitializePolkadotAccountsWithBalance();
  }, [sdk]);

  const { connectWallet } = useWalletCenter();

  const setPolkadotAccountsWithBalance = useCallback(async (walletName: ConnectedWalletsName = 'polkadot-js') => {
    if (!sdk) return;

    const polkadotAccounts = await connectWallet(walletName);
    if (polkadotAccounts.size === 0) {
      alert(`No ${walletName} accounts found or access denied for this domain`);
      throw new Error(`No ${walletName} accounts found or access denied for this domain`);
    }

    for (let [address, account] of polkadotAccounts) {
      account.signerType = SignerTypeEnum.Polkadot;
      const balanceResponse = await sdk.balance.get({ address });
      account.balance = Number(balanceResponse.available) / Math.pow(10, Number(balanceResponse.decimals));
      polkadotAccounts.set(address, account);
    }

    setAccounts((prevAccounts) => {
      const accountsToUpdate = new Map([...prevAccounts, ...polkadotAccounts]);
      return accountsToUpdate;
    });
  }, [sdk]);

  useEffect(() => {
    if (!address) {
      setAccounts((prevAccounts) => {
        const newAccounts = new Map(prevAccounts);
        for (let [key, account] of newAccounts) {
          if (account.signerType === SignerTypeEnum.Ethereum) {
            newAccounts.delete(key);
          }
        }
        return newAccounts;
      });

      const savedAccounts = localStorage.getItem("accounts");
      if (savedAccounts) {
        try {
          const parsedAccounts: [string, Account][] = JSON.parse(savedAccounts);
          const filteredAccounts = parsedAccounts.filter(
            ([, account]) => account.signerType !== SignerTypeEnum.Ethereum
          );
          localStorage.setItem("accounts", JSON.stringify(filteredAccounts));
        } catch (error) {
          console.error("Failed to filter Ethereum accounts from localStorage", error);
        }
      }
    }
  }, [address]);

  const contextValue = useMemo(
    () => ({
      accounts,
      setAccounts,
      selectedAccountId,
      setSelectedAccountId,
      selectedAccount,
      setPolkadotAccountsWithBalance,
      updateEthereumWallet,
      reinitializePolkadotAccountsWithBalance,
      clearAccounts,
    }),
    [
      accounts,
      setPolkadotAccountsWithBalance,
      selectedAccountId,
      setSelectedAccountId,
      selectedAccount,
      updateEthereumWallet,
      reinitializePolkadotAccountsWithBalance,
      clearAccounts,
    ]
  );

  return (
    <AccountsContext.Provider value={contextValue}>
      {children}
    </AccountsContext.Provider>
  );
};
