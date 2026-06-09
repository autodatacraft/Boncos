import Constants from "expo-constants";
import { Platform } from "react-native";

declare const require: any;

type RevenueCatResult = {
  revenuecat_app_user_id?: string;
  entitlement_id?: string;
  active_entitlements?: string[];
  used_mock: boolean;
};

const PLAN_ENTITLEMENTS: Record<string, string> = {
  AMERICANO: "boncos_americano",
  KOPI_GULA_AREN: "boncos_kopi_gula_aren",
  V60: "boncos_v60",
};

function getExtra() {
  return (Constants.expoConfig?.extra ?? Constants.manifest2?.extra ?? {}) as Record<string, any>;
}

function getApiKey() {
  const extra = getExtra();
  if (Platform.OS === "ios") return extra.revenueCatIosApiKey || process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || "";
  if (Platform.OS === "android") return extra.revenueCatAndroidApiKey || process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || "";
  return extra.revenueCatWebApiKey || process.env.EXPO_PUBLIC_REVENUECAT_WEB_API_KEY || "";
}

function loadPurchases() {
  try {
    return require("react-native-purchases")?.default || require("react-native-purchases");
  } catch {
    return null;
  }
}

function activeEntitlementsFromCustomerInfo(customerInfo: any) {
  const active = customerInfo?.entitlements?.active || {};
  return Object.keys(active);
}

export async function purchaseBoncosPlan(planId: string, userId?: string): Promise<RevenueCatResult> {
  const entitlementId = PLAN_ENTITLEMENTS[planId];
  const apiKey = getApiKey();
  const Purchases = loadPurchases();

  if (!entitlementId || !apiKey || !Purchases) {
    return {
      revenuecat_app_user_id: userId,
      entitlement_id: entitlementId,
      active_entitlements: entitlementId ? [entitlementId] : [],
      used_mock: true,
    };
  }

  if (!Purchases.isConfigured?.()) {
    Purchases.configure({ apiKey, appUserID: userId });
  }

  const offerings = await Purchases.getOfferings();
  const availablePackages = offerings?.current?.availablePackages || [];
  const targetPackage =
    availablePackages.find((pkg: any) => String(pkg.identifier || "").toUpperCase().includes(planId)) ||
    availablePackages.find((pkg: any) => String(pkg.product?.identifier || "").toUpperCase().includes(planId));

  if (!targetPackage) {
    throw new Error("RevenueCat offering package belum tersedia untuk plan ini.");
  }

  const purchase = await Purchases.purchasePackage(targetPackage);
  const active_entitlements = activeEntitlementsFromCustomerInfo(purchase?.customerInfo);

  return {
    revenuecat_app_user_id: userId,
    entitlement_id: entitlementId,
    active_entitlements,
    used_mock: false,
  };
}
