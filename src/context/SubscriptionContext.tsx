import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { Platform } from 'react-native';
import {
  endConnection,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Product,
  type Purchase,
  type PurchaseError
} from 'react-native-iap';
import { SUBSCRIPTION_PRODUCT_IDS } from '../constants/subscriptions';

type SubscriptionProduct = {
  productId: string;
  title: string;
  description: string;
  price: string;
  priceString?: string;
};

type SubscriptionContextValue = {
  products: SubscriptionProduct[];
  isConnected: boolean;
  supported: boolean;
  loadingProducts: boolean;
  purchaseInProgress: boolean;
  restoreInProgress: boolean;
  activeReceipt: string | null;
  error: string | null;
  purchaseSubscription: (productId: string) => Promise<void>;
  restorePurchases: () => Promise<void>;
  clearError: () => void;
};

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<SubscriptionProduct[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [supported, setSupported] = useState(Platform.OS === 'ios' || Platform.OS === 'android');
  const [purchaseInProgress, setPurchaseInProgress] = useState(false);
  const [restoreInProgress, setRestoreInProgress] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const purchaseUpdateSubscription = useRef<ReturnType<typeof purchaseUpdatedListener> | null>(null);
  const purchaseErrorSubscription = useRef<ReturnType<typeof purchaseErrorListener> | null>(null);

  const disconnectAsync = useCallback(async () => {
    purchaseUpdateSubscription.current?.remove();
    purchaseUpdateSubscription.current = null;
    purchaseErrorSubscription.current?.remove();
    purchaseErrorSubscription.current = null;
    setIsConnected(false);
    setProducts([]);
    try {
      await endConnection();
    } catch (err) {
      console.warn('[IAP] endConnection failed', err);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    if (!supported) {
      return;
    }
    setLoadingProducts(true);
    try {
      const fetched = (await fetchProducts({ skus: SUBSCRIPTION_PRODUCT_IDS, type: 'subs' })) as
        | Product[]
        | null;
      const mapped =
        fetched?.map((item: Product) => {
          const formattedPrice = item.displayPrice ?? '';
          return {
            productId: item.id,
            title: item.title,
            description: item.description,
            price: formattedPrice,
            priceString: formattedPrice
          };
        }) ?? [];
      setProducts(mapped);
      if (!mapped.length) {
        setError('Nenhum plano disponível no momento. Verifique os produtos configurados na loja.');
      }
    } catch (err) {
      console.warn('[IAP] load products error', err);
      setProducts([]);
      setError('Erro ao carregar planos. Verifique sua conexão e tente novamente.');
    } finally {
      setLoadingProducts(false);
    }
  }, [supported]);

  const refreshPurchaseHistory = useCallback(async () => {
    if (!supported) {
      return;
    }
    try {
      const purchases = await getAvailablePurchases();
      const subscriptionPurchase = purchases?.find(item =>
        SUBSCRIPTION_PRODUCT_IDS.includes(item.productId)
      );
      const receipt =
        subscriptionPurchase?.purchaseToken ??
        subscriptionPurchase?.transactionId ??
        subscriptionPurchase?.id ??
        null;
      setActiveReceipt(receipt ?? null);
    } catch (err) {
      console.warn('[IAP] purchase history error', err);
    }
  }, [supported]);

  const handlePurchaseUpdate = useCallback(
    async (purchase: Purchase) => {
      const receipt = purchase.purchaseToken ?? purchase.transactionId ?? purchase.id ?? null;
      if (receipt) {
        setActiveReceipt(receipt);
      }
      await finishTransaction({ purchase, isConsumable: false });
    },
    []
  );

  useEffect(() => {
    let isMounted = true;
    const initialize = async () => {
      if (!supported) {
        setLoadingProducts(false);
        return;
      }
      try {
        setLoadingProducts(true);
        const connected = await initConnection();
        if (!connected) {
          setSupported(false);
          setError('Não foi possível conectar à loja de assinaturas. Tente novamente mais tarde.');
          return;
        }
        setIsConnected(true);
        purchaseUpdateSubscription.current = purchaseUpdatedListener(async purchase => {
          try {
            await handlePurchaseUpdate(purchase);
          } catch (finishError) {
            console.warn('[IAP] finish transaction error', finishError);
          } finally {
            setPurchaseInProgress(false);
          }
        });
        purchaseErrorSubscription.current = purchaseErrorListener((purchaseError: PurchaseError) => {
          console.warn('[IAP] purchase error', purchaseError);
          setError(
            purchaseError.message || 'Não foi possível concluir a compra. Tente novamente mais tarde.'
          );
          setPurchaseInProgress(false);
        });
        await loadProducts();
        await refreshPurchaseHistory();
      } catch (errorConnect) {
        console.warn('[IAP] initialization error', errorConnect);
        setSupported(false);
        setError('Não foi possível inicializar o serviço de assinaturas.');
      } finally {
        if (isMounted) {
          setLoadingProducts(false);
        }
      }
    };

    if (Platform.OS !== 'web') {
      void initialize();
    } else {
      setLoadingProducts(false);
    }

    return () => {
      isMounted = false;
      void disconnectAsync();
    };
  }, [disconnectAsync, handlePurchaseUpdate, loadProducts, refreshPurchaseHistory, supported]);

  const purchaseSubscription = useCallback(
    async (productId: string) => {
      if (!supported || !isConnected) {
        setError('Assinaturas indisponíveis no momento. Tente novamente mais tarde.');
        return;
      }
      try {
        setPurchaseInProgress(true);
        await requestPurchase({
          type: 'subs',
          request: {
            android: {
              skus: [productId]
            },
            ios: {
              sku: productId
            }
          }
        });
      } catch (err) {
        console.warn('[IAP] request purchase error', err);
        setError('Erro ao iniciar a compra. Verifique sua conexão e tente novamente.');
        setPurchaseInProgress(false);
      }
    },
    [isConnected, supported]
  );

  const restorePurchases = useCallback(async () => {
    if (!supported || !isConnected) {
      setError('Assinaturas indisponíveis no momento. Tente novamente mais tarde.');
      return;
    }
    try {
      setRestoreInProgress(true);
      await refreshPurchaseHistory();
    } catch (err) {
      console.warn('[IAP] restore error', err);
      setError('Não foi possível restaurar suas assinaturas. Tente novamente.');
    } finally {
      setRestoreInProgress(false);
    }
  }, [isConnected, refreshPurchaseHistory, supported]);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      products,
      isConnected,
      supported,
      loadingProducts,
      purchaseInProgress,
      restoreInProgress,
      activeReceipt,
      error,
      purchaseSubscription,
      restorePurchases,
      clearError
    }),
    [
      products,
      isConnected,
      supported,
      loadingProducts,
      purchaseInProgress,
      restoreInProgress,
      activeReceipt,
      error,
      purchaseSubscription,
      restorePurchases,
      clearError
    ]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
