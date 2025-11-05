declare module 'expo-in-app-purchases' {
  export enum IAPResponseCode {
    OK = 0,
    USER_CANCELED = 1,
    SERVICE_UNAVAILABLE = 2,
    BILLING_UNAVAILABLE = 3,
    ITEM_UNAVAILABLE = 4,
    DEVELOPER_ERROR = 5,
    ERROR = 6,
    ITEM_ALREADY_OWNED = 7,
    ITEM_NOT_OWNED = 8,
    DEFERRED = 9
  }

  export type IAPProduct = {
    productId: string;
    title: string;
    description: string;
    price: string;
    priceCurrencyCode?: string;
  };

  export type IAPPurchase = {
    productId: string;
    acknowledged: boolean;
    transactionReceipt?: string | null;
  };

  export type PurchaseListenerResult = {
    responseCode: IAPResponseCode;
    results?: IAPPurchase[];
    errorCode?: string;
  };

  export type PurchaseListener = (result: PurchaseListenerResult) => void;

  export type PurchaseListenerSubscription = {
    remove: () => void;
  };

  export function connectAsync(): Promise<{ responseCode: IAPResponseCode }>;
  export function disconnectAsync(): Promise<void>;
  export function getProductsAsync(
    productIds: string[]
  ): Promise<{ responseCode: IAPResponseCode; results?: IAPProduct[] }>;
  export function requestPurchaseAsync(productId: string): Promise<void>;
  export function setPurchaseListener(listener: PurchaseListener): PurchaseListenerSubscription;
  export function finishTransactionAsync(purchase: IAPPurchase, consumeItem?: boolean): Promise<void>;
  export function getPurchaseHistoryAsync(
    refresh?: boolean
  ): Promise<{ responseCode: IAPResponseCode; results?: IAPPurchase[] }>;
}
