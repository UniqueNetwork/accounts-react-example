import { init } from '@subwallet-connect/react';
import metamaskSDK from '@subwallet-connect/metamask';
import subwalletModule from '@subwallet-connect/subwallet';
import talismanModule from '@subwallet-connect/talisman';
import polkadot_jsModule from '@subwallet-connect/polkadot-js';
import { TransactionHandlerReturn } from '@subwallet-connect/core/dist/types';

const metamaskSDKWallet = metamaskSDK({
  options: {
    extensionOnly: false,
    i18nOptions: {
      enabled: true
    },
    infuraAPIKey: process.env.REACT_APP_INFURA_KEY,
    dappMetadata: {
      name: 'SubConnect'
    }
  }
});

const subwalletWallet = subwalletModule();
const polkadotWallet = polkadot_jsModule();
const talismanWallet = talismanModule();

export default init({
  theme: 'dark',
  connect: {
    autoConnectLastWallet: true,
    autoConnectAllPreviousWallet: true
  },
  accountCenter: {
    desktop: {
      enabled: false
    },
    mobile: {
      enabled: false
    }
  },
  projectId: process.env.REACT_APP_PROJECT_ID,

  // An array of wallet modules that you would like to be presented to the user to select from when connecting a wallet.
  wallets: [
    subwalletWallet,
    metamaskSDKWallet,
    talismanWallet,
    polkadotWallet,
  ],
  chains: [
    {
      id: '0x22b2', // 8882
      rpcUrl: 'https://rpc-opal.unique.network',
      label: 'OPAL by UNIQUE',
      token: 'OPL',
      namespace: 'evm',
      decimal: 18
    }
  ],
  chainsPolkadot: [
    {
      id: '0xc87870ef90a438d574b8e320f17db372c50f62beb52e479c8ff6ee5b460670b9',
      label: 'Opal',
      decimal: 18,
      namespace: 'substrate',
      token: 'OPL',
      blockExplorerUrl: 'scan.uniquenetwork.dev/opal/'
    }
  ],

  appMetadata: {
    name: 'Unique',
    recommendedInjectedWallets: [
      {
        name: 'MetaMask',
        url: 'https://metamask.io'
      },
      { name: 'Coinbase', url: 'https://wallet.coinbase.com/' }
    ],
    // Optional - but allows for dapps to require users to agree to TOS and privacy policy before connecting a wallet
    agreement: {
      version: '1.0.0',
      termsUrl:
        'https://docs.subwallet.app/main/privacy-and-security/terms-of-use'
    }
  },
  notify: {
    desktop: {
      enabled: true,
      transactionHandler: (transaction): TransactionHandlerReturn => {
        if (transaction.eventCode === 'txConfirmed') {
          return {
            autoDismiss: 0
          };
        }
        // if (transaction.eventCode === 'txPool') {
        //   return {
        //     type: 'hint',
        //     message: 'Your in the pool, hope you brought a towel!',
        //     autoDismiss: 0,
        //     link: `https://goerli.etherscan.io/tx/${transaction.hash}`
        //   }
        // }
      },
      position: 'topCenter'
    }
  }
});